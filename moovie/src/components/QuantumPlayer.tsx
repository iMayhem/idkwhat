import React, { useState, useEffect, useRef } from "react";
import { Movie, PlayerSettings } from "../types";
import {
  Play, Pause, Volume2, RotateCcw, Monitor, Waves, Cpu, Sparkles, Languages, Info, ArrowLeft, Maximize, SkipForward, HelpCircle
} from "lucide-react";

interface QuantumPlayerProps {
  movie: Movie;
  settings: PlayerSettings;
  onBackToHome: () => void;
}

export default function QuantumPlayer({ movie, settings, onBackToHome }: QuantumPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<string>("0:00");
  const [totalTimeStr, setTotalTimeStr] = useState<string>("0:00");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hudOffset, setHudOffset] = useState({ x: 0, y: 0 });
  const [ambilightColors, setAmbilightColors] = useState<string[]>(["#E50914", "#A855F7", "#1E1B4B", "#3B82F6", "#10B981"]);
  const [showHud, setShowHud] = useState<boolean>(true);

  // Scraper & Streaming states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [selectedStreamIndex, setSelectedStreamIndex] = useState<number>(0);
  const [scrapeLogs, setScrapeLogs] = useState<string>("Initializing secure channel...\n");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ambilightTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Auto-hide HUD on idle
  useEffect(() => {
    let timer: any;
    const resetTimer = () => {
      setShowHud(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShowHud(false), 4500);
    };

    window.addEventListener("mousemove", resetTimer);
    resetTimer();

    return () => {
      window.removeEventListener("mousemove", resetTimer);
      clearTimeout(timer);
    };
  }, []);

  // Spatial audio sound effect on HUD interactions
  const playSpatialClick = (e: React.MouseEvent) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = (clickX / rect.width) * 2 - 1; // -1 to 1

      const osc = ctx.createOscillator();
      const panner = ctx.createStereoPanner();
      const gainNode = ctx.createGain();

      osc.connect(panner);
      panner.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.12);

      panner.pan.setValueAtTime(pct, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (err) {
      // Audio fallback
    }
  };

  // Ambient pixel-glow simulator
  useEffect(() => {
    if (!isPlaying) return;

    ambilightTimerRef.current = setInterval(() => {
      setAmbilightColors(() => {
        const primaryColor = movie.auraColor || "#FF4D57";
        const brightnessFactor = 0.55 + Math.random() * 0.45;
        
        const c1 = adjustColorBrightness(primaryColor, brightnessFactor);
        const c2 = adjustColorBrightness("#10B981", Math.random() * 0.4);
        const c3 = adjustColorBrightness("#3B82F6", Math.random() * 0.4);
        const c4 = adjustColorBrightness("#A855F7", Math.random() * 0.5);
        
        return [c1, c2, c3, c4, c1];
      });
    }, 1200);

    return () => {
      if (ambilightTimerRef.current) clearInterval(ambilightTimerRef.current);
    };
  }, [isPlaying, movie]);

  const adjustColorBrightness = (hex: string, factor: number) => {
    try {
      const cleanHex = hex.replace("#", "");
      const r = Math.min(255, Math.floor(parseInt(cleanHex.substring(0, 2), 16) * factor));
      const g = Math.min(255, Math.floor(parseInt(cleanHex.substring(2, 4), 16) * factor));
      const b = Math.min(255, Math.floor(parseInt(cleanHex.substring(4, 6), 16) * factor));
      return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch {
      return hex;
    }
  };

  // Video element event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const cur = video.currentTime;
      const dur = video.duration || 1;
      setPlayProgress((cur / dur) * 100);

      const mins = Math.floor(cur / 60);
      const secs = Math.floor(cur % 60);
      setCurrentTime(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };

    const handleDurationChange = () => {
      const dur = video.duration || 0;
      const mins = Math.floor(dur / 60);
      const secs = Math.floor(dur % 60);
      setTotalTimeStr(`${mins}:${secs < 10 ? '0' : ''}${secs}`);
    };

    const handleVideoEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("ended", handleVideoEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleVideoEnded);
    };
  }, [isLoading]);

  // Clean up Hls on unmount
  useEffect(() => {
    return () => {
      if ((window as any).activeHls) {
        try {
          (window as any).activeHls.destroy();
        } catch {}
        (window as any).activeHls = null;
      }
    };
  }, []);

  // Real-time backend parallel scraper integration
  useEffect(() => {
    let isMounted = true;
    const streamsList: any[] = [];
    const processedUrls = new Set<string>();
    let activePings = 0;
    let allLinksReceived = false;
    let localHasAutoplayed = false;

    const appendLog = (msg: string) => {
      if (isMounted) {
        setScrapeLogs((prev) => prev + msg + "\n");
      }
    };

    const testStreamLatency = async (stream: any, index: number) => {
      activePings++;
      
      const encodedUrl = encodeURIComponent(stream.url);
      const referer = stream.headers.Referer || stream.headers.referer || '';
      const origin = stream.headers.Origin || stream.headers.origin || '';
      const userAgent = stream.headers['User-Agent'] || stream.headers['user-agent'] || '';
      
      let proxiedUrl = `/api/proxy?url=${encodedUrl}`;
      if (referer) proxiedUrl += `&referer=${encodeURIComponent(referer)}`;
      if (origin) proxiedUrl += `&origin=${encodeURIComponent(origin)}`;
      if (userAgent) proxiedUrl += `&user_agent=${encodeURIComponent(userAgent)}`;
      
      const start = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(proxiedUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (resp.ok) {
          const latency = Math.round(performance.now() - start);
          stream.latency = latency;
          appendLog(`[${stream.displayName}] Latency verified: ${latency}ms`);
        } else {
          stream.latency = 99999;
          appendLog(`[${stream.displayName}] Latency test failed (HTTP ${resp.status})`);
        }
      } catch {
        stream.latency = 99999;
        appendLog(`[${stream.displayName}] Latency test timed out`);
      } finally {
        activePings--;
        checkAndAutoplay();
      }
    };

    const checkAndAutoplay = () => {
      if (allLinksReceived && activePings === 0 && !localHasAutoplayed && streamsList.length > 0) {
        localHasAutoplayed = true;
        
        // Find lowest latency stream
        let fastestIndex = 0;
        let lowestLatency = 99999;
        streamsList.forEach((s, idx) => {
          if (s.latency < lowestLatency) {
            lowestLatency = s.latency;
            fastestIndex = idx;
          }
        });

        appendLog(`\nAuto-negotiated best source: Channel ${fastestIndex + 1} (${lowestLatency === 99999 ? 'Backup' : lowestLatency + 'ms'})`);
        
        if (isMounted) {
          setActiveStreams([...streamsList]);
          setSelectedStreamIndex(fastestIndex);
          setIsLoading(false);
          // Wait briefly for video ref connection
          setTimeout(() => {
            if (isMounted) {
              loadVideoSource(streamsList[fastestIndex]);
            }
          }, 100);
        }
      }
    };

    const handleNewStreams = (incoming: any[]) => {
      const added: any[] = [];
      incoming.forEach((s: any) => {
        if (s.url && !processedUrls.has(s.url)) {
          processedUrls.add(s.url);
          let label = s.label || "Auto Server";
          if (label.toLowerCase() === "unknown") {
            label = `Mirror Gateway ${streamsList.length + 1}`;
          }
          s.displayName = label;
          s.latency = 99999;
          s.index = streamsList.length;
          
          streamsList.push(s);
          added.push(s);
        }
      });

      if (added.length > 0 && isMounted) {
        setActiveStreams([...streamsList]);
        added.forEach((stream) => {
          testStreamLatency(stream, stream.index);
        });
      }
    };

    const performScrape = async () => {
      try {
        appendLog(`Connecting to index parallel pipeline for: ${movie.title} (ID: ${movie.id})...`);
        
        const response = await fetch(`/api/scrape?id=${movie.id}&type=movie`);
        if (!response.ok) {
          throw new Error(`HTTP pipeline connection error: ${response.status}`);
        }
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const parsed = JSON.parse(line);
                if (parsed.type === "log") {
                  appendLog(parsed.message);
                } else if (parsed.type === "streams") {
                  handleNewStreams(parsed.streams);
                } else if (parsed.type === "error") {
                  appendLog(`Pipeline warning: ${parsed.message}`);
                }
              } catch {}
            }
          }
        }

        // Process residual buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.type === "log") {
              appendLog(parsed.message);
            } else if (parsed.type === "streams") {
              handleNewStreams(parsed.streams);
            }
          } catch {}
        }
        
        allLinksReceived = true;
        checkAndAutoplay();
        
        if (streamsList.length === 0) {
          appendLog("\n❌ Failed to resolve any working index nodes.");
        }
      } catch (err: any) {
        appendLog(`\n❌ Scraper connection failed: ${err.message}`);
      }
    };

    performScrape();

    return () => {
      isMounted = false;
    };
  }, [movie]);

  const loadVideoSource = (stream: any) => {
    const video = videoRef.current;
    if (!video) return;

    if ((window as any).activeHls) {
      try {
        (window as any).activeHls.destroy();
      } catch {}
      (window as any).activeHls = null;
    }

    const encodedUrl = encodeURIComponent(stream.url);
    const referer = stream.headers.Referer || stream.headers.referer || '';
    const origin = stream.headers.Origin || stream.headers.origin || '';
    const userAgent = stream.headers['User-Agent'] || stream.headers['user-agent'] || '';
    
    let proxiedUrl = `/api/proxy?url=${encodedUrl}`;
    if (referer) proxiedUrl += `&referer=${encodeURIComponent(referer)}`;
    if (origin) proxiedUrl += `&origin=${encodeURIComponent(origin)}`;
    if (userAgent) proxiedUrl += `&user_agent=${encodeURIComponent(userAgent)}`;

    const isHls = stream.type === "hls" || proxiedUrl.toLowerCase().includes(".m3u8");
    const HlsClass = (window as any).Hls;

    if (isHls && HlsClass && HlsClass.isSupported()) {
      const hls = new HlsClass();
      hls.loadSource(proxiedUrl);
      hls.attachMedia(video);
      hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
        setIsPlaying(true);
      });
      (window as any).activeHls = hls;
    } else {
      video.src = proxiedUrl;
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleMuteToggle = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleHUDMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.05;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.05;
    setHudOffset({ x, y });
  };

  const handleHUDMouseLeave = () => {
    setHudOffset({ x: 0, y: 0 });
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black flex flex-col justify-between font-sans select-none"
      onMouseMove={handleHUDMouseMove}
      onMouseLeave={handleHUDMouseLeave}
    >
      
      {/* Bloom Backdrops */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-70">
        <div
          className="absolute top-[20%] left-[-15%] w-[80%] h-[60%] rounded-full opacity-60 blur-[130px] transition-all duration-1000 ease-in-out"
          style={{ backgroundColor: ambilightColors[0] }}
        />
        <div
          className="absolute top-[30%] right-[-15%] w-[80%] h-[60%] rounded-full opacity-50 blur-[130px] transition-all duration-1000 ease-in-out"
          style={{ backgroundColor: ambilightColors[1] }}
        />
        <div
          className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] rounded-full opacity-40 blur-[110px] transition-all duration-1000 ease-in-out"
          style={{ backgroundColor: ambilightColors[3] }}
        />
      </div>

      {/* Top action indicators */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 p-8 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent transition-all duration-500 ease-out ${
          showHud ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <button
          onClick={onBackToHome}
          className="flex items-center gap-2 px-4 py-2 border border-white/10 bg-black/40 hover:bg-white/10 text-white rounded-full transition-all text-xs font-mono tracking-widest uppercase focus:outline-none cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to discovery
        </button>

        {/* Channels/Server dropdown switcher */}
        <div className="flex items-center gap-3">
          {!isLoading && activeStreams.length > 0 && (
            <select
              value={selectedStreamIndex}
              onChange={(e) => {
                const idx = parseInt(e.target.value);
                setSelectedStreamIndex(idx);
                loadVideoSource(activeStreams[idx]);
              }}
              className="bg-black/70 border border-white/10 hover:border-white/20 text-white text-xs font-mono rounded-full px-3 py-1.5 outline-none cursor-pointer focus:border-red-500 transition-all pointer-events-auto"
            >
              {activeStreams.map((s, idx) => (
                <option key={idx} value={idx}>
                  {s.displayName} ({s.latency === 99999 ? "Offline" : `${s.latency}ms`})
                </option>
              ))}
            </select>
          )}

          <span className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono tracking-wider text-gray-400">
            <Cpu className="h-3 w-3 text-red-500" />
            BITRATE: <span className="text-white font-medium">{settings.resolutionMultiplier === "4k" ? "42.8 GBps" : settings.resolutionMultiplier === "original" ? "98.5 GBps" : "12.4 GBps"}</span>
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-950/30 border border-red-500/20 rounded-full text-[10px] font-mono tracking-wider text-red-400">
            <Waves className="h-3 w-3 text-red-500 animate-pulse" />
            AUDIO: <span className="text-white uppercase font-medium">{settings.audioPhase === "spatial3d" ? "Spatial Atmos 3D" : "Standard Stereo"}</span>
          </span>
        </div>
      </div>

      {/* Center Theater Zone (Curved Projection screen) */}
      <div className="absolute inset-x-0 top-[15%] bottom-[20%] z-10 flex items-center justify-center pointer-events-none px-6">
        
        <div
          className="relative w-full max-w-5xl aspect-video rounded-2xl bg-neutral-950/90 shadow-2xl border border-white/15 overflow-hidden transition-all duration-700 pointer-events-auto flex items-center justify-center"
          style={{
            transform: `perspective(1000px) rotateX(1.5deg) rotateY(${hudOffset.x * -0.06}deg) translateZ(0) scale(1.02)`,
            boxShadow: `0 35px 80px -20px ${adjustedAlphaHex(movie.auraColor, "60") || "rgba(0,0,0,0.9)"}`
          }}
          onClick={playSpatialClick}
        >
          {isLoading ? (
            /* Scraper holographic terminal viewport */
            <div className="w-full h-full p-8 flex flex-col justify-between bg-black/90 font-mono text-xs text-left overflow-hidden relative">
              <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                <span className="text-red-500 animate-pulse font-bold tracking-widest uppercase">HOLOGRAPHIC STREAM DECRYPTOR v3D</span>
                <span className="text-[10px] text-gray-500">AURA SOURCE DETECTED</span>
              </div>
              <pre className="flex-1 overflow-y-auto whitespace-pre-wrap text-emerald-400 font-mono text-[10px] md:text-xs leading-relaxed py-4 scroll-smooth">
                {scrapeLogs}
              </pre>
              <div className="flex items-center gap-3 pt-3 border-t border-white/5 text-[10px] text-gray-500">
                <div className="h-4.5 w-4.5 rounded-full border-2 border-red-500/20 border-t-red-500 animate-spin" />
                <span>Calibrating parallel gateways, mapping network coordinates...</span>
              </div>
            </div>
          ) : (
            /* Main HTML5 video engine */
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover z-[1] bg-black"
              controls={false}
              autoPlay
            />
          )}

          {/* Liquid dynamic film particles mask */}
          <div className="absolute inset-0 bg-black/10 mix-blend-overlay pointer-events-none z-[2]" />

          {/* Cyber scanner overlay lines */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_97%,rgba(229,9,20,0.18)_99%)] bg-[size:100%_40px] animate-[slide_10s_linear_infinite] pointer-events-none z-[3]" />

          {/* Sound Wave Visualizer */}
          {settings.audioPhase === "spatial3d" && isPlaying && !isLoading && (
            <div className="absolute bottom-6 left-6 z-10 flex items-end gap-1 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-red-500/20 text-red-400 text-[10px] font-mono tracking-widest uppercase">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              SPATIAL BOUNDS ACTIVE: L R SPHERE
            </div>
          )}

          {/* Subtitles Overlay */}
          {isPlaying && !isLoading && (
            <div
              className="absolute bottom-16 inset-x-8 text-center z-10 select-none transition-all pointer-events-none"
              style={{
                textShadow: settings.subtitleStyle === "shadow" ? "2px 2px 8px #000" : undefined,
                filter: settings.subtitleStyle === "glow" ? "drop-shadow(0 0 8px rgba(229,9,20,0.8))" : undefined
              }}
            >
              <span
                className={`px-4 py-1.5 text-sm md:text-base font-light tracking-wide rounded-lg inline-block ${
                  settings.subtitleStyle === "flat"
                    ? "bg-black/75 border border-white/10 text-white"
                    : settings.subtitleStyle === "glow"
                    ? "bg-[#E50914]10 text-red-400 font-medium"
                    : "text-amber-400 uppercase font-bold text-shadow-xl"
                }`}
              >
                {playProgress < 25 
                  ? "Resolving digital tethers to orbital satellite transponders..." 
                  : playProgress < 50 
                  ? "Deep space telemetry streaming in clean spatial bounds." 
                  : playProgress < 75
                  ? "Mapping localized audio phase shifts into 3D stereo buffers."
                  : "Scanning stream buffers... Quantization levels nominal."}
              </span>
            </div>
          )}

          {/* Pause overlay mask */}
          {!isPlaying && !isLoading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10 gap-2">
              <div
                className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 font-semibold cursor-pointer animate-pulse"
                onClick={handlePlayPause}
              >
                <Play className="h-6 w-6 ml-1" />
              </div>
              <p className="text-xs font-mono tracking-widest text-red-500 uppercase mt-2">
                PAUSED • SURROUND AMBILIGHT ON IDLE
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Floating HUD Controller */}
      <div
        className={`absolute bottom-0 inset-x-0 z-30 p-8 flex flex-col gap-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-all duration-500 ease-out ${
          showHud ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
        }`}
        style={{
          transform: `translate3d(${hudOffset.x * 0.15}px, ${hudOffset.y * 0.15}px, 0)`
        }}
        onClick={playSpatialClick}
      >
        
        {/* Scrubber track */}
        <div className="relative w-full max-w-5xl mx-auto flex items-center gap-4">
          <span className="text-[10px] font-mono text-gray-500 w-10 flex-shrink-0 text-left">{currentTime}</span>
          
          <div
            id="timeline_tracker"
            className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden cursor-pointer relative group"
            onClick={(e) => {
              if (isLoading) return;
              const video = videoRef.current;
              if (!video) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percentage = clickX / rect.width;
              video.currentTime = percentage * (video.duration || 0);
              setPlayProgress(percentage * 100);
            }}
          >
            <div className="absolute top-0 bottom-0 left-0 bg-neutral-700/50" style={{ width: `${Math.min(100, playProgress + 10)}%` }} />
            <div className="absolute top-0 bottom-0 left-0 bg-red-600 group-hover:bg-red-500 transition-all" style={{ width: `${playProgress}%` }} />
          </div>

          <span className="text-[10px] font-mono text-gray-500 w-10 flex-shrink-0 text-right">{totalTimeStr}</span>
        </div>

        {/* Action icons bar */}
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between mt-2">
          
          {/* Left: Playback toggles */}
          <div className="flex items-center gap-6">
            <button
              onClick={handlePlayPause}
              disabled={isLoading}
              className="text-gray-300 hover:text-white transition-colors focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title={isPlaying ? "Pause Stream" : "Play Stream"}
            >
              {isPlaying ? <Pause className="h-5 w-5 text-red-500" /> : <Play className="h-5 w-5" />}
            </button>

            <button
              onClick={() => {
                const video = videoRef.current;
                if (video) video.currentTime = Math.max(0, video.currentTime - 10);
              }}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors focus:outline-none disabled:opacity-30 cursor-pointer"
              title="Skip backward 10s"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>

            <button
              onClick={() => {
                const video = videoRef.current;
                if (video) video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
              }}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors focus:outline-none disabled:opacity-30 cursor-pointer"
              title="Skip forward 10s"
            >
              <SkipForward className="h-4.5 w-4.5" />
            </button>

            <button
              onClick={handleMuteToggle}
              disabled={isLoading}
              className="text-gray-400 hover:text-white transition-colors focus:outline-none disabled:opacity-30 cursor-pointer"
              title={isMuted ? "Unmute" : "Mute Sound"}
            >
              <Volume2 className={`h-4.5 w-4.5 ${isMuted ? "text-red-500 line-through" : ""}`} />
            </button>
          </div>

          {/* Center: Vibe title */}
          <div className="hidden md:flex flex-col items-center">
            <span className="text-white text-sm font-medium tracking-wide flex items-center gap-1.5">
              {movie.title} <span className="text-[10px] font-mono text-red-500 uppercase px-1 py-0.2 rounded border border-red-500/20">{movie.resolution || "4K ULTRA HD"}</span>
            </span>
            <span className="text-[10px] text-gray-500 font-mono tracking-widest mt-0.5 uppercase">
              {isLoading ? "Negotiating Gateways..." : "Now Streaming Spatial Streamlines"}
            </span>
          </div>

          {/* Right: Codec options */}
          <div className="flex items-center gap-5">
            <span className="hidden sm:inline-block text-[11px] font-mono text-gray-400 bg-white/5 border border-white/5 px-2 py-1 rounded">
              CODEC: <span className="text-white">HEVC h.265</span>
            </span>
            <span className="hidden sm:inline-block text-[11px] font-mono text-gray-400 bg-white/5 border border-white/5 px-2 py-1 rounded">
              RES: <span className="text-white font-bold">{settings.resolutionMultiplier.toUpperCase()}</span>
            </span>
            <button
              className="text-gray-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
              title="Toggle full screen"
              onClick={() => {
                const video = videoRef.current;
                if (video && video.requestFullscreen) {
                  video.requestFullscreen();
                }
              }}
            >
              <Maximize className="h-4.5 w-4.5" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
