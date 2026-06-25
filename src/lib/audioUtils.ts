export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onAudioData: (base64Data: string) => void;

  constructor(onAudioData: (base64Data: string) => void) {
    this.onAudioData = onAudioData;
  }

  async start(sourceType: 'microphone' | 'tab') {
    try {
      if (sourceType === 'microphone') {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        // For tab capture, we use getDisplayMedia which lets user select a tab and its audio
        this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // required by some browsers to enable audio capture
          audio: true,
        });
        
        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length === 0) {
          this.mediaStream.getTracks().forEach(track => track.stop());
          throw new Error("Không tìm thấy âm thanh! Bạn phải tick vào ô 'Chia sẻ âm thanh thẻ' (Share tab audio) khi chọn tab nhé.");
        }
      }

      this.audioContext = new AudioContext({ sampleRate: 16000 });
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
      
      this.workletNode.port.onmessage = (e) => {
        const pcmData = e.data as Int16Array;
        // Convert to base64
        const base64Str = this.arrayBufferToBase64(pcmData.buffer);
        this.onAudioData(base64Str);
      };

      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);
    } catch (e) {
      console.error('Error starting audio recorder:', e);
      throw e;
    }
  }

  stop() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
