const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const config = require('./config');
const { loadJSON, saveJSON, randomDelay, sleep } = require('./utils');

async function sendMessages() {
  console.log('=== WHATSAPP: Enviando mensajes a restaurantes ===\n');

  const restaurants = loadJSON(config.restaurantesFile) || [];
  const pendientes = restaurants.filter(r => r.estado === 'pendiente' && r.telefono);

  if (pendientes.length === 0) {
    console.log('✅ No hay restaurantes pendientes por contactar.');
    return;
  }

  console.log(`Restaurantes para contactar hoy: ${pendientes.length}\n`);

  if (!fs.existsSync(config.imagePath)) {
    console.error(`❌ No se encontró la imagen: ${config.imagePath}`);
    console.log('   Asegúrate de que imagenZ.jpeg esté en el escritorio.');
    return;
  }

  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      executablePath: config.chromePath,
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    console.log('📱 Escanea este código QR con tu WhatsApp (Zammpy):\n');
    qrcode.generate(qr, { small: true });
    console.log('\n✅ Después de escanear, el envío comenzará automáticamente.');
  });

  client.on('ready', async () => {
    console.log('✅ WhatsApp conectado correctamente.\n');

    const media = MessageMedia.fromFilePath(config.imagePath);
    let enviados = 0;
    let errores = 0;
    let sinWA = 0;

    for (const r of pendientes) {
      const chatId = r.telefono.includes('@c.us') ? r.telefono : `${r.telefono}@c.us`;

      try {
        console.log(`📤 Enviando a: ${r.nombre} (${r.telefono})`);

        await client.sendMessage(chatId, media, {
          caption: config.messageText
        });

        console.log(`   ✅ Enviado correctamente`);
        r.estado = 'enviado';
        enviados++;

        if (enviados < pendientes.length) {
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

    console.log(`\n═══════════════════════════════════════`);
    console.log(`📊 RESUMEN DE ENVÍO:`);
    console.log(`   ✅ Enviados: ${enviados}`);
    console.log(`   ❌ Errores: ${errores}`);
    console.log(`   📵 Sin WhatsApp: ${sinWA}`);
    console.log(`   📋 Total procesados: ${pendientes.length}`);
    console.log(`═══════════════════════════════════════\n`);

    await client.destroy();
    process.exit(0);
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
    process.exit(1);
  });

  client.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp desconectado:', reason);
    process.exit(1);
  });

  await client.initialize();
}

async function sendAndSave() {
  return await sendMessages();
}

module.exports = { sendMessages, sendAndSave };
