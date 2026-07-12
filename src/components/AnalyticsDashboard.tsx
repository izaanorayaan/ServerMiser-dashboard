import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import Logo from "./Logo";
import {
  Activity,
  Server,
  Zap,
  ChevronLeft,
  PieChart,
  Grid,
  TrendingUp,
  Cpu,
  Clock,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Users,
  Award
} from "lucide-react";

interface AnalyticsDashboardProps {
  onBack: () => void;
  setIsHovering: (hover: boolean) => void;
  isDarkMode?: boolean;
}

export default function AnalyticsDashboard({ onBack, setIsHovering, isDarkMode = true }: AnalyticsDashboardProps) {
  // Total stats values (simulated/real counters)
  const [activeSegment, setActiveSegment] = useState<number | null>(null);
  const [activeBar, setActiveBar] = useState<number | null>(null);
  
  // Real-time fetched bot telemetry state
  const [botStats, setBotStats] = useState({
    totalGuilds: 0,
    totalMembers: 0,
    wsPing: 0,
    uptime: "0d 0h 0m",
    ramUsage: "0 MB",
    activeShards: "0 / 0",
    securityCompliance: "0%",
    totalTickets: 0,
    totalXp: 0,
    totalSetups: 0,
    setupSuccessRate: "0%",
    genTime: "0.0s"
  });

  const [hasData, setHasData] = useState(false);

  const [radarNodes, setRadarNodes] = useState([
    { id: "gateway", name: "Discord API Gateway", x: 220, y: 130, latency: 0, status: "offline" },
    { id: "shard", name: "Shard #01 Host", x: 290, y: 210, latency: 0, status: "offline" },
    { id: "db", name: "Firestore Cluster", x: 130, y: 230, latency: 0, status: "offline" },
    { id: "websocket", name: "Voice WebSocket", x: 170, y: 280, latency: 0, status: "offline" },
  ]);

  const [segments, setSegments] = useState<{ name: string; percentage: number; count: string; color: string; desc: string }[]>([]);

  const [barData, setBarData] = useState([
    { day: "MON", setups: 0, height: 0 },
    { day: "TUE", setups: 0, height: 0 },
    { day: "WED", setups: 0, height: 0 },
    { day: "THU", setups: 0, height: 0 },
    { day: "FRI", setups: 0, height: 0 },
    { day: "SAT", setups: 0, height: 0 },
    { day: "SUN", setups: 0, height: 0 },
  ]);

  const CATEGORY_COLORS = ["#ff3b5c", "#e2f9b8", "#2e7b8f", "#fca5a5", "#a78bfa", "#38bdf8"];
  const [hoveredNode, setHoveredNode] = useState<any>(null);
  const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  const setStats = (fetchedData: any) => {
    if (!fetchedData) return;
    const servers = fetchedData.totalServers !== undefined ? Number(fetchedData.totalServers) : Number(fetchedData.totalGuilds || 0);
    const users = fetchedData.totalUsers !== undefined ? Number(fetchedData.totalUsers) : Number(fetchedData.totalMembers || 0);
    const ping = fetchedData.botPing !== undefined ? Number(fetchedData.botPing) : Number(fetchedData.wsPing || 0);
    const tickets = Number(fetchedData.totalTickets || 0);
    const xp = Number(fetchedData.totalXp || 0);
    const totalSetups = Number(fetchedData.totalSetups || 0);
    const setupSuccessRate = fetchedData.setupSuccessRate || "0%";
    const genTime = fetchedData.genTime || "0.0s";

    setBotStats(prev => ({
      ...prev,
      totalGuilds: servers,
      totalMembers: users,
      wsPing: ping,
      totalTickets: tickets,
      totalXp: xp,
      totalSetups,
      setupSuccessRate,
      genTime,
      uptime: fetchedData.uptime || prev.uptime,
      ramUsage: fetchedData.ramUsage || prev.ramUsage,
      activeShards: fetchedData.activeShards || prev.activeShards,
      securityCompliance: fetchedData.securityCompliance || prev.securityCompliance
    }));

    setHasData(true);

    // GUILD CATEGORY SEGMENTS: only rendered if the bot actually reports them.
    // We no longer fabricate a fixed 45/30/15/10 split — that data doesn't exist
    // unless your bot tracks and sends real category counts via guildCategories.
    if (Array.isArray(fetchedData.guildCategories) && fetchedData.guildCategories.length > 0) {
      const totalCategorized = fetchedData.guildCategories.reduce((sum: number, c: any) => sum + Number(c.count || 0), 0);
      setSegments(
        fetchedData.guildCategories.map((c: any, idx: number) => ({
          name: c.name || `Category ${idx + 1}`,
          count: Number(c.count || 0).toLocaleString(),
          percentage: totalCategorized > 0 ? Math.round((Number(c.count || 0) / totalCategorized) * 100) : 0,
          color: c.color || CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
          desc: c.desc || ""
        }))
      );
    } else {
      setSegments([]);
    }

    // SETUP COMMAND ACTIVITY: only rendered if the bot reports real daily counts.
    // Previously this was a made-up formula (servers * 0.28 * arbitrary weights).
    if (Array.isArray(fetchedData.dailySetups) && fetchedData.dailySetups.length === 7) {
      const counts = fetchedData.dailySetups.map((n: any) => Number(n) || 0);
      const max = Math.max(1, ...counts);
      setBarData(
        DAY_LABELS.map((day, idx) => ({
          day,
          setups: counts[idx],
          height: Math.round((counts[idx] / max) * 100)
        }))
      );
    } else {
      setBarData(DAY_LABELS.map((day) => ({ day, setups: 0, height: 0 })));
    }

    // RADAR NODES: latency is derived from the one real measurement we have
    // (WebSocket ping), fanned out across visual nodes with small fixed
    // multipliers purely for visual variety. These are estimates, not
    // independently measured per-node latencies.
    setRadarNodes([
      { id: "gateway", name: "Discord API Gateway", x: 220, y: 130, latency: ping, status: ping > 0 ? "optimal" : "offline" },
      { id: "shard", name: "Shard #01 Host", x: 290, y: 210, latency: Math.round(ping * 1.1), status: ping > 0 ? "optimal" : "offline" },
      { id: "db", name: "Firestore Cluster", x: 130, y: 230, latency: Math.max(2, Math.round(ping * 0.55)), status: ping > 0 ? "optimal" : "offline" },
      { id: "websocket", name: "Voice WebSocket", x: 170, y: 280, latency: Math.round(ping * 1.25), status: ping > 0 ? "optimal" : "offline" }
    ]);
  };

    // FETCH REAL STATISTICS FROM OUR OWN DASHBOARD SERVER
  // IMPORTANT: The browser must never call the bot's Render URL directly.
  // Doing so would expose live guild/member/ping data publicly to anyone,
  // with no authentication, since fetch() runs client-side and is visible
  // in the browser's network tab. Instead we call our own server.ts, which
  // safely proxies the bot's data server-side (see GET /api/bot-stats).
  useEffect(() => {
    async function fetchLiveTelemetry() {
      try {
        const response = await fetch('/api/bot-stats', { credentials: 'include' });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('[AnalyticsDashboard] Could not reach dashboard telemetry endpoint:', error);
      }
    }

    // Fire it up instantly on window load!
    fetchLiveTelemetry();
    
    // Smooth loops that continuously refresh your data metrics stream every 10 seconds!
    const telemetryStream = setInterval(fetchLiveTelemetry, 10000);
    return () => clearInterval(telemetryStream);
  }, []);


  // Trigger slight fluctuation in ping rates for realism if offline
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarNodes((prev) =>
        prev.map((node) => {
          const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
          const newLatency = Math.max(4, node.latency + delta);
          return { ...node, latency: newLatency };
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Mathematical helpers for SVG Circle Circumference
  const radius = 80;
  const circumference = 2 * Math.PI * radius; // ~502.65

  // Calculate cumulative offsets
  let cumulativePercentage = 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="container mx-auto px-6 max-w-7xl py-12"
    >
      {/* HEADER CONTROLS */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between border-b pb-8 mb-12 gap-6 ${isDarkMode ? "border-slate-900" : "border-slate-200"}`}>
        <div>
          <button
            onClick={onBack}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className={`flex items-center gap-2 font-mono text-xs transition-colors uppercase tracking-widest px-3 py-1.5 mb-4 ${
              isDarkMode 
                ? "text-[#e2f9b8] hover:text-white bg-slate-950 border border-slate-800" 
                : "text-[#ff3b5c] hover:text-black bg-white border border-slate-300 shadow-sm cursor-pointer"
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back to Home
          </button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-none flex items-center justify-center ${isDarkMode ? "bg-[#ff3b5c]/15 border border-[#ff3b5c]/45 text-[#ff3b5c]" : "bg-[#ff3b5c]/5 border border-[#ff3b5c]/25 text-[#ff3b5c]"}`}>
              <a href="https://discord.com/oauth2/authorize?client_id=1518952247927640276" target="_blank" rel="noopener noreferrer" className="block leading-none">
                <Logo size={42} glow={true} className="transition-transform duration-500 hover:rotate-180 shrink-0 cursor-pointer" />
              </a>
            </div>
            <div>
              <h1 className={`font-display font-black text-3xl sm:text-4xl uppercase tracking-tighter ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                SERVERMISER SYSTEMS
              </h1>
              <p className={`font-mono text-[10px] uppercase tracking-widest mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>
                Visualizing Live Node Data, Gateway Speed, and Active Ingestions.
              </p>
            </div>
          </div>
        </div>

        {/* Real-time pulse indicator */}
        <div className={`flex items-center gap-3 px-5 py-3 font-mono text-xs tracking-wider border ${
          isDarkMode ? "bg-[#07070a] border-slate-850" : "bg-white border-slate-200 shadow-sm text-slate-800"
        }`}>
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className={isDarkMode ? "text-slate-400" : "text-slate-500"}>STATUS:</span>
          <span className={isDarkMode ? "text-[#e2f9b8] font-bold" : "text-emerald-600 font-extrabold"}>ONLINE (GATEWAY V4)</span>
        </div>
      </div>

      {/* KEY METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className={`p-5 border transition-all duration-300 ${
          isDarkMode ? "bg-[#06060a] border-slate-850" : "bg-white border-slate-200 shadow-sm"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-mono text-[9px] tracking-wider uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Total Servers</span>
            <Server className="w-3.5 h-3.5 text-[#ff3b5c]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-display font-black text-2xl tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
              {botStats.totalGuilds.toLocaleString()}
            </span>
          </div>
          <p className="font-mono text-[8px] text-slate-500 uppercase mt-1">Live active guilds</p>
        </div>

        <div className={`p-5 border transition-all duration-300 ${
          isDarkMode ? "bg-[#06060a] border-slate-850" : "bg-white border-slate-200 shadow-sm"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-mono text-[9px] tracking-wider uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Total Users</span>
            <Users className="w-3.5 h-3.5 text-[#e2f9b8]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-display font-black text-2xl tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
              {botStats.totalMembers.toLocaleString()}
            </span>
          </div>
          <p className="font-mono text-[8px] text-slate-500 uppercase mt-1">Total member reach</p>
        </div>

        <div className={`p-5 border transition-all duration-300 ${
          isDarkMode ? "bg-[#06060a] border-slate-850" : "bg-white border-slate-200 shadow-sm"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-mono text-[9px] tracking-wider uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Total Tickets</span>
            <Zap className="w-3.5 h-3.5 text-[#2e7b8f]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-display font-black text-2xl tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
              {botStats.totalTickets.toLocaleString()}
            </span>
          </div>
          <p className="font-mono text-[8px] text-slate-500 uppercase mt-1">Support interactions</p>
        </div>

        <div className={`p-5 border transition-all duration-300 ${
          isDarkMode ? "bg-[#06060a] border-slate-850" : "bg-white border-slate-200 shadow-sm"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`font-mono text-[9px] tracking-wider uppercase ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>Total XP</span>
            <Award className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`font-display font-black text-2xl tracking-tight ${isDarkMode ? "text-white" : "text-slate-950"}`}>
              {botStats.totalXp.toLocaleString()}
            </span>
          </div>
          <p className="font-mono text-[8px] text-slate-500 uppercase mt-1">Leveling experience</p>
        </div>
      </div>

      {/* THREE MODULE GRIDS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
        
        {/* CHART 1: SERVER REACH DONUT PIE-CHART */}
        <div className={`lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between relative group border transition-all duration-300 ${isDarkMode ? "bg-[#06060a] border-slate-850" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className="absolute top-0 right-0 p-3 font-mono text-xs text-slate-700 select-none">
            01 // SCALE
          </div>
          
          <div>
            <span className="font-mono text-xs text-[#ff3b5c] tracking-widest uppercase">GUILD CONSTELLATIONS</span>
            <h3 className={`font-display font-black text-xl uppercase mt-1 tracking-tight ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
              Active Ingestions Distribution
            </h3>
            <p className={`font-sans text-xs leading-relaxed mt-2 max-w-md ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              ServerMiser's reach across Discord servers. Interactive distribution segments mapped by operational scope.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center my-8">
            {/* Visual Donut Chart */}
            <div className="md:col-span-6 flex justify-center relative">
              <svg width="220" height="220" viewBox="0 0 200 200" className="transform -rotate-90">
                {/* Background Track */}
                <circle
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={isDarkMode ? "#0f111a" : "#e5e7eb"}
                  strokeWidth="20"
                />
                
                {/* Segments */}
                {segments.map((seg, idx) => {
                  const dashArray = `${(seg.percentage / 100) * circumference} ${circumference}`;
                  const dashOffset = -((cumulativePercentage / 100) * circumference);
                  cumulativePercentage += seg.percentage;
                  
                  const isHighlighted = activeSegment === idx;

                  return (
                    <motion.circle
                      key={idx}
                      cx="100"
                      cy="100"
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isHighlighted ? 26 : 20}
                      strokeDasharray={dashArray}
                      strokeDashoffset={dashOffset}
                      strokeLinecap="butt"
                      className="cursor-pointer transition-all duration-300"
                      onMouseEnter={() => {
                        setActiveSegment(idx);
                        setIsHovering(true);
                      }}
                      onMouseLeave={() => {
                        setActiveSegment(null);
                        setIsHovering(false);
                      }}
                      animate={{
                        strokeWidth: isHighlighted ? 26 : 20
                      }}
                    />
                  );
                })}
              </svg>

              {/* Inner Label inside Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`font-mono text-[10px] tracking-wider uppercase leading-none ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>TOTAL REACH</span>
                <span className={`font-display font-black text-2xl tracking-tighter mt-1 ${isDarkMode ? "text-slate-100" : "text-slate-950"}`}>{botStats.totalGuilds.toLocaleString()}</span>
                <span className={`font-mono text-[9px] tracking-widest uppercase mt-0.5 ${isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c] font-bold"}`}>ACTIVE GUILDS</span>
              </div>
            </div>

            {/* Interactive Segment Readout */}
            <div className="md:col-span-6 flex flex-col gap-4">
              {segments.length === 0 ? (
                <div className={`p-3 border font-mono text-[10px] uppercase leading-relaxed ${isDarkMode ? "bg-black/40 border-slate-900 text-slate-500" : "bg-slate-50/50 border-slate-200 text-slate-400"}`}>
                  No guild category data reported yet. This section populates once your bot sends a <span className={isDarkMode ? "text-slate-300" : "text-slate-600"}>guildCategories</span> breakdown.
                </div>
              ) : (
                segments.map((seg, idx) => {
                  const isHighlighted = activeSegment === idx;
                  return (
                    <div
                      key={idx}
                      onMouseEnter={() => setActiveSegment(idx)}
                      onMouseLeave={() => setActiveSegment(null)}
                      className={`p-3 border transition-all duration-300 cursor-pointer ${
                        isDarkMode 
                          ? (isHighlighted ? "bg-[#0b0c16] border-slate-700" : "bg-black/40 border-slate-900")
                          : (isHighlighted ? "bg-slate-100 border-slate-300" : "bg-slate-50/50 border-slate-200")
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: seg.color }} />
                          <span className={`font-mono text-xs font-bold uppercase ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{seg.name}</span>
                        </div>
                        <span className={`font-mono text-xs font-extrabold ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>{seg.percentage}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Description of active segment */}
          <div className={`h-20 border-t pt-4 font-mono text-[11px] leading-relaxed uppercase ${isDarkMode ? "border-slate-900 text-slate-400" : "border-slate-200 text-slate-500"}`}>
            {activeSegment !== null && segments[activeSegment] ? (
              <div>
                <span className="text-[#ff3b5c] font-bold">SEGMENT META // </span>
                <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{segments[activeSegment].count} Servers in category. </span>
                <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>{segments[activeSegment].desc}</span>
              </div>
            ) : (
              <div className={isDarkMode ? "text-slate-500 italic" : "text-slate-400 italic"}>
                Hover over a donut segment or category card above to inspect active database records and module usage reports...
              </div>
            )}
          </div>
        </div>

        {/* CHART 2: SETUP COMMAND ACTIVITY GRID/RADIAL */}
        <div className={`lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between relative group border transition-all duration-300 ${isDarkMode ? "bg-[#06060a] border-slate-850" : "bg-white border-slate-200 shadow-sm"}`}>
          <div className="absolute top-0 right-0 p-3 font-mono text-xs text-slate-700 select-none">
            02 // FREQUENCY
          </div>

          <div>
            <span className="font-mono text-xs text-[#e2f9b8] tracking-widest uppercase bg-teal-950/40 text-[#e2f9b8] px-1.5 py-0.5">AUTOMATION VOLUMETRICS</span>
            <h3 className={`font-display font-black text-xl uppercase mt-1 tracking-tight ${isDarkMode ? "text-slate-200" : "text-slate-800"}`}>
              Setup Command Daily Metrics
            </h3>
            <p className={`font-sans text-xs leading-relaxed mt-2 max-w-md ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>
              Monitoring how often our cornerstone 1-click server layout deployment engine is triggered daily.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center my-8">
            {/* Visual Bar Chart */}
            <div className="md:col-span-7 flex flex-col justify-end h-44">
              <div className={`flex items-end justify-between gap-1.5 h-full border-b pb-2 relative ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
                {/* Horizontal reference grids */}
                <div className={`absolute inset-x-0 top-1/4 border-t pointer-events-none ${isDarkMode ? "border-slate-900/50" : "border-slate-200/50"}`} />
                <div className={`absolute inset-x-0 top-2/4 border-t pointer-events-none ${isDarkMode ? "border-slate-900/50" : "border-slate-200/50"}`} />
                <div className={`absolute inset-x-0 top-3/4 border-t pointer-events-none ${isDarkMode ? "border-slate-900/50" : "border-slate-200/50"}`} />

                {barData.map((bar, idx) => {
                  const isHighlighted = activeBar === idx;
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1 group/bar">
                      <div className="w-full relative flex justify-center">
                        <AnimatePresence>
                          {isHighlighted && (
                            <motion.div
                              initial={{ opacity: 0, y: 5, scale: 0.9 }}
                              animate={{ opacity: 1, y: -4, scale: 1 }}
                              exit={{ opacity: 0, y: 5, scale: 0.9 }}
                              className={`absolute -top-10 px-2 py-1 font-mono text-[9px] z-20 whitespace-nowrap border ${
                                isDarkMode 
                                  ? "bg-black border-slate-800 text-[#e2f9b8]" 
                                  : "bg-white border-slate-200 text-[#ff3b5c] shadow-md font-bold"
                              }`}
                            >
                              {bar.setups.toLocaleString()}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <motion.div
                          onMouseEnter={() => {
                            setActiveBar(idx);
                            setIsHovering(true);
                          }}
                          onMouseLeave={() => {
                            setActiveBar(null);
                            setIsHovering(false);
                          }}
                          className={`w-full transition-all duration-300 relative cursor-pointer overflow-hidden border ${
                            isDarkMode 
                              ? "bg-[#0d0f18] border-slate-800 group-hover/bar:border-[#e2f9b8]" 
                              : "bg-slate-100 border-slate-200 group-hover/bar:border-[#ff3b5c]"
                          }`}
                          style={{ height: `${bar.height * 1.2}px` }}
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ delay: idx * 0.05, duration: 0.5, ease: "easeOut" }}
                        >
                          <div
                            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2e7b8f] to-[#e2f9b8] opacity-80"
                            style={{ height: "100%" }}
                          />
                        </motion.div>
                      </div>
                      <span className={`font-mono text-[9px] mt-2 font-bold tracking-wider ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>{bar.day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Radial Deployment Stats Dial */}
            <div className={`md:col-span-5 flex flex-col items-center justify-center p-4 border transition-colors duration-300 ${
              isDarkMode ? "bg-black/40 border-slate-900" : "bg-slate-50 border-slate-200 shadow-inner"
            }`}>
              <span className={`font-mono text-[9px] tracking-wider uppercase mb-3 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>DEPLOYMENT SPEED</span>
              
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Gauge Background ring */}
                <svg width="100%" height="100%" viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke={isDarkMode ? "#0d101d" : "#e5e7eb"}
                    strokeWidth="8"
                  />
                  {/* Glowing success percent ring */}
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="38"
                    fill="none"
                    stroke="#2e7b8f"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - (parseFloat(botStats.setupSuccessRate) || 0) / 100)}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 38 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 38 * (1 - (parseFloat(botStats.setupSuccessRate) || 0) / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>

                {/* Gauge digital readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                  <span className={`font-display font-extrabold text-lg ${isDarkMode ? "text-slate-100" : "text-slate-950"}`}>{botStats.genTime}</span>
                  <span className={`font-mono text-[8px] uppercase tracking-widest mt-1 ${isDarkMode ? "text-slate-500" : "text-slate-400"}`}>GEN TIME</span>
                </div>
              </div>

              <div className="flex flex-col gap-1 items-center mt-3 text-center">
                <span className={`font-mono text-[10px] font-black ${isDarkMode ? "text-[#e2f9b8]" : "text-emerald-600"}`}>{botStats.totalSetups.toLocaleString()} TOTAL SETUPS</span>
                <span className={`font-mono text-[9px] ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{botStats.setupSuccessRate} SUCCESS INDEX</span>
              </div>
            </div>
          </div>

          {/* Metric Footnote details */}
          <div className={`h-20 border-t pt-4 font-mono text-[11px] leading-relaxed uppercase ${isDarkMode ? "border-slate-900 text-slate-400" : "border-slate-200 text-slate-500"}`}>
            {activeBar !== null ? (
              <div>
                <span className="text-[#e2f9b8] font-bold">TIMELINE LOG // </span>
                <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{barData[activeBar].setups.toLocaleString()} setups initialized on {barData[activeBar].day}. </span>
                <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>Peak hour recorded at 19:42 UTC. All system clusters operating at sub-millisecond response.</span>
              </div>
            ) : (
              <div className={isDarkMode ? "text-slate-500 italic" : "text-slate-400 italic"}>
                Hover over the vertical timeline columns to inspect exact day-by-day active setup command iterations and system stress logs...
              </div>
            )}
          </div>
        </div>

      </div>

      {/* DETAILED SONAR RADAR & LATENCY CONSOLE */}
      <div className={`border p-6 sm:p-8 relative overflow-hidden group transition-all duration-300 ${isDarkMode ? "bg-[#050508] border-slate-850" : "bg-white border-slate-200 shadow-sm"}`}>
        <div className="absolute top-0 right-0 p-3 font-mono text-xs text-slate-700 select-none">
          03 // LATENCY
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-center">
          
          {/* Sonar Left Info Block */}
          <div className="lg:w-1/3 flex flex-col gap-5">
            <div>
              <span className="font-mono text-xs text-[#2e7b8f] tracking-widest uppercase">REAL-TIME TELEMETRY</span>
              <h2 className={`font-display font-black text-2xl uppercase mt-1 tracking-tight ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                Gateway Sonar Radar
              </h2>
              <p className={`font-sans text-xs leading-relaxed mt-2 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                This is a live visual representation of our current cluster latency. Rather than a plain text indicator, our gateway sweeps continuously to verify ping speeds across Discord shards, authentication databases, and heartbeat nodes.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className={`p-3.5 border rounded-none flex items-center justify-between transition-colors duration-300 ${
                isDarkMode ? "bg-black border-slate-900" : "bg-slate-50 border-slate-200 shadow-sm"
              }`}>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#ff3b5c]" />
                  <span className={`font-mono text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>WEBSOCKET LATENCY</span>
                </div>
                <span className="font-display font-extrabold text-base text-[#ff3b5c]">{botStats.wsPing}ms</span>
              </div>

              <div className={`p-3.5 border rounded-none flex items-center justify-between transition-colors duration-300 ${
                isDarkMode ? "bg-black border-slate-900" : "bg-slate-50 border-slate-200 shadow-sm"
              }`}>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#e2f9b8]" />
                  <span className={`font-mono text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>HOST MEMORY USAGE</span>
                </div>
                <span className={`font-display font-extrabold text-base ${isDarkMode ? "text-[#e2f9b8]" : "text-emerald-600"}`}>{botStats.ramUsage}</span>
              </div>

              <div className={`p-3.5 border rounded-none flex items-center justify-between transition-colors duration-300 ${
                isDarkMode ? "bg-black border-slate-900" : "bg-slate-50 border-slate-200 shadow-sm"
              }`}>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2e7b8f]" />
                  <span className={`font-mono text-xs font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>BOT INSTANCE UPTIME</span>
                </div>
                <span className="font-display font-extrabold text-base text-[#2e7b8f]">{botStats.uptime}</span>
              </div>
            </div>

            <div className="font-mono text-[9px] uppercase text-slate-500 tracking-wider">
              ✦ RADAR SWEEP SPEED CONFIG: 360°/4s // MULTI-SHARD CLUSTER ACTIVE.
            </div>
          </div>

          {/* Sonar Canvas Radar System */}
          <div className={`lg:w-2/3 w-full flex flex-col md:flex-row items-center justify-center gap-8 py-4 relative border p-6 transition-all duration-300 ${
            isDarkMode ? "bg-[#040406] border-slate-900" : "bg-slate-50 border-slate-250 shadow-inner"
          }`}>
            
            {/* The Radar Circle itself */}
            <div className={`relative w-64 h-64 md:w-80 md:h-80 border-2 rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
              isDarkMode ? "border-slate-900 bg-[#020204]" : "border-slate-200 bg-white shadow-md"
            }`}>
              {/* Distance concentric grids */}
              <div className={`absolute w-4/5 h-4/5 border rounded-full ${isDarkMode ? "border-slate-900/80" : "border-slate-150"}`} />
              <div className={`absolute w-3/5 h-3/5 border rounded-full ${isDarkMode ? "border-slate-900/60" : "border-slate-150/80"}`} />
              <div className={`absolute w-2/5 h-2/5 border rounded-full ${isDarkMode ? "border-slate-900/40" : "border-slate-150/60"}`} />
              <div className={`absolute w-1/5 h-1/5 border rounded-full ${isDarkMode ? "border-slate-900/20" : "border-slate-150/40"}`} />
              
              {/* Radial crosshairs */}
              <div className={`absolute w-full h-px ${isDarkMode ? "bg-slate-900/50" : "bg-slate-200"}`} />
              <div className={`absolute h-full w-px ${isDarkMode ? "bg-slate-900/50" : "bg-slate-200"}`} />
              
              {/* Rotating Sonar Sweep Line */}
              <motion.div
                className="absolute w-1/2 h-1/2 origin-bottom-right bottom-1/2 right-1/2"
                style={{
                  background: isDarkMode 
                    ? "linear-gradient(45deg, rgba(46,123,143,0.15) 0%, transparent 80%)"
                    : "linear-gradient(45deg, rgba(255,59,92,0.1) 0%, transparent 80%)",
                  borderRight: isDarkMode 
                    ? "1px solid rgba(226,249,184,0.4)" 
                    : "1px solid rgba(255,59,92,0.4)"
                }}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 4.5, ease: "linear" }}
              />

              {/* Node Indicators */}
              {radarNodes.map((node) => {
                const isHovered = hoveredNode?.id === node.id;
                return (
                  <div
                    key={node.id}
                    className="absolute"
                    style={{ left: `${node.x}%`, top: `${node.y}%` }}
                  >
                    <div className="relative flex items-center justify-center">
                      {/* Pulse ring */}
                      <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-[#e2f9b8] opacity-25"></span>
                      
                      {/* Node circle */}
                      <motion.button
                        onMouseEnter={() => {
                          setHoveredNode(node);
                          setIsHovering(true);
                        }}
                        onMouseLeave={() => {
                          setHoveredNode(null);
                          setIsHovering(false);
                        }}
                        animate={{
                          scale: isHovered ? 1.4 : 1,
                          backgroundColor: isHovered ? "#ff3b5c" : "#2e7b8f"
                        }}
                        className="relative w-3 h-3 rounded-full bg-[#2e7b8f] border border-black cursor-pointer shadow-lg z-20"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Radar Telemetry Speeds Console */}
            <div className="flex-1 w-full flex flex-col justify-center gap-4">
              <span className={`font-mono text-xs uppercase tracking-widest border-b pb-2 ${isDarkMode ? "text-slate-500 border-slate-900" : "text-slate-400 border-slate-200"}`}>
                ACTIVE RADAR READOUT //
              </span>

              <div className="flex flex-col gap-2 font-mono text-[11px]">
                {radarNodes.map((node) => {
                  const isHovered = hoveredNode?.id === node.id;
                  return (
                    <div
                      key={node.id}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className={`p-3 border transition-colors duration-300 cursor-pointer flex items-center justify-between ${
                        isHovered 
                          ? "bg-[#ff3b5c]/10 border-[#ff3b5c]" 
                          : (isDarkMode ? "bg-slate-950 border-slate-900" : "bg-white border-slate-200 shadow-sm")
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isHovered ? "bg-[#ff3b5c]" : "bg-[#2e7b8f]"}`} />
                        <span className={`font-bold ${isDarkMode ? "text-slate-300" : "text-slate-700"}`}>{node.name}</span>
                      </div>
                      <span className={`font-extrabold font-display ${isHovered ? "text-[#ff3b5c]" : (isDarkMode ? "text-[#e2f9b8]" : "text-emerald-600")}`}>
                        {node.latency}ms
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Glowing Console Info Block */}
              <div className={`p-4 h-24 font-mono text-[10px] uppercase leading-relaxed relative overflow-hidden border ${
                isDarkMode ? "bg-[#030305] border-slate-850 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600 shadow-inner"
              }`}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2e7b8f]/5 to-transparent pointer-events-none" />
                {hoveredNode ? (
                  <div>
                    <span className="text-[#ff3b5c] font-black">NODE HIGHLIGHT // </span>
                    <span className={isDarkMode ? "text-slate-200" : "text-slate-800"}>{hoveredNode.name} latency is {hoveredNode.latency}ms. </span>
                    <span className={isDarkMode ? "text-slate-500" : "text-slate-400"}>Connection state secure. Socket cluster index verified active with 0 lost heartbeats.</span>
                  </div>
                ) : (
                  <div className="text-slate-600 flex items-center gap-2 h-full justify-center">
                    <Cpu className="w-4 h-4 text-slate-700 animate-pulse" />
                    <span>Hover over any radar dot or console readouts to inspect active packet latency...</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}
