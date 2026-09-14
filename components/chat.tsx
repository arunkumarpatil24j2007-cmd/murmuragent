'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { AgentStatus } from './agent-status';
import { MessageBubble, type Message } from './message';
import { Composer } from './composer';
import { EmptyState } from './empty-state';
import type { AgentEvent } from '@/lib/schemas';

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId] = useState(() => uuid());
  const [status, setStatus] = useState<'idle' | 'thinking' | 'executing' | 'error'>('idle');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [pendingEvents, setPendingEvents] = useState<AgentEvent[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('auto');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('murmur_selected_model');
      if (saved) setSelectedModelId(saved);
    } catch {}
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    try {
      localStorage.setItem('murmur_selected_model', modelId);
    } catch {}
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingEvents, scrollToBottom]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setPendingEvents([]);
    setMessages((prev) => [
      ...prev,
      {
        id: uuid(),
        role: 'assistant',
        content: '⏹ Action terminated by user.',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  const handleSend = useCallback(async (text: string, modelOverride?: string) => {
    const chosenModel = modelOverride || selectedModelId;
    // Add user message
    const userMsg: Message = {
      id: uuid(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStatus('thinking');
    setPendingEvents([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          conversationId,
          model: chosenModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      const collectedEvents: AgentEvent[] = [];
      let assistantContent = '';
      let modelName = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'final_response') {
                assistantContent = event.data.content;
                modelName = event.data.model || modelName;
                continue;
              }

              // Track model
              if (event.type === 'model_selected' && event.data?.model) {
                modelName = event.data.model;
                setCurrentModel(event.data.model);
              }

              // Update status
              if (event.type === 'tool_started') {
                setStatus('executing');
              }
              if (event.type === 'agent_error') {
                setStatus('error');
              }

              // Accumulate text from agent_text events
              if (event.type === 'agent_text' && event.data?.text) {
                assistantContent = event.data.text;
              }

              collectedEvents.push(event);
              setPendingEvents([...collectedEvents]);
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Add assistant message with all events
      const assistantMsg: Message = {
        id: uuid(),
        role: 'assistant',
        content: assistantContent || 'I processed your request.',
        timestamp: new Date().toISOString(),
        events: collectedEvents,
        model: modelName,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setPendingEvents([]);
      setStatus('idle');

    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
        return;
      }

      const errorMsg: Message = {
        id: uuid(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please check that the server is running and try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setStatus('error');
      setPendingEvents([]);

      // Reset error status after a moment
      setTimeout(() => setStatus('idle'), 3000);
    }
  }, [conversationId]);

  const isProcessing = status === 'thinking' || status === 'executing';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'var(--murmur-bg)',
    }}>
      <AgentStatus status={status} model={currentModel} />

      {/* Messages area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0',
        }}
      >
        {messages.length === 0 && !isProcessing ? (
          <EmptyState onSelectCommand={handleSend} />
        ) : (
          <div style={{
            maxWidth: '760px',
            margin: '0 auto',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Live tool activity during processing */}
            {isProcessing && pendingEvents.length > 0 && (
              <div style={{
                animation: 'fadeIn 0.2s ease',
              }}>
                <PendingToolStatus events={pendingEvents} />
              </div>
            )}

            {/* Thinking indicator */}
            {isProcessing && pendingEvents.length === 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 0',
                animation: 'fadeIn 0.2s ease',
              }}>
                <ThinkingDots />
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        maxWidth: '760px',
        margin: '0 auto',
        width: '100%',
      }}>
        <Composer
          onSend={(msg) => handleSend(msg)}
          onStop={handleStop}
          isProcessing={isProcessing}
          disabled={isProcessing}
          activeModelLabel={currentModel}
          selectedModelPreference={selectedModelId}
          onSelectModel={handleSelectModel}
        />
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function PendingToolStatus({ events }: { events: AgentEvent[] }) {
  const relevantEvents = events.filter((e) =>
    ['tool_started', 'tool_result', 'tool_failed', 'model_selected', 'agent_thinking'].includes(e.type)
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {relevantEvents.map((event, i) => {
        let icon = '●';
        let color = 'var(--murmur-accent)';
        let text = '';
        let pulse = false;

        switch (event.type) {
          case 'model_selected':
            icon = '◆';
            color = 'var(--murmur-text-tertiary)';
            text = `Using ${event.data.model}`;
            break;
          case 'agent_thinking':
            icon = '●';
            color = 'var(--murmur-accent)';
            text = event.data.status || 'Thinking...';
            pulse = true;
            break;
          case 'tool_started':
            icon = '●';
            color = 'var(--murmur-accent)';
            text = event.data.action || `Running ${event.data.tool}`;
            pulse = i === relevantEvents.length - 1;
            break;
          case 'tool_result':
            icon = '✓';
            color = 'var(--murmur-success)';
            text = event.data.result || 'Done';
            break;
          case 'tool_failed':
            icon = '✗';
            color = 'var(--murmur-error)';
            text = event.data.error || 'Failed';
            break;
        }

        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: 'var(--murmur-text-secondary)',
          }}>
            <span style={{
              color,
              fontSize: '10px',
              animation: pulse ? 'statusPulse 1.2s ease-in-out infinite' : 'none',
              width: '14px',
              textAlign: 'center',
            }}>
              {icon}
            </span>
            <span>{text}</span>
          </div>
        );
      })}
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
      padding: '4px 0',
    }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: 'var(--murmur-accent)',
            animation: `dotPulse 1.4s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes dotPulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
