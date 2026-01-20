import React, { useState, useEffect } from "react";
import { Play, Command } from "lucide-react";

interface LandingPageProps {
  onNavigate: (url: string) => void;
  customGreeting?: string;
  onOpenCommandPalette?: () => void;
}

const S_WORDS = [
  { word: "SECURE", color: "text-green-400" },
  { word: "SOVEREIGN", color: "text-amber-400" },
  { word: "SEXY", color: "text-pink-500" },
  { word: "SAFE", color: "text-blue-400" },
  { word: "SEALED", color: "text-gray-400" },
  { word: "SHIELDED", color: "text-indigo-400" },
  { word: "SUPREME", color: "text-purple-400" },
  { word: "SPLENDID", color: "text-yellow-300" },
  { word: "SECURED", color: "text-emerald-400" },
  { word: "SUZERAIN", color: "text-red-500" },
  { word: "SUPER", color: "text-cyan-400" },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  customGreeting,
  onOpenCommandPalette,
}) => {
  const [sWordIndex, setSWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSWordIndex((prev) => (prev + 1) % S_WORDS.length);
    }, 1500); // Change word every 1.5 seconds
    return () => clearInterval(interval);
  }, []);

  const currentSWord = S_WORDS[sWordIndex];

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full bg-gray-950 text-white overflow-hidden select-none">
      {/* Background Grid Effect */}
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--primary) 20%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--primary) 20%, transparent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute inset-0 z-0 themed-gradient-overlay pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-5xl w-full px-4">
        {/* Logo & Branding */}
        <div className="text-center space-y-6">
          <div className="inline-block relative group">
            <h1 className="text-8xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text themed-title-gradient glow-text-soft">
              MOSAIC
            </h1>
            {/* Glow effect behind text */}
            <div className="absolute -inset-4 bg-indigo-500/10 blur-3xl rounded-full -z-10 group-hover:bg-indigo-500/20 transition-all duration-1000" />
          </div>

          {/* Acronym Animation */}
          <div className="text-2xl md:text-4xl font-light tracking-wide flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 text-gray-400 font-sans">
            <span className="opacity-80">My Own</span>

            {/* Animated Word Container */}
            <div className="h-12 flex items-center justify-center min-w-[220px] bg-gray-900/50 rounded-lg border border-gray-800 backdrop-blur-sm px-4 shadow-inner">
              <span
                key={currentSWord.word}
                className={`font-bold tracking-widest ${currentSWord.color} animate-in slide-in-from-bottom-2 fade-in duration-300 drop-shadow-md`}
              >
                {currentSWord.word}
              </span>
            </div>

            <span className="opacity-80">AI Companion</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-12 flex items-center gap-4 justify-center">
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="group relative px-6 py-3 bg-gray-900/50 border border-gray-800 rounded-full hover:bg-gray-800 transition-all duration-300"
              title="Open Command Palette (Cmd+K)"
            >
              <div className="flex items-center gap-2">
                <Command
                  size={16}
                  className="text-gray-400 group-hover:text-indigo-400"
                />
                <span className="text-xs font-mono text-gray-500 group-hover:text-gray-300">
                  ⌘K
                </span>
              </div>
            </button>
          )}
          <button
            onClick={() => onNavigate("demo://start")}
            className="group relative px-8 py-3 bg-indigo-600/10 border border-indigo-500/50 rounded-full hover:bg-indigo-600/20 transition-all duration-300 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-500 rounded-full group-hover:scale-110 transition-transform glow-primary">
                <Play size={16} fill="white" className="text-white" />
              </div>
              <span className="text-sm font-medium tracking-widest text-indigo-300 group-hover:text-white transition-colors">
                WATCH DEMO
              </span>
            </div>
          </button>
        </div>

        {/* Status Indicators */}
        <div className="mt-16 flex gap-8 opacity-60">
          <div className="flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500 glow-success animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-gray-500">
              System Online
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-indigo-500 glow-primary" />
            <span className="text-[10px] uppercase tracking-widest text-gray-500">
              Neural Link Active
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-cyan-500 glow-accent" />
            <span className="text-[10px] uppercase tracking-widest text-gray-500">
              Privacy Shielded
            </span>
          </div>
        </div>
      </div>

      {/* Decorative Corners for Techy Feel */}
      <div className="absolute top-8 left-8 w-32 h-32 border-t border-l border-gray-800 rounded-tl-3xl opacity-50" />
      <div className="absolute top-8 right-8 w-32 h-32 border-t border-r border-gray-800 rounded-tr-3xl opacity-50" />
      <div className="absolute bottom-8 left-8 w-32 h-32 border-b border-l border-gray-800 rounded-bl-3xl opacity-50" />
      <div className="absolute bottom-8 right-8 w-32 h-32 border-b border-r border-gray-800 rounded-br-3xl opacity-50" />
    </div>
  );
};
