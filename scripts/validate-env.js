#!/usr/bin/env node

/**
 * Validates optional .env values against a strict schema.
 * If .env is absent, validation succeeds using defaults from .env.example.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
}

function isBooleanString(value) {
  return value === 'true' || value === 'false';
}

function isPositiveIntegerString(value) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function validate(env) {
  const errors = [];

  if (env.BLUETTOOL_APP_URL && !/^https?:\/\/.+/i.test(env.BLUETTOOL_APP_URL)) {
    errors.push('BLUETTOOL_APP_URL must be an absolute http(s) URL.');
  }

  if (env.BLUETTOOL_LOG_LEVEL && !LOG_LEVELS.has(env.BLUETTOOL_LOG_LEVEL)) {
    errors.push('BLUETTOOL_LOG_LEVEL must be one of: debug, info, warn, error.');
  }

  if (env.BLUETTOOL_ENABLE_TELEMETRY && !isBooleanString(env.BLUETTOOL_ENABLE_TELEMETRY)) {
    errors.push('BLUETTOOL_ENABLE_TELEMETRY must be true or false.');
  }

  if (env.BLUETTOOL_MAX_IMPORT_BYTES && !isPositiveIntegerString(env.BLUETTOOL_MAX_IMPORT_BYTES)) {
    errors.push('BLUETTOOL_MAX_IMPORT_BYTES must be a positive integer.');
  }

  return errors;
}

const parsed = parseEnvFile(ENV_PATH);
const errors = validate(parsed);

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[env] ${error}`);
  }
  process.exit(1);
}

console.log('[env] configuration valid');
