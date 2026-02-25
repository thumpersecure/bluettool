/**
 * BlueTTool Test Suite
 * Runs in Node.js — validates module logic, HTML structure, and code quality.
 * Does not require a browser or real Bluetooth hardware.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  FAIL: ${msg}`);
  }
}

function section(name) {
  console.log(`\n=== ${name} ===`);
}

// --- File Existence Tests ---
section('File Existence');

const requiredFiles = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'js/logger.js',
  'js/bluetooth-scanner.js',
  'js/announcements.js',
  'js/audio-player.js',
  'js/advanced.js',
  'js/sharing.js',
  'audio/dtmf-fax-tones.wav',
  'README.md',
  'icons/icon-180.svg',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
];

for (const file of requiredFiles) {
  const fullPath = path.join(ROOT, file);
  assert(fs.existsSync(fullPath), `${file} exists`);
}

// --- HTML Structure Tests ---
section('HTML Structure');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

assert(html.includes('<!DOCTYPE html>'), 'Has DOCTYPE');
assert(html.includes('viewport-fit=cover'), 'Has viewport-fit=cover for iOS safe areas');
assert(html.includes('apple-mobile-web-app-capable'), 'Has apple-mobile-web-app-capable meta');
assert(html.includes('manifest.json'), 'Links to manifest.json');

// Tab structure
assert(html.includes('data-tab="scanner"'), 'Has scanner tab');
assert(html.includes('data-tab="devices"'), 'Has devices tab');
assert(html.includes('data-tab="audio"'), 'Has audio tab');
assert(html.includes('data-tab="advanced"'), 'Has advanced/agent tab');
assert(html.includes('data-tab="log"'), 'Has log tab');

// Key UI elements
assert(html.includes('id="btn-scan"'), 'Has scan button');
assert(html.includes('id="btn-scan-all"'), 'Has scan-all button');
assert(html.includes('id="btn-play-dtmf"'), 'Has DTMF play button');
assert(html.includes('id="btn-play-file"'), 'Has file play button');
assert(html.includes('id="btn-stop-audio"'), 'Has stop audio button');
assert(html.includes('id="btn-silence-all"'), 'Has silence-all button');
assert(html.includes('id="btn-share-audio"'), 'Has share audio button');
assert(html.includes('id="btn-share-hearts"'), 'Has share hearts button');
assert(html.includes('id="btn-share-link"'), 'Has share link button');
assert(html.includes('id="btn-agent-full"'), 'Has full agent button');
assert(html.includes('id="btn-agent-quick"'), 'Has quick agent button');
assert(html.includes('id="btn-agent-stop"'), 'Has stop agent button');

// Device detail panel
assert(html.includes('id="device-detail"'), 'Has device detail panel');
assert(html.includes('id="btn-back-devices"'), 'Has back button in detail');

// Audio overlay replaces rickroll
assert(!html.includes('rickroll'), 'No rickroll references in HTML');
assert(html.includes('id="audio-overlay"'), 'Has audio overlay');
assert(html.includes('audio-visualizer'), 'Has audio visualizer');

// Disclaimer
assert(html.includes('card-disclaimer'), 'Has disclaimer card');
assert(html.includes('personal testing'), 'Disclaimer mentions personal testing');

// Script load order
const scriptOrder = [
  'js/logger.js',
  'js/bluetooth-scanner.js',
  'js/announcements.js',
  'js/audio-player.js',
  'js/advanced.js',
  'js/sharing.js',
  'js/app.js'
];
let lastIdx = -1;
let orderCorrect = true;
for (const script of scriptOrder) {
  const idx = html.indexOf(`src="${script}"`);
  assert(idx > -1, `Script ${script} is included`);
  if (idx <= lastIdx) orderCorrect = false;
  lastIdx = idx;
}
assert(orderCorrect, 'Scripts loaded in correct dependency order');

// No rickroll script
assert(!html.includes('rickroll.js'), 'rickroll.js is not loaded');

// --- JavaScript Module Tests ---
section('JavaScript Module Quality');

const jsFiles = [
  'js/app.js',
  'js/logger.js',
  'js/bluetooth-scanner.js',
  'js/announcements.js',
  'js/audio-player.js',
  'js/advanced.js',
  'js/sharing.js',
];

for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert(content.length > 100, `${file} has substantive content (${content.length} chars)`);
  assert(!content.includes('console.log('), `${file} has no console.log calls (uses Logger)`);

  // Check for common JS errors
  let braceCount = 0;
  let parenCount = 0;
  for (const ch of content) {
    if (ch === '{') braceCount++;
    if (ch === '}') braceCount--;
    if (ch === '(') parenCount++;
    if (ch === ')') parenCount--;
  }
  assert(braceCount === 0, `${file} has balanced braces`);
  assert(parenCount === 0, `${file} has balanced parentheses`);
}

// --- App.js Bug Fixes ---
section('Bug Fix Verification');

const appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

// Bug: stale device references in char-read/notify handlers
assert(appJs.includes('BluetoothScanner.getDevices()') &&
  appJs.includes('freshDevices'), 'Uses fresh device list in char read/notify handlers');

// Bug: duplicate escapeHtml — app.js should define its own, not rely on Logger's private one
assert(appJs.includes('function escapeHtml'), 'app.js defines its own escapeHtml');

// Bug: rickroll reference removed
assert(!appJs.includes('RickRoll'), 'No RickRoll references in app.js');
assert(!appJs.includes('rickroll'), 'No rickroll references in app.js');

// Loading states on buttons
assert(appJs.includes('Connecting...'), 'Shows loading state on connect');
assert(appJs.includes('Reading...'), 'Shows loading state on read');
assert(appJs.includes('Capturing...'), 'Shows loading state on capture');

// --- Audio Player Tests ---
section('Audio Player Module');

const audioJs = fs.readFileSync(path.join(ROOT, 'js/audio-player.js'), 'utf8');

assert(audioJs.includes('DTMF_FREQS'), 'Has DTMF frequency table');
assert(audioJs.includes('playDTMFSequence'), 'Has live DTMF playback function');
assert(audioJs.includes('playFile'), 'Has file playback function');
assert(audioJs.includes('stopAll'), 'Has stop function');
assert(audioJs.includes('getAudioBlob'), 'Has getAudioBlob for sharing');
assert(audioJs.includes('triggerOnConnect'), 'Has triggerOnConnect');

// Verify DTMF frequencies are correct
assert(audioJs.includes('[697, 1209]'), 'Correct DTMF freq for digit 1');
assert(audioJs.includes('[941, 1336]'), 'Correct DTMF freq for digit 0');

// --- Advanced Module Tests ---
section('Advanced Agent Module');

const advJs = fs.readFileSync(path.join(ROOT, 'js/advanced.js'), 'utf8');

assert(advJs.includes('AGENT_STATES'), 'Defines agent states');
assert(advJs.includes('runFullDiscovery'), 'Has full discovery function');
assert(advJs.includes('quickScan'), 'Has quick scan function');
assert(advJs.includes('stop'), 'Has stop function');
assert(advJs.includes('SCANNING'), 'Has scanning state');
assert(advJs.includes('CONNECTING'), 'Has connecting state');
assert(advJs.includes('ENUMERATING'), 'Has enumerating state');
assert(advJs.includes('READING'), 'Has reading state');
assert(advJs.includes('CAPTURING'), 'Has capturing state');
assert(advJs.includes('ANALYZING'), 'Has analyzing state');
assert(advJs.includes('COMPLETE'), 'Has complete state');

// --- Sharing Module Tests ---
section('Sharing Module');

const shareJs = fs.readFileSync(path.join(ROOT, 'js/sharing.js'), 'utf8');

assert(shareJs.includes('shareAudioFile'), 'Has shareAudioFile function');
assert(shareJs.includes('shareLink'), 'Has shareLink function');
assert(shareJs.includes('shareHearts'), 'Has shareHearts function');
assert(shareJs.includes('navigator.share'), 'Uses Web Share API');
assert(shareJs.includes('navigator.canShare'), 'Checks canShare before sharing files');
assert(shareJs.includes('AbortError'), 'Handles user cancellation');

// --- CSS Tests ---
section('CSS Quality');

const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');

assert(css.includes('safe-area-inset-top'), 'Has iOS safe area support');
assert(css.includes('safe-area-inset-bottom'), 'Has bottom safe area');
assert(css.includes('-webkit-overflow-scrolling'), 'Has momentum scrolling');
assert(css.includes('touch-action: manipulation'), 'Has touch-action manipulation (prevents double-tap zoom)');
assert(css.includes('-webkit-text-size-adjust'), 'Prevents text size adjustment');
assert(css.includes('-webkit-appearance: none'), 'Resets webkit appearance on inputs');

// New section styles
assert(css.includes('.audio-visualizer'), 'Has audio visualizer styles');
assert(css.includes('.agent-badge'), 'Has agent badge styles');
assert(css.includes('.agent-feed'), 'Has agent feed styles');
assert(css.includes('.card-disclaimer'), 'Has disclaimer card styles');
assert(css.includes('.conn-badge'), 'Has connection badge styles');
assert(css.includes('.device-id-row'), 'Has device ID row styles');

// No rickroll styles
assert(!css.includes('rickroll'), 'No rickroll references in CSS');

// --- Audio File Tests ---
section('Audio File');

const audioPath = path.join(ROOT, 'audio/dtmf-fax-tones.wav');
const audioStat = fs.statSync(audioPath);
assert(audioStat.size > 100000, `Audio file is substantial (${(audioStat.size / 1024).toFixed(0)} KB)`);
assert(audioStat.size < 5000000, 'Audio file is not too large (< 5MB)');

// Check WAV header
const wavBuf = Buffer.alloc(44);
const fd = fs.openSync(audioPath, 'r');
fs.readSync(fd, wavBuf, 0, 44, 0);
fs.closeSync(fd);
assert(wavBuf.toString('ascii', 0, 4) === 'RIFF', 'WAV has RIFF header');
assert(wavBuf.toString('ascii', 8, 12) === 'WAVE', 'WAV has WAVE format marker');

const sampleRate = wavBuf.readUInt32LE(24);
assert(sampleRate === 44100, `WAV sample rate is 44100 (got ${sampleRate})`);

// --- Manifest Tests ---
section('PWA Manifest');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
assert(manifest.name, 'Manifest has name');
assert(manifest.short_name, 'Manifest has short_name');
assert(manifest.display === 'standalone', 'Display is standalone');
assert(manifest.icons && manifest.icons.length >= 2, 'Has at least 2 icons');

// --- README Tests ---
section('README Content');

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

assert(readme.includes('Personal use only'), 'README has personal use disclaimer');
assert(readme.includes('educational purposes'), 'README mentions educational purposes');
assert(readme.includes('Bluefy'), 'README mentions Bluefy');
assert(readme.includes('DTMF'), 'README documents DTMF feature');
assert(readme.includes('AirDrop'), 'README documents AirDrop feature');
assert(readme.includes('Agentic'), 'README documents agentic feature');
assert(readme.includes('Silence'), 'README documents silence feature');
assert(readme.includes('audio-player.js'), 'README lists audio-player.js');
assert(readme.includes('advanced.js'), 'README lists advanced.js');
assert(readme.includes('sharing.js'), 'README lists sharing.js');
assert(!readme.includes('rickroll'), 'README has no rickroll references');

// --- Summary ---
console.log(`\n=============================`);
console.log(`  Tests: ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`=============================\n`);

process.exit(failed > 0 ? 1 : 0);
