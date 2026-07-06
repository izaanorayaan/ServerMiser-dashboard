import React from "react";
import { motion, MotionValue } from "motion/react";
import Logo from "./Logo";

interface CoinProps {
  size?: number;
  rotateY?: MotionValue<number> | number;
  rotateX?: MotionValue<number> | number;
  y?: MotionValue<number> | number;
  scale?: MotionValue<number> | number;
  interactive?: boolean;
}

export default function Coin({
  size = 220,
  rotateY = 0,
  rotateX = 0,
  y = 0,
  scale = 1,
  interactive = true,
}: CoinProps) {
  // Local state to capture gentle hover tilt if the parent controls are not overriding
  const [hoverTilt, setHoverTilt] = React.useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = React.useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    
    // Tilt max 20 degrees
    const rX = -(mouseY / (height / 2)) * 20;
    const rY = (mouseX / (width / 2)) * 20;
    setHoverTilt({ x: rX, y: rY });
  };

  const handleMouseLeave = () => {
    setHoverTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{
        width: size,
        height: size,
        perspective: 1200,
      }}
    >
      <motion.div
        className="w-full h-full relative cursor-grab active:cursor-grabbing"
        style={{
          transformStyle: "preserve-3d",
          rotateY: isHovered && interactive ? hoverTilt.y : rotateY,
          rotateX: isHovered && interactive ? hoverTilt.x : rotateX,
          y,
          scale,
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        transition={
          isHovered
            ? { type: "spring", stiffness: 150, damping: 15 }
            : { type: "spring", stiffness: 80, damping: 20 }
        }
      >
        {/* --- FRONT SIDE --- */}
        <div
          className="absolute inset-0 w-full h-full rounded-full"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <Logo size={size} glow={true} />
        </div>

        {/* --- BACK SIDE --- */}
        <div
          className="absolute inset-0 w-full h-full rounded-full flex items-center justify-center bg-radial from-[#1e293b] via-[#0f172a] to-[#020617] border border-slate-700 shadow-2xl overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            boxShadow: "inset 0 0 25px rgba(0,0,0,0.9), 0 10px 30px rgba(0,0,0,0.8)",
          }}
        >
          {/* Inside Gradient and Ring */}
          <div className="absolute inset-1 rounded-full border-2 border-dashed border-slate-600/40 flex items-center justify-center bg-slate-950/80">
            {/* Elegant metallic concentric circles */}
            <div className="absolute inset-4 rounded-full border border-slate-700/60 flex items-center justify-center">
              <div className="absolute inset-6 rounded-full border border-slate-800 flex items-center justify-center bg-[#090d16]">
                
                {/* Branding "M" Mascot / Savings Vault */}
                <svg
                  viewBox="0 0 100 100"
                  className="w-16 h-16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="backMiserGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e2f9b8" />
                      <stop offset="50%" stopColor="#2e7b8f" />
                      <stop offset="100%" stopColor="#ff3b5c" />
                    </linearGradient>
                  </defs>
                  
                  {/* Outer Vault Ring */}
                  <circle cx="50" cy="50" r="40" stroke="url(#backMiserGlow)" strokeWidth="1" strokeDasharray="3 3" />
                  
                  {/* Stylized M / Vault Crest */}
                  <path
                    d="M30 65 V35 L50 50 L70 35 V65"
                    stroke="url(#backMiserGlow)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M30 65 L40 68 L50 65 L60 68 L70 65"
                    stroke="url(#backMiserGlow)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Shield frame backing */}
                  <path
                    d="M22 45 C22 25, 50 15, 50 15 C50 15, 78 25, 78 45 C78 68, 50 82, 50 82 C50 82, 22 68, 22 45 Z"
                    stroke="url(#backMiserGlow)"
                    strokeWidth="1.5"
                    strokeOpacity="0.4"
                    fill="none"
                  />
                </svg>

              </div>
            </div>

            {/* Glowing branding gradient ring on edge */}
            <div className="absolute inset-0 rounded-full border border-slate-500/20 mix-blend-overlay pointer-events-none" />

            {/* Micro-engravings for texture */}
            <div className="absolute top-2.5 text-[7px] font-mono tracking-widest text-[#e2f9b8]/60 uppercase">
              • SERVERMISER •
            </div>
            <div className="absolute bottom-2.5 text-[7px] font-mono tracking-widest text-[#ff3b5c]/60 uppercase">
              • SECURE & LEAN •
            </div>
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 -rotate-90 text-[7px] font-mono tracking-widest text-slate-500 uppercase">
              DECISIONS
            </div>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[7px] font-mono tracking-widest text-slate-500 uppercase">
              SAVINGS
            </div>
          </div>

          {/* Golden/Silver Rim Highlight */}
          <div className="absolute inset-0 rounded-full border-4 border-slate-800/80 pointer-events-none" />
          <div className="absolute inset-1 rounded-full border border-slate-700/50 pointer-events-none" />
        </div>
      </motion.div>
    </div>
  );
}
