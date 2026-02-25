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
  'js/vulnerability.js',
  'js/advanced.js',
  'js/sharing.js',
  'audio/dtmf-fax-tones.wav',
  'README.md',
  'sw.js',
  'icons/icon-180.svg',
  'icons/icon-192.svg',
  'icons/icon-512.svg',
];

for (const file of requiredFiles) {
  const fullPath = path.join(ROOT, file);
  assert(fs.existsSync(fullPath), `${file} exists`);
}

// rickroll.js should NOT exist
assert(!fs.existsSync(path.join(ROOT, 'js/rickroll.js')), 'rickroll.js has been deleted');

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

// New v2 elements
assert(html.includes('id="toast-container"'), 'Has toast container');
assert(html.includes('id="confirm-dialog"'), 'Has confirm dialog');
assert(html.includes('id="volume-slider"'), 'Has volume slider');
assert(html.includes('id="captures-section"'), 'Has captures section in devices tab');
assert(html.includes('id="mimic-select"'), 'Has replay/mimic select');
assert(html.includes('id="btn-mimic"'), 'Has replay button');

// Device detail panel
assert(html.includes('id="device-detail"'), 'Has device detail panel');
assert(html.includes('id="btn-back-devices"'), 'Has back button in detail');

// Vulnerability report UI
assert(html.includes('id="vuln-report-card"'), 'Has vulnerability report card');
assert(html.includes('id="vuln-score-banner"'), 'Has vulnerability score banner');
assert(html.includes('id="vuln-stats"'), 'Has vulnerability stats section');
assert(html.includes('id="vuln-findings"'), 'Has vulnerability findings section');
assert(html.includes('id="vuln-recommendations"'), 'Has vulnerability recommendations section');
assert(html.includes('vulnerability.js'), 'Loads vulnerability.js');

// No rickroll
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
  'js/vulnerability.js',
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
assert(!html.includes('rickroll.js'), 'rickroll.js is not loaded');

// --- JavaScript Module Tests ---
section('JavaScript Module Quality');

const jsFiles = [
  'js/app.js',
  'js/logger.js',
  'js/bluetooth-scanner.js',
  'js/announcements.js',
  'js/audio-player.js',
  'js/vulnerability.js',
  'js/advanced.js',
  'js/sharing.js',
];

