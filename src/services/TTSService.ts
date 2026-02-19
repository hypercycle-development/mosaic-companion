/**
 * Thin singleton wrapper around the Web Speech API's SpeechSynthesis interface.
 * Handles async voice loading, user-configured playback settings, and clean
 * cancellation of in-flight utterances.
 */
class TTSService {
    private static instance: TTSService;
    private synth: SpeechSynthesis;
    // Preferred voice resolved during initialization; may be null until then.
    private voice: SpeechSynthesisVoice | null = null;
    private isInitialized: boolean = false;

    private constructor() {
        this.synth = window.speechSynthesis;
    }

    /** Returns the shared singleton, creating it on first call. */
    static getInstance(): TTSService {
        if (!TTSService.instance) {
            TTSService.instance = new TTSService();
        }
        return TTSService.instance;
    }

    /**
     * Resolves the best available voice and marks the service as ready.
     * Chromium exposes voices asynchronously via `onvoiceschanged`, so we
     * listen for that event and fall back to a 1 s timeout as a safety net.
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        return new Promise((resolve, reject) => {
            const loadVoices = () => {
                const voices = this.synth.getVoices();
                if (voices.length > 0) {
                    // Prefer a natural-sounding English voice, then any English, then first available.
                    this.voice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Natural')) 
                        || voices.find(v => v.lang.startsWith('en'))
                        || voices[0];
                    this.isInitialized = true;
                    console.log('TTS initialized with voice:', this.voice?.name);
                    resolve();
                } else {
                    reject(new Error('No voices available'));
                }
            };

            // Voices are already loaded (common on subsequent calls).
            if (this.synth.getVoices().length > 0) {
                loadVoices();
            } else {
                // Chromium fires this event once the voice list is populated.
                this.synth.onvoiceschanged = loadVoices;
                // Fallback: some environments never fire onvoiceschanged.
                setTimeout(() => {
                    if (!this.isInitialized) {
                        const voices = this.synth.getVoices();
                        if (voices.length > 0) {
                            this.voice = voices[0];
                            this.isInitialized = true;
                            resolve();
                        }
                    }
                }, 1000);
            }
        });
    }

    /**
     * Speaks `text` using the current voice and user-configured rate/pitch/volume.
     * Cancels any utterance already in progress before starting a new one.
     * Resolves when the utterance finishes; rejects on a speech error.
     */
    async speak(text: string, onStart?: () => void): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            // Stop any speech currently playing before queuing a new one.
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            
            if (this.voice) {
                utterance.voice = this.voice;
            }
            
            // Apply live settings so changes in the UI take effect immediately.
            const settings = this.getSettings();
            utterance.rate = settings.rate;
            utterance.pitch = settings.pitch;
            utterance.volume = settings.volume;

            utterance.onstart = () => {
                console.log('TTS started');
                if (onStart) onStart();
            };

            utterance.onend = () => {
                console.log('TTS finished');
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('TTS error:', event);
                reject(new Error(event.error));
            };

            this.synth.speak(utterance);
        });
    }

    /**
     * Reads playback settings persisted by the Narrator settings UI.
     * Returns safe defaults when nothing is stored or the value is malformed.
     */
    private getSettings(): { rate: number; pitch: number; volume: number } {
        try {
            const stored = localStorage.getItem('narrator_settings');
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error reading narrator settings:', e);
        }
        return { rate: 1.0, pitch: 1.0, volume: 1.0 };
    }

    /** Switches to the voice whose name matches `voiceName`, if it exists. */
    setVoice(voiceName: string): void {
        const voices = this.synth.getVoices();
        const voice = voices.find(v => v.name === voiceName);
        if (voice) {
            this.voice = voice;
        }
    }

    /** Returns all voices currently available from the browser. */
    getAvailableVoices(): SpeechSynthesisVoice[] {
        return this.synth.getVoices();
    }

    /** Immediately stops any speech in progress. */
    stop(): void {
        this.synth.cancel();
    }

    // No-op: Web Speech API has no in-memory cache to clear.
    clearCache(): void {}

    /** Returns true once voices have been resolved and the service is ready. */
    isModelLoaded(): boolean {
        return this.isInitialized;
    }

    /** Returns true while an utterance is actively being spoken. */
    isSpeaking(): boolean {
        return this.synth.speaking;
    }
}

export default TTSService.getInstance();

