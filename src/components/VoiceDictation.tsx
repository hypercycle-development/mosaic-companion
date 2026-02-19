import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { pipeline } from "@xenova/transformers";

/**
 * localStorage key shared with SettingsPage so the user's preferred microphone
 * device persists across sessions without needing a backend.
 */
const MIC_DEVICE_STORAGE_KEY = "voice_input_device_id";

interface VoiceDictationProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  /**
   * When this value changes (e.g. new chat session, different tab),
   * any in-progress recording or transcription is cancelled immediately
   * so stale results are never inserted into the wrong conversation.
   */
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
  // Holds the loaded Whisper pipeline; null until the model finishes downloading.
  const transcriber = useRef<any>(null);
  // Active media stream kept in a ref so it can be stopped from any code path.
  const streamRef = useRef<MediaStream | null>(null);
  /**
   * Unique token stamped at the start of each transcription job.
   * If the token is cleared (cancel) before Whisper responds, the result
   * is silently dropped — preventing insertion into the wrong session.
   */
  const processingTokenRef = useRef<string | null>(null);
  // Blob URL passed to Whisper; stored so it can be revoked on cancel.
  const audioUrlRef = useRef<string | null>(null);

  // Load the Whisper ASR model once on mount. The model (~145 MB) is fetched
  // from Hugging Face CDN and cached by the browser on subsequent loads.
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

  // Full cleanup on unmount: release the mic, cancel pending work, and revoke
  // any object URLs so the browser can free the associated memory.
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

  /**
   * Unconditionally stops recording and cancels any pending transcription.
   * Called when the parent disables the button or navigates away.
   */
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

  // Stop immediately when the parent disables the control (e.g. message sending).
  useEffect(() => {
    if (disabled) {
      stopAll();
    }
  }, [disabled]);

  // Stop when the context changes (new chat, different tab, different agent).
  useEffect(() => {
    stopAll();
  }, [resetKey]);

  // Sync the preferred device from localStorage on mount and react to changes
  // made in the Settings page (different tab → storage event).
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
    // Prevent starting a new recording while the previous one is still being transcribed.
    if (isProcessing) return;

    try {
      setError(null);

      // Read the device preference directly from storage so it's always current,
      // even if the Settings page changed it in another tab since mount.
      const storedDeviceId = localStorage.getItem(MIC_DEVICE_STORAGE_KEY) || selectedDeviceId;
      const constraints = storedDeviceId
        ? { audio: { deviceId: { exact: storedDeviceId } } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Accumulate chunks as they arrive from the MediaRecorder.
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        try {
          setIsProcessing(true);

          // Stamp a token so we can detect whether this job was cancelled before
          // Whisper finishes; if the token no longer matches, discard the result.
          const processingToken = `proc-${Date.now()}`;
          processingTokenRef.current = processingToken;

          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

          if (transcriber.current) {
            // Whisper accepts a blob URL; we revoke it as soon as it's no longer needed.
            const audioUrl = URL.createObjectURL(audioBlob);
            audioUrlRef.current = audioUrl;

            const result = await transcriber.current(audioUrl, {
              chunk_length_s: 30,
              stride_length_s: 5,
              task: "transcribe",
            });

            // Revoke only if this job still owns the URL (not already cleared by cancel).
            if (audioUrlRef.current === audioUrl) {
              URL.revokeObjectURL(audioUrl);
              audioUrlRef.current = null;
            }

            // Deliver the result only if the transcription wasn't cancelled.
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
          // Always release the mic and reset state, regardless of outcome.
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
          processingTokenRef.current = null;
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

  /** Stops the MediaRecorder; the `onstop` handler will take care of transcription. */
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  /**
   * Aborts an in-flight transcription by invalidating its token and revoking
   * the audio URL. The Whisper call may still complete internally, but its
   * result will be silently dropped.
   */
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
