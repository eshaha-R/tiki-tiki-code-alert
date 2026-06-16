export interface BuildupWaveOptions {
  durationSeconds?: number;
  sampleRate?: number;
  volume?: number;
}

const DEFAULT_DURATION_SECONDS = 2.65;
const DEFAULT_SAMPLE_RATE = 44100;
const DEFAULT_VOLUME = 0.42;

export function createDefaultBuildupWave(options: BuildupWaveOptions = {}): Buffer {
  const durationSeconds = options.durationSeconds ?? DEFAULT_DURATION_SECONDS;
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const volume = clamp(options.volume ?? DEFAULT_VOLUME, 0, 1);
  const totalSamples = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const samples = new Float32Array(totalSamples);

  let cursorSeconds = 0;
  let pulseIndex = 0;

  while (cursorSeconds < durationSeconds) {
    const progress = cursorSeconds / durationSeconds;
    const frequency = pulseIndex % 2 === 0 ? 1220 : 1760;
    const pulseSeconds = 0.045 + progress * 0.018;
    const pulseVolume = volume * (0.55 + progress * 0.45);

    addPercussivePulse(samples, sampleRate, cursorSeconds, pulseSeconds, frequency, pulseVolume);

    const tighteningGap = 0.22 - progress * 0.145;
    const accentGap = pulseIndex % 4 === 3 ? 0.04 - progress * 0.02 : 0;
    cursorSeconds += Math.max(0.066, tighteningGap + accentGap);
    pulseIndex += 1;
  }

  addSoftLimiter(samples);
  return encodePcm16Wav(samples, sampleRate);
}

export function encodePcm16Wav(samples: Float32Array, sampleRate: number): Buffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = clamp(samples[index], -1, 1);
    const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    buffer.writeInt16LE(Math.round(pcm), 44 + index * bytesPerSample);
  }

  return buffer;
}

function addPercussivePulse(
  samples: Float32Array,
  sampleRate: number,
  startSeconds: number,
  durationSeconds: number,
  frequency: number,
  volume: number
): void {
  const start = Math.floor(startSeconds * sampleRate);
  const length = Math.floor(durationSeconds * sampleRate);
  const twoPi = Math.PI * 2;

  for (let offset = 0; offset < length && start + offset < samples.length; offset += 1) {
    const localProgress = offset / Math.max(1, length - 1);
    const seconds = offset / sampleRate;
    const attack = Math.min(1, localProgress / 0.14);
    const release = Math.pow(1 - localProgress, 2.2);
    const envelope = attack * release;
    const click = Math.sin(twoPi * frequency * seconds);
    const overTone = 0.42 * Math.sin(twoPi * frequency * 1.52 * seconds);

    samples[start + offset] += (click + overTone) * envelope * volume;
  }
}

function addSoftLimiter(samples: Float32Array): void {
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.tanh(samples[index] * 1.35);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
