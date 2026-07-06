import React, { useState } from "react";
import { motion, useAnimation } from "motion/react";
import Coin from "./Coin";
import { Sparkles, HelpCircle, Swords, AlertCircle, ArrowRight, RotateCcw, Flame, ThumbsUp } from "lucide-react";

interface Dilemma {
  id: string;
  question: string;
  context: string;
  headsResult: {
    title: string;
    description: string;
    action: string;
  };
  tailsResult: {
    title: string;
    description: string;
    action: string;
  };
}

const DILEMMAS: Dilemma[] = [
  {
    id: "prune",
    question: "Should we prune 500 members inactive for 60+ days?",
    context: "Our member count is high, but chat activity feels quiet and server loading times are slowing down.",
    headsResult: {
      title: "Heads: The Aggressive Purge!",
      description: "Prune them instantly! Free up the roster, improve member quality ratio, and restore active server speed.",
      action: "ServerMiser automates this! Run a 'dry-run' first using /prune dry, then let the bot handle the eviction smoothly."
    },
    tailsResult: {
      title: "Tails: Active Re-Engagement",
      description: "Keep them, but trigger a wake-up campaign. Push a custom automated survey or server game invite to see who stays.",
      action: "Use ServerMiser's /engage start. It identifies cold accounts and privately nudges them with low-stress, playful polls."
    }
  },
  {
    id: "roles",
    question: "Should we delete 20+ unused booster/event staff roles?",
    context: "Our roles directory stretches forever. Staff are confused, and permissions are overlapping dangerously.",
    headsResult: {
      title: "Heads: Role Consolidation",
      description: "Wipe them out. Consolidate into 3 simple role groups. Prevent 'permission creep' where retired mods still have admin access.",
      action: "Use /audit roles. ServerMiser lists safe-to-delete tags and can sweep 25 bloated roles in seconds."
    },
    tailsResult: {
      title: "Tails: Structured Archive",
      description: "Keep the roles but completely strip their active permissions, moving them to a locked folder for historical record.",
      action: "Set up /roles locker. ServerMiser locks down any role with zero users, safe-guarding server security automatically."
    }
  },
  {
    id: "bot_spam",
    question: "Should we delete spam commands 5 minutes after they run?",
    context: "Bots are filling our channels with music, rank, and coin command spam, making conversations unreadable.",
    headsResult: {
      title: "Heads: Instant Clean Sweep",
      description: "Delete them! Keep channels pristine. Let people play, but wipe all prefix and slash commands after 5 minutes.",
      action: "Enable ServerMiser's /miser auto-clean channel:#bot-commands delay:5m. Your logs remain perfectly tidy."
    },
    tailsResult: {
      title: "Tails: Designated Quiet Thread",
      description: "Redirect all bot commands into automated private threads that auto-archive themselves after 1 hour of silence.",
      action: "Set up /miser bot-threads. ServerMiser detects bot commands, moves them to a thread, and sweeps them later."
    }
  }
];

