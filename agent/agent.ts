// agent/agent.ts — Main agent orchestrator
// Implements the full agent loop: understand → plan → execute tools → verify → respond

import { v4 as uuid } from 'uuid';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { toolRegistry } from '@/tools/registry';
import { selectProvider, executeWithFailover } from '@/models/router';
import { routeRequest } from './router';
import { buildSystemPrompt } from './planner';
import { executeToolCall, type ExecutionContext } from './executor';
import { ShortTermMemory, ToolStateMemory } from './memory';
import type { AgentEvent, ModelMessage, TaskState, ToolCall } from '@/lib/schemas';
import type { ModelProvider } from '@/models/types';

// Tool initialization
import { registerGmailTools } from '@/tools/google/gmail';
import { registerDriveTools } from '@/tools/google/drive';
import { registerDocsTools } from '@/tools/google/docs';
import { registerSheetsTools } from '@/tools/google/sheets';
import { registerNotionTools } from '@/tools/notion';
import { registerVercelTools } from '@/tools/vercel';
import { registerGitHubTools } from '@/tools/github';
import { registerCalculatorTools } from '@/tools/calculator';
import { registerBrowserTools } from '@/browser/browser-agent';
import { initializeMCP } from '@/mcp/registry';

let initialized = false;

/**
 * Initialize all tools and integrations.
 * Called once on first request.
 */
export async function initializeAgent(): Promise<void> {
  if (initialized) return;

  logger.info('Agent', 'Initializing Murmur Agent...');

  // Register built-in tools
  registerGmailTools();
  registerDriveTools();
  registerDocsTools();
  registerSheetsTools();
  registerNotionTools();
  registerVercelTools();
  registerGitHubTools();
  registerCalculatorTools();
  registerBrowserTools();

  // Discover and register MCP tools
  try {
    const mcpResult = await initializeMCP();
    if (mcpResult.connected) {
      logger.info('Agent', `MCP connected: ${mcpResult.toolCount} tools discovered`);
    } else {
      logger.warn('Agent', `MCP not connected: ${mcpResult.error || 'unknown'}`);
    }
  } catch (err) {
    logger.warn('Agent', 'MCP initialization failed', { error: String(err) });
  }

  logger.info('Agent', `Agent initialized with ${toolRegistry.size} tools`);
  initialized = true;
}

// Per-conversation memory stores
const conversationMemory = new Map<string, ShortTermMemory>();

/**
 * Process a user message through the full agent loop.
 */
