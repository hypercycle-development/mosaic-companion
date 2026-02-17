import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import { pipeline } from "@xenova/transformers";

interface VoiceDictationProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export const VoiceDictation: React.FC<VoiceDictationProps> = ({
  onTranscription,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriber = useRef<any>(null);

  // Load Whisper model on component mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsModelLoading(true);
        transcriber.current = await pipeline(
          "automatic-speech-recognition",
          "Xenova/whisper-base.en"
        );
        setIsModelLoading(false);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Error loading Whisper model:", err);
        setError("Error loading model: " + errorMsg);
        setIsModelLoading(false);
      }
    };

    loadModel();
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          setIsProcessing(true);
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          // Convert blob to ArrayBuffer
          const arrayBuffer = await audioBlob.arrayBuffer();
          
          // Transcribe audio
          if (transcriber.current) {
            const result = await transcriber.current(arrayBuffer);
            const transcribedText = result.text || "";
            
            if (transcribedText.trim()) {
              onTranscription(transcribedText.trim());
            }
          }

          setIsProcessing(false);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("Error transcribing audio:", err);
          setError("Error transcribing: " + errorMsg);
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Error accessing microphone:", err);
      setError("Error: " + errorMsg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isLoading = isModelLoading || isProcessing;

  return (
    <div className="relative">
      <button
        onClick={handleMicClick}
        disabled={disabled || isLoading || !transcriber.current}
        className={`
          h-12 px-3 rounded-xl transition-all flex items-center justify-center
          ${
            isRecording
              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/25"
              : disabled || isLoading || !transcriber.current
                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300"
          }
        `}
        title={isRecording ? "Stop recording" : "Start voice dictation"}
      >
        {isLoading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isRecording ? (
          <MicOff size={20} />
        ) : (
          <Mic size={20} />
        )}
      </button>

      {error && (
        <div className="absolute bottom-full right-0 mb-2 bg-red-900 text-red-100 text-xs rounded px-2 py-1 whitespace-nowrap">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-100"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
