class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // 256ms of audio at 16000Hz
    this.buffer = new Int16Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData) {
        for (let i = 0; i < channelData.length; i++) {
          // Convert Float32Array (-1.0 to 1.0) to Int16Array (-32768 to 32767)
          let s = Math.max(-1, Math.min(1, channelData[i]));
          this.buffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          
          if (this.bufferIndex >= this.bufferSize) {
            // Post the buffered PCM data back to the main thread
            this.port.postMessage(new Int16Array(this.buffer));
            this.bufferIndex = 0;
          }
        }
      }
    }
    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
