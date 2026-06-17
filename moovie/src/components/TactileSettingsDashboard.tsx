import React, { useState, useEffect } from "react";
import { PlayerSettings, ThemePalette, AudioPhase } from "../types";
import { X, Check, Activity, Volume2, Video, Sparkles, Sliders, Type, Database } from "lucide-react";

interface TactileSettingsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PlayerSettings;
  onSettingsChange: (updater: (prev: PlayerSettings) => PlayerSettings) => void;
  selectedTheme: ThemePalette;
  onThemeSelect: (theme: ThemePalette) => void;
}

export default function TactileSettingsDashboard({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  selectedTheme,
  onThemeSelect
}: TactileSettingsDashboardProps) {
  // Local state for live packet graph logging
  const [bitrateHistory, setBitrateHistory] = useState<number[]>([15, 18, 22, 28, 25, 29, 34, 45, 52, 48, 55, 68, 72, 69, 78, 85, 92, 88, 85, 99]);
  const [currentBps, setCurrentBps] = useState<number>(4500); // kbps

  // Simulate incoming video chunks/packets updates for the SVG graph
  useEffect(() => {
    if (!isOpen || !settings.bitrateDiagnosticEnabled) return;

    const interval = setInterval(() => {
      // Walk with mathematical bounds
      setBitrateHistory((prev) => {
        const nextSpeed = Math.floor(prev[prev.length - 1] + (Math.random() - 0.5) * 12);
        const boundedSpeed = Math.max(10, Math.min(100, nextSpeed));
        const updated = [...prev.slice(1), boundedSpeed];
        
        // Compute nominal kb/s equivalent
        setCurrentBps(Math.round(boundedSpeed * 115) + 3800);
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, settings.bitrateDiagnosticEnabled]);

  const toggleDiagnosticChange = () => {
    onSettingsChange((prev) => ({
      ...prev,
      bitrateDiagnosticEnabled: !prev.bitrateDiagnosticEnabled
    }));
  };

  const setAudioPhase = (phase: AudioPhase) => {
    onSettingsChange((prev) => ({
      ...prev,
      audioPhase: phase
    }));

    // Play a brief feedback sound representing audio test
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const panner = audioCtx.createStereoPanner();
      const gain = audioCtx.createGain();

      osc.connect(panner);
      panner.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);

      if (phase === "spatial3d") {
        // Sweep panning sound back and forth to simulate spatial surround
        panner.pan.setValueAtTime(-1, audioCtx.currentTime);
        panner.pan.linearRampToValueAtTime(1, audioCtx.currentTime + 0.3);
        panner.pan.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
        osc.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.6);
      } else {
        // Standard center stereo beep
        panner.pan.setValueAtTime(0, audioCtx.currentTime);
      }

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.7);
    } catch (e) {
      // Web Audio API fallback
    }
  };

  // Convert histories into coordinates sequence for the SVG lines
  const pointsString = bitrateHistory
    .map((val, idx) => `${(idx / (bitrateHistory.length - 1)) * 340},${100 - val}`)
    .join(" ");

  return (
    <div
      id="tactile_settings_sidebar"
      className={`fixed top-0 right-0 h-full w-full sm:w-[450px] z-40 bg-black/40 backdrop-blur-[35px] border-l border-white/10 flex flex-col justify-between p-8 font-sans shadow-2xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
      }`}
      style={{
        boxShadow: isOpen ? "-30px 0 60px rgba(0,0,0,0.8)" : "none",
        transformStyle: "preserve-3d"
      }}
    >
      {/* Header element */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Sliders className="h-4.5 w-4.5 text-red-500" />
          </div>
          <div>
            <h2 className="text-xl font-medium text-white tracking-wide leading-tight">Tactile Matrix</h2>
            <p className="text-gray-500 font-mono text-[9px] tracking-widest uppercase">System Controls</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="h-8 w-8 rounded-full border border-white/5 bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors focus:outline-none"
          title="Close Settings Panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main Settings Sections */}
      <div className="flex-1 my-6 overflow-y-auto pr-2 space-y-8 scrollbar-thin">
        
        {/* Theme select section (Ambient logic preset) */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-xs font-mono font-medium tracking-widest uppercase text-neutral-300">Ambient Aura Theme</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3" id="theme_presets_grid">
            {[
              { id: "crimson", name: "Netflix Aura", color: "from-red-600 to-rose-500", glowHex: "#FF4D57" },
              { id: "purple", name: "Cyber Purple", color: "from-purple-600 to-fuchsia-500", glowHex: "#A855F7" },
              { id: "midnight", name: "Cobalt Void", color: "from-blue-600 to-cyan-500", glowHex: "#3B82F6" },
              { id: "emerald", name: "Green Matrix", color: "from-emerald-500 to-teal-500", glowHex: "#10B981" }
            ].map((theme) => {
              const active = selectedTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  id={`theme_toggle_${theme.id}`}
                  onClick={() => onThemeSelect(theme.id as ThemePalette)}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border bg-black/30 transition-all text-left focus:outline-none ${
                    active 
                      ? "border-white/20 ring-[1px] ring-white/10 bg-white/5" 
                      : "border-white/5 hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className={`h-4.5 w-4.5 rounded-full bg-gradient-to-tr ${theme.color} ring-2 ring-black flex items-center justify-center relative overflow-visible shadow-lg`}>
                    <div className="absolute inset-0 rounded-full blur-sm opacity-50" style={{ backgroundColor: theme.glowHex }} />
                    {active && <Check className="h-3 w-3 text-white relative z-10" />}
                  </div>
                  <span className="text-xs font-medium text-gray-200">{theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Streaming Resolution Multiplier Select */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <Video className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-xs font-mono font-medium tracking-widest uppercase text-neutral-300">Resolution Mode</span>
          </div>

          <div className="grid grid-cols-4 gap-2" id="resolution_grid">
            {[
              { id: "720p", label: "720p", desc: "SD mobile" },
              { id: "1080p", label: "1080p", desc: "FHD panel" },
              { id: "k4", label: "4K UHD", desc: "UHD Cinema" },
              { id: "original", label: "RAW", desc: "True Uncom." }
            ].map((resOption) => {
              const mappedId = resOption.id === "k4" ? "4k" : resOption.id === "original" ? "original" : resOption.id === "1080p" ? "1080p" : "720p";
              const active = settings.resolutionMultiplier === mappedId;

              return (
                <button
                  key={resOption.id}
                  id={`resolution_btn_${resOption.id}`}
                  onClick={() => onSettingsChange((prev) => ({ ...prev, resolutionMultiplier: mappedId }))}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all text-center focus:outline-none ${
                    active
                      ? "border-red-500 bg-red-950/20 text-white"
                      : "border-white/5 bg-black/20 hover:border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <span className="text-xs font-semibold tracking-wide">{resOption.label}</span>
                  <span className="text-[8px] font-mono mt-1 text-gray-500 block text-nowrap">{resOption.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spatial Audio Phase configuration (Virtuality surround Soundscape) */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <Volume2 className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-xs font-mono font-medium tracking-widest uppercase text-neutral-300">Spatial Audio Phase</span>
          </div>

          <div className="space-y-2" id="audio_phase_controls">
            {[
              { id: "stereo", name: "Standard Stereo Matrix", desc: "Flat horizontal dual channel output" },
              { id: "spatial3d", name: "Dolby Atmos 3D Spatializer", desc: "Virtual surround soundscape via binaural filtering" }
            ].map((phase) => {
              const active = settings.audioPhase === phase.id;

              return (
                <button
                  key={phase.id}
                  id={`audio_phase_toggle_${phase.id}`}
                  onClick={() => setAudioPhase(phase.id as AudioPhase)}
                  className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left bg-black/20 transition-all focus:outline-none ${
                    active
                      ? "border-red-500 bg-red-950/10"
                      : "border-white/5 hover:border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border border-neutral-700 flex items-center justify-center flex-shrink-0 ${active ? "border-red-500 bg-red-500" : ""}`}>
                    {active && <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-200 block">{phase.name}</span>
                    <span className="text-[10px] text-gray-500 leading-tight block mt-0.5">{phase.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customizable Floating Subtitles style */}
        <div>
          <div className="flex items-center gap-2 mb-3.5">
            <Type className="h-3.5 w-3.5 text-neutral-400" />
            <span className="text-xs font-mono font-medium tracking-widest uppercase text-neutral-300">Subtitle Style Customizer</span>
          </div>

          <div className="grid grid-cols-3 gap-2" id="subtitles_style_selector">
            {[
              { id: "flat", label: "Floating Plain", style: "border border-neutral-700" },
              { id: "glow", label: "Neon Cyber Glow", style: "bg-red-500/20 text-red-400 border border-red-500/30" },
              { id: "shadow", label: "Cinematic Drop", style: "shadow-[2px_2px_4px_rgba(0,0,0,1)] uppercase text-amber-400" }
            ].map((item) => {
              const active = settings.subtitleStyle === item.id;
              return (
                <button
                  key={item.id}
                  id={`sub_style_${item.id}`}
                  onClick={() => onSettingsChange((prev) => ({ ...prev, subtitleStyle: item.id as any }))}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all focus:outline-none ${
                    active
                      ? "border-red-500 bg-red-950/20 text-white"
                      : "border-white/5 bg-black/20 hover:border-white/10 text-gray-400"
                  }`}
                >
                  <span className={`text-[10px] px-1 bg-black/40 rounded scale-90 mb-1 inline-block ${item.style}`}>Aa</span>
                  <span className="text-[10px] font-medium leading-none whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-time Diagnostic Buffering Rate Monitor */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-neutral-400" />
              <span className="text-xs font-mono font-medium tracking-widest uppercase text-neutral-300">Buffering Diagnostic</span>
            </div>
            
            <button
              onClick={toggleDiagnosticChange}
              className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors focus:outline-none ${
                settings.bitrateDiagnosticEnabled
                  ? "bg-red-950/40 border-red-500/30 text-red-400 hover:bg-red-950/60"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {settings.bitrateDiagnosticEnabled ? "DISABLE" : "ENABLE"}
            </button>
          </div>

          {settings.bitrateDiagnosticEnabled ? (
            <div className="p-4 rounded-xl border border-white/5 bg-black/40 text-left relative overflow-hidden" id="diagnostics_panel">
              {/* Bitrate analytics details */}
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase font-mono">Download Speed</span>
                  <span className="text-lg font-mono font-medium text-white flex items-center gap-1">
                    {(currentBps / 1000).toFixed(2)} <span className="text-[11px] text-red-500">MB/s</span>
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase font-mono">Frame Latency</span>
                  <span className="text-lg font-mono font-medium text-emerald-400">1.4ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-mono">FPS Rate</span>
                  <span className="text-lg font-mono font-medium text-white">60.2</span>
                </div>
              </div>

              {/* Bitrate graph */}
              <div className="relative h-24 w-full bg-black/60 rounded-lg p-2 border border-white/5">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 340 100" preserveAspectRatio="none">
                  {/* Subtle Grid horizontal lines */}
                  <line x1="0" y1="25" x2="340" y2="25" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                  <line x1="0" y1="50" x2="340" y2="50" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                  <line x1="0" y1="75" x2="340" y2="75" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                  
                  {/* Glowing Gradient fill under speed curve */}
                  <defs>
                    <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FF4D57" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="#FF4D57" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Fill shape */}
                  <path
                    d={`M 0,100 L ${pointsString} L 340,100 Z`}
                    fill="url(#glowGrad)"
                  />
                  
                  {/* Line stroke */}
                  <polyline
                    fill="none"
                    stroke="#FF4D57"
                    strokeWidth="1.5"
                    points={pointsString}
                    className="transition-all duration-300"
                  />
                </svg>
              </div>

              <div className="flex items-center gap-1.5 mt-3 text-[9px] text-gray-500 font-mono">
                <Database className="h-3 w-3 text-red-500 animate-pulse" />
                PACKETS TUNNELED IN REALTIME VIA CINEMA ADAPTIVE BITRATE
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-white/5 bg-black/10 text-center flex flex-col items-center justify-center">
              <Activity className="h-6 w-6 text-neutral-600 mb-2" />
              <span className="text-xs text-neutral-400 font-medium">Diagnostic Monitor Terminated</span>
              <span className="text-[10px] text-neutral-600 font-mono mt-1">Enable telemetry logging for real-time bitrate metrics.</span>
            </div>
          )}
        </div>

      </div>

      {/* Footer System Details */}
      <div className="border-t border-white/10 pt-6 flex flex-col gap-3">
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
          <span className="flex items-center gap-1 text-gray-500">
            <Sliders className="h-3 w-3 text-red-500" /> Matrix-Kernel:
          </span>
          <span className="text-gray-300">v4.18.2-Aura</span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-gray-400">
          <span className="text-gray-500">Server Node Status:</span>
          <span className="text-emerald-500 uppercase flex items-center gap-1 font-semibold">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" /> Stable 0ms
          </span>
        </div>
        <p className="text-[9px] font-mono text-gray-600 text-center leading-relaxed">
          Tactile dials utilize hardware accelerations. Real-time theme updates re-render ambient lights instantly dynamically.
        </p>
      </div>

    </div>
  );
}
