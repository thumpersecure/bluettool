/**
 * CallHistory - In-memory call history storage and import/export
 * Supports CSV and JSON formats for iPhone call history import.
 */
(function (global) {
  'use strict';

  const storage = [];
  const DEFAULT_MAX_IMPORT_BYTES = 1024 * 1024; // 1MB
  const ALLOWED_IMPORT_EXTENSIONS = new Set(['.csv', '.json']);

  function getMaxImportBytes() {
    const configured = Number(global.BLUETTOOL_MAX_IMPORT_BYTES);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_IMPORT_BYTES;
  }

  function normalizeCallRecord(input) {
    const record = {
      date: String(input?.date || '').trim(),
      number: String(input?.number || '').trim(),
      duration: String(input?.duration || '').trim(),
      type: String(input?.type || '').trim(),
    };
    if (input?.name !== null && input?.name !== undefined && String(input.name).trim()) {
      record.name = String(input.name).trim();
    }
    return record;
  }

  function parseDelimitedLine(line, delimiter) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === delimiter && !inQuotes) {
        fields.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }

    if (inQuotes) {
      throw new Error('Malformed CSV input: unmatched quote');
    }

    fields.push(current.trim());
    return fields;
  }

  function inferDelimiter(lines) {
    const tabRows = lines.filter((line) => line.includes('\t')).length;
    const commaRows = lines.filter((line) => line.includes(',')).length;
    return tabRows > commaRows ? '\t' : ',';
  }

  /**
   * Parse CSV text. Supports header row (date,number,duration,type) or headerless.
   * Optional 5th column: name
   */
  function parseCSV(text) {
    if (typeof text !== 'string') return [];
    const trimmed = text.trim();
    if (!trimmed) return [];
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];

    const delimiter = inferDelimiter(lines);
    const rows = lines.map((line) => parseDelimitedLine(line, delimiter));

    const first = rows[0];
    const hasHeader =
      first.length >= 4 && /^(date|Date)$/i.test(first[0]) && /^(number|Number)$/i.test(first[1]);

    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows
      .map((row) =>
        normalizeCallRecord({
          date: row[0] || '',
          number: row[1] || '',
          duration: row[2] || '',
          type: row[3] || '',
          name: row[4] || '',
        }),
      )
      .filter((c) => c.date || c.number);
  }

  /**
   * Parse JSON array of call objects: {date, number, duration, type, name?}
   */
  function parseJSON(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error('Invalid JSON format');
    }
    if (!Array.isArray(data)) {
      throw new Error('JSON import must be an array of call objects');
    }
    return data.map((item) => normalizeCallRecord(item)).filter((c) => c.date || c.number);
  }

  function detectImportType(file) {
    const fileName = String(file?.name || '').toLowerCase();
    const extension = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
    if (ALLOWED_IMPORT_EXTENSIONS.has(extension)) {
      return extension === '.json' ? 'json' : 'csv';
    }
    const mime = String(file?.type || '').toLowerCase();
    if (mime.includes('json')) return 'json';
    if (mime.includes('csv') || mime.includes('text/plain') || mime.includes('text/tab-separated'))
      return 'csv';
    throw new Error('Unsupported file type. Please import CSV or JSON.');
  }

  /**
   * Read file and parse as CSV or JSON based on extension/content.
   */
  function importFromFile(file) {
    if (!file) {
      return Promise.reject(new Error('No file selected'));
    }
    if (Number(file.size || 0) > getMaxImportBytes()) {
      return Promise.reject(
        new Error(`File too large. Max supported size is ${getMaxImportBytes()} bytes.`),
      );
    }

    let importType;
    try {
      importType = detectImportType(file);
    } catch (err) {
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = String(e.target?.result || '');
          const calls = importType === 'json' ? parseJSON(text) : parseCSV(text);

          storage.push(...calls);
          resolve(calls.length);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse import file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  function sanitizeCsvField(value) {
    const normalized = String(value ?? '');
    const needsFormulaEscaping = /^[=+\-@]/.test(normalized);
    const escapedFormula = needsFormulaEscaping ? `'${normalized}` : normalized;
    const escapedQuotes = escapedFormula.replace(/"/g, '""');
    return `"${escapedQuotes}"`;
  }

  /**
   * Export calls to CSV string.
   */
  function exportToCSV() {
    const header = 'date,number,duration,type,name';
    const rows = storage.map((c) =>
      [c.date, c.number, c.duration, c.type, c.name || '']
        .map((v) => sanitizeCsvField(v))
        .join(','),
    );
    return [header, ...rows].join('\n');
  }

  /**
   * Return all calls.
   */
  function getCalls() {
    return [...storage];
  }

  /**
   * Clear all calls from storage.
   */
  function clearCalls() {
    storage.length = 0;
  }

  const CallHistory = {
    parseCSV,
    parseJSON,
    importFromFile,
    exportToCSV,
    getCalls,
    clearCalls,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CallHistory;
  } else {
    global.CallHistory = CallHistory;
  }
})(typeof self !== 'undefined' ? self : this);
