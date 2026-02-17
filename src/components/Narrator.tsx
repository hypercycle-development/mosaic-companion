import React, { useEffect, useState } from 'react';
import TTSService from '../services/TTSService';

const Narrator: React.FC<{ text: string; autoPlay?: boolean }> = ({ text, autoPlay = false }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [isEnabled, setIsEnabled] = useState(true);

    // Load settings on mount
    useEffect(() => {
        const loadSettings = () => {
            try {
                const stored = localStorage.getItem('narrator_settings');
                if (stored) {
                    const settings = JSON.parse(stored);
                    setIsEnabled(settings.enabled !== false);
                    
                    // Apply voice settings if available
                    if (settings.voice) {
                        TTSService.setVoice(settings.voice);
                    }
                }
            } catch (e) {
                console.error('Error loading narrator settings:', e);
            }
        };
        loadSettings();
    }, []);

    useEffect(() => {
        // Initialize TTS model on component mount
        const initModel = async () => {
            if (!TTSService.isModelLoaded()) {
                setIsLoading(true);
                try {
                    await TTSService.initialize();
                    setIsModelLoaded(true);
                } catch (error) {
                    console.error('Failed to load TTS model:', error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setIsModelLoaded(true);
            }
        };

        initModel();
    }, []);

    const speak = async () => {
        if (!text || isSpeaking || isThinking || !isEnabled) return;

        setIsThinking(true);
        try {
            await TTSService.speak(text, () => {
                // Called when audio starts playing
                setIsThinking(false);
                setIsSpeaking(true);
            });
            // Audio finished playing
            setIsSpeaking(false);
        } catch (error) {
            console.error('Error speaking:', error);
            setIsThinking(false);
        }
    };

    const stop = () => {
        TTSService.stop();
        setIsSpeaking(false);
        setIsThinking(false);
    };

    useEffect(() => {
        if (autoPlay && text && isModelLoaded && !isSpeaking && !isThinking && isEnabled) {
            speak();
        }
    }, [autoPlay, text, isModelLoaded, isEnabled]);

    if (!isEnabled) {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            {isLoading && (
                <span className="text-xs text-gray-400">Loading...</span>
            )}
            {isThinking && (
                <button 
                    onClick={stop}
                    className="p-2 hover:bg-gray-800 rounded transition-colors"
                    title="Generating speech..."
                >
                    <span className="inline-block animate-spin">⏳</span>
                </button>
            )}
            {!isSpeaking && !isThinking ? (
                <button 
                    onClick={speak}
                    disabled={isLoading || !isModelLoaded}
                    className="p-2 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Speak"
                >
                    🔊
                </button>
            ) : isSpeaking ? (
                <button 
                    onClick={stop}
                    className="p-2 hover:bg-gray-800 rounded transition-colors"
                    title="Stop speaking"
                >
                    ⏹️
                </button>
            ) : null}
        </div>
    );
};

export default Narrator;