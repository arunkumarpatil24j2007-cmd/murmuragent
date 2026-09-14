'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import type { AgentEvent } from '@/lib/schemas';
import { Composer } from '@/components/composer';
import { FormattedMessage, WorkArtifactCards, ToolResultLinkBadge, extractWorkArtifacts } from '@/components/work-artifact';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  events?: AgentEvent[];
  model?: string;
}

interface AgentConsoleProps {
  onStatusChange?: (status: 'idle' | 'thinking' | 'executing' | 'error') => void;
  composerRef?: React.RefObject<HTMLTextAreaElement | null>;
  searchQuery?: string;
}

const EXAMPLE_PROMPTS = [
  { label: 'List my Vercel projects', prompt: 'List all my Vercel projects and their latest deployment status' },
  { label: 'Search Notion workspace', prompt: 'Search my Notion workspace for project notes' },
  { label: 'Check my emails', prompt: 'Search Gmail for recent emails' },
  { label: 'Create Google Doc', prompt: 'Create a Google Doc titled "Murmur Agent Architecture" with an outline' },
  { label: 'Browse web page', prompt: 'Navigate to https://news.ycombinator.com and extract top 3 stories' },
];

export function AgentConsole({
  onStatusChange,
  composerRef: externalComposerRef,
  searchQuery = '',
}: AgentConsoleProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId] = useState(() => uuid());
  const [status, setStatus] = useState<'idle' | 'thinking' | 'executing' | 'error'>('idle');
  const [currentModel, setCurrentModel] = useState<string>('Auto Router');
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [pendingEvents, setPendingEvents] = useState<AgentEvent[]>([]);

  // Load persisted model preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('murmur_selected_model');
      if (saved) {
        setSelectedModel(saved);
      }
    } catch {}
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    try {
      localStorage.setItem('murmur_selected_model', modelId);
    } catch {}
  }, []);
  
  const internalComposerRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = externalComposerRef || internalComposerRef;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    onStatusChange?.('idle');
    setPendingEvents([]);

    setMessages((prev) => [
      ...prev,
      {
        id: uuid(),
        role: 'assistant',
        content: '⏹ Action terminated by user.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [onStatusChange]);

  const isProcessing = status === 'thinking' || status === 'executing';

  // Global shortcut: ⌥ Space focuses input, Escape terminates running action
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.code === 'Space') {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (e.key === 'Escape' && isProcessing) {
        e.preventDefault();
        handleStop();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [composerRef, isProcessing, handleStop]);

  // Handle external link clicks to open in default macOS browser via native bridge
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (target && target.href && (target.href.startsWith('http://') || target.href.startsWith('https://'))) {
        if (!target.href.includes(window.location.host)) {
          e.preventDefault();
          if ((window as any).webkit?.messageHandlers?.murmurNative) {
            (window as any).webkit.messageHandlers.murmurNative.postMessage({
              type: 'open_url',
              url: target.href,
            });
          } else {
            window.open(target.href, '_blank', 'noopener,noreferrer');
          }
        }
      }
    };
    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setStatus('thinking');
    onStatusChange?.('thinking');
    setPendingEvents([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text.trim(),
          conversationId,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      const collectedEvents: AgentEvent[] = [];
      let assistantContent = '';
      let modelUsed = currentModel;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const event: AgentEvent = JSON.parse(trimmed.slice(6));

              if (event.type === 'model_selected' && event.data?.model) {
                modelUsed = event.data.model;
                setCurrentModel(event.data.model);
              }

              if (event.type === 'tool_started') {
                setStatus('executing');
                onStatusChange?.('executing');
              }

              if (event.type === 'agent_text' && event.data?.text) {
                assistantContent = event.data.text;
              }

              collectedEvents.push(event);
              setPendingEvents([...collectedEvents]);
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }

      // Determine honest assistant response
      let finalContent = assistantContent.trim();
      if (!finalContent) {
        const completedTools = collectedEvents.filter((e) => e.type === 'tool_result');
        if (completedTools.length > 0) {
          finalContent = 'The requested actions have been executed successfully.';
        } else {
          finalContent =
            'I could not find an available tool to complete this request. Please verify that the required connector (e.g. Google Workspace) is connected under Settings > Connectors.';
        }
      }

      const assistantMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: finalContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        events: collectedEvents,
        model: modelUsed,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setPendingEvents([]);
      setStatus('idle');
      onStatusChange?.('idle');

    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError')) {
        // Action was terminated by the user; handleStop already appended termination status
        return;
      }

      const errorMsg: ChatMessage = {
        id: uuid(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Execution failed'}. Please check your connection and API keys.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setStatus('error');
      onStatusChange?.('error');
      setPendingEvents([]);
      setTimeout(() => {
        setStatus('idle');
        onStatusChange?.('idle');
      }, 3000);
    }
  }, [conversationId, currentModel, onStatusChange, composerRef]);

  // Expose global prompt submission for native voice toggle injection
  useEffect(() => {
    (window as any).murmurSubmitPrompt = (text: string) => {
      if (text && typeof text === 'string' && text.trim()) {
        handleSend(text.trim());
      }
    };
    return () => {
      delete (window as any).murmurSubmitPrompt;
    };
  }, [handleSend]);

  // Notify native macOS app when agent status changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).webkit?.messageHandlers?.murmurNative) {
      try {
        (window as any).webkit.messageHandlers.murmurNative.postMessage({
          type: 'status',
          status,
          model: currentModel,
        });
      } catch {}
    }
  }, [status, currentModel]);

  // Filter messages by search if specified
  const filteredMessages = searchQuery
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      backgroundColor: 'var(--mac-card-bg)',
      border: '1px solid var(--mac-card-border)',
      borderRadius: '16px',
      overflow: 'visible',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
      position: 'relative',
    }}>
      {/* Scrollable messages or empty state */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {filteredMessages.length === 0 && !isProcessing ? (
          /* Empty state matching reference screenshot */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '260px',
            margin: 'auto 0',
            textAlign: 'center',
            padding: '20px',
          }}>
            {/* Waveform / Soundbar muted icon matching screenshot */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              height: '36px',
              marginBottom: '16px',
              opacity: 0.35,
            }}>
              <div style={{ width: '3px', height: '14px', backgroundColor: 'var(--mac-plum)', borderRadius: '2px' }} />
              <div style={{ width: '3px', height: '24px', backgroundColor: 'var(--mac-plum)', borderRadius: '2px' }} />
              <div style={{ width: '3px', height: '34px', backgroundColor: 'var(--mac-plum)', borderRadius: '2px' }} />
              <div style={{ width: '3px', height: '18px', backgroundColor: 'var(--mac-plum)', borderRadius: '2px' }} />
              <div style={{ width: '3px', height: '28px', backgroundColor: 'var(--mac-plum)', borderRadius: '2px' }} />
              <div style={{ width: '3px', height: '12px', backgroundColor: 'var(--mac-plum)', borderRadius: '2px' }} />
            </div>

            <h3 style={{
              fontSize: '15px',
              fontWeight: '700',
              color: 'var(--mac-plum)',
              marginBottom: '6px',
            }}>
              No recent recordings
            </h3>

            <p style={{
              fontSize: '12px',
              color: 'var(--mac-text-secondary)',
              maxWidth: '380px',
              lineHeight: 1.5,
              marginBottom: '24px',
            }}>
              Transcribed dictations and agent executions are saved temporarily for 4 hours.
            </p>

            {/* Quick Suggestion Pills */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              maxWidth: '560px',
            }}>
              {EXAMPLE_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleSend(item.prompt)}
                  style={{
                    backgroundColor: 'var(--mac-sidebar-bg)',
                    border: '1px solid var(--mac-sidebar-border)',
                    padding: '7px 13px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--mac-plum)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--mac-sidebar-active)';
                    e.currentTarget.style.borderColor = 'var(--mac-plum)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--mac-sidebar-bg)';
                    e.currentTarget.style.borderColor = 'var(--mac-sidebar-border)';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat message conversation */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxWidth: '820px',
            margin: '0 auto',
            width: '100%',
          }}>
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                {/* Role badge & timestamp */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--mac-text-tertiary)',
                  marginBottom: '4px',
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span>{msg.role === 'user' ? 'Arunkumar' : 'Murmur Agent'}</span>
                  {msg.model && (
                    <span style={{
                      fontSize: '10px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(40, 8, 19, 0.06)',
                      color: 'var(--mac-plum)',
                    }}>
                      {msg.model}
                    </span>
                  )}
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Bubble */}
                <div style={{
                  maxWidth: '85%',
                  padding: '14px 18px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  backgroundColor: msg.role === 'user' ? 'var(--mac-sidebar-bg)' : '#FFFFFF',
                  border: msg.role === 'user' ? '1px solid var(--mac-sidebar-border)' : '1px solid var(--mac-card-border)',
                  color: 'var(--mac-text-primary)',
                  fontSize: '13.5px',
                  lineHeight: '1.6',
                  boxShadow: msg.role === 'user' ? 'none' : '0 2px 6px rgba(0,0,0,0.03)',
                  wordBreak: 'break-word',
                }}>
                  {msg.role === 'user' ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  ) : (
                    <FormattedMessage content={msg.content} />
                  )}

                  {/* Work Artifact Card for completed tasks (Docs, Sheets, Notion, Vercel, etc.) */}
                  {msg.role === 'assistant' && (
                    <WorkArtifactCards artifacts={extractWorkArtifacts(msg.content, msg.events)} />
                  )}

                  {/* Tool events summary for assistant message */}
                  {msg.events && msg.events.length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid var(--mac-card-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}>
                      {msg.events
                        .filter((e) => ['tool_result', 'tool_failed'].includes(e.type))
                        .map((evt, idx) => {
                          const detectedUrl = evt.data.url || (evt.data.result?.match(/https?:\/\/[^\s"'<>\)]+/)?.[0]);
                          return (
                            <div
                              key={idx}
                              style={{
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '6px',
                                color: evt.type === 'tool_result' ? '#1b7440' : '#c0394b',
                                fontWeight: '500',
                              }}
                            >
                              <span>{evt.type === 'tool_result' ? '✓' : '✗'}</span>
                              <span style={{ fontFamily: 'monospace' }}>{evt.data.tool}</span>
                              {evt.data.result && !detectedUrl && (
                                <span style={{ color: 'var(--mac-text-tertiary)' }}>({evt.data.result})</span>
                              )}
                              {evt.data.error && (
                                <span style={{ color: '#c0394b' }}>({evt.data.error})</span>
                              )}
                              {detectedUrl && (
                                <ToolResultLinkBadge url={detectedUrl} label={evt.data.title} />
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Live activity feed during execution */}
            {isProcessing && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '14px 18px',
                borderRadius: '14px',
                backgroundColor: 'rgba(245, 235, 225, 0.5)',
                border: '1px solid var(--mac-sidebar-border)',
                maxWidth: '85%',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--mac-plum)',
                }}>
                  <div style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--mac-tag-pink)',
                    animation: 'pulseGently 1.2s infinite',
                  }} />
                  <span>Murmur Agent is working...</span>
                </div>

                {pendingEvents
                  .filter((e) => ['model_selected', 'tool_started', 'tool_result'].includes(e.type))
                  .map((evt, i) => {
                    const detectedUrl = evt.data.url || (evt.data.result?.match(/https?:\/\/[^\s"'<>\)]+/)?.[0]);
                    return (
                      <div
                        key={i}
                        style={{
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '6px',
                          color: 'var(--mac-text-secondary)',
                        }}
                      >
                        <span style={{ opacity: 0.6 }}>→</span>
                        {evt.type === 'model_selected' && <span>Using {evt.data.model}</span>}
                        {evt.type === 'tool_started' && <span>Running <code style={{ color: 'var(--mac-plum)' }}>{evt.data.tool}</code>...</span>}
                        {evt.type === 'tool_result' && (
                          <span style={{ color: '#1b7440', display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>✓ {evt.data.tool}: {evt.data.title || evt.data.result}</span>
                            {detectedUrl && <ToolResultLinkBadge url={detectedUrl} />}
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer Input Area matching reference screenshot */}
      <div style={{
        padding: '12px 20px 16px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid var(--mac-card-border)',
        borderBottomLeftRadius: '16px',
        borderBottomRightRadius: '16px',
        position: 'relative',
        overflow: 'visible',
      }}>
        <Composer
          onSend={(msg) => handleSend(msg)}
          onStop={handleStop}
          isProcessing={isProcessing}
          disabled={isProcessing}
          activeModelLabel={currentModel}
          selectedModelPreference={selectedModel}
          onSelectModel={handleSelectModel}
          placeholder="Type a message..."
        />

        {/* Footer shortcuts hint */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '8px',
          padding: '0 4px',
          fontSize: '11px',
          color: 'var(--mac-text-muted)',
        }}>
          <div>
            Press <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: '#F3F4F6', border: '1px solid #E5E7EB', fontWeight: '600' }}>⏎ Return</kbd> to send, <kbd style={{ padding: '1px 5px', borderRadius: '4px', background: '#F3F4F6', border: '1px solid #E5E7EB', fontWeight: '600' }}>⇧ Shift + ⏎</kbd> for new line
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>
              {selectedModel === 'local'
                ? 'Active Provider:'
                : selectedModel === 'kimi'
                ? 'Active Model:'
                : 'Auto Router:'}
            </span>
            <span style={{ color: '#0F172A', fontWeight: '600' }}>
              {selectedModel === 'local'
                ? 'Local — Qwen 3.5'
                : selectedModel === 'kimi'
                ? 'Kimi K2.6'
                : currentModel}
            </span>
            {selectedModel === 'local' && (
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#059669',
                backgroundColor: '#ECFDF5',
                padding: '1px 6px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>●</span> 100% Local (Mac)
              </span>
            )}
            {selectedModel === 'kimi' && (
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#7E22CE',
                backgroundColor: '#FAF5FF',
                border: '1px solid #E9D5FF',
                padding: '1px 6px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <span>★</span> moonshotai/kimi-k2.6:free
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
