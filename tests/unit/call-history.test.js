const CallHistory = require('../../js/call-history.js');

describe('CallHistory', () => {
  beforeEach(() => {
    CallHistory.clearCalls();
    window.BLUETTOOL_MAX_IMPORT_BYTES = 1024 * 1024;
  });

  it('parses quoted CSV safely', () => {
    const csv = [
      'date,number,duration,type,name',
      '"2026-01-01","12345","00:30","incoming","Doe, John"',
      '"2026-01-02","67890","01:15","outgoing","Alice ""A"""',
    ].join('\n');

    const calls = CallHistory.parseCSV(csv);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe('Doe, John');
    expect(calls[1].name).toBe('Alice "A"');
  });

  it('throws on malformed CSV quotes', () => {
    expect(() => CallHistory.parseCSV('"date","number"\n"2026-01-01,"123"')).toThrow(
      /Malformed CSV input/i,
    );
  });

  it('parses JSON arrays and rejects invalid JSON shape', () => {
    const json = JSON.stringify([{ date: 'd', number: 'n', duration: '1', type: 'incoming' }]);
    expect(CallHistory.parseJSON(json)).toHaveLength(1);
    expect(() => CallHistory.parseJSON('{"date":"d"}')).toThrow(/must be an array/i);
    expect(() => CallHistory.parseJSON('{invalid')).toThrow(/Invalid JSON/i);
  });

  it('imports from JSON file and enforces max size', async () => {
    const valid = new File(
      [
        JSON.stringify([
          { date: '2026-01-01', number: '555', duration: '00:10', type: 'incoming' },
        ]),
      ],
      'calls.json',
      { type: 'application/json' },
    );
    const imported = await CallHistory.importFromFile(valid);
    expect(imported).toBe(1);
    expect(CallHistory.getCalls()).toHaveLength(1);

    window.BLUETTOOL_MAX_IMPORT_BYTES = 8;
    const tooLarge = new File([JSON.stringify([{ date: 'x' }])], 'calls.json', {
      type: 'application/json',
    });
    await expect(CallHistory.importFromFile(tooLarge)).rejects.toThrow(/File too large/i);
  });

  it('rejects unsupported and missing files', async () => {
    await expect(CallHistory.importFromFile(null)).rejects.toThrow(/No file selected/i);
    const unsupported = new File(['x'], 'calls.bin', { type: 'application/octet-stream' });
    await expect(CallHistory.importFromFile(unsupported)).rejects.toThrow(/Unsupported file type/i);
  });

  it('accepts text/plain csv fallback imports', async () => {
    const csvFile = new File(
      ['date,number,duration,type\n2026-01-01,123,00:01,incoming'],
      'calls',
      {
        type: 'text/plain',
      },
    );
    const count = await CallHistory.importFromFile(csvFile);
    expect(count).toBe(1);
  });

  it('handles read errors from FileReader', async () => {
    const original = global.FileReader;
    class BrokenReader {
      readAsText() {
        this.onerror();
      }
    }
    global.FileReader = BrokenReader;
    await expect(
      CallHistory.importFromFile(new File(['x'], 'calls.csv', { type: 'text/csv' })),
    ).rejects.toThrow(/Failed to read file/i);
    global.FileReader = original;
  });

  it('sanitizes spreadsheet formulas in CSV export', async () => {
    const file = new File(
      [
        JSON.stringify([
          {
            date: '2026-01-01',
            number: '=2+5',
            duration: '00:02',
            type: 'incoming',
            name: '@name',
          },
        ]),
      ],
      'calls.json',
      { type: 'application/json' },
    );
    await CallHistory.importFromFile(file);
    const csv = CallHistory.exportToCSV();
    expect(csv).toContain("'=2+5");
    expect(csv).toContain("'@name");
  });
});
