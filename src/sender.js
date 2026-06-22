const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const config = require('./config');
const { loadJSON, saveJSON, isMobilePhone, sleep } = require('./utils');

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

    if (!isMobilePhone(r.telefono)) {
      console.log(`   📵 ${r.nombre} (${r.telefono}) — número fijo, no tiene WhatsApp`);
      r.estado = 'sin_whatsapp';
      sinWA++;
      saveJSON(config.restaurantesFile, restaurants);
      continue;
    }

    const rawNumber = r.telefono.startsWith('+') ? r.telefono.slice(1) : r.telefono;

    let registeredId = null;
    let verified = false;
    try {
      registeredId = await client.getNumberId(rawNumber);
      verified = true;
    } catch (err) {
      console.log(`   ⚠️ No se pudo verificar ${r.nombre}, intentando envío directo...`);
      console.error(`      Detalle: ${err.stack || err.message}`);
    }

    if (verified && !registeredId) {
      console.log(`   📵 ${r.nombre} (${r.telefono}) — no registrado en WhatsApp`);
      r.estado = 'sin_whatsapp';
      sinWA++;
      saveJSON(config.restaurantesFile, restaurants);
      continue;
    }

    const chatId = registeredId ? registeredId._serialized : (r.telefono.includes('@c.us') ? r.telefono : `${r.telefono}@c.us`);

    try {
      console.log(`   📤 Enviando a: ${r.nombre} (${r.telefono})`);

      await client.sendMessage(chatId, media, {
        caption: config.messageText
      });

      console.log(`   ✅ Enviado correctamente`);
      r.estado = 'enviado';
      enviados++;
    } catch (err) {
      console.log(`   ❌ Error al enviar a ${r.nombre}: ${err.message}`);
      console.error(`      Detalle: ${err.stack || err.message}`);

      if (err.message && (err.message.includes('not registered') || err.message.includes('no longer exists'))) {
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
