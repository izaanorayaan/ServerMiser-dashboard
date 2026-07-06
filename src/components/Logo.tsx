import React from "react";

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  glow?: boolean;
  className?: string;
}

export default function Logo({ size = 200, glow = true, className, ...props }: LogoProps) {
  return (
    <div
      className={`relative inline-block ${className || ""}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Glow Effect - Always highly visible */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-60 pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(255,59,92,0.6) 0%, rgba(46,123,143,0.4) 50%, rgba(226,249,184,0.3) 100%)",
            transform: "scale(1.1)",
          }}
        />
      )}

      <svg
        viewBox="0 0 400 400"
        width="100%"
        height="100%"
        className="relative z-10 w-full h-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        {...props}
      >
        <defs>
          {/* Base Dark/Teal Space Gradient - Adjusted to be more visible and vivid */}
          <radialGradient id="baseSpace" cx="65%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#254d66" />
            <stop offset="40%" stopColor="#173245" />
            <stop offset="80%" stopColor="#0f1f2e" />
            <stop offset="100%" stopColor="#08101a" />
          </radialGradient>

          {/* Yellow Glow at Top Left */}
          <radialGradient id="yellowGlow" cx="28%" cy="28%" r="45%">
            <stop offset="0%" stopColor="#e2f9b8" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#c5e691" stopOpacity="0.7" />
            <stop offset="75%" stopColor="#2e7b8f" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#173245" stopOpacity="0" />
          </radialGradient>

          {/* Vivid Pink/Red Glow at Bottom Left */}
          <radialGradient id="pinkGlow" cx="18%" cy="72%" r="48%">
            <stop offset="0%" stopColor="#ff3b5c" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#d91e46" stopOpacity="0.7" />
            <stop offset="75%" stopColor="#54133b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f1f2e" stopOpacity="0" />
          </radialGradient>

          {/* Beautiful high-contrast neon linear gradient for the outer planet ring */}
          <linearGradient id="neonRimGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2f9b8" />
            <stop offset="35%" stopColor="#2e7b8f" />
            <stop offset="70%" stopColor="#ff3b5c" />
            <stop offset="100%" stopColor="#e2f9b8" />
          </linearGradient>

          {/* Dark crater stroke shadow effect */}
          <filter id="craterShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feOffset dx="1" dy="2" />
            <feGaussianBlur stdDeviation="1.5" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.7" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* The Base Sphere with highly visible neon border stroke */}
        <circle 
          cx="200" 
          cy="200" 
          r="180" 
          fill="url(#baseSpace)" 
          stroke="url(#neonRimGradient)"
          strokeWidth="8"
        />

        {/* Overlay Glows for dynamic shading - using standard SVG opacity for bulletproof browser compatibility */}
        <circle cx="200" cy="200" r="176" fill="url(#yellowGlow)" opacity="0.85" />
        <circle cx="200" cy="200" r="176" fill="url(#pinkGlow)" opacity="0.85" />

        {/* Moon/Planet Crater Features - Stylized as glowing high-tech cyber craters */}
        {/* Large Top Crater */}
        <g filter="url(#craterShadow)">
          <circle
            cx="165"
            cy="115"
            r="42"
            fill="none"
            stroke="#ff3b5c"
            strokeWidth="3.5"
            strokeOpacity="0.85"
          />
        </g>
        {/* Bottom Left Crater */}
        <g filter="url(#craterShadow)">
          <circle
            cx="112"
            cy="222"
            r="32"
            fill="none"
            stroke="#e2f9b8"
            strokeWidth="3.2"
            strokeOpacity="0.9"
          />
        </g>
        {/* Center Right Crater */}
        <g filter="url(#craterShadow)">
          <circle
            cx="232"
            cy="156"
            r="19"
            fill="none"
            stroke="#2e7b8f"
            strokeWidth="2.8"
            strokeOpacity="0.85"
          />
        </g>
        {/* Mid-Left Crater */}
        <g filter="url(#craterShadow)">
          <circle
            cx="96"
            cy="154"
            r="16"
            fill="none"
            stroke="#ff3b5c"
            strokeWidth="2.5"
            strokeOpacity="0.85"
          />
        </g>
        {/* Center-Mid-Right Crater */}
        <g filter="url(#craterShadow)">
          <circle
            cx="188"
            cy="222"
            r="23"
            fill="none"
            stroke="#e2f9b8"
            strokeWidth="2.8"
            strokeOpacity="0.9"
          />
        </g>
        {/* Bottom-Mid Crater */}
        <g filter="url(#craterShadow)">
          <circle
            cx="173"
            cy="286"
            r="13"
            fill="none"
            stroke="#2e7b8f"
            strokeWidth="2.2"
            strokeOpacity="0.85"
          />
        </g>

        {/* Overlay subtle shine representing coin border rim */}
        <circle
          cx="200"
          cy="200"
          r="179"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeOpacity="0.3"
        />
        <circle
          cx="200"
          cy="200"
          r="178"
          fill="none"
          stroke="black"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
      </svg>
    </div>
  );
}