export async function processMessage(
  message: string,
  conversationId: string,
  emit: (event: AgentEvent) => void,
  modelPreference?: string,
  signal?: AbortSignal
): Promise<{ content: string; model: string; taskState: TaskState }> {
  await initializeAgent();

  const taskId = uuid();
  const taskState: TaskState = {
    id: taskId,
    request: message,
    status: 'running',
    model: '',
    steps: [],
    toolCalls: [],
    errors: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Emit agent started
  emit({
    type: 'agent_started',
    timestamp: new Date().toISOString(),
    data: { taskId },
  });

  // Get or create conversation memory
  if (!conversationMemory.has(conversationId)) {
    conversationMemory.set(conversationId, new ShortTermMemory());
  }
  const memory = conversationMemory.get(conversationId)!;
  const toolState = new ToolStateMemory();

  // Route the request
  const route = routeRequest(message);

  // Select model provider
  let provider: ModelProvider;
  try {
    provider = await selectProvider(
      modelPreference || 'auto',
      message
    );
    taskState.model = provider.metadata.id;

    emit({
      type: 'model_selected',
      timestamp: new Date().toISOString(),
      data: { model: provider.metadata.name, taskId },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    taskState.status = 'failed';
    taskState.errors.push(error);
    emit({
      type: 'agent_error',
      timestamp: new Date().toISOString(),
      data: { error, taskId },
    });
    return { content: `I couldn't process your request: ${error}`, model: 'none', taskState };
  }

  // Add user message to memory
  memory.add({ role: 'user', content: message });

  // Build system prompt with current tools
  const systemPrompt = buildSystemPrompt();

  // Get available tools for the model
  const availableTools = toolRegistry.getAllDefinitions();

  const ctx: ExecutionContext = { emit, signal };

  // === AGENT LOOP ===
  let stepCount = 0;
  const maxSteps = env.agent.maxSteps;
  const maxToolCalls = env.agent.maxToolCalls;
  let totalToolCalls = 0;
  const startTime = Date.now();

  try {
    while (stepCount < maxSteps) {
      stepCount++;

      // Check cancellation signal
      if (signal?.aborted) {
        logger.info('Agent', 'Task terminated by user signal');
        taskState.status = 'cancelled';
        emit({
          type: 'agent_text',
          timestamp: new Date().toISOString(),
          data: { text: '⏹ Action terminated by user.', taskId },
        });
        return {
          content: '⏹ Action terminated by user.',
          model: provider.metadata.name,
          taskState,
        };
      }

      // Check execution time limit
      if (Date.now() - startTime > env.agent.maxExecutionTime) {
        logger.warn('Agent', 'Execution time limit reached');
        break;
      }

      // Call the model with automated failover circuit
      const messages = memory.getAll();

      emit({
        type: 'agent_thinking',
        timestamp: new Date().toISOString(),
        data: { taskId, status: 'Thinking...' },
      });

      let response;
      try {
        const result = await executeWithFailover(
          messages,
          {
            tools: availableTools.length > 0 ? availableTools : undefined,
            systemPrompt,
            temperature: 0.3,
          },
          provider,
          message,
          (fromId, toId, reason) => {
            emit({
              type: 'model_selected',
              timestamp: new Date().toISOString(),
              data: {
                model: `${toId} (Auto-switched: ${reason})`,
                taskId,
              },
            });
          }
        );
        response = result.response;
        provider = result.providerUsed;
        taskState.model = provider.metadata.id;
      } catch (loopError) {
        const error = loopError instanceof Error ? loopError.message : String(loopError);
        taskState.status = 'failed';
        taskState.errors.push(error);
        emit({
          type: 'agent_error',
          timestamp: new Date().toISOString(),
          data: { error, taskId },
        });
        return {
          content: `I'm unable to complete this task right now: ${error}`,
          model: taskState.model,
          taskState,
        };
      }

      // If the model returned tool calls, execute them
      if (response.toolCalls && response.toolCalls.length > 0 && totalToolCalls < maxToolCalls) {
        // Add assistant message with tool calls to memory
        memory.add({
          role: 'assistant',
          content: response.content || '',
          toolCalls: response.toolCalls,
        });

        // Execute each tool call
        for (const toolCall of response.toolCalls) {
          if (totalToolCalls >= maxToolCalls) {
            logger.warn('Agent', 'Tool call limit reached');
            break;
          }
          totalToolCalls++;

          const result = await executeToolCall(toolCall, ctx);
          toolState.set(result.toolCallId, result);
          taskState.toolCalls.push(result);

          // Add tool result to memory so the model can see it
          memory.add({
            role: 'tool',
            content: result.success
              ? JSON.stringify(result.result)
              : `ERROR: ${result.error}`,
            toolCallId: toolCall.id,
            toolName: toolCall.tool,
          });
        }

        // Continue the loop — the model will see tool results and decide what's next
        continue;
      }

      // No tool calls — the model is done
      const finalContent = response.content || 'Task completed.';

      // Add final assistant message to memory
      memory.add({ role: 'assistant', content: finalContent });

      // Emit text
      emit({
        type: 'agent_text',
        timestamp: new Date().toISOString(),
        data: { text: finalContent, taskId },
      });

      // Complete
      taskState.status = 'completed';
      taskState.result = finalContent;
      taskState.completedAt = new Date().toISOString();
      taskState.updatedAt = new Date().toISOString();

      emit({
        type: 'agent_completed',
        timestamp: new Date().toISOString(),
        data: { taskId },
      });

      return { content: finalContent, model: provider.metadata.id, taskState };
    }

    // Reached step limit
    const lastMessages = memory.getAll();
    const lastAssistantMsg = lastMessages.filter((m) => m.role === 'assistant').pop();
    const content = lastAssistantMsg?.content || 'I reached the maximum number of steps. Here is what I accomplished so far.';

    taskState.status = 'completed';
    taskState.result = content;
    taskState.completedAt = new Date().toISOString();

    emit({
      type: 'agent_completed',
      timestamp: new Date().toISOString(),
      data: { taskId },
    });

    return { content, model: provider.metadata.id, taskState };

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Agent', 'Agent loop error', { error });
    taskState.status = 'failed';
    taskState.errors.push(error);

    emit({
      type: 'agent_error',
      timestamp: new Date().toISOString(),
      data: { error, taskId },
    });

    return {
      content: `An error occurred while processing your request: ${error}`,
      model: taskState.model,
      taskState,
    };
  }
}
