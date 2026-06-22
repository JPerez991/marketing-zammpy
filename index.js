require('dotenv').config();
const readline = require('readline');
const { launchBrowser, scrapeZone } = require('./src/scraper');
const { connectWhatsApp, sendPending, printResumen } = require('./src/sender');
const { exportToExcel } = require('./src/excel');
const config = require('./src/config');
const { loadJSON, saveJSON } = require('./src/utils');

let stopRequested = false;

function setupStopKey() {
  stopRequested = false;
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key && key.name === 's') {
      stopRequested = true;
      console.log('\n   ⏹ Tecla S detectada — deteniendo al finalizar el envío actual...\n');
    }
  });
}

function removeStopKey() {
  try {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.removeAllListeners('keypress');
  } catch {}
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function showMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('  🍽️  ZAMMPY - Marketing Automation');
  console.log('  Menú Digital para Restaurantes');
  console.log('='.repeat(50));
  console.log('');
  console.log('  1️⃣  🚀 Iniciar proceso completo');
  console.log('      (Buscar en Maps + Enviar WhatsApp)');
  console.log('');
  console.log('  0️⃣  ❌ Salir');
  console.log('');
  console.log('  💡 Presiona S durante el proceso para detener');
  console.log('');
}

async function showResumenFinal({ zonas, enviados, errores, sinWA }) {
  console.log('\n═══════════════════════════════════════');
  console.log('  📊 RESUMEN FINAL');
  console.log('═══════════════════════════════════════');
  console.log(`   🏪 Zonas procesadas:  ${zonas}`);
  if (enviados > 0) console.log(`   ✅ WhatsApp enviados: ${enviados}`);
  if (errores > 0) console.log(`   ❌ Errores:           ${errores}`);
  if (sinWA > 0) console.log(`   📵 Sin WhatsApp:      ${sinWA}`);
  console.log('═══════════════════════════════════════\n');
}

async function iniciarProceso() {
  console.log('\n' + '='.repeat(50));
  console.log('  🚀 INICIANDO PROCESO COMPLETO');
  console.log('='.repeat(50));
  console.log('  Presiona S en cualquier momento para detener\n');

  setupStopKey();

  const client = await connectWhatsApp();
  if (!client) {
    removeStopKey();
    return;
  }

  let browser, page;
  try {
    console.log('=== INICIANDO CHROME PARA SCRAPING ===\n');
    const launched = await launchBrowser();
    browser = launched.browser;
    page = launched.page;
  } catch (err) {
    console.error(`❌ Error al abrir Chrome: ${err.message}`);
    console.log('   Verifica la ruta de Chrome en .env o config.js\n');
    await client.destroy();
    removeStopKey();
    return;
  }

  const existing = loadJSON(config.restaurantesFile) || [];
  let totalEnviados = 0;
  let totalErrores = 0;
  let totalSinWA = 0;
  let zonasProcesadas = 0;
  let procesoDetenido = false;

  for (const zone of config.zones) {
    if (stopRequested) {
      procesoDetenido = true;
      break;
    }

    zonasProcesadas++;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📍 ZONA ${zonasProcesadas}/${config.zones.length}: ${zone}`);
    console.log(`${'─'.repeat(50)}\n`);

    const nuevos = await scrapeZone(page, zone);
    console.log(`   Encontrados en página: ${nuevos.length}`);

    let agregados = 0;
    for (const r of nuevos) {
      const dupe = r.telefono
        ? existing.some(e => e.telefono === r.telefono)
        : existing.some(e => e.nombre === r.nombre && e.zona === zone);

      if (!dupe) {
        existing.push(r);
        agregados++;
      }
    }

    saveJSON(config.restaurantesFile, existing);
    console.log(`   Nuevos agregados: ${agregados}`);
    console.log(`   Total acumulado: ${existing.length}\n`);

    if (stopRequested) {
      procesoDetenido = true;
      break;
    }

    const result = await sendPending(client, { onStopCheck: () => stopRequested });
    printResumen(result);
    totalEnviados += result.enviados;
    totalErrores += result.errores;
    totalSinWA += result.sinWA;

    if (result.detenido) {
      procesoDetenido = true;
      break;
    }
  }

  console.log('=== CERRANDO CHROME Y WHATSAPP ===\n');
  try { await browser.close(); } catch {}
  try { await client.destroy(); } catch {}

  removeStopKey();

  console.log(`✅ Proceso ${procesoDetenido ? 'detenido' : 'completado'}`);
  await showResumenFinal({
    zonas: zonasProcesadas,
    enviados: totalEnviados,
    errores: totalErrores,
    sinWA: totalSinWA
  });

  const excelAnswer = await ask('📊 ¿Exportar a Excel? (s/n): ');
  if (excelAnswer === 's' || excelAnswer === 'si') {
    await exportToExcel();
  }
}

async function main() {
  let running = true;

  while (running) {
    showMenu();
    const choice = await ask('Selecciona una opción: ');

    switch (choice) {
      case '1':
        await iniciarProceso();
        break;

      case '0':
      case 'salir':
      case 'exit':
        console.log('\n👋 ¡Hasta luego!\n');
        running = false;
        break;

      default:
        console.log('\n⚠️ Opción no válida. Intenta de nuevo.\n');
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Error inesperado:', err);
  process.exit(1);
});
