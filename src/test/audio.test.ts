import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultBuildupWave, encodePcm16Wav } from "../audio";

test("creates a playable RIFF WAVE buffer", () => {
  const wave = createDefaultBuildupWave({ durationSeconds: 0.2, sampleRate: 8000, volume: 0.25 });

  assert.equal(wave.subarray(0, 4).toString(), "RIFF");
  assert.equal(wave.subarray(8, 12).toString(), "WAVE");
  assert.equal(wave.subarray(12, 16).toString(), "fmt ");
  assert.equal(wave.subarray(36, 40).toString(), "data");
  assert.equal(wave.readUInt32LE(24), 8000);
  assert.ok(wave.length > 44);
});

test("encodes pcm samples with the expected data size", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
  const wave = encodePcm16Wav(samples, 44100);

  assert.equal(wave.readUInt32LE(40), samples.length * 2);
  assert.equal(wave.length, 44 + samples.length * 2);
});
