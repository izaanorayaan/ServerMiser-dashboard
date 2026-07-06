import React, { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform, useSpring, useMotionValue, useMotionValueEvent } from "motion/react";
import Coin from "./Coin";
import { 
  Sparkles, 
  ArrowDown, 
  Settings, 
  MessageSquare, 
  Award, 
  Shield, 
  Users, 
  ArrowRight,
  ExternalLink,
  Check
} from "lucide-react";

interface ScrollJourneyProps {
  triggerAuthFlow: () => void;
  onIntroComplete?: (completed: boolean) => void;
}

export default function ScrollJourney({ triggerAuthFlow, onIntroComplete }: ScrollJourneyProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [introPhase, setIntroPhase] = useState<"falling" | "landing" | "completed">("falling");

  // Track responsive screen sizing for layout scaling and coin scaling
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDesktop = windowWidth >= 1024;

  // Notify parent of intro status
  useEffect(() => {
    if (onIntroComplete) {
      onIntroComplete(introPhase === "completed");
    }
  }, [introPhase, onIntroComplete]);

  // Motion values for the initial 5-second automatic intro animation
  const introRotateY = useMotionValue(0);
  const introRotateX = useMotionValue(0);
  const introY = useMotionValue(0);
  const introScale = useMotionValue(1.8);

  useEffect(() => {
    let active = true;
    const startTime = performance.now();
    
    const frame = (now: number) => {
      if (!active) return;
      const elapsed = (now - startTime) / 1000; // in seconds
      
      if (elapsed < 4.2) {
        // --- 1. FALLING PHASE (0.0s to 4.2s) ---
        // Rapid 3D spin on Y axis
        const rotY = (elapsed * 1080) % 360;
        introRotateY.set(rotY);
        
        // Wobble on X axis (wind resistance)
        const rotX = Math.sin(elapsed * 3.5) * 18;
        introRotateX.set(rotX);
        
        // Continuous falling air-drift vertical motion
        const yVal = Math.sin(elapsed * 5) * 15;
        introY.set(yVal);
        
        // Massive focus scale
        introScale.set(1.8);
        
      } else if (elapsed < 5.0) {
        // --- 2. LANDING PHASE (4.2s to 5.0s) ---
        setIntroPhase("landing");
        
        const t = (elapsed - 4.2) / 0.8; // Normalized progress 0 to 1
        
        // Ease-out curve for rotation and landing
        const easeOut = 1 - Math.pow(1 - t, 3); // cubic ease out
        const easeOutBounce = (x: number): number => {
          const n1 = 7.5625;
          const d1 = 2.75;
          if (x < 1 / d1) {
            return n1 * x * x;
          } else if (x < 2 / d1) {
            return n1 * (x -= 1.5 / d1) * x + 0.75;
          } else if (x < 2.5 / d1) {
            return n1 * (x -= 2.25 / d1) * x + 0.9375;
          } else {
            return n1 * (x -= 2.625 / d1) * x + 0.984375;
          }
        };

        // Smoothly bring Y rotation to rest (let's say 0 degrees)
        const currentRotY = (4.2 * 1080) % 360;
        const rotY = currentRotY + (360 - currentRotY) * easeOut;
        introRotateY.set(rotY);
        
        // Rotate X to 75 degrees (lay face to the ground flat perspective)
        const startRotX = Math.sin(4.2 * 3.5) * 18;
        const rotX = startRotX + (75 - startRotX) * easeOut;
        introRotateX.set(rotX);
        
        // drop vertically onto the "ground" with a beautiful physically simulated bounce
        const startY = Math.sin(4.2 * 5) * 15;
        const targetLandingY = isDesktop ? 130 : 100;
        const yVal = startY + (targetLandingY - startY) * easeOutBounce(t);
        introY.set(yVal);
        
        // Settle scale to landed scale
        const scaleVal = 1.8 + (1.2 - 1.8) * easeOut;
        introScale.set(scaleVal);
        
      } else {
        // --- 3. COMPLETED PHASE (5.0s+) ---
        setIntroPhase("completed");
        active = false;
      }
      
      if (active) {
        requestAnimationFrame(frame);
      }
    };
    
    requestAnimationFrame(frame);
    return () => {
      active = false;
    };
  }, [isDesktop]);

  // Track scroll progress of the entire 500vh container (5 sequential view states)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Create smooth spring animations for scroll progress to prevent jitter
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 85,
    damping: 24,
    mass: 0.7,
  });

  // Create a continuous motion value for the slow idle spin at the top
  const idleRotationMV = useMotionValue(0);

  useEffect(() => {
    let active = true;
    const speed = 0.025; // degrees per millisecond
    let lastTime = performance.now();

    const frame = (now: number) => {
      if (!active) return;
      const delta = now - lastTime;
      lastTime = now;
      idleRotationMV.set((idleRotationMV.get() + delta * speed) % 360);
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
    return () => {
      active = false;
    };
  }, [idleRotationMV]);

  // Track reactive active slide indexes to prevent z-index/opacity card overlapping
  const [activeIndex, setActiveIndex] = useState(0);

  useMotionValueEvent(smoothProgress, "change", (latest) => {
    const p = latest as number;
    if (p < 0.20) {
      setActiveIndex(0);
    } else if (p < 0.40) {
      setActiveIndex(1);
    } else if (p < 0.60) {
      setActiveIndex(2);
    } else if (p < 0.80) {
      setActiveIndex(3);
    } else {
      setActiveIndex(4);
    }
  });

  const coinSize = windowWidth < 1024 ? 190 : 290;

  const scrollToSlide = (index: number) => {
    if (!containerRef.current) return;
    const totalHeight = containerRef.current.clientHeight;
    const viewportHeight = window.innerHeight;
    
    let progressMultiplier = 0;
    if (index === 0) progressMultiplier = 0.05;
    else if (index === 1) progressMultiplier = 0.30;
    else if (index === 2) progressMultiplier = 0.50;
    else if (index === 3) progressMultiplier = 0.70;
    else if (index === 4) progressMultiplier = 0.90;

    const targetY = containerRef.current.offsetTop + (totalHeight - viewportHeight) * progressMultiplier;
    
    window.scrollTo({
      top: targetY,
      behavior: "smooth"
    });
  };

  // Top-level motion transforms to comply with React hook rules (declared unconditionally)
  const introShadowScale = useTransform(introScale, [1.2, 1.8], [0.6, 1.3]);
  const introShadowOpacity = useTransform(introY, [-40, 140], [0.25, 0.85]);
  const guidanceOpacity = useTransform(smoothProgress, [0, 0.08], [1, 0]);
  const ringOpacity = useTransform(smoothProgress, [0, 0.12], [0, 1]);
  const ring1Scale = useTransform(smoothProgress, [0, 0.12], [0.5, 1.05]);
  const ring2Scale = useTransform(smoothProgress, [0, 0.12], [0.5, 1.1]);
  const faceLabelOpacity = useTransform(smoothProgress, [0, 0.12, 0.9, 1], [0, 0.8, 0.8, 0.3]);

  // Seamless hand-off from idle turning to scroll-controlled coin flip
  const rotateY = useTransform(
    [smoothProgress, idleRotationMV],
    ([p, idle]) => {
      const pVal = (p as number) || 0;
      const idleVal = (idle as number) || 0;
      const blend = Math.max(0, 1 - pVal / 0.02);
      
      let scrollRot = 0;
      if (pVal <= 0.08) {
        scrollRot = (pVal / 0.08) * 720;
      } else {
        scrollRot = 720 + ((pVal - 0.08) / (1 - 0.08)) * (2160 - 720);
      }
      
      return scrollRot * (1 - blend) + idleVal * blend;
    }
  );

  // Wobble rotation on X-axis to simulate physical organic coin tumbling during scrolls
  const rotateX = useTransform(smoothProgress,
    [0, 0.08, 0.20, 0.40, 0.60, 0.80, 1.0],
    [75, 0, 25, -25, 20, -20, 0]
  );

  // Map coin vertical positioning: keeping bounds beautiful and prominent to show a real physical toss & fall motion
  const coinY = useTransform(smoothProgress,
    [0, 0.03, 0.06, 0.08, 0.20, 0.40, 0.60, 0.80, 1.0],
    [isDesktop ? 130 : 100, -160, 180, 0, 0, -130, 130, -90, 0]
  );

  // Map coin scaling
  const coinScale = useTransform(smoothProgress,
    [0, 0.03, 0.06, 0.08, 0.20, 0.40, 0.60, 0.80, 1.0],
    [1.2, 2.1, 0.7, 1.0, 1.0, 1.25, 0.85, 1.2, 1.0]
  );

  // horizontal centering shift: from 29.2vw (centered) to 0 (its normal left position)
  const coinCenterX = useTransform(smoothProgress, [0, 0.08], [isDesktop ? "29.2vw" : "0vw", "0vw"]);
  
  // vertical centering shift: on mobile from 15vh to 0, on desktop from 0 to 0
  const coinCenterY = useTransform(smoothProgress, [0, 0.08], [isDesktop ? "0vh" : "15vh", "0vh"]);

  // Dynamic backlights matching active section color themes
  const activeColorGlow = useTransform(smoothProgress,
    [0, 0.20, 0.40, 0.60, 0.80, 1.0],
    [
      "radial-gradient(circle, rgba(226,249,184,0.12) 0%, rgba(0,0,0,0) 70%)", // Slide 0 (Hero)
      "radial-gradient(circle, rgba(226,249,184,0.3) 0%, rgba(0,0,0,0) 70%)",  // Slide 1 (Server Setup)
      "radial-gradient(circle, rgba(46,123,143,0.3) 0%, rgba(0,0,0,0) 70%)",   // Slide 2 (Ticketing)
      "radial-gradient(circle, rgba(255,59,92,0.3) 0%, rgba(0,0,0,0) 70%)",    // Slide 3 (Leveling)
      "radial-gradient(circle, rgba(99,102,241,0.3) 0%, rgba(0,0,0,0) 70%)",   // Slide 4 (Moderation)
      "radial-gradient(circle, rgba(226,249,184,0.15) 0%, rgba(0,0,0,0) 70%)", // Settled
    ]
  );

  const focusMV = useTransform(smoothProgress, [0, 0.20, 0.40, 0.60, 0.80, 1.0], [
    "ServerMiser Logo • Turning Slowly",
    "Yellow Energy • Auto-Server Setup",
    "Teal Shield • Ticketing System",
    "Coral Flare • Leveling Core",
    "Indigo Force • Smart Moderation",
    "All Systems Armed • Secure & Lean",
  ]);

  const [currentFocus, setCurrentFocus] = useState("ServerMiser Logo • Turning Slowly");

  useMotionValueEvent(focusMV, "change", (latest) => {
    setCurrentFocus(latest as string);
  });

  return (
    <div ref={containerRef} id="features" className="relative h-[500vh] bg-[#070913]">
      
      {/* Background elegant grid layout */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* Sticky viewport frame tracking the entire user transition */}
      <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
        
        {/* Active color glow aura behind the coin */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full pointer-events-none blur-3xl transition-all duration-500 opacity-60"
          style={{ background: activeColorGlow }}
        />

        {/* Floating guidance banner at the bottom (fades out as scroll starts) */}
        {introPhase === "completed" && (
          <motion.div 
            style={{
              opacity: guidanceOpacity
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center text-slate-500 text-xs font-mono tracking-widest animate-pulse pointer-events-none z-20"
          >
            <span>SCROLL DOWN TO FLIP THE COIN</span>
            <ArrowDown className="w-4 h-4 mt-1 text-slate-400" />
          </motion.div>
        )}

        {/* --- INITIAL 5-SECOND AUTOFIP CINEMATIC INTRO OVERLAY --- */}
        {introPhase !== "completed" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
            <div className="relative flex flex-col items-center justify-center">
              <Coin
                size={coinSize}
                rotateY={introRotateY}
                rotateX={introRotateX}
                y={introY}
                scale={introScale}
                interactive={false}
              />
              {/* Elegant dynamic landing shadow below the coin */}
              <motion.div 
                className="w-32 h-4 rounded-full bg-black/60 blur-md mt-6"
                style={{
                  scale: introShadowScale,
                  opacity: introShadowOpacity,
                }}
              />
            </div>
          </div>
        ) : (
          /* --- MAIN STICKY GRID --- */
          <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 h-full items-center relative z-10 gap-8">
            
            {/* Left Side: The Master Coin that spins, tosses, falls, and shifts based on scrolling */}
            <motion.div 
              style={{
                x: coinCenterX,
                y: coinCenterY,
              }}
              className="col-span-1 lg:col-span-5 flex flex-col items-center justify-center relative h-[35vh] lg:h-auto min-h-[220px] lg:min-h-0"
            >
              
              {/* Concentric planetary rings backing (scale and fade in as user scrolls) */}
              <motion.div 
                style={{
                  opacity: ringOpacity,
                  scale: ring1Scale
                }}
                className="absolute w-[220px] h-[220px] lg:w-[280px] lg:h-[280px] border border-slate-800/20 rounded-full animate-pulse" 
              />
              <motion.div 
                style={{
                  opacity: ringOpacity,
                  scale: ring2Scale
                }}
                className="absolute w-[290px] h-[290px] lg:w-[360px] lg:h-[360px] border border-slate-800/10 rounded-full pointer-events-none" 
              />

              {/* The single, highly responsive Coin model */}
              <Coin
                size={coinSize}
                rotateY={rotateY}
                rotateX={rotateX}
                y={coinY}
                scale={coinScale}
                interactive={false} // completely bound to scroll progress and idle math!
              />

              {/* Floating face labels indicator linking current layout to coin faces (hidden at landing) */}
              <motion.div 
                className="mt-6 lg:mt-8 font-mono text-[10px] tracking-widest text-slate-500 text-center uppercase pointer-events-none z-10"
                style={{
                  opacity: faceLabelOpacity
                }}
              >
                <span className="text-slate-400 font-bold">CURRENT MISER FOCUS: </span>
                {currentFocus}
              </motion.div>

            </motion.div>

          {/* Right Side: Sequentially Fading Texts & Cards */}
          <div className="col-span-1 lg:col-span-7 h-[45vh] lg:h-[80vh] flex flex-col justify-center relative">
            
            {/* Elegant horizontal tab categories for features */}
            {activeIndex > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none max-w-full relative z-20 self-start"
              >
                {[
                  { id: 1, label: "Automation", icon: <Settings className="w-3.5 h-3.5" /> },
                  { id: 2, label: "Ticketing", icon: <MessageSquare className="w-3.5 h-3.5" /> },
                  { id: 3, label: "Engagement", icon: <Award className="w-3.5 h-3.5" /> },
                  { id: 4, label: "Moderation", icon: <Shield className="w-3.5 h-3.5" /> }
                ].map((tab) => {
                  const isCurrent = activeIndex === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => scrollToSlide(tab.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                        isCurrent
                          ? "bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20 scale-105"
                          : "bg-[#111322]/80 border border-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-[#1c1e30]"
                      }`}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* --- SLIDE 0: HERO ENTRY (Scroll range: 0.0 to 0.20) --- */}
            <ScrollHeroSection
              progress={smoothProgress}
              range={[0.0, 0.20]}
              triggerAuthFlow={triggerAuthFlow}
              isActive={activeIndex === 0}
              introCompleted={introPhase === "completed"}
            />

            {/* --- SLIDE 1: SERVER SETUP (Scroll range: 0.20 to 0.40) --- */}
            <ScrollSection
              progress={smoothProgress}
              range={[0.20, 0.40]}
              title="Instant Server Setup"
              subtitle="The Yellow Energy • Automation Core"
              icon={<Settings className="w-5 h-5 text-[#e2f9b8]" />}
              borderColor="border-[#e2f9b8]/20"
              shadowColor="rgba(226,249,184,0.1)"
              badgeColor="bg-[#e2f9b8]/10 text-[#e2f9b8]"
              description="Deploy a flawless server structure in seconds. Automatically configure category architectures, default roles, rule sheets, welcome guidelines, and permissions utilizing high-engagement pre-built blueprints."
              metrics={[
                { label: "Deploy Time", value: "< 3 Seconds" },
                { label: "Blueprints", value: "45+ Layouts" },
              ]}
              isActive={activeIndex === 1}
            />

            {/* --- SLIDE 2: TICKETING (Scroll range: 0.40 to 0.60) --- */}
            <ScrollSection
              progress={smoothProgress}
              range={[0.40, 0.60]}
              title="Live Ticketing System"
              subtitle="The Teal Shield • Support Rails"
              icon={<MessageSquare className="w-5 h-5 text-[#2e7b8f]" />}
              borderColor="border-[#2e7b8f]/20"
              shadowColor="rgba(46,123,143,0.1)"
              badgeColor="bg-[#2e7b8f]/10 text-[#2e7b8f]"
              description="Keep support clean and private. Members trigger lightweight support rooms with one click. Staff can claim tickets, save transcripts automatically, export logs, and handle multiple queues seamlessly."
              metrics={[
                { label: "Resolution Speed", value: "+60% Faster" },
                { label: "Active Tickets", value: "Unlimited" },
              ]}
              isActive={activeIndex === 2}
            />

            {/* --- SLIDE 3: LEVELING (Scroll range: 0.60 to 0.80) --- */}
            <ScrollSection
              progress={smoothProgress}
              range={[0.60, 0.80]}
              title="Leveling & Engagement Core"
              subtitle="The Coral Spark • Gamified Chat"
              icon={<Award className="w-5 h-5 text-[#ff3b5c]" />}
              borderColor="border-[#ff3b5c]/20"
              shadowColor="rgba(255,59,92,0.1)"
              badgeColor="bg-[#ff3b5c]/10 text-[#ff3b5c]"
              description="Fuel conversations automatically. Award customizable XP rates to active talkers. Auto-assign vanity roles upon level-ups, generate rich visual rank cards, and spark server-wide leaderboards."
              metrics={[
                { label: "Active Boost", value: "+85% Chat" },
                { label: "Rank Styles", value: "12 Designs" },
              ]}
              isActive={activeIndex === 3}
            />

            {/* --- SLIDE 4: SMART MODERATION (Scroll range: 0.80 to 1.00) --- */}
            <ScrollSection
              progress={smoothProgress}
              range={[0.80, 1.00]}
              title="Automated Moderation Guard"
              subtitle="The Indigo Shield • Secure Perimeter"
              icon={<Shield className="w-5 h-5 text-indigo-400" />}
              borderColor="border-indigo-500/20"
              shadowColor="rgba(99,102,241,0.1)"
              badgeColor="bg-indigo-500/10 text-indigo-400"
              description="Protect your server from raid spikes, phishing links, and bot spam. ServerMiser audits user invites, runs automatic infraction logs, silences bad actors, and enforces warnings rules 24/7."
              metrics={[
                { label: "Raid Protection", value: "99.9% Safe" },
                { label: "Shield Level", value: "Military Grade" },
              ]}
              isActive={activeIndex === 4}
            />

          </div>
        </div>
      )}

      </div>
    </div>
  );
}

// Custom specialized view for the Slide 0 (Hero Entry) to ensure standard CTA buttons are fully interactive
interface HeroSectionProps {
  progress: any;
  range: [number, number];
  triggerAuthFlow: () => void;
  isActive: boolean;
  introCompleted?: boolean;
}

function ScrollHeroSection({ progress, range, triggerAuthFlow, isActive, introCompleted = true }: HeroSectionProps) {
  const start = range[0];
  const end = range[1];

  // Hero text starts completely hidden (0) when user goes onto website.
  // Fades in beautifully once the first coinflip lands/completes (from progress 0.08 to 0.12).
  // This satisfies "THEN show all the text no text before the flip ends"
  const opacity = useTransform(progress, [0, 0.08, 0.12, 0.18, end], [0, 0, 1, 1, 0]);
  const scale = useTransform(progress, [0.08, 0.12, end], [0.94, 1, 0.94]);
  const x = useTransform(progress, [0.08, 0.12, end], [25, 0, -35]);

  return (
    <motion.div
      initial={{ y: -120, opacity: 0 }}
      animate={introCompleted ? { y: 0, opacity: 1 } : { y: -120, opacity: 0 }}
      transition={{ 
        type: "spring", 
        stiffness: 75, 
        damping: 14, 
        mass: 1.1,
        delay: 0.15 // Small elegant delay after coin lands flat!
      }}
      style={{ 
        opacity: introCompleted ? opacity : 0, 
        scale, 
        x, 
        zIndex: isActive ? 30 : 10,
        pointerEvents: isActive && introCompleted ? "auto" : "none" 
      }}
      className="absolute inset-x-0 flex flex-col gap-4 lg:gap-5 text-left"
    >
      <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-[#e2f9b8] font-mono tracking-wider">
        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
        <span>THE ULTIMATE ALL-IN-ONE DISCORD BOT</span>
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-extrabold text-slate-100 tracking-tight leading-[1.05]">
        Keep your Discord <span className="text-[#e2f9b8]">lean, active, and clean.</span>
      </h1>

      <p className="text-slate-400 text-sm sm:text-base md:text-lg max-w-xl leading-relaxed">
        ServerMiser automates your community. Setting up servers, ticketing support, leveling systems, and active moderation shields — all managed through real-time interactive 3D coin flips.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3 mt-1 lg:mt-2">
        <button
          onClick={triggerAuthFlow}
          className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-xs sm:text-sm font-bold tracking-wide text-slate-100 shadow-xl shadow-black/40 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
        >
          {/* Simple white discord logo representation using pure SVG */}
          <svg viewBox="0 0 127.14 96.36" className="w-4 h-4 fill-current">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.79.71,1.63,1.4,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,49.52,123.6,26.69,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.72,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96,53,91,65.69,84.69,65.69Z" />
          </svg>
          <span>Invite to Discord</span>
        </button>
        
        <a
          href="https://discord.gg/H36QXKB6R6"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-slate-900/60 border border-slate-800 text-xs sm:text-sm font-bold tracking-wide text-slate-300 hover:bg-slate-900 hover:text-slate-100 hover:border-slate-700 transition-all text-center flex items-center justify-center gap-2"
        >
          <span>Join Support Server</span>
          <ExternalLink className="w-4 h-4 text-slate-400" />
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4 lg:gap-6 pt-4 lg:pt-8 border-t border-slate-900 mt-2 lg:mt-3 max-w-xl">
        <div>
          <span className="block text-xl sm:text-2xl font-bold font-mono text-slate-100">142k+</span>
          <span className="text-[9px] sm:text-[10px] font-mono tracking-widest uppercase text-slate-500">Active Servers</span>
        </div>
        <div>
          <span className="block text-xl sm:text-2xl font-bold font-mono text-slate-100">450 TB</span>
          <span className="text-[9px] sm:text-[10px] font-mono tracking-widest uppercase text-slate-500">Disk Reclaimed</span>
        </div>
        <div>
          <span className="block text-xl sm:text-2xl font-bold font-mono text-[#e2f9b8] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>A+ Sec</span>
          </span>
          <span className="text-[9px] sm:text-[10px] font-mono tracking-widest uppercase text-slate-500">Audit Grade</span>
        </div>
      </div>
    </motion.div>
  );
}

// Wrapper for individual scrolling sections
interface ScrollSectionProps {
  progress: any;
  range: [number, number];
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  description: string;
  borderColor: string;
  shadowColor: string;
  badgeColor: string;
  metrics: { label: string; value: string }[];
  isActive: boolean;
}

function ScrollSection({
  progress,
  range,
  title,
  subtitle,
  icon,
  description,
  borderColor,
  shadowColor,
  badgeColor,
  metrics,
  isActive,
}: ScrollSectionProps) {
  const start = range[0];
  const end = range[1];
  const mid = (start + end) / 2;

  // Highlights the card when progress enters its respective range and fades out once passed
  const opacity = useTransform(
    progress,
    [start - 0.05, start, mid, end, end + 0.05],
    [0, 1, 1, 1, 0]
  );

  const scale = useTransform(
    progress,
    [start - 0.05, start, mid, end, end + 0.05],
    [0.95, 1, 1.02, 1, 0.95]
  );

  const x = useTransform(
    progress,
    [start - 0.05, start, mid, end, end + 0.05],
    [-30, 0, 10, 0, -35]
  );

  return (
    <motion.div
      style={{ 
        opacity, 
        scale, 
        x, 
        position: "absolute", 
        zIndex: isActive ? 30 : 10,
        pointerEvents: isActive ? "auto" : "none"
      }}
      className={`w-full max-w-xl p-5 lg:p-8 rounded-2xl bg-slate-900/90 backdrop-blur-md border ${borderColor} flex flex-col gap-4 lg:gap-5`}
      placeholder="ServerMiser Feature Card"
      id={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Header Info */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className={`self-start px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase ${badgeColor}`}>
            {subtitle}
          </span>
          <h3 className="text-xl lg:text-2xl font-bold font-sans text-slate-100 tracking-tight mt-1">
            {title}
          </h3>
        </div>
        <div className={`p-2 lg:p-3 rounded-xl bg-slate-950/60 border ${borderColor} shadow-inner`}>
          {icon}
        </div>
      </div>

      {/* Description */}
      <p className="text-slate-400 text-xs lg:text-sm leading-relaxed font-sans">
        {description}
      </p>

      {/* Stats/Metrics row */}
      <div className="grid grid-cols-2 gap-4 mt-1 lg:mt-2 pt-3 lg:pt-4 border-t border-slate-800/60">
        {metrics.map((m, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-[9px] lg:text-[10px] font-mono uppercase tracking-widest text-slate-500">
              {m.label}
            </span>
            <span className="text-base lg:text-lg font-bold text-slate-200 mt-0.5 font-mono">
              {m.value}
            </span>
          </div>
        ))}
      </div>

      {/* Sparkle alignment indicators */}
      <div className="flex items-center gap-1.5 self-end mt-1 text-[10px] font-mono text-slate-500">
        <Sparkles className="w-3 h-3 text-amber-300" />
        <span>SERVERMISER CORE FUNCTION</span>
      </div>
    </motion.div>
  );
}


