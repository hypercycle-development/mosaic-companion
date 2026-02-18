import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { pipeline } from "@xenova/transformers";

const MIC_DEVICE_STORAGE_KEY = "voice_input_device_id";

interface VoiceDictationProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  resetKey?: string;
}

export const VoiceDictation: React.FC<VoiceDictationProps> = ({
  onTranscription,
  disabled = false,
  resetKey,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriber = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processingTokenRef = useRef<string | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      processingTokenRef.current = null;
      setIsRecording(false);
      setIsProcessing(false);
    };
  }, []);

  const stopAll = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    cancelProcessing();
    setIsRecording(false);
  };

  useEffect(() => {
    if (disabled) {
      stopAll();
    }
  }, [disabled]);

  useEffect(() => {
    stopAll();
  }, [resetKey]);

  useEffect(() => {
    const stored = localStorage.getItem(MIC_DEVICE_STORAGE_KEY) || "";
    setSelectedDeviceId(stored);

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === MIC_DEVICE_STORAGE_KEY) {
        setSelectedDeviceId(event.newValue || "");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      if (isProcessing) {
        return;
      }
      const storedDeviceId = localStorage.getItem(MIC_DEVICE_STORAGE_KEY) || selectedDeviceId;
      const constraints = storedDeviceId
        ? { audio: { deviceId: { exact: storedDeviceId } } }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          setIsProcessing(true);
          const processingToken = `proc-${Date.now()}`;
          processingTokenRef.current = processingToken;
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });

          if (transcriber.current) {
            const audioUrl = URL.createObjectURL(audioBlob);
            audioUrlRef.current = audioUrl;
            const result = await transcriber.current(audioUrl, {
              chunk_length_s: 30,
              stride_length_s: 5,
              task: "transcribe",
            });
            if (audioUrlRef.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              audioUrlRef.current = null;
            }

            if (processingTokenRef.current === processingToken) {
              const transcribedText = result?.text || "";
              if (transcribedText.trim()) {
                onTranscription(transcribedText.trim());
              }
            }
          } else {
            setError("Speech model not ready yet.");
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("Error transcribing audio:", err);
          setError("Error transcribing: " + errorMsg);
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          if (processingTokenRef.current) {
            processingTokenRef.current = null;
          }
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

  const cancelProcessing = () => {
    processingTokenRef.current = null;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsProcessing(false);
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else if (isProcessing) {
      cancelProcessing();
    } else {
      startRecording();
    }
  };

  const isLoading = isModelLoading || isProcessing;

  return (
    <div className="relative">
      <button
        onClick={handleMicClick}
        disabled={disabled || isModelLoading || (!transcriber.current && !isProcessing)}
        className={`
          h-12 px-3 rounded-xl transition-all flex items-center justify-center
          ${
            isRecording
              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/25"
              : isProcessing
                ? "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                : disabled || isModelLoading || !transcriber.current
                  ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300"
          }
        `}
        title={
          isProcessing
            ? "Cancel dictation"
            : isRecording
            ? "Stop recording"
            : "Start voice dictation"
        }
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
