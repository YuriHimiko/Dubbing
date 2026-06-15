/**
 * Utility to convert an AudioBuffer retrieved from HTML5 audio file/video file
 * into a compact 16kHz Mono WAV base64 string for optimum Gemini ingestion.
 */
export async function audioBufferToWavBase64(audioBuffer: AudioBuffer): Promise<{ base64: string; mimeType: string }> {
  const workerRate = 16000; // Optimal for transcription
  const numOfChannels = 1; // Mono is perfect
  
  // Downsample to 16kHz using OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(
    numOfChannels,
    Math.round(audioBuffer.duration * workerRate),
    workerRate
  );
  
  // Create solid source buffer
  const bufferSource = offlineCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(offlineCtx.destination);
  bufferSource.start();
  
  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);
  
  // Encode as WAV
  const wavBuffer = encodeWAV(channelData, workerRate);
  
  // Convert ArrayBuffer to Base64
  const base64 = arrayBufferToBase64(wavBuffer);
  return {
    base64,
    mimeType: "audio/wav"
  };
}

export function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  
  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample (16-bit PCM) */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);
  
  floatTo16BitPCM(view, 44, samples);
  
  return buffer;
}

function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
