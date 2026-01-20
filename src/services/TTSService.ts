// Text-to-Speech Service using local models
import { pipeline } from '@xenova/transformers';

class TTSService {
    private static instance: TTSService;
    private ttsModel: any = null;
    private isLoading: boolean = false;
    private audioContext: AudioContext | null = null;
    private audioCache: Map<string, AudioBuffer> = new Map();

    private constructor() {}

    static getInstance(): TTSService {
        if (!TTSService.instance) {
            TTSService.instance = new TTSService();
        }
        return TTSService.instance;
    }

    async initialize(): Promise<void> {
        if (this.ttsModel || this.isLoading) return;

        this.isLoading = true;
        try {
            console.log('Loading TTS model...');
            // Using Speecht5 model for text-to-speech
            this.ttsModel = await pipeline(
                'text-to-speech',
                'Xenova/speecht5_tts',
                { quantized: false }
            );
            
            this.audioContext = new AudioContext();
            console.log('TTS model loaded successfully');
        } catch (error) {
            console.error('Error loading TTS model:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async speak(text: string, onStart?: () => void): Promise<void> {
        if (!this.ttsModel) {
            await this.initialize();
        }

        if (!this.ttsModel || !this.audioContext) {
            throw new Error('TTS model not initialized');
        }

        try {
            let audioBuffer: AudioBuffer;

            // Check if audio is cached
            if (this.audioCache.has(text)) {
                console.log('Using cached audio for:', text.substring(0, 50));
                audioBuffer = this.audioCache.get(text)!;
            } else {
                console.log('Generating new audio for:', text.substring(0, 50));
                // Generate speech
                const output = await this.ttsModel(text, {
                    speaker_embeddings: 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/speaker_embeddings.bin'
                });

                // Convert the output to audio
                const audioData = output.audio;
                const sampleRate = output.sampling_rate;

                // Create audio buffer
                audioBuffer = this.audioContext.createBuffer(
                    1, // mono
                    audioData.length,
                    sampleRate
                );

                // Fill the buffer with audio data
                const channelData = audioBuffer.getChannelData(0);
                channelData.set(audioData);

                // Cache the audio buffer
                this.audioCache.set(text, audioBuffer);
            }

            // Play the audio
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            // Notify when audio starts playing
            if (onStart) {
                onStart();
            }
            
            source.start();

            // Return a promise that resolves when audio finishes playing
            return new Promise((resolve) => {
                source.onended = () => resolve();
            });
        } catch (error) {
            console.error('Error generating speech:', error);
            throw error;
        }
    }

    clearCache(): void {
        this.audioCache.clear();
    }

    stop(): void {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = new AudioContext();
        }
    }

    isModelLoaded(): boolean {
        return this.ttsModel !== null;
    }
}

export default TTSService.getInstance();

