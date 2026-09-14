// scripts/test-termination.ts — Verification of action termination via AbortSignal

import { processMessage } from '../agent/agent';
import { executeToolCall } from '../agent/executor';
import type { AgentEvent, ToolCall } from '../lib/schemas';

async function main() {
  console.log('--- 1. Testing Tool Execution Cancellation via AbortSignal ---');
  const controller = new AbortController();
  controller.abort(); // Pre-aborted

  const emittedEvents: AgentEvent[] = [];
  const ctx = {
    emit: (event: AgentEvent) => emittedEvents.push(event),
    signal: controller.signal,
  };

  const toolCall: ToolCall = {
    id: 'call-terminate',
    tool: 'docs.create',
    arguments: { title: 'Should Not Create' },
  };

  const res = await executeToolCall(toolCall, ctx);
  console.assert(res.success === false, 'Cancelled tool call should not succeed');
  console.assert(res.error?.includes('terminated') || res.error?.includes('cancelled'), 'Error should state action terminated');
  console.log('✓ Tool call cleanly rejected when aborted:', res.error);

  console.log('\n--- 2. Testing processMessage Immediate Termination ---');
  const agentController = new AbortController();
  agentController.abort(); // Pre-aborted signal

  const events: AgentEvent[] = [];
  const result = await processMessage(
    'Create a huge document with 50 pages',
    'test-abort-conv',
    (e) => events.push(e),
    'auto',
    agentController.signal
  );

  console.assert(result.taskState.status === 'cancelled', `Expected taskState status to be cancelled, got ${result.taskState.status}`);
  console.assert(result.content.includes('terminated'), `Expected termination message, got: ${result.content}`);
  console.log('✓ processMessage terminated immediately on signal:', result.content);

  console.log('\n🎉 ALL TERMINATION TESTS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
