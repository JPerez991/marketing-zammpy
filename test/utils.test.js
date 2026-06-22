const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadJSON, saveJSON, normalizePhone, randomDelay } = require('../src/utils');

describe('loadJSON', () => {
  const tmpFile = path.join(os.tmpdir(), `test-load-${Date.now()}.json`);

  after(() => {
    try { fs.unlinkSync(tmpFile); } catch {}
  });

  it('returns empty array for non-existing file', () => {
    const result = loadJSON('./no-existe.json');
    assert.deepEqual(result, []);
  });

  it('returns parsed JSON for valid file', () => {
    fs.writeFileSync(tmpFile, JSON.stringify([1, 2, 3]));
    const result = loadJSON(tmpFile);
    assert.deepEqual(result, [1, 2, 3]);
  });

  it('returns empty array for invalid JSON', () => {
    fs.writeFileSync(tmpFile, '{ malo');
    const result = loadJSON(tmpFile);
    assert.deepEqual(result, []);
  });
});

describe('saveJSON', () => {
  const tmpDir = path.join(os.tmpdir(), `test-save-${Date.now()}`);

  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  });

  it('writes JSON file correctly', () => {
    const filePath = path.join(tmpDir, 'data.json');
    saveJSON(filePath, { a: 1, b: 2 });
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.equal(content, JSON.stringify({ a: 1, b: 2 }, null, 2));
  });

  it('creates directories if missing', () => {
    const nested = path.join(tmpDir, 'a', 'b', 'c.json');
    saveJSON(nested, []);
    assert.equal(fs.existsSync(nested), true);
  });
});

describe('normalizePhone', () => {
  it('returns empty for null/undefined', () => {
    assert.equal(normalizePhone(null), '');
    assert.equal(normalizePhone(undefined), '');
    assert.equal(normalizePhone(''), '');
  });

  it('keeps +57 numbers with correct length', () => {
    assert.equal(normalizePhone('+573001234567'), '+573001234567');
    assert.equal(normalizePhone('+5730012345678'), '+5730012345678');
  });

  it('adds + prefix to 57-prefixed numbers', () => {
    assert.equal(normalizePhone('573001234567'), '+573001234567');
  });

  it('adds +57 to 10-digit mobile numbers', () => {
    assert.equal(normalizePhone('3001234567'), '+573001234567');
  });

  it('adds +57350 to 7-digit numbers', () => {
    assert.equal(normalizePhone('1234567'), '+573501234567');
  });

  it('returns empty for unrecognized format', () => {
    assert.equal(normalizePhone('123'), '');
    assert.equal(normalizePhone('abc'), '');
  });

  it('strips non-digit characters', () => {
    assert.equal(normalizePhone('+57 (300) 123-4567'), '+573001234567');
  });
});

describe('randomDelay', () => {
  it('returns a number within range', () => {
    for (let i = 0; i < 100; i++) {
      const val = randomDelay(1000, 2000);
      assert.ok(val >= 1000 && val <= 2000, `${val} not in [1000, 2000]`);
    }
  });

  it('works with equal min/max', () => {
    assert.equal(randomDelay(5000, 5000), 5000);
  });
});
