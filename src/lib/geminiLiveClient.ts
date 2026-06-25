export type GeminiLiveClientConfig = {
  apiKey: string;
  model: string;
  onMessage: (text: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onClose: () => void;
};

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private config: GeminiLiveClientConfig;

  constructor(config: GeminiLiveClientConfig) {
    this.config = config;
  }

  connect() {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.config.apiKey}`;
    
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log('Connected to Gemini Live API');
        this.setupConnection();
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        this.config.onError('WebSocket connection error.');
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket Closed:', event.code, event.reason);
        this.config.onClose();
      };
    } catch (e: any) {
      this.config.onError(e.message || 'Failed to initialize connection.');
    }
  }

  private setupConnection() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const setupMessage = {
      setup: {
        model: `models/${this.config.model.replace('models/', '')}`,
        inputAudioTranscription: { languageAuto: {} },
        systemInstruction: {
          parts: [{
            text: "You are a silent listener. You MUST NOT respond, speak, or generate any text or audio. Do not answer questions. Do not acknowledge. Remain completely silent at all times."
          }]
        },
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede"
              }
            }
          }
        }
      }
    };
    
    // Wait, the new API just needs the setup message first. Let's send setup alone.
    this.ws.send(JSON.stringify({ setup: setupMessage.setup }));
  }

  sendAudioChunk(base64PcmData: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    
    const realtimeInputMessage = {
      realtimeInput: {
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: base64PcmData,
        }
      }
    };
    this.ws.send(JSON.stringify(realtimeInputMessage));
  }
  
  endTurn() {
     if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
     this.ws.send(JSON.stringify({ clientContent: { turnComplete: true } }));
  }

  private async handleMessage(event: MessageEvent) {
    try {
      let dataStr = event.data;
      if (dataStr instanceof Blob) {
        dataStr = await dataStr.text();
      }
      const data = JSON.parse(dataStr);
      console.log('Gemini Live API Message:', data);
      
      if (data) {
        // Clone data to avoid mutating original, then delete modelTurn so we don't grab AI's conversational text
        const safeData = JSON.parse(JSON.stringify(data));
        if (safeData.serverContent && safeData.serverContent.modelTurn) {
           delete safeData.serverContent.modelTurn;
        }

        // Recursive search for any "text" field in the server response
        const findTextParts = (obj: any): string[] => {
          let texts: string[] = [];
          if (!obj || typeof obj !== 'object') return texts;
          
          if (typeof obj.text === 'string' && obj.text.trim().length > 0) {
            texts.push(obj.text);
          } else if (Array.isArray(obj)) {
            for (const item of obj) {
              texts = texts.concat(findTextParts(item));
            }
          } else {
            for (const key in obj) {
              texts = texts.concat(findTextParts(obj[key]));
            }
          }
          return texts;
        };

        const texts = findTextParts(safeData);
        if (texts.length > 0) {
           this.config.onMessage(texts.join(" "), false);
        }
      }
      
      if (data.serverContent?.turnComplete) {
         this.config.onMessage('', true); // Signal turn complete if needed
      }
      
    } catch (e) {
      console.error("Failed to parse Gemini message", e);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
