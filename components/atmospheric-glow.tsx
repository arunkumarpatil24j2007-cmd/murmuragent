'use client';

import React from 'react';

interface AtmosphericGlowProps {
  variant?: 'default' | 'chat' | 'agent' | 'subtle';
}

export function AtmosphericGlow({ variant = 'default' }: AtmosphericGlowProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Bottom-right soft lavender & pink cloud */}
      <div
        style={{
          position: 'absolute',
          bottom: '-12%',
          right: '-8%',
          width: '780px',
          height: '620px',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(230, 218, 245, 0.55) 0%, rgba(246, 222, 235, 0.35) 45%, transparent 72%)',
          filter: 'blur(70px)',
          transform: 'rotate(-10deg)',
          opacity: 0.95,
        }}
      />

      {/* Bottom-left soft peach & warm apricot glow */}
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          left: '-5%',
          width: '640px',
          height: '520px',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(248, 226, 212, 0.5) 0%, rgba(248, 234, 224, 0.3) 50%, transparent 75%)',
          filter: 'blur(80px)',
          opacity: 0.9,
        }}
      />

      {/* Center subtle warm peach / rose glow behind mascot */}
      {variant === 'default' && (
        <div
          style={{
            position: 'absolute',
            top: '18%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '480px',
            height: '320px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, rgba(247, 224, 235, 0.45) 0%, rgba(254, 238, 228, 0.25) 55%, transparent 75%)',
            filter: 'blur(60px)',
            opacity: 0.85,
          }}
        />
      )}

      {/* Subtle organic light ray across bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          right: '18%',
          width: '380px',
          height: '240px',
          background:
            'radial-gradient(circle at center, rgba(255, 255, 255, 0.6) 0%, rgba(245, 230, 240, 0.2) 50%, transparent 70%)',
          filter: 'blur(50px)',
          opacity: 0.6,
        }}
      />
    </div>
  );
}
