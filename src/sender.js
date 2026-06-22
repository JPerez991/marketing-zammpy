const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const config = require('./config');
const { loadJSON, saveJSON, randomDelay, sleep } = require('./utils');

async function connectWhatsApp() {
  console.log('=== CONECTANDO WHATSAPP ===\n');

  if (!fs.existsSync(config.imagePath)) {
    console.error(`❌ No se encontró la imagen: ${config.imagePath}`);
    console.log('   Asegúrate de que imagenZ.jpeg esté en el escritorio.\n');
    return null;
  }

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      executablePath: config.chromePath,
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  const readyPromise = new Promise((resolve, reject) => {
    client.on('qr', (qr) => {
      console.log('📱 Escanea este código QR con tu WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n⏳ Esperando escaneo...');
    });

    client.on('ready', () => {
      console.log('✅ WhatsApp conectado correctamente.\n');
      resolve();
    });

    client.on('auth_failure', (msg) => {
      reject(new Error(`Error de autenticación: ${msg}`));
    });

    client.on('disconnected', (reason) => {
      reject(new Error(`WhatsApp desconectado: ${reason}`));
    });
  });

  try {
    await client.initialize();
    await readyPromise;
    return client;
  } catch (err) {
    console.error(`❌ ${err.message}\n`);
    try { await client.destroy(); } catch {}
    return null;
  }
}

async function sendPending(client, { onStopCheck } = {}) {
  const restaurants = loadJSON(config.restaurantesFile) || [];
  const pendientes = restaurants.filter(r => r.estado === 'pendiente' && r.telefono);

  if (pendientes.length === 0) {
    console.log('   ✅ No hay restaurantes pendientes por contactar.\n');
    return { enviados: 0, errores: 0, sinWA: 0, detenido: false };
  }

  console.log(`   📋 Pendientes en esta zona: ${pendientes.length}\n`);

  const media = MessageMedia.fromFilePath(config.imagePath);
  let enviados = 0;
  let errores = 0;
  let sinWA = 0;
  let detenido = false;

  for (const r of pendientes) {
    if (onStopCheck && onStopCheck()) {
      console.log('   ⏹ Proceso detenido por el usuario.\n');
      detenido = true;
      break;
    }

    const chatId = r.telefono.includes('@c.us') ? r.telefono : `${r.telefono}@c.us`;

    try {
      console.log(`   📤 Enviando a: ${r.nombre} (${r.telefono})`);

      const caption = config.messageTemplate(r.nombre, r.dueno);
      await client.sendMessage(chatId, media, { caption });

      console.log(`   ✅ Enviado correctamente`);
      r.estado = 'enviado';
      enviados++;

      if (enviados + errores + sinWA < pendientes.length && !detenido) {
        const delay = randomDelay(config.minDelay, config.maxDelay);
        console.log(`   ⏳ Esperando ${Math.round(delay / 1000)} segundos...`);
        await sleep(delay);
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);

      if (err.message.includes('not registered') || err.message.includes('no longer exists')) {
        r.estado = 'sin_whatsapp';
        sinWA++;
      } else {
        r.estado = 'error';
        errores++;
      }

      await sleep(10000);
    }

    saveJSON(config.restaurantesFile, restaurants);
  }

  return { enviados, errores, sinWA, detenido };
}

function printResumen(result) {
  console.log(`   ───────────────────────────────`);
  console.log(`   ✅ Enviados:      ${result.enviados}`);
  console.log(`   ❌ Errores:       ${result.errores}`);
  console.log(`   📵 Sin WhatsApp:  ${result.sinWA}`);
  if (result.detenido) {
    console.log(`   ⏹ Detenido por usuario`);
  }
  console.log(`   ───────────────────────────────\n`);
}

module.exports = { connectWhatsApp, sendPending, printResumen };
