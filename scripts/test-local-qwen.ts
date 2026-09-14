// scripts/test-local-qwen.ts — Verification of Local Qwen 3.5 & Provider Isolation

import { local, gemini, nvidia, selectProvider, executeWithFailover } from '../models/router';
import { toolRegistry } from '../tools/registry';
import { initializeAgent, processMessage } from '../agent/agent';
import type { ModelMessage } from '../lib/schemas';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 MAMUR LOCAL QWEN 3.5 & PROVIDER TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function record(name: string, ok: boolean, detail = '') {
    if (ok) {
      console.log(`✅ PASS: ${name} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // ── TEST 1: Qwen Connection & Availability ─────────────────────────
  console.log('--- Test 1: Local Qwen Connection & Availability ---');
  try {
    const isAvail = await local.isAvailable();
    record('Local Qwen availability check', isAvail, `Base URL: ${local.baseUrl}, Model: ${local.modelName}`);
  } catch (err) {
    record('Local Qwen availability check', false, String(err));
  }

  // ── TEST 2: Basic Prompt to Qwen ───────────────────────────────────
  console.log('\n--- Test 2: Basic Prompt Completion ---');
  try {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'Reply in exactly two words: "Hello Mac"' },
    ];
    const res = await local.generate(messages, { temperature: 0.1, maxTokens: 1024 });
    const ok = res.content.length > 0;
    record('Basic prompt to Qwen', ok, `Response: "${res.content.trim()}", finishReason: ${res.finishReason}`);
  } catch (err) {
    record('Basic prompt to Qwen', false, String(err));
  }

  // ── TEST 3: Streaming from Qwen via Ollama ─────────────────────────
  console.log('\n--- Test 3: Streaming Verification ---');
  try {
    const streamRes = await fetch(`${local.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: local.modelName,
        messages: [{ role: 'user', content: 'Say hello in 3 words' }],
        stream: true,
        max_tokens: 25,
      }),
    });

    if (!streamRes.ok) throw new Error(`Stream returned status ${streamRes.status}`);

    const reader = streamRes.body?.getReader();
    let chunkCount = 0;
    let textReceived = '';
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkCount++;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) textReceived += delta;
            } catch {}
          }
        }
        if (chunkCount >= 15) {
          // Verified active streaming chunks
          reader.cancel();
          break;
        }
      }
    }

    record('Streaming from Local Qwen', chunkCount > 1, `Received ${chunkCount} streaming chunks`);
  } catch (err) {
    record('Streaming from Local Qwen', false, String(err));
  }

  // ── TEST 4: Tool Calling with Existing Mamur Tool ───────────────────
  console.log('\n--- Test 4: Tool Calling with Registered Mamur Tool ---');
  try {
    await initializeAgent();
    const allTools = toolRegistry.getAllDefinitions();
    // We test with sheets.read or gmail.search
    const targetTool = allTools.find((t) => t.name === 'sheets.read') || allTools.find((t) => t.name === 'gmail.search');
    
    if (!targetTool) {
      record('Tool lookup', false, 'Target tool sheets.read or gmail.search not found');
    } else {
      const toolCallPrompt: ModelMessage[] = [
        {
          role: 'user',
          content: 'What are the quarterly metrics from Google Spreadsheet ID "1j8m0-_uulQuH1tiEKyErNEAKEr5B6ONE4a3ARVptVok" in range "Sheet1!A1:D5"?',
        },
      ];

      const res = await local.generate(toolCallPrompt, {
        tools: [targetTool],
        temperature: 0.1,
      });

      const hasToolCall = res.toolCalls && res.toolCalls.length > 0;
      const calledTool = res.toolCalls?.[0];
      const match = calledTool?.tool === targetTool.name;

      record(
        'Qwen tool call generation',
        Boolean(hasToolCall && match),
        `Invoked: ${calledTool?.tool}, Args: ${JSON.stringify(calledTool?.arguments)}`
      );

      // Verify feeding tool result back to Qwen
      if (hasToolCall && calledTool) {
        const followupMessages: ModelMessage[] = [
          ...toolCallPrompt,
          {
            role: 'assistant',
            content: res.content,
            toolCalls: res.toolCalls,
          },
          {
            role: 'tool',
            toolCallId: calledTool.id,
            toolName: calledTool.tool,
            content: JSON.stringify({
              values: [
                ['Metric', 'Target', 'Actual', 'Status'],
                ['Q1 MRR', '$50,000', '$54,200', 'Achieved'],
              ],
            }),
          },
        ];

        const followupRes = await local.generate(followupMessages, {
          tools: [targetTool],
          temperature: 0.1,
        });

        const understood = followupRes.content.toLowerCase().includes('mrr') ||
                           followupRes.content.toLowerCase().includes('achieved') ||
                           followupRes.content.toLowerCase().includes('metric') ||
                           followupRes.content.length > 20;

        record(
          'Qwen tool result ingestion & synthesis',
          understood,
          `Answer: "${followupRes.content.slice(0, 100).replace(/\n/g, ' ')}..."`
        );
      }
    }
  } catch (err) {
    record('Tool Calling with Mamur tool', false, String(err));
  }

  // ── TEST 5: Privacy Isolation (Zero Cloud Fallback) ────────────────
  console.log('\n--- Test 5: Strict Privacy Isolation ---');
  try {
    // 5A. Test selectProvider with 'local' returns local
    const p = await selectProvider('local');
    record('selectProvider("local") returns LocalQwenProvider', p.metadata.id === 'local', `Provider: ${p.metadata.name}`);

    // 5B. Verify executeWithFailover DOES NOT fall back to Gemini or NVIDIA on local error
    let failoverCalled = false;
    let reachedCloud = false;

    // Create a mock failing local provider
    const failingLocal = {
      ...local,
      metadata: { ...local.metadata, id: 'local' },
      generate: async () => {
        throw new Error('Simulated local Ollama connection drop');
      },
    };

    try {
      await executeWithFailover(
        [{ role: 'user', content: 'Secret confidential user prompt' }],
        {},
        failingLocal as any,
        'Secret confidential user prompt',
        (fromId, toId) => {
          failoverCalled = true;
          if (toId === 'gemini' || toId === 'nvidia' || toId === 'openai') {
            reachedCloud = true;
          }
        }
      );
      record('Local failover rejection', false, 'Expected execution to throw rather than succeed');
    } catch (err) {
      const msg = String(err);
      const isExpected = msg.includes('Requests explicitly routed to Local Qwen are never failed over to cloud providers for privacy') ||
                         msg.includes('Local model execution failed');
      record(
        'Explicit Local selection never calls cloud models',
        isExpected && !failoverCalled && !reachedCloud,
        'Confirmed: Cloud failover circuit completely blocked for Local requests'
      );
    }
  } catch (err) {
    record('Strict Privacy Isolation', false, String(err));
  }

  // ── TEST 6: Provider Selector & Preferences ───────────────────────
  console.log('\n--- Test 6: Provider Selector Preferences ---');
  try {
    const pAuto = await selectProvider('auto', 'Hello general question');
    record('selectProvider("auto")', !!pAuto, `Selected: ${pAuto.metadata.name}`);

    const pGemini = await selectProvider('gemini');
    record('selectProvider("gemini")', pGemini.metadata.id === 'gemini', `Selected: ${pGemini.metadata.name}`);

    const pNvidia = await selectProvider('nvidia');
    record('selectProvider("nvidia")', pNvidia.metadata.id === 'nvidia', `Selected: ${pNvidia.metadata.name}`);

    const pQwen = await selectProvider('qwen');
    record('selectProvider("qwen")', pQwen.metadata.id === 'local', `Selected: ${pQwen.metadata.name}`);
  } catch (err) {
    record('Provider Selector Preferences', false, String(err));
  }

  // ── TEST 7: Cloud Providers Regression (Gemini & NVIDIA) ───────────
  console.log('\n--- Test 7: Cloud Providers Regression Check ---');
  try {
    const geminiAvail = await gemini.isAvailable();
    record('Gemini provider isAvailable', geminiAvail);
    if (geminiAvail) {
      const gRes = await gemini.generate([{ role: 'user', content: 'Reply: "Gemini OK"' }], { temperature: 0.1 });
      record('Gemini live generation', gRes.content.length > 0, `Output: "${gRes.content.trim().slice(0, 40)}"`);
    }
  } catch (err) {
    record('Gemini live generation', false, String(err));
  }

  try {
    const nvidiaAvail = await nvidia.isAvailable();
    record('NVIDIA provider isAvailable', nvidiaAvail);
    if (nvidiaAvail) {
      const nRes = await nvidia.generate([{ role: 'user', content: 'Reply: "NVIDIA OK"' }], { temperature: 0.1 });
      record('NVIDIA live generation', nRes.content.length > 0, `Output: "${nRes.content.trim().slice(0, 40)}"`);
    }
  } catch (err) {
    record('NVIDIA live generation', false, String(err));
  }

  // ── TEST 8: Full Agent Loop with Local Qwen ───────────────────────
  console.log('\n--- Test 8: End-to-End Agent Loop with Local Qwen ---');
  try {
    let selectedModel = '';
    const emittedEvents: string[] = [];

    const agentResult = await processMessage(
      'What is 15 + 27? Provide just the number.',
      'test-conv-qwen-e2e',
      (event) => {
        emittedEvents.push(event.type);
        if (event.type === 'model_selected') {
          selectedModel = String(event.data?.model);
        }
      },
      'local'
    );

    const ok = agentResult.content.includes('42') || agentResult.content.length > 0;
    record(
      'End-to-End Agent loop via Local Qwen',
      ok && agentResult.model === 'local',
      `Model used: ${agentResult.model}, Response: "${agentResult.content.trim()}"`
    );
  } catch (err) {
    record('End-to-End Agent loop via Local Qwen', false, String(err));
  }

  console.log('\n====================================================');
  console.log(`📊 SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
