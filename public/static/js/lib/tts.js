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
            // Check for browser TTS support first
            if ('speechSynthesis' in window) {
                // Load voices (may be async in some browsers)
                if (window.speechSynthesis.getVoices().length === 0) {
                    // Wait for voices to load if needed
                    if (speechSynthesis.onvoiceschanged !== undefined) {
                        await new Promise(resolve => {
                            speechSynthesis.onvoiceschanged = resolve;
                            // Set a timeout in case voices never load
                            setTimeout(resolve, 1000);
                        });
                    }
                }
                
                // Get available browser voices
                const browserVoices = window.speechSynthesis.getVoices();
                console.log(`🎤 Browser TTS: ${browserVoices.length} voices available`);
                
                // Filter to English voices
                const englishVoices = browserVoices.filter(v => v.lang.startsWith('en'));
                console.log(`🎤 English voices: ${englishVoices.length}`);
                
                // Check for premium voices
                const premiumVoices = browserVoices.filter(v => 
                    v.name.includes('Microsoft') || 
                    v.name.includes('Google') || 
                    v.name.toLowerCase().includes('neural') ||
                    v.name.toLowerCase().includes('aria') ||
                    v.name.toLowerCase().includes('guy') ||
                    v.name.toLowerCase().includes('premium') ||
                    v.name.toLowerCase().includes('enhanced') ||
                    v.name.toLowerCase().includes('wavenet')
                );
                
                // Log some premium voices for debugging
                if (premiumVoices.length > 0) {
                    console.log('🎤 Premium voices:', premiumVoices.slice(0, 5).map(v => v.name).join(', ') + 
                                (premiumVoices.length > 5 ? '...' : ''));
                }
                
                if (premiumVoices.length > 0) {
                    console.log(`🎤 Premium voices available: ${premiumVoices.length}`);
                }
            }
            
            // Still check server status
            const response = await fetch('/api/tts/status');
            const status = await response.json();
            
            console.log('🔍 TTS Status Response:', status);
            
            // Browser TTS is always available if supported
            this.isAvailable = 'speechSynthesis' in window;
            this.voices = status.voices || [];
            
            if (this.isAvailable) {
                console.log(`✅ TTS available with browser speech synthesis`);
            } else {
                console.log('⚠️ TTS not available - browser does not support speech synthesis');
            }
        } catch (error) {
            console.log('❌ TTS initialization failed:', error.message);
            // Even if server fails, browser TTS might still work
            this.isAvailable = 'speechSynthesis' in window;
            if (this.isAvailable) {
                console.log('✅ Using browser TTS as fallback');
            }
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
            // Get available voices
            const voices = window.speechSynthesis.getVoices();
            console.log(`🎤 Available browser voices: ${voices.length}`);
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Try to find a good quality voice
            let selectedVoice = null;
            
            // Voice selection priority:
            // 1. Microsoft voices (Edge/Chrome on Windows)
            // 2. Google voices (Chrome)
            // 3. Apple voices (Safari)
            // 4. Any other voice
            // 5. Default voice
            
            // Log all voices for debugging
            console.log('🔍 Available voices:', voices.map(v => `${v.name} (${v.lang})`).join(', '));
            
            // Look for Microsoft voices first (best quality)
            selectedVoice = voices.find(v => 
                (v.name.includes('Microsoft') || v.name.toLowerCase().includes('aria') || v.name.toLowerCase().includes('guy')) && 
                v.lang.startsWith('en')
            );
            
            // Then Google voices
            if (!selectedVoice) {
                selectedVoice = voices.find(v => 
                    (v.name.includes('Google') || v.name.toLowerCase().includes('neural')) && 
                    v.lang.startsWith('en')
                );
            }
            
            // Then Apple voices
            if (!selectedVoice) {
                selectedVoice = voices.find(v => 
                    (v.name.includes('Samantha') || v.name.includes('Alex') || 
                     v.name.includes('Daniel') || v.name.includes('Karen')) && 
                    v.lang.startsWith('en')
                );
            }
            
            // Then any natural-sounding English voice
            if (!selectedVoice) {
                const naturalVoiceKeywords = ['natural', 'premium', 'enhanced', 'wavenet', 'neural', 'standard'];
                selectedVoice = voices.find(v => 
                    naturalVoiceKeywords.some(keyword => v.name.toLowerCase().includes(keyword)) && 
                    v.lang.startsWith('en')
                );
            }
            
            // Then any English US voice
            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang === 'en-US');
            }
            
            // Then any English voice
            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang.startsWith('en'));
            }
            
            // Let user select a voice
            console.log('🎤 To select a specific voice, use one of these in the browser console:');
            console.log('window.selectedVoiceName = "Microsoft David";  // Replace with any voice name');
            
            // Check for user-selected voice
            if (window.selectedVoiceName) {
                const userVoice = voices.find(v => v.name.includes(window.selectedVoiceName));
                if (userVoice) {
                    selectedVoice = userVoice;
                    console.log(`🎤 Using user-selected voice: ${userVoice.name}`);
                }
            }
            
            // Use selected voice or default
            if (selectedVoice) {
                console.log(`🎤 Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
                utterance.voice = selectedVoice;
            }
            
            // Set speech parameters for better quality
            utterance.rate = 0.95;      // Slightly slower for better clarity
            utterance.pitch = 1.0;      // Natural pitch
            utterance.volume = 0.9;     // Slightly louder
            
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