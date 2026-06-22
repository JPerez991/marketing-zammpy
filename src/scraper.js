const puppeteer = require('puppeteer-core');
const config = require('./config');
const { loadJSON, saveJSON, normalizePhone, sleep } = require('./utils');

async function launchBrowser() {
  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  );
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  return { browser, page };
}

async function scrapeAllZones() {
  console.log('\n=== BUSCANDO RESTAURANTES EN GOOGLE MAPS ===\n');

  const { browser, page } = await launchBrowser();
  const existing = loadJSON(config.restaurantesFile) || [];
  let total = existing.length;

  for (const zone of config.ciudades) {
    console.log(`📍 Zona: ${zone}`);
    const nuevos = await scrapeZone(page, zone);
    console.log(`   Encontrados: ${nuevos.length}`);

    for (const r of nuevos) {
      const dupe = r.telefono
        ? existing.some(e => e.telefono === r.telefono)
        : existing.some(e => e.nombre === r.nombre && e.ciudad === zone);

      if (!dupe) {
        existing.push(r);
        total++;
      }
    }

    saveJSON(config.restaurantesFile, existing);
    console.log(`   Total acumulado: ${total}\n`);
  }

  await browser.close();
  console.log(`✅ Scraping completado. Total: ${total} restaurantes\n`);
  return existing;
}

