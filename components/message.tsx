'use client';

import React from 'react';
import type { AgentEvent } from '@/lib/schemas';
import { ToolStatus } from './tool-status';
import { FormattedMessage, WorkArtifactCards, extractWorkArtifacts } from './work-artifact';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  events?: AgentEvent[];
  model?: string;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      width: '100%',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Tool activity for assistant messages */}
      {!isUser && message.events && message.events.length > 0 && (
        <div style={{
          maxWidth: '680px',
          width: '100%',
          paddingLeft: '2px',
        }}>
          <ToolStatus events={message.events} />
        </div>
      )}

      <div style={{
        maxWidth: isUser ? '520px' : '680px',
        width: isUser ? 'auto' : '100%',
      }}>
        <div style={{
          padding: isUser ? '10px 16px' : '0',
          borderRadius: isUser ? '18px 18px 4px 18px' : '0',
          backgroundColor: isUser ? 'var(--murmur-user-bg)' : 'transparent',
          fontSize: '15px',
          lineHeight: '1.6',
          color: 'var(--murmur-text)',
          letterSpacing: '0.01em',
          wordBreak: 'break-word',
        }}>
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
          ) : (
            <>
              <FormattedMessage content={message.content} />
              <WorkArtifactCards artifacts={extractWorkArtifacts(message.content, message.events)} />
            </>
          )}
        </div>

        {/* Model tag for assistant */}
        {!isUser && message.model && (
          <div style={{
            fontSize: '11px',
            color: 'var(--murmur-text-tertiary)',
            marginTop: '6px',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {message.model}
          </div>
        )}
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

export type { Message };
