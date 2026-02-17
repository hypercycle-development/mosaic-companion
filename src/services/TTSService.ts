// Text-to-Speech Service using Web Speech API (built into Electron/Chromium)
class TTSService {
    private static instance: TTSService;
    private synth: SpeechSynthesis;
    private voice: SpeechSynthesisVoice | null = null;
    private isInitialized: boolean = false;

    private constructor() {
        this.synth = window.speechSynthesis;
    }

    static getInstance(): TTSService {
        if (!TTSService.instance) {
            TTSService.instance = new TTSService();
        }
        return TTSService.instance;
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        return new Promise((resolve, reject) => {
            const loadVoices = () => {
                const voices = this.synth.getVoices();
                if (voices.length > 0) {
                    // Try to find a good English voice
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

            // Voices might load asynchronously
            if (this.synth.getVoices().length > 0) {
                loadVoices();
            } else {
                this.synth.onvoiceschanged = loadVoices;
                // Timeout fallback
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

    async speak(text: string, onStart?: () => void): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            // Cancel any ongoing speech
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            
            if (this.voice) {
                utterance.voice = this.voice;
            }
            
            // Get settings from localStorage or use defaults
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

    setVoice(voiceName: string): void {
        const voices = this.synth.getVoices();
        const voice = voices.find(v => v.name === voiceName);
        if (voice) {
            this.voice = voice;
        }
    }

    getAvailableVoices(): SpeechSynthesisVoice[] {
        return this.synth.getVoices();
    }

    stop(): void {
        this.synth.cancel();
    }

    clearCache(): void {
        // Not needed for Web Speech API
    }

    isModelLoaded(): boolean {
        return this.isInitialized;
    }

    isSpeaking(): boolean {
        return this.synth.speaking;
    }
}

export default TTSService.getInstance();

