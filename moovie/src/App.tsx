import React, { useState, useEffect, useRef } from "react";
import { Movie, UserProfile, PlayerSettings, ThemePalette } from "./types";
import { DEFAULT_MOVIES } from "./data/defaultMovies";
import { ColorThiefLogic } from "./utils/colorThief";
import { usePerspectiveScroller } from "./hooks/usePerspectiveScroller";
import Main3DScene from "./components/Main3DScene";
import ProfileWarpView from "./components/ProfileWarpView";
import MovieCard from "./components/MovieCard";
import QuantumPlayer from "./components/QuantumPlayer";
import TactileSettingsDashboard from "./components/TactileSettingsDashboard";
import AuraAdvisor from "./components/AuraAdvisor";
import {
  Sparkles, Search, Sliders, LogOut, RefreshCw, Star, Info, Play, Plus, Clock, HelpCircle, Film, Waves, Globe, Compass, Monitor, Activity, Radio
} from "lucide-react";

export default function App() {
  // Profiles selection states
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<"home" | "player">("home");
  const [activeMovie, setActiveMovie] = useState<Movie | null>(DEFAULT_MOVIES[0]);
  
  // Dynamic Movies catalog (loaded via TMDB)
  const [movies, setMovies] = useState<Movie[]>(DEFAULT_MOVIES);
  const [activeCategory, setActiveCategory] = useState<string>("All Matrix");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingTMDB, setIsLoadingTMDB] = useState<boolean>(false);
  
  // Dashboard drawer states
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemePalette>("crimson");

  // Keyboard navigation & search trackers
  const [searchFocused, setSearchFocused] = useState<boolean>(false);

  // Mouse coords to feed WebGL PointLights parallax
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  // Custom scroller hook: Maps mouse scrolls momentum to camera Z space depth coordinates
  const { zPosition, resetScroller } = usePerspectiveScroller(10, 5, 20);

  // Global Player Settings
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({
    resolutionMultiplier: "1080p",
    audioPhase: "stereo",
    subtitleStyle: "glow",
    activeSubtitleText: "",
    bitrateDiagnosticEnabled: true
  });

  // Track coordinates for global illuminance shifts
  const [ambientColors, setAmbientColors] = useState<string[]>(["#E50914", "#A855F7", "#1E1B4B"]);

  // Detect and update dominant colors dynamically when movie is hovered or active
  useEffect(() => {
    if (activeMovie) {
      const shades = ColorThiefLogic(activeMovie.title, activeMovie.auraColor);
      setAmbientColors(shades);
    }
  }, [activeMovie]);

  // Hook mouse parallax listener
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // Normal coordinates [-1, 1]
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setMouse({ x, y });
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  // Fetch real movies dynamically from the TMDB API using the provided API key
  useEffect(() => {
    const fetchTMDBDiscovery = async () => {
      setIsLoadingTMDB(true);
      try {
        const tmdbApiKey = "dfa4c2c7c1de1005adee824dc5593672";
        
        // 1. Fetch Trending movies
        const trendingRes = await fetch(
          `https://api.themoviedb.org/3/trending/movie/week?api_key=${tmdbApiKey}`
        );
        
        if (!trendingRes.ok) {
          throw new Error("Unable to reach TMDB API services.");
        }
        
        const trendingData = await trendingRes.json();
        const rawResults = trendingData.results || [];
        
        // 2. Format results to comply with Movie interfaces models
        const mappedMovies: Movie[] = rawResults.slice(0, 15).map((m: any, idx: number) => {
          // Associate custom glowing Aura profiles based on movie genres indices
          const id = String(m.id);
          const title = m.title || "Cinema Spec";
          const overview = m.overview || "No synopses logged.";
          const poster = m.poster_path 
            ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
            : "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=500&auto=format&fit=crop&q=80";
          const backdrop = m.backdrop_path 
            ? `https://image.tmdb.org/t/p/original${m.backdrop_path}`
            : "https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?w=1600&auto=format&fit=crop&q=80";

          // Dynamic aura coloring based on genre list map
          let computedColor = "#FF4D57"; // red
          let genreName = "Drama";
          
          if (m.genre_ids && m.genre_ids.length > 0) {
            const primaryG = m.genre_ids[0];
            if ([28, 12].includes(primaryG)) {
              computedColor = "#06B6D4"; // cyan action/adventure
              genreName = "Action";
            } else if ([878].includes(primaryG)) {
              computedColor = "#A855F7"; // violet sci-fi
              genreName = "Sci-Fi";
            } else if ([53, 9648].includes(primaryG)) {
              computedColor = "#EA580C"; // rust orange thriller
              genreName = "Thriller";
            } else if ([27].includes(primaryG)) {
              computedColor = "#10B981"; // green horror/matrix
              genreName = "Horror";
            }
          }

          // Resolution random mock details
          const resOptions: ("4K UHD" | "1080p HDR" | "HDR10" | "8K IMAX")[] = ["4K UHD", "1080p HDR", "8K IMAX"];
          const resolution = resOptions[idx % resOptions.length];

          return {
            id,
            title,
            overview,
            posterPath: poster,
            backdropPath: backdrop,
            rating: m.vote_average || 7.5,
            releaseDate: m.release_date || "2024",
            duration: `${Math.floor(Math.random() * 50) + 100}m`,
            resolution,
            audioCodec: "Dolby Atmos Spatial",
            genre: genreName,
            auraColor: computedColor,
            visualVibe: "Cinematic Hologram Spec"
          };
        });

        // 3. Merge with default baseline catalog preserving duplicates
        const union = [...mappedMovies, ...DEFAULT_MOVIES];
        const uniqueMovies = union.filter(
          (movie, index, self) => self.findIndex((m) => m.id === movie.id) === index
        );

        setMovies(uniqueMovies);
        if (uniqueMovies.length > 0) {
          setActiveMovie(uniqueMovies[0]);
        }
      } catch (err) {
        console.error("Failed to load TMDB, keeping defaults local dataset:", err);
      } finally {
        setIsLoadingTMDB(false);
      }
    };

    fetchTMDBDiscovery();
  }, []);

  // Sync palette presets to background lights
  const handleThemeSelect = (theme: ThemePalette) => {
    setSelectedTheme(theme);
    let themeBaseColor = "#E50914"; // red
    if (theme === "purple") themeBaseColor = "#A855F7";
    if (theme === "midnight") themeBaseColor = "#3B82F6";
    if (theme === "emerald") themeBaseColor = "#10B981";

    if (activeMovie) {
      const shades = ColorThiefLogic(activeMovie.title, themeBaseColor);
      setAmbientColors(shades);
    }
  };

  // Profile activation routing helper
  const handleProfileActivation = (user: UserProfile) => {
    setActiveProfile(user);
    resetScroller(10); // reset space coordinate on login
  };

  // Filter lists based on category button clicked or searches queries
  const processedMovies = movies.filter((m) => {
    const matchesSearch = searchQuery 
      ? m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.overview.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    
    const matchesCategory = activeCategory === "All Matrix" 
      ? true 
      : m.genre.toLowerCase() === activeCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  // Handle smart recommendation clicks
  const handleSmartAIRecommendationSelect = (movieTitle: string) => {
    setSearchQuery(movieTitle);
    setActiveCategory("All Matrix");
    
    // Look for best first match in list
    const bestMatchIndex = movies.findIndex(m => m.title.toLowerCase().includes(movieTitle.toLowerCase()));
    if (bestMatchIndex !== -1) {
      setActiveMovie(movies[bestMatchIndex]);
      
      // Auto-scroll screen down to cards row focus
      const rowElement = document.getElementById("movie_catalog_grid");
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // Log outs routing
  const handleLogout = () => {
    setActiveProfile(null);
    setSearchQuery("");
  };

  // Render entry holographic warp portal if profile is empty
  if (!activeProfile) {
    return <ProfileWarpView onProfileSelect={handleProfileActivation} />;
  }

  // Active video streaming session view
  if (currentView === "player" && activeMovie) {
    return (
      <QuantumPlayer
        movie={activeMovie}
        settings={playerSettings}
        onBackToHome={() => setCurrentView("home")}
      />
    );
  }

  return (
    <div id="homesafe_dashboard" className="cinema-entrance relative w-full min-h-screen bg-[#030303] text-white selection:bg-red-600/30 font-sans overflow-hidden">
      
      {/* Absolute Dynamic WebGL Three.js point-light and nebulae stars backdrop */}
      <Main3DScene
        colors={ambientColors}
        mouse={mouse}
        activeZ={zPosition}
        selectedPalette={selectedTheme}
      />

      {/* Glossy top perspective mesh overlay */}
      <div className="absolute inset-x-0 top-0 h-[220px] bg-gradient-to-b from-[#030303]/90 via-[#030303]/40 to-transparent pointer-events-none z-[5]" />

      {/* Persistent floating navigation capsule */}
      <header className="cinema-stagger-1 fixed top-6 inset-x-6 z-30 flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl max-w-7xl mx-auto shadow-2xl transition-all duration-300">
        
        {/* Brand visual pairing */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold font-display tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-rose-400">
            MOOVIE <span className="font-mono text-[9px] text-red-500/80 px-1 border border-red-500/20 rounded font-semibold bg-red-950/20">3D</span>
          </span>
        </div>

        {/* Search bar & Category dropdowns */}
        <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-8 relative">
          <div className="relative w-full flex items-center bg-black/45 hover:bg-black/75 border border-white/5 hover:border-white/15 focus-within:border-red-500 rounded-xl transition-all">
            <Search className="h-4.5 w-4.5 text-neutral-500 ml-4.5 flex-shrink-0" />
            <input
              type="text"
              id="global_search_input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search movie title energy, characters..."
              className="w-full bg-transparent px-3 py-2.5 text-sm outline-none border-none focus:ring-0 placeholder-neutral-600 font-mono text-xs text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-xs font-mono text-gray-500 hover:text-white mr-4 focus:outline-none"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* User context information details & Tactile Controls sidebar trigger */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            id="open_tactile_sidebar_btn"
            className="p-2.5 rounded-xl border border-white/5 hover:border-white/15 bg-white/5 text-gray-300 hover:text-white transition-all flex items-center gap-1.5 focus:outline-none"
            title="System controls panel"
          >
            <Sliders className="h-4 w-4 text-red-500" />
            <span className="hidden lg:inline text-xs font-mono tracking-widest uppercase">Tactile Settings</span>
          </button>

          {/* Active profile badge container */}
          <div className="flex items-center gap-3 pl-3 border-l border-white/10">
            <div className="flex flex-col items-end text-right justify-center">
              <span className="text-xs font-medium text-white leading-tight">{activeProfile.name}</span>
              <span className="text-[9px] text-gray-500 font-mono tracking-wider uppercase">Active Space</span>
            </div>
            
            {/* Clickable Avatar Logout orb */}
            <button
              onClick={handleLogout}
              id="profile_logout_badge_btn"
              className="relative h-10 w-10 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center hover:scale-105 transition-all text-sm font-semibold select-none group focus:outline-none"
              title="Return to profile selection warp portals"
            >
              <div
                className="absolute inset-0 rounded-full animate-pulse opacity-40 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `radial-gradient(circle, ${activeProfile.glowColor}90 0%, transparent 80%)`
                }}
              />
              <div className={`absolute inset-0.5 rounded-full bg-gradient-to-tr ${activeProfile.avatarColor} p-[1px]`}>
                <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center">
                  <span className="text-white relative z-10">{activeProfile.name.charAt(0)}</span>
                </div>
              </div>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 transition-colors focus:outline-none"
              title="Logout Profile"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Hero showcasing flagship movie */}
      {activeMovie && (
        <section className="relative w-full min-h-[92vh] pt-32 flex flex-col justify-end px-6 md:px-16 pb-16 z-10 max-w-7xl mx-auto">
          
          {/* Subtle horizontal rule separator */}
          <div className="absolute inset-x-0 bottom-0 h-[220px] bg-gradient-to-t from-[#030303] via-[#030303]/60 to-transparent pointer-events-none z-10" />

          {/* Core metadata text labels columns */}
          <div className="cinema-stagger-2 max-w-2xl relative z-20 space-y-5 text-left mb-12">
            <div className="flex flex-wrap items-center gap-2 flex-row">
              <span className="flex items-center gap-1 px-3 py-1 bg-red-950/20 border border-red-500/20 rounded-full text-[10px] font-mono tracking-wider text-red-500 uppercase font-semibold">
                <Sparkles className="h-3 w-3 inline text-red-500 animate-spin" /> {activeMovie.genre} SPECTRA
              </span>
              <span className="font-mono text-[10px] text-gray-400 bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                CALLED: {activeMovie.resolution || "4K UHD"}
              </span>
              <span className="font-mono text-[10px] text-gray-400 bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                {activeMovie.duration || "2h 40m"}
              </span>
            </div>

            {/* Display Headings */}
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white drop-shadow-2xl">
              {activeMovie.title}
            </h1>

            {/* Cinematic visual overview */}
            <p className="text-gray-400 text-sm md:text-base leading-relaxed font-light drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] font-sans">
              {activeMovie.overview}
            </p>

            {/* Multi-action buttons panel */}
            <div className="flex flex-wrap gap-4 pt-3" id="hero_movie_actions">
              <button
                onClick={() => {
                  setCurrentView("player");
                }}
                className="px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-xs font-mono tracking-widest uppercase flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer focus:outline-none"
              >
                <Play className="h-4 w-4 fill-white text-white" /> STREAM SPECTRA IN 3D
              </button>

              <button
                onClick={() => {
                  // Simulate simple detail popup or open specs
                  setIsSettingsOpen(true);
                }}
                className="px-5 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-medium text-xs font-mono tracking-widest uppercase flex items-center gap-2 focus:outline-none transition-all"
              >
                <Sliders className="h-4 w-4 text-red-500" /> CALIBRATE MATRIX
              </button>
            </div>
          </div>
          
          {/* Mouse Perspective scroll help badge */}
          <div className="absolute right-8 bottom-16 z-20 hidden lg:flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-black/40 backdrop-blur-md">
            <div className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center text-xs text-red-500 font-mono animate-bounce">
              ↕
            </div>
            <div className="text-left">
              <span className="text-[10px] text-gray-500 font-mono uppercase block tracking-wider">Z-Perspective wheel</span>
              <span className="text-xs font-medium text-gray-300">CURVE COORD: <span className="font-mono text-red-400 font-bold">{zPosition.toFixed(1)}m</span></span>
            </div>
          </div>

        </section>
      )}

      {/* Main interactive grid and category list */}
      <main id="movie_catalog_grid" className="cinema-stagger-3 relative z-20 pb-32 max-w-7xl mx-auto px-6 md:px-16 space-y-12 text-left">
        
        {/* Category specs selector */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3" id="categories_tabs">
            {["All Matrix", "Sci-Fi", "Action", "Thriller"].map((genreTag) => (
              <button
                key={genreTag}
                onClick={() => setActiveCategory(genreTag)}
                id={`cat_button_${genreTag.replace(" ", "")}`}
                className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wider transition-all focus:outline-none ${
                  activeCategory === genreTag
                    ? "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-md shadow-red-600/10"
                    : "text-gray-400 hover:text-white bg-white/5 hover:bg-white/10"
                }`}
              >
                {genreTag.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 uppercase tracking-widest self-end md:self-auto">
            <Radio className="h-3.5 w-3.5 text-emerald-500 animate-ping" />
            SHOWING {processedMovies.length} CLUSTER MATCHES {isLoadingTMDB && "• FETCHING NEURAL GRIDS..."}
          </div>
        </div>

        {/* Dynamic Curved Showcase Row (Horizontal sliding perspective) */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Compass className="h-4.5 w-4.5 text-red-500 animate-spin" />
            <h2 className="text-2xl font-light tracking-tight text-white">
              Cinematic Curvature <span className="font-extrabold text-red-500">Showcase</span>
            </h2>
          </div>

          {processedMovies.length > 0 ? (
            <div
              id="curved_slider_row_wrapper"
              className="flex gap-6 overflow-x-auto pb-8 pt-4 px-2 scrollbar-thin snap-x mask-image-horizontal"
              style={{
                perspective: "1200px"
              }}
            >
              {processedMovies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onPlay={(m) => {
                    setActiveMovie(m);
                    setCurrentView("player");
                  }}
                  onHoverState={(m) => {
                    if (m) setActiveMovie(m);
                  }}
                  isFocused={activeMovie?.id === movie.id}
                />
              ))}
            </div>
          ) : (
            <div className="p-16 rounded-2xl border border-dashed border-white/5 bg-black/40 text-center flex flex-col items-center justify-center">
              <Film className="h-10 w-10 text-neutral-600 mb-3" />
              <span className="text-white font-medium text-base">Empty spectrum coordinates</span>
              <span className="text-sm text-gray-500 mt-1 max-w-sm">No items matching '{searchQuery}' found under the '{activeCategory}' filter. Tap CLEAR above to restore all models.</span>
            </div>
          )}
        </div>

        {/* AI Advisor interactive section (Satisfying the Server-Side Gemini capability requirement) */}
        <AuraAdvisor
          onRecommendationClick={handleSmartAIRecommendationSelect}
          selectedThemeGlow={ambientColors[0]}
        />

      </main>

      {/* Frosted settings slide panel */}
      <TactileSettingsDashboard
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={playerSettings}
        onSettingsChange={setPlayerSettings}
        selectedTheme={selectedTheme}
        onThemeSelect={handleThemeSelect}
      />

    </div>
  );
}
