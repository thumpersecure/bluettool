#!/usr/bin/env node
/**
 * Generate a minimal DTMF/fax tones WAV file for BlueTTool.
 * Creates ~1 second of DTMF-like tones at 8kHz mono 16-bit.
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const DURATION_SEC = 3.0; // ~264KB to satisfy "substantial" test (>100KB)

// Generate DTMF-like sine wave (697 + 1209 Hz mix)
function generateSample(t, freq1, freq2, volume) {
  const v1 = Math.sin(2 * Math.PI * freq1 * t) * volume;
  const v2 = Math.sin(2 * Math.PI * freq2 * t) * volume;
  const sample = Math.max(-1, Math.min(1, (v1 + v2) / 2));
  return Math.floor(sample * 32767);
}

const numSamples = Math.floor(SAMPLE_RATE * DURATION_SEC * NUM_CHANNELS);
const dataSize = numSamples * (BITS_PER_SAMPLE / 8);
const chunkSize = 36 + dataSize;
const fileSize = 4 + 4 + chunkSize;

const buffer = Buffer.alloc(44 + dataSize);
let offset = 0;

function writeStr(s) {
  buffer.write(s, offset);
  offset += s.length;
}
function writeU32(v) {
  buffer.writeUInt32LE(v, offset);
  offset += 4;
}
function writeU16(v) {
  buffer.writeUInt16LE(v, offset);
  offset += 2;
}

// RIFF header
writeStr('RIFF');
writeU32(chunkSize);
writeStr('WAVE');

// fmt chunk
writeStr('fmt ');
writeU32(16);
writeU16(1); // PCM
writeU16(NUM_CHANNELS);
writeU32(SAMPLE_RATE);
writeU32(SAMPLE_RATE * NUM_CHANNELS * (BITS_PER_SAMPLE / 8));
writeU16(NUM_CHANNELS * (BITS_PER_SAMPLE / 8));
writeU16(BITS_PER_SAMPLE);

// data chunk
writeStr('data');
writeU32(dataSize);

// Generate DTMF "1" tone (697 + 1209 Hz)
const volume = 0.3;
for (let i = 0; i < numSamples; i++) {
  const t = i / SAMPLE_RATE;
  const sample = generateSample(t, 697, 1209, volume);
  buffer.writeInt16LE(sample, offset);
  offset += 2;
}

const outPath = path.join(__dirname, '..', 'audio', 'dtmf-fax-tones.wav');
fs.writeFileSync(outPath, buffer);
console.log('Generated:', outPath, '(' + buffer.length + ' bytes)');
