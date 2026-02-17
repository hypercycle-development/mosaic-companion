import React, { useState } from "react";
import { Play, Pause, Volume2, AlertCircle } from "lucide-react";
import TTSService from "../services/TTSService";

interface MessagePlayerProps {
  content: string;
  messageId: string;
}

export const MessagePlayer: React.FC<MessagePlayerProps> = ({
  content,
  messageId,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlayClick = async () => {
    try {
      setError(null);

      if (isPlaying) {
        // Stop playing
        TTSService.stop();
        setIsPlaying(false);
      } else {
        // Start playing
        setIsPlaying(true);
        
        // Extract plain text from markdown (remove markdown syntax)
        const plainText = content
          .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
          .replace(/\*(.+?)\*/g, "$1") // Italic
          .replace(/`(.+?)`/g, "$1") // Code
          .replace(/\[(.+?)\]\(.+?\)/g, "$1") // Links
          .replace(/#+\s/g, ""); // Headers

        await TTSService.speak(plainText, () => {
          setIsPlaying(true);
        });

        setIsPlaying(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error playing message";
      setError(errorMessage);
      console.error("Error playing message:", err);
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePlayClick}
        className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
        title={isPlaying ? "Stop" : "Play"}
      >
        {isPlaying ? (
          <Pause size={14} className="text-indigo-400" />
        ) : (
          <Volume2 size={14} />
        )}
      </button>
      {error && (
        <div className="group relative">
          <AlertCircle size={14} className="text-red-400" />
          <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-red-900 text-red-100 text-xs rounded px-2 py-1 whitespace-nowrap">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};
