import React, { useEffect, useRef, useState } from "react";
import { UserProfile } from "../types";
import { Sparkles, ArrowRight, UserPlus, Zap } from "lucide-react";

interface ProfileWarpViewProps {
  onProfileSelect: (profile: UserProfile) => void;
}

export const PROFILES: UserProfile[] = [
  { id: "sujeet", name: "Sujeet", avatarColor: "from-rose-600 to-red-500", glowColor: "#FF4D57" },
  { id: "guest", name: "Guest User", avatarColor: "from-blue-600 to-indigo-500", glowColor: "#3B82F6" },
  { id: "hacker", name: "Cinephile 3D", avatarColor: "from-purple-600 to-fuchsia-500", glowColor: "#A855F7" }
];

export default function ProfileWarpView({ onProfileSelect }: ProfileWarpViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredProfile, setHoveredProfile] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [warpProgress, setWarpProgress] = useState<number>(0); // 0 to 1
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const hoveredProfileRef = useRef<string | null>(null);
  const selectedProfileRef = useRef<UserProfile | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    hoveredProfileRef.current = hoveredProfile;
  }, [hoveredProfile]);

  useEffect(() => {
    selectedProfileRef.current = selectedProfile;
  }, [selectedProfile]);

  useEffect(() => {
    mouseRef.current = mouse;
  }, [mouse]);

  // Handle mouse movement for parallax
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setMouse({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // WebGL/Canvas Particle and Hologram Simulator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle setup
    interface Particle {
      x: number;
      y: number;
      z: number;
      color: string;
      size: number;
      speed: number;
      angle: number;
    }

    const particles: Particle[] = [];
    const count = 350;

    for (let i = 0; i < count; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * 1000 + 10,
        color: i % 3 === 0 ? "#FF4D57" : i % 3 === 1 ? "#3B82F6" : "#A855F7",
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 3 + 1,
        angle: Math.random() * Math.PI * 2
      });
    }

    // Interactive floating holographic points
    interface Hologram {
      x: number;
      y: number;
      r: number;
      pulse: number;
      glowColor: string;
    }

    const holograms: Hologram[] = [
      { x: width * 0.28, y: height * 0.5, r: 85, pulse: 0, glowColor: "#FF4D57" },
      { x: width * 0.5, y: height * 0.5, r: 85, pulse: 1.5, glowColor: "#3B82F6" },
      { x: width * 0.72, y: height * 0.5, r: 85, pulse: 3.0, glowColor: "#A855F7" }
    ];

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      holograms[0].x = width * 0.28;
      holograms[0].y = height * 0.5;
      holograms[1].x = width * 0.5;
      holograms[1].y = height * 0.5;
      holograms[2].x = width * 0.72;
      holograms[2].y = height * 0.5;
    };

    window.addEventListener("resize", resize);

    let warpSpeed = 1;

    const render = () => {
      const activeSelectedProfile = selectedProfileRef.current;
      const activeHoveredProfile = hoveredProfileRef.current;
      const activeMouse = mouseRef.current;

      // OLED pitch-black void with trailing frame drag during warp speeds
      if (activeSelectedProfile) {
        ctx.fillStyle = `rgba(3, 3, 3, ${Math.max(0.04, 1 - warpSpeed * 0.08)})`;
      } else {
        ctx.fillStyle = "#030303";
      }
      ctx.fillRect(0, 0, width, height);

      // Deep space perspective warp speed calculations
      const cx = width / 2;
      const cy = height / 2;

      // Accelerate warp factors based on selection
      if (activeSelectedProfile) {
        warpSpeed = Math.min(65, warpSpeed + 1.2);
      }

      // Render star clusters with 3D projection formulas
      for (let i = 0; i < count; i++) {
        const p = particles[i];
        
        // Push z closer to view port
        p.z -= warpSpeed * p.speed;

        // Reset stars shooting behind viewer to recreate continuous jump
        if (p.z <= 0) {
          p.z = 1000;
          p.x = (Math.random() - 0.5) * width * 1.5;
          p.y = (Math.random() - 0.5) * height * 1.5;
        }

        // Project 3D coordinate to 2D screen coordinate
        const px = (p.x / p.z) * 500 + cx;
        const py = (p.y / p.z) * 500 + cy;

        // Draw star trail based on Z-velocity
        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const sizeFactor = (1000 - p.z) / 1000;
          const starSize = p.size * (sizeFactor * 1.8 + 0.3) * (activeSelectedProfile ? 2.5 : 1);
          
          ctx.beginPath();
          if (activeSelectedProfile) {
            // Draw warp stretching lines (God Rays / Light Speed streaks)
            const prevPx = (p.x / (p.z + warpSpeed * p.speed * 2.5)) * 500 + cx;
            const prevPy = (p.y / (p.z + warpSpeed * p.speed * 2.5)) * 500 + cy;
            
            const grad = ctx.createLinearGradient(prevPx, prevPy, px, py);
            grad.addColorStop(0, "rgba(3, 3, 3, 0)");
            grad.addColorStop(0.5, p.color);
            grad.addColorStop(1, "#ffffff");
            
            ctx.strokeStyle = grad;
            ctx.lineWidth = starSize * 0.8;
            ctx.moveTo(prevPx, prevPy);
            ctx.lineTo(px, py);
            ctx.stroke();
          } else {
            ctx.arc(px, py, starSize, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = activeHoveredProfile ? 15 : 4;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.shadowBlur = 0; // reset
          }
        }
      }

      // Draw subtle holographic nodes in background if not warping
      if (!activeSelectedProfile) {
        holograms.forEach((g, idx) => {
          g.pulse += 0.02;
          const scale = activeHoveredProfile === PROFILES[idx].id ? 1.12 : 1.0;
          const currentRadius = g.r * scale + Math.sin(g.pulse) * 4;

          // Parallax mouse offsets
          const mouseOffsetVal = 4;
          const finalX = g.x + activeMouse.x * mouseOffsetVal;
          const finalY = g.y - activeMouse.y * mouseOffsetVal;

          // Radial Glow Matrix (Ambient global illumination)
          const radGrad = ctx.createRadialGradient(
            finalX, finalY, currentRadius * 0.1,
            finalX, finalY, currentRadius * 1.8
          );
          radGrad.addColorStop(0, `${g.glowColor}25`);
          radGrad.addColorStop(0.4, `${g.glowColor}05`);
          radGrad.addColorStop(1, "rgba(3,3,3,0)");

          ctx.beginPath();
          ctx.arc(finalX, finalY, currentRadius * 1.8, 0, Math.PI * 2);
          ctx.fillStyle = radGrad;
          ctx.fill();

          // Outer glass thin halo rings
          ctx.beginPath();
          ctx.arc(finalX, finalY, currentRadius * 0.78, 0, Math.PI * 2);
          ctx.strokeStyle = `${g.glowColor}40`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Interweaving rotating orbiting segments
          ctx.beginPath();
          ctx.arc(finalX, finalY, currentRadius * 0.95, g.pulse, g.pulse + Math.PI * 0.45);
          ctx.strokeStyle = `${g.glowColor}99`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(finalX, finalY, currentRadius * 0.95, g.pulse + Math.PI, g.pulse + Math.PI * 1.45);
          ctx.strokeStyle = `${g.glowColor}55`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Cyber-lines crossing orbits
          if (activeHoveredProfile === PROFILES[idx].id) {
            ctx.beginPath();
            ctx.moveTo(finalX - currentRadius * 1.3, finalY);
            ctx.lineTo(finalX + currentRadius * 1.3, finalY);
            ctx.moveTo(finalX, finalY - currentRadius * 1.3);
            ctx.lineTo(finalX, finalY + currentRadius * 1.3);
            ctx.strokeStyle = `${g.glowColor}20`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  // Handle clicking a profile
  const handleWarpSelect = (profile: UserProfile) => {
    if (selectedProfile) return;
    
    setSelectedProfile(profile);
    
    // Play virtual beep sound
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 1.2);
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 1.3);
    } catch (e) {
      // Audio spatial fallbacks
    }

    // Warp pacing
    let prog = 0;
    const interval = setInterval(() => {
      prog += 0.02;
      setWarpProgress(Math.min(1, prog));
      if (prog >= 1) {
        clearInterval(interval);
        onProfileSelect(profile);
      }
    }, 28);
  };

  return (
    <div id="who_watching_page" className="relative w-full h-screen overflow-hidden bg-[#030303] flex items-center justify-center font-sans">
      {/* Background canvas for 3D Holographic Particles and warp drives */}
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full z-0 block pointer-events-none"
      />

      {/* Glossy Grid Backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_100%)] pointer-events-none z-[1] opacity-70" />

      {/* Main Overlay UI */}
      <div
        className="relative z-10 text-center flex flex-col justify-between h-full py-16 px-6 max-w-6xl w-full"
        style={{
          opacity: 1 - warpProgress * 2.2,
          transform: `scale(${1 + warpProgress * 0.4})`,
          transition: "opacity 0.4s ease, transform 0.4s ease"
        }}
      >
        {/* Header */}
        <div id="app_header_holographic" className="flex items-center justify-center gap-3">
          <span className="text-3xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-rose-400 to-red-600">
            MOOVIE
          </span>
        </div>

        {/* Profiles Grid container */}
        <div className="my-auto flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white mb-16">
            Who's Browsing the Space?
          </h1>

          <div id="profiles_wrapper" className="flex flex-wrap justify-center gap-12 md:gap-16 w-full max-w-4xl px-4">
            {PROFILES.map((prof) => {
              const isHovered = hoveredProfile === prof.id;
              
              return (
                <button
                  key={prof.id}
                  id={`profile_button_${prof.id}`}
                  className="group relative flex flex-col items-center bg-transparent border-none cursor-pointer focus:outline-none focus:ring-0"
                  onMouseEnter={() => setHoveredProfile(prof.id)}
                  onMouseLeave={() => setHoveredProfile(null)}
                  onClick={() => handleWarpSelect(prof)}
                >
                  {/* Hologram Avatar Orb */}
                  <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-500 bg-black border border-white/5 shadow-2x shadow-black overflow-visible">
                    
                    {/* Glowing outer liquid aura ring */}
                    <div
                      className={`absolute -inset-1.5 rounded-full transition-all duration-500 blur-md opacity-40 group-hover:opacity-100 ${
                        isHovered ? "scale-110" : "scale-100"
                      }`}
                      style={{
                        background: `radial-gradient(circle, ${prof.glowColor}90 0%, transparent 75%)`
                      }}
                    />

                    {/* True Glass Orb */}
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-tr ${prof.avatarColor} p-[1px] shadow-inner transition-all duration-500 scale-95`}>
                      <div className="w-full h-full rounded-full bg-neutral-950/90 flex flex-col items-center justify-center overflow-hidden relative">
                        {/* Shimmer light bar */}
                        <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 group-hover:left-[150%] transition-all duration-1000 ease-in-out" />
                        
                        {/* Profile initials */}
                        <span className="text-3xl font-medium tracking-tight text-white group-hover:scale-115 transition-transform duration-500 bg-clip-text text-transparent bg-gradient-to-b from-white via-neutral-100 to-neutral-400">
                          {prof.name.charAt(0)}
                        </span>
                      </div>
                    </div>

                    {/* God Ray Aura lines (Holographic vertical lasers) */}
                    <div
                      className={`absolute -bottom-8 left-12 w-1.5 h-12 bg-gradient-to-t from-transparent via-white to-transparent transition-all duration-700 pointer-events-none opacity-0 ${
                        isHovered ? "opacity-100 translate-y-[-10px] scale-y-125" : ""
                      }`}
                      style={{
                        filter: `drop-shadow(0 0 10px ${prof.glowColor})`,
                        backgroundImage: `linear-gradient(to top, transparent, ${prof.glowColor}, transparent)`
                      }}
                    />
                    <div
                      className={`absolute -top-8 right-12 w-1.5 h-12 bg-gradient-to-b from-transparent via-white to-transparent transition-all duration-700 pointer-events-none opacity-0 ${
                        isHovered ? "opacity-90 translate-y-[10px] scale-y-110" : ""
                      }`}
                      style={{
                        filter: `drop-shadow(0 0 10px ${prof.glowColor})`,
                        backgroundImage: `linear-gradient(to bottom, transparent, ${prof.glowColor}, transparent)`
                      }}
                    />
                  </div>

                  {/* Profile Name info */}
                  <span className="mt-5 text-lg font-medium text-gray-300 group-hover:text-white tracking-wide transition-colors duration-300">
                    {prof.name}
                  </span>
                </button>
              );
            })}

            {/* Manage/Add Profile Interactive node */}
            <button
              id="add_new_profile_button"
              className="group relative flex flex-col items-center bg-transparent border-none cursor-pointer focus:outline-none"
            >
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center transition-all duration-500 bg-neutral-900/40 border border-dashed border-neutral-700 hover:border-neutral-400 group-hover:bg-neutral-900/60 shadow-lg shadow-black/80">
                <UserPlus className="h-8 w-8 text-neutral-500 group-hover:text-neutral-300 group-hover:scale-110 transition-transform duration-300" />
              </div>
              <span className="mt-5 text-lg font-medium text-neutral-500 group-hover:text-neutral-300 tracking-wide transition-colors duration-300">
                Add Profile
              </span>
            </button>
          </div>
        </div>

        {/* Minimal Bottom Spacer */}
        <div id="profiles_footer_info" className="flex flex-col items-center gap-4">
          <div className="h-[1px] w-24 bg-neutral-800/50" />
        </div>
      </div>

      {/* Extreme Hyperspace Warp Speed Overlay */}
      {selectedProfile && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none"
          style={{
            backgroundColor: `rgba(255, 255, 255, ${Math.max(0, (warpProgress - 0.75) * 4)})`
          }}
        >
          <div
            className="flex flex-col items-center gap-3 transition-opacity duration-300"
            style={{ opacity: warpProgress > 0.3 ? 1 : 0 }}
          >
            <p className="text-white text-base font-mono tracking-widest uppercase animate-pulse">
              Engaging Space Warp Drive...
            </p>
            <div className="h-[2px] w-48 bg-neutral-800 rounded-full overflow-hidden relative border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-100 ease-out"
                style={{ width: `${warpProgress * 100}%` }}
              />
            </div>
            <p className="text-rose-500/80 text-[10px] font-mono tracking-widest">
              SHIFTING VIEWPORT CAMERA FOV {Math.floor(50 + warpProgress * 70)}°
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
