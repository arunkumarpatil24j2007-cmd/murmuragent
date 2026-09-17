'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export function Mascot3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene & Camera
    const scene = new THREE.Scene();
    const width = 340;
    const height = 240;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 5.2);

    // Renderer with full alpha transparency
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ─── Character Root Group ───
    const characterGroup = new THREE.Group();
    scene.add(characterGroup);

    // ─── Procedural Soft Blob Geometry ───
    // Create a smooth sphere and deform it into a friendly teardrop / gumdrop shape
    const baseGeo = new THREE.SphereGeometry(1.25, 64, 64);
    const pos = baseGeo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      
      // Taper the top, plump the bottom (gumdrop shape)
      const normalizedY = (v.y + 1.25) / 2.5; // 0 to 1
      const plumpness = 1.0 + (1.0 - normalizedY) * 0.28;
      v.x *= plumpness;
      v.z *= plumpness;

      // Softly flatten the bottom slightly for sitting/floating creature silhouette
      if (v.y < -0.6) {
        const bottomFactor = (-v.y - 0.6) / 0.65;
        v.y += bottomFactor * 0.22;
      }

      // Smooth dome top
      if (v.y > 0.8) {
        const topFactor = (v.y - 0.8) / 0.45;
        v.y += topFactor * 0.1;
      }

      pos.setXYZ(i, v.x, v.y, v.z);
    }
    baseGeo.computeVertexNormals();

    // ─── Soft Subsurface Scattering Physical Material ───
    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xfff7f6),
      roughness: 0.32,
      metalness: 0.02,
      transmission: 0.18,
      thickness: 1.2,
      ior: 1.45,
      sheen: 1.0,
      sheenRoughness: 0.28,
      sheenColor: new THREE.Color(0xf6d5df),
      clearcoat: 0.3,
      clearcoatRoughness: 0.15,
    });

    const bodyMesh = new THREE.Mesh(baseGeo, bodyMaterial);
    characterGroup.add(bodyMesh);

    // ─── Cute Happy 3D Arched Eyes ───
    const eyeMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0x280b18), // Deep plum
    });

    // Arch curve for smiling eye (◠)
    const eyeRadius = 0.15;
    const eyeTube = 0.038;
    const eyeGeo = new THREE.TorusGeometry(eyeRadius, eyeTube, 16, 32, Math.PI * 0.92);

    // Left Eye
    const leftEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    leftEye.position.set(-0.35, 0.18, 1.16);
    leftEye.rotation.set(-0.15, -0.12, Math.PI * 0.04);
    characterGroup.add(leftEye);

    // Right Eye
    const rightEye = new THREE.Mesh(eyeGeo, eyeMaterial);
    rightEye.position.set(0.35, 0.18, 1.16);
    rightEye.rotation.set(-0.15, 0.12, -Math.PI * 0.04);
    characterGroup.add(rightEye);

    // ─── Soft Rosy Cheeks ───
    const cheekGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const cheekMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xf4b6c6),
      transparent: true,
      opacity: 0.45,
    });

    const leftCheek = new THREE.Mesh(cheekGeo, cheekMaterial);
    leftCheek.position.set(-0.64, -0.05, 1.05);
    leftCheek.scale.set(1, 0.6, 0.25);
    characterGroup.add(leftCheek);

    const rightCheek = new THREE.Mesh(cheekGeo, cheekMaterial);
    rightCheek.position.set(0.64, -0.05, 1.05);
    rightCheek.scale.set(1, 0.6, 0.25);
    characterGroup.add(rightCheek);

    // ─── Atmospheric Studio Lighting ───
    // Soft warm ambient
    const ambientLight = new THREE.AmbientLight(0xfff3ea, 1.4);
    scene.add(ambientLight);

    // Key light (warm ivory/pink from top-front)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(2, 4, 4);
    scene.add(keyLight);

    // Rim light 1 (soft magenta/lavender from behind-left)
    const rimLight1 = new THREE.PointLight(0xf2a4cb, 3.2, 10);
    rimLight1.position.set(-3.5, 1.5, -2);
    scene.add(rimLight1);

    // Rim light 2 (gentle peach/gold from behind-right)
    const rimLight2 = new THREE.PointLight(0xffd4b8, 2.6, 10);
    rimLight2.position.set(3.5, -0.5, -1.5);
    scene.add(rimLight2);

    // Bottom fill light
    const fillLight = new THREE.PointLight(0xf8d7e3, 1.2, 8);
    fillLight.position.set(0, -3, 2);
    scene.add(fillLight);

    // ─── Interactive Motion & Physics State ───
    let mouseX = 0;
    let mouseY = 0;
    let targetRotY = 0;
    let targetRotX = 0;
    let targetScaleX = 1;
    let targetScaleY = 1;
    let targetScaleZ = 1;
    let squishVelocity = 0;
    let currentScaleY = 1;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - (rect.left + rect.width / 2);
      const clientY = e.clientY - (rect.top + rect.height / 2);

      // Normalize coordinates
      mouseX = Math.max(-1, Math.min(1, clientX / 300));
      mouseY = Math.max(-1, Math.min(1, clientY / 200));

      targetRotY = mouseX * 0.45; // Turn head left/right
      targetRotX = -mouseY * 0.28; // Tilt head up/down
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Squish on click
    const handlePointerDown = () => {
      squishVelocity = -0.35;
      targetScaleY = 0.78;
      targetScaleX = 1.22;
      targetScaleZ = 1.22;
    };

    const handlePointerUp = () => {
      targetScaleY = 1;
      targetScaleX = 1;
      targetScaleZ = 1;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    // ─── Animation Loop ───
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Smooth camera / rotation follow with damping
      characterGroup.rotation.y += (targetRotY - characterGroup.rotation.y) * 0.08;
      characterGroup.rotation.x += (targetRotX - characterGroup.rotation.x) * 0.08;
      characterGroup.rotation.z = -characterGroup.rotation.y * 0.15; // Natural subtle roll

      // Natural breathing & floating motion
      const floatOffset = Math.sin(time * 2.2) * 0.08;
      characterGroup.position.y = floatOffset;

      // Subtle breathing scale
      const breathScale = 1 + Math.sin(time * 2.2) * 0.02;

      // Spring physics for squish on click
      squishVelocity += (targetScaleY - currentScaleY) * 0.2;
      squishVelocity *= 0.72; // Damping
      currentScaleY += squishVelocity;

      const dynamicScaleY = currentScaleY * breathScale;
      const dynamicScaleXZ = (2 - currentScaleY) * breathScale;

      characterGroup.scale.set(dynamicScaleXZ, dynamicScaleY, dynamicScaleXZ);

      // Subtle blinking/winking effect every ~4.5 seconds
      const blinkCycle = time % 4.8;
      if (blinkCycle > 4.65) {
        const blinkAmount = Math.sin((blinkCycle - 4.65) / 0.15 * Math.PI);
        leftEye.scale.y = 1 - blinkAmount * 0.85;
        rightEye.scale.y = 1 - blinkAmount * 0.85;
      } else {
        leftEye.scale.y = 1;
        rightEye.scale.y = 1;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      renderer.dispose();
      baseGeo.dispose();
      bodyMaterial.dispose();
      eyeGeo.dispose();
      eyeMaterial.dispose();
      cheekGeo.dispose();
      cheekMaterial.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'grab',
        userSelect: 'none',
        marginBottom: '10px',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsClicked(true)}
      onMouseUp={() => setIsClicked(false)}
      title="Click or move your mouse to play with Murmur!"
    >
      {/* Soft Ground Radial Glow / Shadow under 3D Character */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          width: '150px',
          height: '26px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(239, 164, 191, 0.45) 0%, rgba(246, 227, 215, 0.25) 45%, transparent 75%)',
          filter: 'blur(7px)',
          transform: isClicked ? 'scale(1.25)' : 'scale(1)',
          transition: 'transform 0.15s ease',
          pointerEvents: 'none',
        }}
      />

      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        style={{
          width: '340px',
          height: '240px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />

      {/* Hand-drawn Whimsical Annotation: "Same brain. Less friction." */}
      <div
        style={{
          position: 'absolute',
          top: '26px',
          right: '-44px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          pointerEvents: 'none',
          animation: 'murmurFloat 4s ease-in-out infinite',
        }}
      >
        <div
          style={{
            fontFamily: 'Caveat, "Comic Sans MS", -apple-system, sans-serif',
            fontSize: '18px',
            lineHeight: '1.2',
            fontWeight: 600,
            color: '#655752',
            letterSpacing: '0.01em',
            transform: 'rotate(-4deg)',
            textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)',
          }}
        >
          Same brain.
          <br />
          Less friction.
        </div>

        {/* Hand-drawn curved arrow pointing to the 3D character */}
        <svg
          width="48"
          height="38"
          viewBox="0 0 52 40"
          fill="none"
          stroke="#655752"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginTop: '2px',
            marginLeft: '4px',
            opacity: 0.85,
            transform: 'rotate(-10deg)',
          }}
        >
          <path d="M 38 6 C 24 16, 12 24, 6 34" />
          <polyline points="2 28 6 34 14 32" />
        </svg>
      </div>

      <style jsx>{`
        @keyframes murmurFloat {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-4px) rotate(0.5deg);
          }
        }
      `}</style>
    </div>
  );
}
