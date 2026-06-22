require('dotenv').config();
const readline = require('readline');
const { scrapeAndSave } = require('./src/scraper');
const { sendAndSave } = require('./src/sender');
const { exportToExcel } = require('./src/excel');
const { syncToSheets } = require('./src/sheets');
const { loadJSON } = require('./src/utils');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function showMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('  🍽️  ZAMMPY - Marketing Automation');
  console.log('  Menú Digital para Restaurantes');
  console.log('='.repeat(50));
  console.log('');
  console.log('  1️⃣  Buscar restaurantes en Google Maps');
  console.log('  2️⃣  Enviar mensajes por WhatsApp');
  console.log('  3️⃣  Exportar a Excel (escritorio)');
  console.log('  4️⃣  Ver estado actual');
  console.log('  5️⃣  Ejecutar todo (Buscar + Excel)');
  console.log('  6️⃣  Sincronizar con Google Sheets');
  console.log('');
  console.log('  0️⃣  Salir');
  console.log('');
}

async function showStatus() {
  console.log('\n=== ESTADO ACTUAL ===\n');

  const restaurants = loadJSON('./src/data/restaurantes.json') || [];

  if (restaurants.length === 0) {
    console.log('📭 No hay restaurantes registrados. Ejecuta la opción 1 primero.\n');
    return;
  }

  const pendientes = restaurants.filter(r => r.estado === 'pendiente').length;
  const enviados = restaurants.filter(r => r.estado === 'enviado').length;
  const sinTelefono = restaurants.filter(r => r.estado === 'sin_telefono').length;
  const sinWA = restaurants.filter(r => r.estado === 'sin_whatsapp').length;
  const errores = restaurants.filter(r => r.estado === 'error').length;
  const conWhatsApp = restaurants.filter(r => r.telefono && r.estado !== 'enviado').length;

  console.log(`📊 Total restaurantes: ${restaurants.length}`);
  console.log(`   📝 Pendientes:       ${pendientes}`);
  console.log(`   ✅ Enviados:         ${enviados}`);
  console.log(`   📵 Sin teléfono:     ${sinTelefono}`);
  console.log(`   📵 Sin WhatsApp:     ${sinWA}`);
  console.log(`   ❌ Error:            ${errores}`);
  console.log(`   📋 Listos para enviar: ${conWhatsApp}`);
  console.log('');

  const zonas = {};
  for (const r of restaurants) {
    zonas[r.zona] = (zonas[r.zona] || 0) + 1;
  }
  console.log('📍 Restaurantes por zona:');
  for (const [zona, count] of Object.entries(zonas).sort()) {
    console.log(`   ${zona}: ${count}`);
  }
  console.log('');
}

async function main() {
  let running = true;

  while (running) {
    showMenu();
    const choice = await prompt('Selecciona una opción: ');

    switch (choice) {
      case '1':
        console.log('\n');
        await scrapeAndSave();
        break;

      case '2':
        console.log('\n');
        await sendAndSave();
        break;

      case '3':
        console.log('\n');
        await exportToExcel();
        break;

      case '4':
        await showStatus();
        break;

      case '5':
        console.log('\n');
        console.log('=== EJECUTANDO TODO ===\n');
        await scrapeAndSave();
        console.log('\n');
        await exportToExcel();
        break;

      case '6':
        console.log('\n');
        await syncToSheets();
        break;

      case '0':
        console.log('\n👋 ¡Hasta luego!\n');
        running = false;
        break;

      default:
        console.log('\n⚠️ Opción no válida. Intenta de nuevo.\n');
    }
  }

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});
