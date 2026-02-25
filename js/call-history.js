/**
 * CallHistory - In-memory call history storage and import/export
 * Supports CSV and JSON formats for iPhone call history import.
 */
(function (global) {
  'use strict';

  const storage = [];

  /**
   * Parse CSV text. Supports header row (date,number,duration,type) or headerless.
   * Optional 5th column: name
   */
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return [];

    const rows = lines.map(line => {
      const parts = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if ((c === ',' && !inQuotes) || c === '\t') {
          parts.push(current.trim());
          current = '';
        } else {
          current += c;
        }
      }
      parts.push(current.trim());
      return parts;
    });

    const first = rows[0];
    const hasHeader = first.length >= 4 &&
      /^(date|Date)$/i.test(first[0]) &&
      /^(number|Number)$/i.test(first[1]);

    const dataRows = hasHeader ? rows.slice(1) : rows;

    return dataRows.map(row => {
      const date = row[0] || '';
      const number = row[1] || '';
      const duration = row[2] || '';
      const type = row[3] || '';
      const name = row[4] || undefined;
      return { date, number, duration, type, ...(name && { name }) };
    }).filter(c => c.date || c.number);
  }

  /**
   * Parse JSON array of call objects: {date, number, duration, type, name?}
   */
  function parseJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return [];
    return data.map(item => ({
      date: String(item.date || ''),
      number: String(item.number || ''),
      duration: String(item.duration || ''),
      type: String(item.type || ''),
      ...(item.name != null && { name: String(item.name) })
    }));
  }

  /**
   * Read file and parse as CSV or JSON based on extension/content.
   */
  function importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const name = (file.name || '').toLowerCase();
          let calls;

          if (name.endsWith('.json')) {
            calls = parseJSON(text);
          } else {
            calls = parseCSV(text);
          }

          storage.push(...calls);
          resolve(calls.length);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Export calls to CSV string.
   */
  function exportToCSV() {
    const header = 'date,number,duration,type,name';
    const rows = storage.map(c =>
      [c.date, c.number, c.duration, c.type, c.name || '']
        .map(v => (v.includes(',') || v.includes('"') ? `"${String(v).replace(/"/g, '""')}"` : v))
        .join(',')
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
    clearCalls
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CallHistory;
  } else {
    global.CallHistory = CallHistory;
  }
})(typeof self !== 'undefined' ? self : this);
