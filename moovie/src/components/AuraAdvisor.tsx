import React, { useState } from "react";
import { Recommendation, Movie } from "../types";
import { MessageSquare, Cpu, Sparkles, Send, Loader2, Play, AlertCircle, ArrowRight, User } from "lucide-react";

interface AuraAdvisorProps {
  onRecommendationClick: (movieTitle: string) => void;
  selectedThemeGlow: string;
}

export default function AuraAdvisor({ onRecommendationClick, selectedThemeGlow }: AuraAdvisorProps) {
  const [moodInput, setMoodInput] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState<string>("Sci-Fi");
  const [loading, setLoading] = useState<boolean>(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAIRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moodInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setRecommendations([]);

    try {
      const response = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: moodInput,
          genre: selectedGenre,
          query: moodInput
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error code ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const list = data.recommendations || [];
      setRecommendations(list);
    } catch (err: any) {
      console.error("AI Recommendation client error:", err);
      setErrorMsg(err.message || "Failed to fetch AI Advice. Please check your secrets configurations.");
    } finally {
      setLoading(false);
    }
  };

  const loadPresetMood = (preset: string, genre: string) => {
    setMoodInput(preset);
    setSelectedGenre(genre);
  };

  return (
    <div
      id="aura_advisor_section"
      className="p-6 md:p-8 rounded-2xl bg-black/45 backdrop-blur-2xl border border-white/10 shadow-2xl relative overflow-hidden font-sans"
    >
      {/* Absolute side ambient glow light */}
      <div
        className="absolute -top-[40%] -right-[30%] w-[100px] h-[100px] rounded-full blur-[80px] pointer-events-none transition-colors duration-1000 opacity-60"
        style={{ backgroundColor: selectedThemeGlow }}
      />

      {/* Header Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
        <div>
          <h3 className="text-xl font-medium text-white flex items-center gap-2 tracking-wide leading-tight">
            <Cpu className="h-5 w-5 text-red-500 animate-pulse" /> Aura Advisor AI
          </h3>
          <p className="text-gray-500 font-mono text-[9px] tracking-widest uppercase mt-1">
            Gemini-powered neural movie discovery profile
          </p>
        </div>

        {/* Hot pre-calculated states buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Lost in space", preset: "Vibrant interstellar deep voyage, very dark void spaces", genre: "Sci-Fi" },
            { label: "Cyber Action", preset: "Exciting synthwave city streets hacker escape chase", genre: "Action" },
            { label: "Mindbending Paradox", preset: "Dream dimensions, multiple parallel realities mystery", genre: "Thriller" }
          ].map((item, idx) => (
            <button
              key={idx}
              id={`preset_${idx}`}
              onClick={() => loadPresetMood(item.preset, item.genre)}
              className="px-3 py-1.5 rounded-full border border-white/5 bg-neutral-900/60 hover:bg-neutral-800 text-gray-400 hover:text-white text-[10px] font-medium tracking-wide transition-colors focus:outline-none"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input container row */}
      <form onSubmit={fetchAIRecommendation} className="space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest font-mono text-gray-500 block mb-2">
            Describe your current biological mood or visual desires
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="mood_input_field"
              value={moodInput}
              onChange={(e) => setMoodInput(e.target.value)}
              placeholder="e.g. 'Cozy evening with glowing orange starscapes, silent space, rich audio atmospheres'..."
              className="flex-1 px-4 py-3 rounded-xl bg-neutral-950/80 border border-white/10 hover:border-white/20 focus:border-red-500 text-white text-sm focus:outline-none placeholder-gray-600 transition-all shadow-inner"
            />
            
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white flex items-center justify-center font-medium font-mono text-xs tracking-widest uppercase focus:outline-none shadow-lg shadow-red-600/20 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <span className="flex items-center gap-1">
                  QUERY <Send className="h-3.5 w-3.5 inline" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Genre option checklist */}
        <div className="flex items-center gap-3 py-1">
          <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500">Filter Spectrum:</span>
          <div className="flex gap-2">
            {["Sci-Fi", "Action", "Thriller", "Adventure", "Drama"].map((cat) => (
              <button
                type="button"
                key={cat}
                id={`cat_${cat}`}
                onClick={() => setSelectedGenre(cat)}
                className={`px-2.5 py-0.8 rounded text-[10px] font-mono tracking-widest ${
                  selectedGenre === cat
                    ? "bg-red-950/20 border border-red-500 text-red-400"
                    : "bg-neutral-900 border border-neutral-800 text-gray-500 hover:text-white"
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </form>

      {/* Error state */}
      {errorMsg && (
        <div className="mt-5 p-4 rounded-xl border border-red-500/20 bg-red-950/10 text-red-400 text-xs flex items-start gap-2.5 leading-relaxed">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Neural Link interrupted: </span>{errorMsg}
            <span className="block mt-1 text-[10.5px] text-red-500 font-mono">Ensure process.env.GEMINI_API_KEY compiles on your secrets panel.</span>
          </div>
        </div>
      )}

      {/* Recommendations results list */}
      {recommendations.length > 0 && (
        <div className="mt-8 border-t border-white/5 pt-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-emerald-400 animate-spin" />
            <span className="text-xs font-mono font-medium tracking-widest uppercase text-emerald-400">
              AI Recommendation matches computed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="ai_results_grid">
            {recommendations.map((rec, idx) => (
              <div
                key={idx}
                id={`ai_rec_${idx}`}
                onClick={() => onRecommendationClick(rec.title)}
                className="group p-5 rounded-xl border border-white/5 bg-neutral-950/60 hover:border-white/15 hover:bg-neutral-950 transition-all text-left flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className="text-[9px] font-mono uppercase bg-neutral-900 border border-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                      MATCH #{idx + 1}
                    </span>
                    <span className="text-[9px] font-mono uppercase text-red-400 px-1.5 py-0.5 rounded" style={{ color: rec.auraColor }}>
                      {rec.visualVibe || "ATMOSPHERIC"}
                    </span>
                  </div>
                  
                  <h4 className="text-white font-medium text-base tracking-wide flex items-center justify-between">
                    {rec.title}
                    <ArrowRight className="h-3.5 w-3.5 text-gray-500 group-hover:text-white transition-transform group-hover:translate-x-1" />
                  </h4>
                  
                  <p className="text-gray-400 text-xs leading-relaxed mt-2.5">
                    {rec.reason}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 mt-4 text-[9px] font-mono text-gray-500">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: rec.auraColor }} />
                  TAP TO MATCH POSTER CATALOGUE
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
