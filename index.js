require('dotenv').config();
const readline = require('readline');
const { launchBrowser, scrapeZone } = require('./src/scraper');
const { connectWhatsApp, sendPending, printResumen } = require('./src/sender');
const { exportToExcel } = require('./src/excel');
const config = require('./src/config');
const { loadJSON, saveJSON } = require('./src/utils');

process.on('unhandledRejection', (reason) => {
  console.error(`\n⚠️ Error interno no manejado (el programa continúa): ${reason instanceof Error ? reason.message : reason}\n`);
});

process.on('uncaughtException', (err) => {
  console.error(`\n⚠️ Error crítico: ${err.message}\n`);
  console.error(err.stack);
});

let stopRequested = false;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

function onKeypress(str, key) {
  if (stopRequested) return;
  if ((key && key.name === 's') || str === 's' || str === 'S') {
    stopRequested = true;
    console.log('\n   ⏹ Tecla S detectada — deteniendo al finalizar el envío actual...\n');
  }
}

function setupStopKey() {
  stopRequested = false;
  process.stdin.on('keypress', onKeypress);
}

function removeStopKey() {
  process.stdin.removeListener('keypress', onKeypress);
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

function seleccionarCiudades() {
  console.log('\n' + '═'.repeat(50));
  console.log('  🏙️  SELECCIONAR CIUDADES');
  console.log('═'.repeat(50));
  console.log('');

  const ciudades = config.ciudades;
  for (let i = 0; i < ciudades.length; i++) {
    console.log(`  ${String(i + 1).padStart(2)}. ${ciudades[i]}`);
  }
  console.log('');
  console.log('   0. 🌎 Todas las ciudades');
  console.log('');
}

function parseSeleccion(input) {
  if (!input) return [];

  input = input.trim().toLowerCase();

  if (input === '0' || input === 't' || input === 'todas' || input === 'all' || input === 'todo') {
    return [...config.ciudades];
  }

  const partes = input.split(',').map(p => p.trim());
  const indices = new Set();

  for (const parte of partes) {
    if (parte.includes('-')) {
      const [inicio, fin] = parte.split('-').map(n => parseInt(n, 10));
      if (!isNaN(inicio) && !isNaN(fin)) {
        for (let i = inicio; i <= fin; i++) {
          indices.add(i);
        }
      }
    } else {
      const num = parseInt(parte, 10);
      if (!isNaN(num)) indices.add(num);
    }
  }

  const ciudades = [];
  for (const idx of indices) {
    const i = idx - 1;
    if (i >= 0 && i < config.ciudades.length) {
      ciudades.push(config.ciudades[i]);
    }
  }

  return ciudades;
}

async function showResumenFinal({ ciudades, enviados, errores, sinWA }) {
  console.log('\n═══════════════════════════════════════');
  console.log('  📊 RESUMEN FINAL');
  console.log('═══════════════════════════════════════');
  console.log(`   🏪 Ciudades procesadas: ${ciudades}`);
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

  seleccionarCiudades();
  const input = await ask('Selecciona ciudades (ej: 1,3,5 o 2-4 o 0 para todas): ');
  const ciudades = parseSeleccion(input);

  if (ciudades.length === 0) {
    console.log('\n⚠️ No seleccionaste ninguna ciudad válida.\n');
    return;
  }

  console.log(`\n📍 Ciudades a procesar (${ciudades.length}):`);
  for (const c of ciudades) {
    console.log(`   • ${c}`);
  }
  console.log('');

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

  let totalEnviados = 0;
  let totalErrores = 0;
  let totalSinWA = 0;
  let ciudadesProcesadas = 0;
  let procesoDetenido = false;

  for (const ciudad of ciudades) {
    if (stopRequested) {
      procesoDetenido = true;
      break;
    }

    ciudadesProcesadas++;
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📍 CIUDAD ${ciudadesProcesadas}/${ciudades.length}: ${ciudad}`);
    console.log(`${'─'.repeat(50)}\n`);

    const existing = loadJSON(config.restaurantesFile) || [];
    const nuevos = await scrapeZone(page, ciudad);
    console.log(`   Encontrados en página: ${nuevos.length}`);

    let agregados = 0;
    for (const r of nuevos) {
      const dupe = r.telefono
        ? existing.some(e => e.telefono === r.telefono)
        : existing.some(e => e.nombre === r.nombre && e.ciudad === ciudad);

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

    try {
      const result = await sendPending(client, { onStopCheck: () => stopRequested });
      printResumen(result);
      totalEnviados += result.enviados;
      totalErrores += result.errores;
      totalSinWA += result.sinWA;

      if (result.detenido) {
        procesoDetenido = true;
        break;
      }
    } catch (err) {
      console.error(`   ❌ Error inesperado en envíos: ${err.message}`);
    }
  }

  console.log('=== CERRANDO CHROME Y WHATSAPP ===\n');
  try { await browser.close(); } catch {}
  try { await client.destroy(); } catch {}

  removeStopKey();

  console.log(`✅ Proceso ${procesoDetenido ? 'detenido' : 'completado'}`);
  await showResumenFinal({
    ciudades: ciudadesProcesadas,
    enviados: totalEnviados,
    errores: totalErrores,
    sinWA: totalSinWA
  });

  const excelAnswer = await ask('📊 ¿Exportar a Excel? (s/n): ');
  if (excelAnswer === 's' || excelAnswer === 'si') {
    await exportToExcel();
  }
}

rl.on('close', () => {
  console.log('\n👋 ¡Hasta luego!\n');
  process.exit(0);
});

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