export default function CoinFlipPlayground() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [outcome, setOutcome] = useState<"heads" | "tails" | null>(null);
  
  // Custom rotation and displacement values for coin-tossing
  const [coinRotateY, setCoinRotateY] = useState(0);
  const [coinRotateX, setCoinRotateX] = useState(0);
  const [coinY, setCoinY] = useState(0);
  const [coinScale, setCoinScale] = useState(1);

  const activeDilemma = DILEMMAS[selectedIdx];

  const handleFlip = () => {
    if (isFlipping) return;

    setIsFlipping(true);
    setOutcome(null);

    // Randomize Heads (logo, 0 or 360 multiples) or Tails (miser back, 180 or 540 multiples)
    const coinLandedHeads = Math.random() > 0.5;
    
    // Calculate dramatic spinning rotations (5 full spins minimum)
    const spins = 5 + Math.floor(Math.random() * 3);
    const targetY = coinRotateY + spins * 360 + (coinLandedHeads ? 0 : 180);
    // Toss wobble rotation
    const targetX = coinRotateX + (Math.random() > 0.5 ? 360 : -360) + 15;

    // Trigger sequential animations for physical coin feel (launch, flip, land)
    // 1. Launch & Scale
    setCoinScale(1.3);
    setCoinY(-180); // fly up
    setCoinRotateY(targetY);
    setCoinRotateX(targetX);

    // 2. Fall back down (using timer matching transition)
    setTimeout(() => {
      setCoinY(0); // land back
      setCoinScale(1.0);
    }, 600);

    // 3. Complete and show results
    setTimeout(() => {
      setIsFlipping(false);
      setOutcome(coinLandedHeads ? "heads" : "tails");
    }, 1100);
  };

  const handleReset = () => {
    setOutcome(null);
    setIsFlipping(false);
    setCoinY(0);
    setCoinScale(1);
    // return to 0 state smoothly
    setCoinRotateY(0);
    setCoinRotateX(0);
  };

  return (
    <section id="playground" className="py-24 bg-[#0a0c16] relative overflow-hidden">
      {/* Absolute glow overlays */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ff3b5c]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 left-1/3 w-[300px] h-[300px] bg-[#2e7b8f]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 max-w-5xl relative z-10">
        
        {/* Title & Introduction */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-[#e2f9b8] font-mono tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            <span>INTERACTIVE STRESS-TEST</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold font-sans tracking-tight text-slate-100">
            Let the Miser Coin Decide
          </h2>
          <p className="text-slate-400 text-sm mt-3 leading-relaxed">
            Stuck in server owner indecision? Select a common community dilemma, flip our branding coin, and see how ServerMiser turns chaotic coin flips into automated, structured actions.
          </p>
        </div>

        {/* --- PLAYGROUND GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-900/40 backdrop-blur-md rounded-3xl p-6 md:p-10 border border-slate-800/80 shadow-2xl">
          
          {/* Dilemma Selector Column */}
          <div className="col-span-1 lg:col-span-5 flex flex-col gap-5">
            <h3 className="text-xs font-mono tracking-widest text-slate-500 uppercase flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#2e7b8f]" />
              Select Your Server Dilemma
            </h3>

            <div className="flex flex-col gap-3">
              {DILEMMAS.map((dil, idx) => {
                const isActive = selectedIdx === idx;
                return (
                  <button
                    key={dil.id}
                    onClick={() => {
                      if (!isFlipping) {
                        setSelectedIdx(idx);
                        setOutcome(null);
                      }
                    }}
                    disabled={isFlipping}
                    className={`text-left p-4 rounded-xl border transition-all duration-300 flex flex-col gap-1 cursor-pointer ${
                      isActive
                        ? "bg-[#111628] border-[#2e7b8f]/40 shadow-md scale-[1.01]"
                        : "bg-slate-950/40 border-slate-800/40 hover:bg-slate-900/60"
                    }`}
                  >
                    <span className={`text-[10px] font-mono tracking-wider uppercase font-semibold ${
                      isActive ? "text-[#e2f9b8]" : "text-slate-500"
                    }`}>
                      Dilemma #{idx + 1}
                    </span>
                    <span className={`font-semibold text-sm ${isActive ? "text-slate-100" : "text-slate-400"}`}>
                      {dil.question}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Question Details */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 mt-2">
              <span className="text-[9px] font-mono tracking-widest text-slate-500 uppercase block mb-1">Context Background</span>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                {activeDilemma.context}
              </p>
            </div>
          </div>

          {/* Coin Flipping Action Column */}
          <div className="col-span-1 lg:col-span-7 flex flex-col items-center justify-center py-8 relative min-h-[440px] border-t lg:border-t-0 lg:border-l border-slate-800/60 lg:pl-10">
            
            {/* Launchpad stand graphic */}
            <div className="absolute w-[220px] h-[220px] rounded-full border border-dashed border-slate-800/80 flex items-center justify-center animate-spin [animation-duration:40s]">
              <div className="w-[180px] h-[180px] rounded-full border border-dashed border-slate-700/30" />
            </div>

            {/* The 3D Coin Object */}
            <div className="relative z-10 my-8">
              <Coin
                size={180}
                rotateY={coinRotateY}
                rotateX={coinRotateX}
                y={coinY}
                scale={coinScale}
                interactive={!isFlipping}
              />
            </div>

            {/* Action Trigger / Flip Trigger */}
            <div className="flex items-center gap-3 relative z-10">
              <button
                onClick={handleFlip}
                disabled={isFlipping}
                className={`px-8 py-3.5 rounded-full font-bold text-sm tracking-wide transition-all shadow-lg shadow-black/40 flex items-center gap-2 cursor-pointer ${
                  isFlipping
                    ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#2e7b8f] to-[#ff3b5c] text-slate-100 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95 border border-slate-700/30"
                }`}
              >
                {isFlipping ? "MISER COIN TOSSING..." : "TOSS THE MISER COIN"}
              </button>

              {outcome && (
                <button
                  onClick={handleReset}
                  className="p-3.5 rounded-full bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title="Reset Coin Angle"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Outcome Display Card */}
            {outcome && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className={`mt-8 w-full p-5 rounded-2xl border bg-slate-950/80 backdrop-blur-md relative z-10 ${
                  outcome === "heads" ? "border-[#e2f9b8]/30" : "border-[#ff3b5c]/30"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${
                    outcome === "heads" ? "bg-[#e2f9b8]/10 text-[#e2f9b8]" : "bg-[#ff3b5c]/10 text-[#ff3b5c]"
                  }`}>
                    {outcome === "heads" ? <Flame className="w-5 h-5" /> : <ThumbsUp className="w-5 h-5" />}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1 text-left">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                      Landed Decision
                    </span>
                    <h4 className="text-base font-bold text-slate-200">
                      {outcome === "heads" ? activeDilemma.headsResult.title : activeDilemma.tailsResult.title}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">
                      {outcome === "heads" ? activeDilemma.headsResult.description : activeDilemma.tailsResult.description}
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-900 flex flex-col gap-1 bg-[#060810]/60 p-3 rounded-lg border border-slate-800/40">
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">How ServerMiser Automates This:</span>
                      <p className="text-xs text-[#e2f9b8]/90 font-sans mt-0.5 leading-relaxed">
                        {outcome === "heads" ? activeDilemma.headsResult.action : activeDilemma.tailsResult.action}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {!outcome && !isFlipping && (
              <p className="mt-4 text-xs font-mono text-slate-500 text-center animate-pulse">
                👈 Pick a dilemma, then spin to resolve!
              </p>
            )}

          </div>

        </div>

      </div>
    </section>
  );
}
