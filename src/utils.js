const fs = require('fs');
const path = require('path');

function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (err) {
    console.error(`Error leyendo ${filePath}: ${err.message}`);
  }
  return [];
}

function saveJSON(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error guardando ${filePath}: ${err.message}`);
  }
}

function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+57') && digits.length >= 12) {
    return digits;
  }
  if (digits.startsWith('57') && digits.length >= 11) {
    return '+' + digits;
  }
  if (digits.length === 10) {
    return '+57' + digits;
  }
  if (digits.length === 7) {
    return '+57350' + digits;
  }
  return '';
}

function isMobilePhone(phone) {
  if (!phone) return false;
  const digits = phone.replace(/[^\d+]/g, '');
  let national = digits;
  if (digits.startsWith('+57')) {
    national = digits.slice(3);
  } else if (digits.startsWith('57')) {
    national = digits.slice(2);
  }
  return national.length >= 10 && national.startsWith('3');
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { loadJSON, saveJSON, normalizePhone, isMobilePhone, randomDelay, sleep };
