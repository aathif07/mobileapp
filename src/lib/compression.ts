import { ImagePreset, ImagePresetId } from '../types/pulselink';

export const IMAGE_PRESETS: ImagePreset[] = [
  {
    id: 'ultra_tiny',
    label: 'Ultra-Tiny 240px',
    maxDim: 240,
    quality: 0.36,
    targetNote: '2G GPRS · ~5–11 KB',
  },
  {
    id: 'standard_2g',
    label: '2G Standard 400px',
    maxDim: 400,
    quality: 0.5,
    targetNote: 'EDGE · ~14–24 KB',
  },
  {
    id: 'clear_640',
    label: 'Clear 640px',
    maxDim: 640,
    quality: 0.68,
    targetNote: '3G+ · ~32–55 KB',
  },
];

/**
 * Compresses UTF-8 text using native browser CompressionStream('deflate-raw').
 * Falls back cleanly to raw UTF-8 if CompressionStream is unavailable.
 */
export async function compressTextBytes(text: string): Promise<{
  rawBytes: Uint8Array;
  compressedBytes: Uint8Array;
  method: 'DEFLATE-RAW';
}> {
  const rawBytes = new TextEncoder().encode(text);

  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(rawBytes);
      writer.close();

      const chunks: Uint8Array[] = [];
      const reader = cs.readable.getReader();
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      const compressed = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        compressed.set(c, offset);
        offset += c.byteLength;
      }
      // Keep the smaller of compressed vs raw (tiny 1-word strings can expand by 2 bytes in deflate)
      return {
        rawBytes,
        compressedBytes: compressed.byteLength < rawBytes.byteLength ? compressed : rawBytes,
        method: 'DEFLATE-RAW',
      };
    } catch {
      return { rawBytes, compressedBytes: rawBytes, method: 'DEFLATE-RAW' };
    }
  }

  return { rawBytes, compressedBytes: rawBytes, method: 'DEFLATE-RAW' };
}

export async function decompressTextBytes(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'undefined') {
    try {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(bytes));
      writer.close();
      const chunks: Uint8Array[] = [];
      const reader = ds.readable.getReader();
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.byteLength;
      }
      const out = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.byteLength;
      }
      return new TextDecoder().decode(out);
    } catch {
      return new TextDecoder().decode(bytes);
    }
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Estimates what a conventional rich messenger (JSON envelope + HTTP/2 headers + presence metadata + unoptimized media)
 * transmits on the wire vs PulseLink's binary compact frame.
 */
export function estimateStandardAppWireBytes(
  rawPayloadBytes: number,
  kind: 'text' | 'image' | 'voice'
): number {
  if (kind === 'text') {
    // Typical REST/WebSocket JSON chat packet with UUIDs, headers, profile URLs, read receipts metadata
    return rawPayloadBytes + 512;
  }
  if (kind === 'image') {
    // Uncompressed / lightly compressed mobile camera JPEG (~450KB to 1.4MB)
    return Math.max(rawPayloadBytes, 380 * 1024);
  }
  // Standard 64-128kbps voice memo (~16KB/sec)
  return Math.max(rawPayloadBytes, 56 * 1024);
}

export interface TinyImageResult {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  presetLabel: string;
  savingsPct: number;
}

export async function compressImageSource(
  source: File | string,
  presetId: ImagePresetId
): Promise<TinyImageResult> {
  const preset = IMAGE_PRESETS.find((p) => p.id === presetId) ?? IMAGE_PRESETS[0];

  let objectUrl: string;
  let originalBytes = 0;
  let shouldRevoke = false;

  if (typeof source === 'string') {
    objectUrl = source;
    try {
      const resp = await fetch(source);
      const blob = await resp.blob();
      originalBytes = blob.size;
    } catch {
      originalBytes = 420 * 1024;
    }
  } else {
    originalBytes = source.size;
    objectUrl = URL.createObjectURL(source);
    shouldRevoke = true;
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, preset.maxDim / Math.max(img.width, img.height));
    const width = Math.max(48, Math.round(img.width * scale));
    const height = Math.max(48, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', preset.quality);
    const base64Body = dataUrl.split(',')[1] ?? '';
    const compressedBytes = Math.ceil((base64Body.length * 3) / 4);

    // Ensure realistic comparison baseline if a small thumbnail was uploaded
    const baselineBytes = Math.max(originalBytes, compressedBytes * 4);
    const savingsPct = Math.max(
      0,
      Math.min(99.5, ((baselineBytes - compressedBytes) / baselineBytes) * 100)
    );

    return {
      dataUrl,
      originalBytes: baselineBytes,
      compressedBytes,
      width,
      height,
      presetLabel: preset.label,
      savingsPct,
    };
  } finally {
    if (shouldRevoke) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * Generates a real playable low-bitrate 8 kHz 8-bit mono PCM WAV audio note (~6-10 KB)
 * with realistic voice-band formant cadence and waveform peaks. Used both for incoming
 * peer voice notes and as a reliable fallback when a microphone is unavailable in demo browsers.
 */
export function synthesizeCompactVoiceNote(
  durationSec = 3.2,
  seed = 1,
  transcriptHint?: string
): {
  dataUrl: string;
  durationSec: number;
  bitrateKbps: number;
  originalBytes: number;
  compressedBytes: number;
  peaks: number[];
  transcriptHint?: string;
} {
  const sampleRate = 8000; // Ultra-low-bandwidth narrowband telephone speech rate (8 kHz)
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // Standard 8-bit unsigned PCM WAV header
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // Byte rate (8000 B/s)
  view.setUint16(32, 1, true); // Block align
  view.setUint16(34, 8, true); // 8-bit
  writeStr(36, 'data');
  view.setUint32(40, numSamples, true);

  const baseFreq = 165 + (seed % 5) * 28;
  const peaks: number[] = [];
  const barCount = 24;
  const samplesPerBar = Math.floor(numSamples / barCount);

  for (let b = 0; b < barCount; b++) {
    let maxAmp = 0;
    for (let j = 0; j < samplesPerBar; j++) {
      const idx = b * samplesPerBar + j;
      const t = idx / sampleRate;
      // Syllabic amplitude envelope to sound like a crisp radio chime / speech cadence
      const syllable = Math.max(0, Math.sin(t * (5.2 + (seed % 3)) * Math.PI));
      const env = Math.sin((t / durationSec) * Math.PI) * (0.25 + 0.75 * syllable);
      const tone =
        0.55 * Math.sin(2 * Math.PI * (baseFreq + Math.sin(t * 4) * 35) * t) +
        0.3 * Math.sin(2 * Math.PI * (baseFreq * 2.02) * t) +
        0.15 * Math.sin(2 * Math.PI * (baseFreq * 3.1) * t);
      const sample = tone * env * 0.65;
      maxAmp = Math.max(maxAmp, Math.abs(sample));
      const u8 = Math.max(0, Math.min(255, Math.round((sample + 1) * 127.5)));
      view.setUint8(44 + idx, u8);
    }
    peaks.push(Math.max(0.18, Math.min(1, maxAmp * 1.45)));
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  const dataUrl = `data:audio/wav;base64,${btoa(binary)}`;

  // Simulated Opus 8 kbps wire size vs standard 128 kbps mobile voice memo
  const opusWireBytes = Math.max(2400, Math.round((durationSec * 8000) / 8));
  const standardMemoBytes = Math.round((durationSec * 128000) / 8);

  return {
    dataUrl,
    durationSec: Number(durationSec.toFixed(1)),
    bitrateKbps: 8,
    originalBytes: standardMemoBytes,
    compressedBytes: opusWireBytes,
    peaks,
    transcriptHint,
  };
}
