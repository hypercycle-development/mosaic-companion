/**
 * Krea Image Generation Panel
 *
 * Standalone UI for generating images with Krea AI directly from Mosaic.
 */

import React, { useState, useCallback } from "react";
import { Wand2, Download, Loader, ImagePlus, Sparkles, CheckCircle } from "lucide-react";

interface KreaPanelProps {
  onGenerate?: (result: any) => void;
  onError?: (error: string) => void;
}

export const KreaPanel: React.FC<KreaPanelProps> = ({ onGenerate, onError }) => {
  const [prompt, setPrompt] = useState("");
  const [creativity, setCreativity] = useState(0.5);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [numImages, setNumImages] = useState(1);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [styleRef, setStyleRef] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    try {
      const result = await (window as any).electronAPI?.krea?.generate?.({
        prompt: prompt.trim(),
        creativity,
        aspectRatio,
        numImages,
        negativePrompt: negativePrompt || undefined,
        styleReference: styleRef || undefined,
      });

      if (result?.success) {
        setLastResult(result);
        onGenerate?.(result);
      } else {
        onError?.(result?.error || "Generation failed");
      }
    } catch (e: any) {
      onError?.(e.message);
    } finally {
      setGenerating(false);
    }
  }, [prompt, creativity, aspectRatio, numImages, negativePrompt, styleRef, generating, onGenerate, onError]);

  const handleDownload = useCallback(async (url: string, idx: number) => {
    try {
      const dest = `/tmp/krea_${Date.now()}_${idx}.png`;
      const result = await (window as any).electronAPI?.krea?.downloadImage?.(url, dest);
      if (result?.success) {
        // Could trigger notification here
      }
    } catch (e) {
      // silent
    }
  }, []);

  return (
    <div className="krea-panel space-y-4" style={{ padding: "16px", maxWidth: "640px" }}>
      <div className="flex items-center gap-2 mb-4">
        <Wand2 size={20} className="text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Krea AI Image Generation</h3>
      </div>

      {/* Prompt */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none resize-none"
        />
      </div>

      {/* Negative Prompt */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Negative Prompt (what to avoid)</label>
        <input
          type="text"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="e.g. blurry, low quality, text"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Creativity: {creativity.toFixed(1)}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={creativity}
            onChange={(e) => setCreativity(parseFloat(e.target.value))}
            className="w-full accent-purple-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Aspect Ratio</label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white"
          >
            <option value="1:1">1:1 Square</option>
            <option value="16:9">16:9 Wide</option>
            <option value="9:16">9:16 Portrait</option>
            <option value="4:3">4:3 Classic</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-gray-400">Images: {numImages}</label>
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={numImages}
            onChange={(e) => setNumImages(parseInt(e.target.value))}
            className="w-full accent-purple-500"
          />
        </div>
      </div>

      {/* Style Reference */}
      <div className="space-y-2">
        <label className="text-sm text-gray-400">Style Reference URL (optional)</label>
        <input
          type="text"
          value={styleRef}
          onChange={(e) => setStyleRef(e.target.value)}
          placeholder="https://example.com/style-reference.jpg"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !prompt.trim()}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:opacity-50 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-colors"
      >
        {generating ? (
          <>
            <Loader size={18} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles size={18} />
            Generate with Krea
          </>
        )}
      </button>

      {/* Results */}
      {lastResult?.images?.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-sm text-green-400">Generated {lastResult.images.length} image(s)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {lastResult.images.map((img: any, idx: number) => (
              <div key={idx} className="relative group bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                <img
                  src={img.url}
                  alt={`Generated ${idx + 1}`}
                  className="w-full h-48 object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
                  >
                    <ImagePlus size={16} className="text-white" />
                  </a>
                  <button
                    onClick={() => handleDownload(img.url, idx)}
                    className="p-2 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
                  >
                    <Download size={16} className="text-white" />
                  </button>
                </div>
                <div className="p-2 text-[10px] text-gray-500 font-mono">
                  {img.width}x{img.height} • seed:{img.seed}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KreaPanel;