for (const file of jsFiles) {
  const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert(content.length > 100, `${file} has substantive content (${content.length} chars)`);
  assert(!content.includes('console.log('), `${file} has no console.log calls (uses Logger)`);

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

// Service worker
const swContent = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
assert(swContent.includes('CACHE_NAME'), 'Service worker has cache name');
assert(swContent.includes('install'), 'Service worker has install handler');
assert(swContent.includes('fetch'), 'Service worker has fetch handler');
assert(swContent.includes('vulnerability.js'), 'Service worker caches vulnerability.js');

// --- App.js Features ---
section('App.js Feature Verification');

const appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');

// Bug fixes
assert(appJs.includes('freshDevices'), 'Uses fresh device list in char handlers');
assert(appJs.includes('function escapeHtml'), 'Defines escapeHtml');
assert(!appJs.includes('RickRoll'), 'No RickRoll references');
assert(!appJs.includes('rickroll'), 'No rickroll references');

// Loading states
assert(appJs.includes('Connecting...'), 'Connect loading state');
assert(appJs.includes('Reading...'), 'Read loading state');
assert(appJs.includes('Capturing...'), 'Capture loading state');
assert(appJs.includes('Scanning...'), 'Scan loading state');
assert(appJs.includes('Subscribing...'), 'Subscribe loading state');
assert(appJs.includes('Writing...'), 'Write loading state');

// Toast notifications
assert(appJs.includes('showToast'), 'Has toast notification function');
assert(appJs.includes('toast-show'), 'Toast has show animation');

// Confirm dialogs
assert(appJs.includes('showConfirm'), 'Has confirm dialog function');
assert(appJs.includes('Clear All Devices'), 'Confirm on clear devices');
assert(appJs.includes('Clear Log'), 'Confirm on clear log');

// Volume control
assert(appJs.includes('volume-slider'), 'Wires volume slider');
assert(appJs.includes('setVolume'), 'Calls setVolume');

// Write characteristic UI
assert(appJs.includes('btn-char-write-toggle'), 'Has write toggle button handler');
assert(appJs.includes('btn-char-write-send'), 'Has write send button handler');
assert(appJs.includes('Invalid hex'), 'Validates hex input');
assert(appJs.includes('isValidHexInput'), 'Uses strict hex validation helper');

// Reconnect button
assert(appJs.includes('btn-reconnect'), 'Has reconnect button in device list');
assert(appJs.includes('btn-light-test'), 'Has quick smart-light test buttons');
assert(appJs.includes('btn-detail-light-test'), 'Has detail smart-light test buttons');
assert(appJs.includes('runLightTestAction'), 'Has smart-light test action runner');
assert(appJs.includes('Best suggested test'), 'Shows best test suggestion from GATT');

// Capture/replay in devices tab
assert(appJs.includes('renderCaptures'), 'Has renderCaptures function');
assert(appJs.includes('mimic-select'), 'Has mimic select handler');
assert(appJs.includes('Replay'), 'References Replay functionality');

// Vulnerability report rendering
assert(appJs.includes('renderVulnReport'), 'Has renderVulnReport function');
assert(appJs.includes('vuln-report-card'), 'Wires vulnerability report card');
assert(appJs.includes('vuln-score-banner'), 'Renders vulnerability score banner');
assert(appJs.includes('vuln-findings'), 'Renders vulnerability findings');
assert(appJs.includes('vuln-recommendations'), 'Renders vulnerability recommendations');

// Service worker registration
assert(appJs.includes('serviceWorker'), 'Registers service worker');

// Agent stop reset bugfix
assert(appJs.includes('agentFeed.innerHTML = \'\''), 'Stop button clears agent feed');
assert(appJs.includes('agentResultsCard.style.display = \'none\''), 'Stop button hides agent results');
assert(appJs.includes('agentBadge.textContent = \'idle\''), 'Stop button resets agent badge');

// --- Audio Player Tests ---
section('Audio Player Module');

const audioJs = fs.readFileSync(path.join(ROOT, 'js/audio-player.js'), 'utf8');

assert(audioJs.includes('DTMF_FREQS'), 'Has DTMF frequency table');
assert(audioJs.includes('playDTMFSequence'), 'Has live DTMF playback');
assert(audioJs.includes('playFile'), 'Has file playback');
assert(audioJs.includes('stopAll'), 'Has stop function');
assert(audioJs.includes('getAudioBlob'), 'Has getAudioBlob');
assert(audioJs.includes('triggerOnConnect'), 'Has triggerOnConnect');
assert(audioJs.includes('setVolume'), 'Has setVolume');
assert(audioJs.includes('getVolume'), 'Has getVolume');
assert(audioJs.includes('masterVolume'), 'Has master volume control');
assert(audioJs.includes('pendingTimeouts'), 'Tracks pending timeouts for cleanup');
assert(audioJs.includes('[697, 1209]'), 'Correct DTMF freq for digit 1');
assert(audioJs.includes('[941, 1336]'), 'Correct DTMF freq for digit 0');

// --- Vulnerability Module Tests ---
section('Vulnerability Assessment Module');

const vulnJs = fs.readFileSync(path.join(ROOT, 'js/vulnerability.js'), 'utf8');

assert(vulnJs.includes('SEVERITY'), 'Defines severity levels');
assert(vulnJs.includes('assessDevice'), 'Has assessDevice function');
assert(vulnJs.includes('assessConnected'), 'Has assessConnected convenience function');
assert(vulnJs.includes('SENSITIVE_CHAR_UUIDS'), 'Has sensitive characteristic map');
assert(vulnJs.includes('SERVICE_CATEGORIES'), 'Has service category map');
assert(vulnJs.includes('generateRecommendations'), 'Generates targeted recommendations');
assert(vulnJs.includes('buildReport'), 'Builds structured reports');
assert(vulnJs.includes('riskScore'), 'Calculates risk score');
assert(vulnJs.includes('riskLevel'), 'Determines risk level');
assert(vulnJs.includes('Write Access'), 'Checks write access vulnerabilities');
assert(vulnJs.includes('Information Disclosure'), 'Checks information disclosure');
assert(vulnJs.includes('Authentication'), 'Checks authentication status');
assert(vulnJs.includes('Data Streaming'), 'Checks notification data streaming');
assert(vulnJs.includes('Bidirectional Access'), 'Checks bidirectional access');
assert(vulnJs.includes('HID Exposure'), 'Checks HID service exposure');
assert(vulnJs.includes('personal testing'), 'Has personal testing disclaimer');

// --- Advanced Module Tests ---
section('Advanced Agent Module');

const advJs = fs.readFileSync(path.join(ROOT, 'js/advanced.js'), 'utf8');

assert(advJs.includes('AGENT_STATES'), 'Defines agent states');
assert(advJs.includes('VULN_ASSESS'), 'Has vulnerability assessment state');
assert(advJs.includes('Vulnerability.assessDevice'), 'Integrates vulnerability assessment');
assert(advJs.includes('vulnReport'), 'Tracks vulnerability report in results');
assert(advJs.includes('runFullDiscovery'), 'Has full discovery');
assert(advJs.includes('quickScan'), 'Has quick scan');
assert(advJs.includes('running = false'), 'Sets running=false on cancel');
assert(advJs.includes('MAX_LOG_ENTRIES'), 'Caps agent log growth');
assert(advJs.includes('activeRunToken'), 'Tracks active run token for stop safety');

// --- Sharing Module Tests ---
section('Sharing Module');

const shareJs = fs.readFileSync(path.join(ROOT, 'js/sharing.js'), 'utf8');

assert(shareJs.includes('shareAudioFile'), 'Has shareAudioFile');
assert(shareJs.includes('shareLink'), 'Has shareLink');
assert(shareJs.includes('shareHearts'), 'Has shareHearts');
assert(shareJs.includes('navigator.share'), 'Uses Web Share API');
assert(shareJs.includes('AbortError'), 'Handles cancellation');

// --- Logger Tests ---
section('Logger Module');

const loggerJs = fs.readFileSync(path.join(ROOT, 'js/logger.js'), 'utf8');
assert(loggerJs.includes('MAX_ENTRIES'), 'Has max entries limit');
assert(loggerJs.includes('splice'), 'Prunes old entries');

// --- Bluetooth Scanner Tests ---
section('Bluetooth Scanner Module');

const btJs = fs.readFileSync(path.join(ROOT, 'js/bluetooth-scanner.js'), 'utf8');
assert(btJs.includes('Bluefy detected'), 'Has Bluefy-specific detection message');
assert(btJs.includes('connectedDevice.id === deviceId'), 'Disconnect checks specific device');
assert(btJs.includes('writeCharacteristic'), 'Has write characteristic');
assert(btJs.includes('writeValueWithoutResponse'), 'Supports writeWithoutResponse');
assert(btJs.includes('SMART_LIGHT_SERVICE_UUIDS'), 'Defines smart light service UUIDs');
assert(btJs.includes('0000ffd5-0000-1000-8000-00805f9b34fb'), 'Includes Govee-like service UUID');
assert(btJs.includes('lightTestPlan'), 'Stores suggested light test plan');

// --- Announcements / Replay Tests ---
section('Announcements Replay Safety');

const annJs = fs.readFileSync(path.join(ROOT, 'js/announcements.js'), 'utf8');
assert(annJs.includes('Connected device does not match this capture profile'), 'Blocks replay to unrelated devices');
assert(annJs.includes('targetService'), 'Matches replay writes by service + characteristic');
assert(annJs.includes('deviceInfo.id !== profile.deviceId'), 'Checks replay target device ID');
assert(annJs.includes('overlapRatio < 0.5'), 'Requires meaningful service overlap for cross-device replay');
assert(annJs.includes('normalizeUuid'), 'Normalizes UUIDs before matching during replay');

// --- CSS Tests ---
section('CSS Quality');

const css = fs.readFileSync(path.join(ROOT, 'css/style.css'), 'utf8');

assert(css.includes('safe-area-inset-top'), 'iOS safe area top');
assert(css.includes('safe-area-inset-bottom'), 'iOS safe area bottom');
assert(css.includes('-webkit-overflow-scrolling'), 'Momentum scrolling');
assert(css.includes('touch-action: manipulation'), 'Touch-action manipulation');
assert(css.includes('-webkit-text-size-adjust'), 'Text size adjust');
assert(css.includes('.audio-visualizer'), 'Audio visualizer styles');
assert(css.includes('.agent-badge'), 'Agent badge styles');
assert(css.includes('.card-disclaimer'), 'Disclaimer styles');
assert(css.includes('#toast-container'), 'Toast container styles');
assert(css.includes('.toast-success'), 'Toast success styles');
assert(css.includes('.toast-error'), 'Toast error styles');
assert(css.includes('.confirm-buttons'), 'Confirm dialog styles');
assert(css.includes('.volume-slider'), 'Volume slider styles');
assert(css.includes('.volume-control'), 'Volume control styles');
assert(css.includes('.char-write-form'), 'Write form styles');
assert(css.includes('.char-write-input'), 'Write input styles');
assert(css.includes('.empty-icon'), 'Enhanced empty state styles');
assert(css.includes('.device-quick-actions'), 'Device quick actions styles');
assert(css.includes('.device-list-header'), 'Device list header styles');
assert(css.includes('.mimic-status'), 'Mimic status styles');
assert(css.includes('.tag-light'), 'Has smart-light tag styles');
assert(css.includes('.tag-best-test'), 'Has best-test tag styles');
assert(css.includes('.light-test-actions'), 'Has smart-light action styles');
assert(css.includes('.vuln-score-banner'), 'Vulnerability score banner styles');
assert(css.includes('.vuln-finding'), 'Vulnerability finding styles');
assert(css.includes('.vuln-sev-badge'), 'Vulnerability severity badge styles');
assert(css.includes('.vuln-risk-critical'), 'Critical risk styling');
assert(css.includes('.vuln-risk-high'), 'High risk styling');
assert(css.includes('.vuln-risk-medium'), 'Medium risk styling');
assert(css.includes('.vuln-risk-low'), 'Low risk styling');
assert(css.includes('.vuln-rec'), 'Vulnerability recommendation styles');
assert(css.includes('.agent-vuln_assess'), 'Agent vuln_assess state styling');
assert(!css.includes('rickroll'), 'No rickroll in CSS');

// --- Audio File Tests ---
section('Audio File');

const audioPath = path.join(ROOT, 'audio/dtmf-fax-tones.wav');
const audioStat = fs.statSync(audioPath);
assert(audioStat.size > 100000, `Audio file is substantial (${(audioStat.size / 1024).toFixed(0)} KB)`);
assert(audioStat.size < 5000000, 'Audio file < 5MB');

const wavBuf = Buffer.alloc(44);
const fd = fs.openSync(audioPath, 'r');
fs.readSync(fd, wavBuf, 0, 44, 0);
fs.closeSync(fd);
assert(wavBuf.toString('ascii', 0, 4) === 'RIFF', 'WAV RIFF header');
assert(wavBuf.toString('ascii', 8, 12) === 'WAVE', 'WAV format marker');
assert(wavBuf.readUInt32LE(24) === 44100, 'WAV sample rate 44100');

// --- Manifest Tests ---
section('PWA Manifest');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
assert(manifest.name, 'Has name');
assert(manifest.short_name, 'Has short_name');
assert(manifest.display === 'standalone', 'Display standalone');
assert(manifest.icons && manifest.icons.length >= 2, 'Has 2+ icons');

// --- README Tests ---
section('README Content');

const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

assert(readme.includes('Personal use only'), 'Personal use disclaimer');
assert(readme.includes('educational purposes'), 'Educational mention');
assert(readme.includes('Bluefy'), 'Bluefy mention');
assert(readme.includes('DTMF'), 'DTMF documented');
assert(readme.includes('AirDrop'), 'AirDrop documented');
assert(readme.includes('Agentic'), 'Agentic documented');
assert(readme.includes('Silence'), 'Silence documented');
assert(!readme.includes('rickroll'), 'No rickroll in README');

// --- Summary ---
console.log(`\n=============================`);
console.log(`  Tests: ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`=============================\n`);

process.exit(failed > 0 ? 1 : 0);
