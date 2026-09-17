'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { AgentEvent } from '@/lib/schemas';
import { Composer } from '@/components/composer';
import { FormattedMessage, WorkArtifactCards, extractWorkArtifacts } from '@/components/work-artifact';
import { Mascot3D } from '@/components/mascot-3d';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode?: 'chat' | 'agent';
  events?: AgentEvent[];
  model?: string;
  isError?: boolean;
}

interface AgentConsoleProps {
  onStatusChange?: (status: 'idle' | 'thinking' | 'executing' | 'error') => void;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
  searchQuery?: string;
  onNewConversation?: () => void;
  conversationId?: string;
  userName?: string;
}

const PROMPT_SUGGESTIONS = [
  { label: 'Explain recursion with a C example', mode: 'chat' as const, prompt: 'Explain recursion and provide an example in C.' },
  { label: 'Capital of France', mode: 'chat' as const, prompt: 'What is the capital of France?' },
  { label: 'Calculate 847 × 293', mode: 'agent' as const, prompt: 'Calculate 847 * 293' },
  { label: 'Search my Google Drive', mode: 'agent' as const, prompt: 'Search my Google Drive for recent documents' },
];

export function AgentConsole({
  onStatusChange,
  composerRef: externalComposerRef,
  searchQuery = '',
  conversationId: propConversationId,
  userName = 'Arunkumar',
}: AgentConsoleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState(() => propConversationId || uuid());
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [status, setStatus] = useState<'idle' | 'thinking' | 'executing' | 'error'>('idle');
  const [currentModel, setCurrentModel] = useState<string>('Claude Opus 4.6');
  const [selectedModel, setSelectedModel] = useState<string>('omniroutes');
  const [liveStreamText, setLiveStreamText] = useState<string>('');
  const [agentStepStatus, setAgentStepStatus] = useState<string>('');
  const [activeSteps, setActiveSteps] = useState<Array<{ name: string; status: 'running' | 'completed' | 'failed' }>>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<{ action: string; tool: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const internalComposerRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = externalComposerRef || internalComposerRef;

  // Persist model & mode preferences
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('murmur_mode') as 'chat' | 'agent' | null;
      if (savedMode && (savedMode === 'chat' || savedMode === 'agent')) {
        setMode(savedMode);
      }
      const savedModel = localStorage.getItem('murmur_selected_model');
      if (savedModel) {
        setSelectedModel(savedModel);
      }
    } catch {}
  }, []);

  const handleModeChange = useCallback((newMode: 'chat' | 'agent') => {
    setMode(newMode);
    try {
      localStorage.setItem('murmur_mode', newMode);
    } catch {}
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    const labels: Record<string, string> = {
      omniroutes: 'Claude Opus 4.6',
      anthropic: 'Claude Opus 4.6',
      kimi: 'Kimi K2.6',
      auto: 'Auto Router',
      gemini: 'Google Gemini',
      nvidia: 'NVIDIA AI',
      local: 'Local Qwen 3.5',
    };
    setCurrentModel(labels[modelId] || modelId);
    try {
      localStorage.setItem('murmur_selected_model', modelId);
    } catch {}
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, liveStreamText, scrollToBottom]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    onStatusChange?.('idle');
    setLiveStreamText('');
    setAgentStepStatus('');

    setMessages((prev) => [
      ...prev,
      {
        id: uuid(),
        role: 'assistant',
        content: 'Generation stopped.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode,
      },
    ]);
  }, [mode, onStatusChange]);

  const isProcessing = status === 'thinking' || status === 'executing';

  const handleSend = useCallback(
    async (text: string, overrideMode?: 'chat' | 'agent') => {
      const activeMode = overrideMode || mode;
      const trimmed = text.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mode: activeMode,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setStatus('thinking');
      onStatusChange?.('thinking');
      setLiveStreamText('');
      setAgentStepStatus(activeMode === 'chat' ? 'Thinking...' : 'Planning task...');
      setActiveSteps([]);
      setPendingConfirmation(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Extract conversation history for multi-turn context
      const historyPayload = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            message: trimmed,
            conversationId,
            model: selectedModel,
            mode: activeMode,
            history: historyPayload,
          }),
        });

        if (!response.ok) {
          throw new Error(`Service returned HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream available.');

        const decoder = new TextDecoder();
        let buffer = '';
        let assistantContent = '';
        let modelUsed = currentModel;
        const collectedEvents: AgentEvent[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const lineTrimmed = line.trim();
            if (lineTrimmed.startsWith('data: ')) {
              try {
                const event = JSON.parse(lineTrimmed.slice(6));

                if (event.type === 'model_selected' && event.data?.model) {
                  modelUsed = event.data.model;
                  setCurrentModel(event.data.model);
                }

                if (event.type === 'tool_started') {
                  setStatus('executing');
                  onStatusChange?.('executing');
                  const toolName = event.data?.action || event.data?.tool || 'tool';
                  setAgentStepStatus(`Using ${toolName}...`);
                  setActiveSteps((prev) => [
                    ...prev.map((s) => (s.status === 'running' ? { ...s, status: 'completed' as const } : s)),
                    { name: toolName, status: 'running' as const },
                  ]);
                }

                if (event.type === 'tool_result') {
                  setActiveSteps((prev) =>
                    prev.map((s) => (s.status === 'running' ? { ...s, status: 'completed' as const } : s))
                  );
                }

                if (event.type === 'tool_failed') {
                  setActiveSteps((prev) =>
                    prev.map((s) => (s.status === 'running' ? { ...s, status: 'failed' as const } : s))
                  );
                }

                if (event.type === 'permission_required') {
                  const actionName = event.data?.action || event.data?.tool || 'Action';
                  setPendingConfirmation({
                    action: actionName,
                    tool: event.data?.tool || 'tool',
                  });
                }

                if (event.type === 'agent_thinking' && event.data?.status) {
                  setAgentStepStatus(event.data.status);
                }

                if (event.type === 'agent_text' && event.data?.text) {
                  assistantContent = event.data.text;
                  setLiveStreamText(assistantContent);
                }

                if (event.type === 'final_response' && event.data?.content) {
                  assistantContent = event.data.content;
                  setLiveStreamText(assistantContent);
                }

                if (event.type === 'agent_error') {
                  throw new Error(event.data?.error || 'An error occurred during execution.');
                }

                collectedEvents.push(event);
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes('JSON')) {
                  throw parseErr;
                }
              }
            }
          }
        }

        const finalContent = assistantContent.trim() || 'Task completed successfully.';

        const assistantMsg: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: finalContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          mode: activeMode,
          model: modelUsed,
          events: collectedEvents,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setStatus('idle');
        onStatusChange?.('idle');
        setLiveStreamText('');
        setAgentStepStatus('');
      } catch (err: any) {
        if (controller.signal.aborted) return;
        const errorMsg = err instanceof Error ? err.message : String(err);
        setStatus('error');
        onStatusChange?.('error');
        setLiveStreamText('');
        setAgentStepStatus('');

        setMessages((prev) => [
          ...prev,
          {
            id: uuid(),
            role: 'assistant',
            content: `I was unable to complete your request: ${errorMsg}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            mode: activeMode,
            isError: true,
          },
        ]);
      }
    },
    [conversationId, currentModel, messages, mode, onStatusChange, selectedModel]
  );

  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        minHeight: 0,
        backgroundColor: 'var(--murmur-canvas)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ─── Top Bar: Clean mode switch & status ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 28px',
          borderBottom: '1px solid var(--murmur-border-subtle)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Subtle Mode Switcher in Header */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--murmur-sidebar)',
              borderRadius: '20px',
              padding: '2px',
              gap: '2px',
              border: '1px solid var(--murmur-border)',
            }}
          >
            <button
              type="button"
              onClick={() => handleModeChange('chat')}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: mode === 'chat' ? '#FFFFFF' : 'transparent',
                color: mode === 'chat' ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                fontSize: '12.5px',
                fontWeight: mode === 'chat' ? 600 : 500,
                cursor: 'pointer',
                boxShadow: mode === 'chat' ? '0 1px 2px rgba(40, 8, 19, 0.08)' : 'none',
                transition: 'all 0.12s ease',
              }}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('agent')}
              style={{
                padding: '4px 12px',
                borderRadius: '16px',
                border: 'none',
                backgroundColor: mode === 'agent' ? '#FFFFFF' : 'transparent',
                color: mode === 'agent' ? 'var(--murmur-plum)' : 'var(--murmur-text-secondary)',
                fontSize: '12.5px',
                fontWeight: mode === 'agent' ? 600 : 500,
                cursor: 'pointer',
                boxShadow: mode === 'agent' ? '0 1px 2px rgba(40, 8, 19, 0.08)' : 'none',
                transition: 'all 0.12s ease',
              }}
            >
              Agent
            </button>
          </div>

          <span
            style={{
              fontSize: '12px',
              color: 'var(--murmur-text-muted)',
            }}
          >
            {mode === 'chat'
              ? `Ask anything. Have a normal conversation with ${currentModel}.`
              : 'Ask Murmur to perform tasks across connected services.'}
          </span>
        </div>

        {/* Clear / New conversation button */}
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
              }
              setStatus('idle');
              onStatusChange?.('idle');
              setMessages([]);
              setConversationId(uuid());
              setLiveStreamText('');
              setAgentStepStatus('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--murmur-text-secondary)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--murmur-sidebar)';
              e.currentTarget.style.color = 'var(--murmur-plum)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--murmur-text-secondary)';
            }}
          >
            Clear conversation
          </button>
        )}
      </div>

      {/* ─── Main Content: Home State OR Conversation Stream ─── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {filteredMessages.length === 0 && !isProcessing ? (
          /* ─── Google Labs Editorial Home State ─── */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              margin: 'auto 0',
              padding: '20px 20px 40px 20px',
              textAlign: 'center',
              width: '100%',
              zIndex: 2,
            }}
          >
            <div style={{ maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Interactive 3D Mascot Character with Physics & Hand-Drawn Annotation */}
              <Mascot3D />

              {/* Uppercase Tracked Greeting */}
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--murmur-text-muted)',
                  marginBottom: '8px',
                }}
              >
                Good afternoon, {userName}
              </div>

              {/* Main Headline */}
              <h1
                style={{
                  fontSize: '36px',
                  fontWeight: 700,
                  letterSpacing: '-0.03em',
                  color: 'var(--murmur-plum)',
                  lineHeight: '1.2',
                  marginBottom: '8px',
                }}
              >
                What can Murmur do for you?
              </h1>

              {/* Subtitle */}
              <p
                style={{
                  fontSize: '15px',
                  color: 'var(--murmur-text-secondary)',
                  marginBottom: '28px',
                  fontWeight: 400,
                }}
              >
                Talk, plan, build or automate — your call.
              </p>

              {/* Centered Floating Hero Composer */}
              <div style={{ width: '100%', marginBottom: '22px' }}>
                <Composer
                  onSend={(msg) => handleSend(msg)}
                  onStop={handleStop}
                  isProcessing={isProcessing}
                  disabled={isProcessing}
                  mode={mode}
                  onModeChange={handleModeChange}
                  activeModelLabel={currentModel}
                  selectedModelPreference={selectedModel}
                  onSelectModel={handleSelectModel}
                  isHero
                />
              </div>

              {/* Pill Suggestion Chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  justifyContent: 'center',
                }}
              >
                {PROMPT_SUGGESTIONS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleModeChange(item.mode);
                      handleSend(item.prompt, item.mode);
                    }}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '9999px',
                      border: '1px solid rgba(220, 210, 204, 0.8)',
                      backgroundColor: '#FFFFFF',
                      color: 'var(--murmur-text-primary)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(45, 11, 27, 0.04)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(239, 164, 191, 0.9)';
                      e.currentTarget.style.color = 'var(--murmur-plum)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(45, 11, 27, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(220, 210, 204, 0.8)';
                      e.currentTarget.style.color = 'var(--murmur-text-primary)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(45, 11, 27, 0.04)';
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ─── Active Conversation Stream ─── */
          <div
            style={{
              maxWidth: '740px',
              width: '100%',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              paddingBottom: '20px',
            }}
          >
            {filteredMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const artifacts = !isUser ? extractWorkArtifacts(msg.content) : [];

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isUser ? 'flex-end' : 'flex-start',
                    width: '100%',
                  }}
                >
                  {/* Sender Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                      fontSize: '11.5px',
                      color: 'var(--murmur-text-muted)',
                      padding: '0 4px',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: isUser ? 'var(--murmur-text-primary)' : 'var(--murmur-plum)' }}>
                      {isUser ? 'You' : 'Murmur'}
                    </span>
                    {!isUser && msg.model && (
                      <span
                        style={{
                          fontSize: '10.5px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(45, 13, 25, 0.05)',
                          color: 'var(--murmur-plum)',
                          fontWeight: 500,
                        }}
                      >
                        {msg.model}
                      </span>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message Body */}
                  {isUser ? (
                    <div
                      style={{
                        backgroundColor: 'var(--murmur-user-msg)',
                        color: 'var(--murmur-text-primary)',
                        padding: '10px 16px',
                        borderRadius: '16px 16px 4px 16px',
                        fontSize: '14.5px',
                        lineHeight: '1.5',
                        maxWidth: '85%',
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        color: 'var(--murmur-text-primary)',
                        fontSize: '15px',
                        lineHeight: '1.65',
                      }}
                    >
                      {msg.isError ? (
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            backgroundColor: '#FEF2F2',
                            border: '1px solid #FCA5A5',
                            color: '#991B1B',
                            fontSize: '13.5px',
                          }}
                        >
                          {msg.content}
                        </div>
                      ) : (
                        <div className="prose-editorial">
                          <FormattedMessage content={msg.content} />
                          {artifacts.length > 0 && <WorkArtifactCards artifacts={artifacts} />}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Streaming Response & Progress */}
            {isProcessing && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  width: '100%',
                  marginTop: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    fontSize: '12px',
                    color: 'var(--murmur-text-muted)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--murmur-plum)' }}>Murmur</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--murmur-plum)',
                      fontWeight: 500,
                    }}
                  >
                    <span
                      className="animate-pulse-subtle"
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--murmur-plum)',
                      }}
                    />
                    {agentStepStatus || 'Thinking...'}
                  </span>
                </div>

                {liveStreamText ? (
                  <div className="prose-editorial" style={{ width: '100%' }}>
                    <FormattedMessage content={liveStreamText} />
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '14px',
                      color: 'var(--murmur-text-secondary)',
                      fontStyle: 'italic',
                      padding: '4px 0',
                    }}
                  >
                    {mode === 'chat' ? `Generating response with ${currentModel}...` : 'Executing task steps...'}
                  </div>
                )}

                {/* Multi-step Concise Progress Indicator (Requirement 14) */}
                {activeSteps.length > 0 && isProcessing && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                      marginTop: '12px',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--murmur-sidebar)',
                      border: '1px solid var(--murmur-border-subtle)',
                      width: 'fit-content',
                      minWidth: '220px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--murmur-text-muted)',
                        marginBottom: '2px',
                      }}
                    >
                      Task Progress
                    </div>
                    {activeSteps.map((step, idx) => {
                      const isDone = step.status === 'completed';
                      const isRunning = step.status === 'running';
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12.5px',
                            color: isRunning
                              ? 'var(--murmur-plum)'
                              : isDone
                              ? 'var(--murmur-text-primary)'
                              : 'var(--murmur-text-muted)',
                            fontWeight: isRunning ? 600 : 450,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '14px',
                              color: isDone ? '#10B981' : isRunning ? 'var(--murmur-plum)' : '#EF4444',
                            }}
                          >
                            {isDone ? '✓' : isRunning ? '→' : '✕'}
                          </span>
                          <span>{step.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Interactive Confirmation Card (Requirement 4 & 12) */}
            {pendingConfirmation && !isProcessing && (
              <div
                style={{
                  margin: '12px 0 6px',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: '1px solid var(--murmur-border-solid)',
                  backgroundColor: '#FFFFFF',
                  boxShadow: 'var(--murmur-shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  maxWidth: '520px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(217, 119, 6, 0.1)',
                      color: '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: 'bold',
                    }}
                  >
                    !
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--murmur-text-primary)' }}>
                      Confirmation Required
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--murmur-text-muted)' }}>
                      This action sends or modifies external data. Please confirm to proceed.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--murmur-text-primary)',
                    backgroundColor: 'var(--murmur-sidebar)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                  }}
                >
                  Ready to perform: <strong>{pendingConfirmation.action}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const action = pendingConfirmation.action;
                      setPendingConfirmation(null);
                      handleSend(`Yes, confirmed. Go ahead and execute: ${action}`);
                    }}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--murmur-plum)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Approve & Execute
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingConfirmation(null);
                      handleSend('Cancel this action.');
                    }}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'transparent',
                      color: 'var(--murmur-text-secondary)',
                      border: '1px solid var(--murmur-border)',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Bottom Composer (visible when in conversation) ─── */}
      {filteredMessages.length > 0 && (
        <div
          style={{
            padding: '14px 28px 20px',
            backgroundColor: 'var(--murmur-canvas)',
            borderTop: '1px solid var(--murmur-border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ maxWidth: '740px', margin: '0 auto', width: '100%' }}>
            <Composer
              onSend={(msg) => handleSend(msg)}
              onStop={handleStop}
              isProcessing={isProcessing}
              disabled={isProcessing}
              mode={mode}
              onModeChange={handleModeChange}
              activeModelLabel={currentModel}
              selectedModelPreference={selectedModel}
              onSelectModel={handleSelectModel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
