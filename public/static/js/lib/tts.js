/**
 * Text-to-Speech functionality
 */

class TTSManager {
    constructor() {
        this.isAvailable = false;
        this.voices = [];
        this.currentAudio = null;
        this.isPlaying = false;
        this.defaultVoice = 'en-US-AriaNeural';
        this.init();
    }

    async init() {
        try {
            const response = await fetch('/api/tts/status');
            const status = await response.json();
            
            this.isAvailable = status.initialized && status.voices.length > 0;
            this.voices = status.voices || [];
            
            if (this.isAvailable) {
                console.log(`✅ TTS available with ${this.voices.length} English voices`);
            } else {
                console.log('⚠️ TTS not available');
            }
        } catch (error) {
            console.log('❌ TTS initialization failed:', error.message);
            this.isAvailable = false;
        }
    }

    // Get available voices grouped by gender
    getVoicesGrouped() {
        const grouped = {
            female: this.voices.filter(v => v.gender === 'Female'),
            male: this.voices.filter(v => v.gender === 'Male')
        };
        return grouped;
    }

    // Synthesize and play text
    async playText(text, voice = null) {
        if (!this.isAvailable) {
            throw new Error('TTS service not available');
        }

        if (!text || text.trim().length === 0) {
            throw new Error('No text to synthesize');
        }

        try {
            // Stop any currently playing audio
            this.stop();

            const response = await fetch('/api/tts/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text.trim(),
                    voice: voice || this.defaultVoice
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'TTS synthesis failed');
            }

            const result = await response.json();
            
            // Convert base64 to audio and play
            await this.playAudioFromBase64(result.audio);
            
            return result;
        } catch (error) {
            console.error('TTS playback failed:', error);
            throw error;
        }
    }

    // Synthesize and play movie overview
    async playMovieOverview(movieTitle, overview, voice = null) {
        if (!this.isAvailable) {
            throw new Error('TTS service not available');
        }

        if (!overview || overview.trim().length === 0) {
            throw new Error('No movie overview to read');
        }

        try {
            // Stop any currently playing audio
            this.stop();

            const response = await fetch('/api/tts/movie-overview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    movieTitle,
                    overview: overview.trim(),
                    voice: voice || this.defaultVoice
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Movie overview TTS failed');
            }

            const result = await response.json();
            
            // Convert base64 to audio and play
            await this.playAudioFromBase64(result.audio);
            
            return result;
        } catch (error) {
            console.error('Movie overview TTS failed:', error);
            throw error;
        }
    }

    // Convert base64 audio to playable audio and play it
    async playAudioFromBase64(audioBase64) {
        return new Promise((resolve, reject) => {
            try {
                // Check if this is a browser TTS instruction
                const audioData = atob(audioBase64);
                
                // Try to parse as JSON first (browser TTS instruction)
                try {
                    const instruction = JSON.parse(audioData);
                    if (instruction.useBrowserTTS) {
                        console.log('🎵 Using browser TTS for:', instruction.movieTitle);
                        this.playWithBrowserTTS(instruction.text, resolve, reject);
                        return;
                    }
                } catch (e) {
                    // Not JSON, continue with audio processing
                }
                
                const arrayBuffer = new ArrayBuffer(audioData.length);
                const uint8Array = new Uint8Array(arrayBuffer);
                
                for (let i = 0; i < audioData.length; i++) {
                    uint8Array[i] = audioData.charCodeAt(i);
                }
                
                // Log audio data info for debugging
                console.log('🎵 Audio data length:', audioData.length);
                console.log('🎵 First few bytes:', Array.from(uint8Array.slice(0, 10)));
                console.log('🎵 First bytes as text:', String.fromCharCode(...uint8Array.slice(0, 10)));
                
                // Check for proper audio format
                const firstBytes = Array.from(uint8Array.slice(0, 4));
                if (firstBytes[0] === 82 && firstBytes[1] === 73 && firstBytes[2] === 70 && firstBytes[3] === 70) {
                    // WAV format
                    const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
                    this.playAudioBlob(blob, resolve, reject);
                } else {
                    // Try MP3 format
                    const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                    this.playAudioBlob(blob, resolve, reject);
                }
                
            } catch (error) {
                reject(new Error('Failed to process audio data'));
            }
        });
    }

    // Play audio using browser's built-in TTS
    playWithBrowserTTS(text, resolve, reject) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 0.8;
            
            utterance.onend = () => {
                this.isPlaying = false;
                resolve();
            };
            
            utterance.onerror = (error) => {
                this.isPlaying = false;
                reject(new Error('Browser TTS failed'));
            };
            
            this.isPlaying = true;
            speechSynthesis.speak(utterance);
        } else {
            reject(new Error('Browser TTS not supported'));
        }
    }

    // Play audio blob
    playAudioBlob(blob, resolve, reject) {
        const audioUrl = URL.createObjectURL(blob);
        
        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.volume = 0.8;
        
        this.currentAudio.onloadstart = () => {
            this.isPlaying = true;
        };
        
        this.currentAudio.onended = () => {
            this.isPlaying = false;
            URL.revokeObjectURL(audioUrl);
            resolve();
        };
        
        this.currentAudio.onerror = (error) => {
            this.isPlaying = false;
            URL.revokeObjectURL(audioUrl);
            reject(new Error('Audio playback failed'));
        };
        
        this.currentAudio.play().catch(reject);
    }

    // Stop current playback
    stop() {
        // Stop browser TTS if active
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            speechSynthesis.cancel();
            console.log('🔇 Stopped browser TTS');
        }
        
        // Stop audio file playback if active
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        
        this.isPlaying = false;
    }

    // Pause current playback
    pause() {
        // Pause browser TTS if active
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            speechSynthesis.pause();
            console.log('⏸️ Paused browser TTS');
        }
        
        // Pause audio file playback if active
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.isPlaying = false;
        }
    }

    // Resume paused playback
    resume() {
        // Resume browser TTS if paused
        if ('speechSynthesis' in window && speechSynthesis.paused) {
            speechSynthesis.resume();
            console.log('▶️ Resumed browser TTS');
        }
        
        // Resume audio file playback if paused
        if (this.currentAudio && this.currentAudio.paused) {
            this.currentAudio.play();
            this.isPlaying = true;
        }
    }

    // Get current playback status
    getStatus() {
        return {
            isAvailable: this.isAvailable,
            isPlaying: this.isPlaying,
            voicesCount: this.voices.length,
            currentTime: this.currentAudio ? this.currentAudio.currentTime : 0,
            duration: this.currentAudio ? this.currentAudio.duration : 0
        };
    }
}

// Export for use in other modules
export { TTSManager };