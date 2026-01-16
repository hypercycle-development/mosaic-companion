import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { pipeline } from "@xenova/transformers";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscription,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [audioLevel, setAudioLevel] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriber = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load available audio devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        setAudioDevices(audioInputs);
        if (audioInputs.length > 0 && !selectedDevice) {
          setSelectedDevice(audioInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Error getting audio devices:", err);
      }
    };

    getDevices();
    navigator.mediaDevices.addEventListener('devicechange', getDevices);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    };
  }, []);

  // Load Whisper model on component mount - using base model for better accuracy
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsModelLoading(true);
        // Using Whisper base for better accuracy (still reasonable size)
        transcriber.current = await pipeline(
          "automatic-speech-recognition",
          "Xenova/whisper-base.en"
        );
        setIsModelLoading(false);
      } catch (err) {
        console.error("Error loading Whisper model:", err);
        setError("Error loading Whisper model: " + err);
        setIsModelLoading(false);
      }
    };

    loadModel();
  }, []);

  // Cleanup audio context on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const visualizeAudio = (stream: MediaStream) => {
    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    
    analyserRef.current.fftSize = 256;
    source.connect(analyserRef.current);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      setAudioLevel(average / 255); // Normalize to 0-1
      
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  };

  const startRecording = async () => {
    try {
      setError(null);
      const constraints = {
        audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Start audio visualization
      visualizeAudio(stream);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await transcribeAudio(audioBlob);
        
        // Stop the stream and audio visualization
        stream.getTracks().forEach((track) => track.stop());
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        setAudioLevel(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setError(null);

      // Convert blob to format that Whisper can process
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Transcribe using local Whisper model
      const result = await transcriber.current(audioUrl, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'english',
        task: 'transcribe'
      });

      if (result && result.text) {
        onTranscription(result.text);
      }

      URL.revokeObjectURL(audioUrl);
      setIsProcessing(false);
    } catch (err) {
      console.error("Error transcribing audio:", err);
      setError("Error transcribing audio");
      setIsProcessing(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isButtonDisabled = disabled || isProcessing || isModelLoading;
  const isActive = isRecording || isProcessing;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Microphone selector inline with controls */}
        {audioDevices.length > 1 && !isRecording && (
          <div className="relative">
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="h-7 pl-2 pr-6 bg-gray-900/70 border border-gray-700/60 rounded text-gray-200 text-[10px] min-w-[6rem] max-w-[3rem] truncate focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
            >
              {audioDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2" />
          </div>
        )}

        {/* Record button */}
        <button
          onClick={handleToggleRecording}
          disabled={isButtonDisabled}
          className={`
            p-4 rounded-xl transition-all flex items-center justify-center
            ${
              isActive
                ? "bg-red-600 hover:bg-red-500 text-white hover:scale-105 shadow-lg shadow-red-500/25"
                : "bg-gray-800 text-gray-500 hover:text-gray-300 hover:bg-gray-700"
            }
            ${isButtonDisabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
          title={
            isModelLoading
              ? "Loading model..."
              : isProcessing
              ? "Processing..."
              : isRecording
              ? "Stop recording"
              : "Record voice"
          }
        >
          {isModelLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : isProcessing ? (
            <Loader2 size={20} className="animate-spin" />
          ) : isRecording ? (
            <MicOff size={20} />
          ) : (
            <Mic size={20} />
          )}
        </button>

        {/* Audio waveform visualization */}
        {isRecording && (
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="bg-red-500 rounded-full transition-all duration-100"
                style={{
                  width: '3px',
                  height: `${Math.max(4, audioLevel * 40 * (1 + Math.sin(Date.now() / 100 + i) * 0.5))}px`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-1 text-red-400 text-xs">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
