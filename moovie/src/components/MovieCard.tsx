import React, { useState, useRef, useEffect } from "react";
import { Movie } from "../types";
import { Play, Plus, Check, Star, Info, MessageSquare, Zap } from "lucide-react";

interface MovieCardProps {
  key?: React.Key;
  movie: Movie;
  onPlay: (movie: Movie) => void;
  onHoverState: (movie: Movie | null) => void;
  isFocused: boolean;
}

export default function MovieCard({ movie, onPlay, onHoverState, isFocused }: MovieCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [inMyList, setInMyList] = useState<boolean>(false);

  // Apply parallax calculations
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width; // 0 to 1
    const y = (e.clientY - rect.top) / rect.height; // 0 to 1

    // Normalize values relative to center (-0.5 to 0.5)
    const normalizedX = x - 0.5;
    const normalizedY = y - 0.5;

    setHoverPosition({ x: normalizedX, y: normalizedY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    onHoverState(movie);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setHoverPosition({ x: 0, y: 0 });
    onHoverState(null);
  };

  return (
    <div
      ref={cardRef}
      id={`movie_card_${movie.id}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onPlay(movie)}
      className={`group relative flex-shrink-0 w-[200px] md:w-[240px] aspect-[2/3] rounded-xl overflow-visible cursor-pointer bg-neutral-900 transition-all duration-500 font-sans z-10`}
      style={{
        // 3D curved cylinder depth calculations via perspective shifts
        transform: isHovered
          ? "perspective(1000px) rotateY(" + (hoverPosition.x * 32) + "deg) rotateX(" + (-hoverPosition.y * 32) + "deg) translate3d(0, -12px, 40px) scale(1.08)"
          : "perspective(1000px) rotateY(0deg) rotateX(0deg) translate3d(0, 0, 0) scale(1.0)",
        boxShadow: isHovered
          ? `0 25px 50px -12px ${movie.auraColor}90, 0 10px 20px -5px rgba(0,0,0,0.8)`
          : "0 10px 20px -5px rgba(0,0,0,0.6)",
        transition: isHovered ? "box-shadow 0.2s ease" : "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        transformStyle: "preserve-3d"
      }}
    >
      
      {/* Dynamic Aura background bleed glows (Global Illuminance simulation) */}
      <div
        className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500 scale-102 z-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${movie.auraColor}60 0%, transparent 80%)`,
        }}
      />

      {/* Main Glass wrapper */}
      <div className="absolute inset-0 rounded-xl bg-black overflow-hidden border border-white/5 group-hover:border-white/15 z-10 shadow-inner">
        
        {/* Poster Image Backdrop Layer */}
        <img
          src={movie.posterPath}
          alt={movie.title}
          className="w-full h-full object-cover select-none pointer-events-none transition-all duration-[1200ms] ease-out group-hover:scale-110"
          style={{
            transform: isHovered ? "translate3d(" + (-hoverPosition.x * 12) + "px, " + (-hoverPosition.y * 12) + "px, 0px) scale(1.12)" : "translate3d(0,0,0) scale(1)",
            filter: isHovered ? "brightness(0.9) contrast(1.1)" : "brightness(0.85)"
          }}
        />

        {/* Shimmer sweeping beam (Holographic glint) */}
        <div
          className="absolute inset-0 z-[12] bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none transition-all duration-700 ease-out translate-x-[-100%] group-hover:translate-x-[100%]"
        />

        {/* Vignette bottom-glow overlay */}
        <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black via-black/30 to-transparent z-[11]" />

        {/* Dynamic EXTRUDED Hero layer (Holographic displacement parallax) */}
        <div
          className="absolute inset-0 z-[12] pointer-events-none transition-transform duration-500 ease-out flex flex-col justify-end p-5 text-left"
          style={{
            transform: isHovered ? "translate3d(" + (hoverPosition.x * 20) + "px, " + (hoverPosition.y * 20) + "px, 20px)" : "translate3d(0,0,0)",
          }}
        >
          {/* Movie Category Tag */}
          <span className="text-[9px] font-mono tracking-widest text-[#E50914] uppercase mb-1.5 flex items-center gap-1 font-semibold">
            <Zap className="h-3 w-3 inline-block text-red-500" /> {movie.genre} MATRIX
          </span>

          {/* Title with depth-shifting shadows */}
          <h3 className="text-white font-semibold text-lg tracking-wide leading-tight group-hover:scale-103 transition-transform duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            {movie.title}
          </h3>

          {/* Extruded bottom meta row on hover */}
          <div className="h-0 group-hover:h-12 group-hover:opacity-100 opacity-0 overflow-hidden transition-all duration-500 flex items-center justify-between mt-3 z-[13]">
            {/* Play Button widget */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay(movie);
                }}
                className="h-8 w-8 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center font-bold focus:outline-none focus:ring-0 shadow-md shadow-red-600/30 cursor-pointer"
                title="Play movie"
              >
                <Play className="h-3.5 w-3.5 ml-0.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInMyList(!inMyList);
                }}
                className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center focus:outline-none shadow-md"
                title="Add to watchlist"
              >
                {inMyList ? <Check className="h-3.5 w-3.5 text-red-500" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Movie ratings */}
            <div className="flex items-center gap-1 font-mono text-[10px] text-gray-300 bg-black/60 px-2 py-0.5 rounded border border-white/5">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <span>{movie.rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Digital Vaudeville Metadata details */}
          <div className="flex items-center gap-1.5 mt-2.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <span className="text-[8px] font-mono px-1.5 py-0.1 bg-white/5 border border-white/10 rounded text-neutral-300 tracking-wider">
              {movie.resolution || "4K"}
            </span>
            <span className="text-[8px] font-mono text-gray-400 whitespace-nowrap">
              {movie.duration || "2h 10m"}
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}