async function scrapeZone(page, zone) {
  const query = `restaurantes en ${zone}`;
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}/`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  } catch (err) {
    console.log(`   ⚠️ Error al cargar: ${err.message}`);
    return [];
  }

  try {
    await page.waitForSelector('[role="feed"]', { timeout: 15000 });
  } catch {
    console.log('   ⚠️ No se encontraron resultados');
    return [];
  }

  await sleep(3000);
  await scrollResults(page);

  const results = await page.evaluate(() => {
    const articles = document.querySelectorAll('[role="feed"] > [role="article"], [role="feed"] > div > [role="article"]');
    const items = [];
    for (const article of articles) {
      const link = article.querySelector('a');
      if (!link) continue;
      const nameEl = link.querySelector('.fontHeadlineSmall') || link.querySelector('h3');
      const name = nameEl ? nameEl.textContent.trim() : '';
      if (!name) continue;
      const href = link.href || '';
      items.push({ name, href });
    }
    return items;
  });

  console.log(`   Resultados en página: ${results.length}`);

  const places = [];
  const seen = new Set();

  for (let i = 0; i < Math.min(results.length, 50); i++) {
    try {
      const idx = await page.evaluate(() => {
        const articles = document.querySelectorAll('[role="feed"] > [role="article"], [role="feed"] > div > [role="article"]');
        for (let j = 0; j < articles.length; j++) {
          const link = articles[j].querySelector('a');
          if (!link) continue;
          const nameEl = link.querySelector('.fontHeadlineSmall') || link.querySelector('h3');
          if (!nameEl) continue;
          link.scrollIntoView({ block: 'center' });
          return j;
        }
        return -1;
      });

      if (idx === -1) break;

      const articles = await page.$$('[role="feed"] > [role="article"], [role="feed"] > div > [role="article"]');
      if (i >= articles.length) break;

      const link = await articles[i].$('a');
      if (!link) continue;

      await link.click();
      await sleep(3000);

      const data = await extractPlaceData(page);
      const phone = normalizePhone(data.phone);

      if (data.name && !seen.has(data.name + zone)) {
        seen.add(data.name + zone);
        places.push({
          nombre: data.name,
          dueno: data.dueno || '',
          telefono: phone,
          direccion: data.address,
          ciudad: zone,
          rating: data.rating,
          reviews: data.reviews,
          fecha: new Date().toISOString(),
          estado: phone ? 'pendiente' : 'sin_telefono'
        });
      }
    } catch (err) {
      console.log(`   ⚠️ Error item ${i + 1}: ${err.message}`);
    }
  }

  return places;
}

async function scrollResults(page) {
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const prev = await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        if (!feed) return 0;
        feed.scrollTop = feed.scrollHeight;
        return feed.scrollHeight;
      });

      await sleep(2000);

      const curr = await page.evaluate(() => {
        const feed = document.querySelector('[role="feed"]');
        return feed ? feed.scrollHeight : 0;
      });

      if (curr === prev) break;
    }
  } catch (err) {
    console.log(`   ⚠️ Error al hacer scroll: ${err.message}`);
  }
}

async function extractPlaceData(page) {
  await sleep(2500);

  return await page.evaluate(() => {
    const text = (el) => el ? el.textContent.trim() : '';

    const name = text(document.querySelector('h1'))
      || text(document.querySelector('[role="main"] h1'))
      || '';

    let phone = '';
    const phoneSelectors = [
      'button[data-tooltip="Copy phone number"]',
      'button[data-tooltip="Copiar número telefónico"]',
      '[data-item-id="phone:tel"]',
      'a[data-item-id*="phone"]',
      'button[data-tooltip*="teléfono"]',
      'button[data-tooltip*="phone"]',
      'a[href^="tel:"]',
      '[aria-label*="teléfono"]',
      '[aria-label*="phone"]',
      '[data-attrid*="phone"]',
      '[data-attrid*="tel"]',
      'button[data-value*="tel"]',
      'div[data-value*="tel"]'
    ];
    for (const sel of phoneSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const raw = el.getAttribute('data-phone-number')
          || el.getAttribute('href')?.replace('tel:', '')
          || el.getAttribute('data-value')
          || el.getAttribute('aria-label')
          || el.textContent
          || el.innerText
          || '';
        const cleaned = raw.replace(/[^\d+]/g, '');
        if (cleaned && cleaned.replace(/[^\d]/g, '').length >= 7) {
          phone = cleaned;
          break;
        }
      }
      if (phone) break;
    }

    if (!phone) {
      const allElements = document.querySelectorAll('[class*="fontBodyMedium"], [class*="CsEnBe"], [jsname*="phone"]');
      for (const el of allElements) {
        const raw = el.textContent || el.innerText || '';
        const cleaned = raw.replace(/[^\d+]/g, '');
        if (cleaned.replace(/[^\d]/g, '').length >= 7) {
          phone = cleaned;
          break;
        }
      }
    }

    let address = '';
    const addrSelectors = [
      '[data-item-id="address"]',
      'button[data-tooltip*="dirección"]',
      'button[data-tooltip*="address"]',
      '[aria-label*="dirección"]',
      '[aria-label*="address"]'
    ];
    for (const sel of addrSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        address = el.textContent || el.getAttribute('aria-label') || '';
        address = address.replace(/^(Dirección|Address)\s*/i, '').trim();
        if (address) break;
      }
    }

    let dueno = '';
    const bodyText = document.body.innerText || '';
    const ownerRegex = /(?:propietario|dueño|owner|administrador|gerente|encargado|contacto)\s*:?\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/i;
    const match = bodyText.match(ownerRegex);
    if (match && match[1]) {
      dueno = match[1].trim().replace(/\s+/g, ' ');
      if (dueno.length > 60) dueno = '';
    }

    const ratingEl = document.querySelector('[role="img"][aria-label*="estrella"], [role="img"][aria-label*="star"]');
    const rating = ratingEl ? ratingEl.getAttribute('aria-label') || '' : '';
    const ratingNum = rating.match(/([\d.]+)/)?.[1] || '';
    const reviews = rating.match(/(\d+)\s*(reseñas?|review)/i)?.[1] || '';

    return { name, phone, address, rating: ratingNum, reviews, dueno };
  });
}

async function scrapeAndSave() {
  return await scrapeAllZones();
}

module.exports = { launchBrowser, scrapeAllZones, scrapeZone, scrapeAndSave };
