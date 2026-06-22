const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { loadJSON } = require('./utils');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'];
const SHEET_NAME = 'Zammpy - Restaurantes Medellín';

async function authorize() {
  if (fs.existsSync(config.tokenFile)) {
    const token = JSON.parse(fs.readFileSync(config.tokenFile, 'utf-8'));
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || '',
      process.env.GOOGLE_CLIENT_SECRET || ''
    );
    auth.setCredentials(token);

    if (auth.isTokenExpiring()) {
      const { credentials } = await auth.refreshAccessToken();
      fs.writeFileSync(config.tokenFile, JSON.stringify(credentials, null, 2));
      auth.setCredentials(credentials);
    }

    return auth;
  }

  if (!fs.existsSync(config.credsFile)) {
    console.log('\n⚠️  No se encontró credentials.json');
    console.log('\nPara conectar con Google Sheets necesitas:');
    console.log('1. Ir a https://console.cloud.google.com/');
    console.log('2. Crear un proyecto nuevo');
    console.log('3. Activar "Google Sheets API"');
    console.log('4. Ir a "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth"');
    console.log('5. Tipo: "Aplicación de escritorio"');
    console.log('6. Descargar el JSON y guardarlo como "credentials.json" en:');
    console.log(`   ${config.credsFile}\n`);
    return null;
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || '',
      process.env.GOOGLE_CLIENT_SECRET || ''
    );

    const credentials = JSON.parse(fs.readFileSync(config.credsFile, 'utf-8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    auth._clientId = client_id;
    auth._clientSecret = client_secret;
    auth._redirectUri = redirect_uris[0];

    const url = auth.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES
    });

    console.log('\n🔑 Abre este enlace en tu navegador:');
    console.log(url);
    console.log('\n📝 Después de autorizar, Google te mostrará un código.');
    console.log('   Pégalo aquí:\n');

    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const code = await new Promise((resolve) => {
      rl.question('Código de autorización: ', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);
    fs.writeFileSync(config.tokenFile, JSON.stringify(tokens, null, 2));
    console.log('✅ Token guardado en token.json\n');

    return auth;
  } catch (err) {
    console.error('❌ Error de autorización:', err.message);
    return null;
  }
}

async function syncToSheets() {
  console.log('=== GOOGLE SHEETS: Sincronizando datos ===\n');

  const restaurants = loadJSON(config.restaurantesFile) || [];

  if (restaurants.length === 0) {
    console.log('⚠️ No hay restaurantes para sincronizar. Ejecuta primero la opción 1 (Scraping).');
    return;
  }

  const auth = await authorize();
  if (!auth) return;

  const sheets = google.sheets({ version: 'v4', auth });
  let spreadsheetId = null;

  try {
    const response = await sheets.spreadsheets.list();
    const existing = response.data.files?.find(f => f.name === SHEET_NAME);
    if (existing) {
      spreadsheetId = existing.id;
      console.log(`📄 Hoja existente encontrada: ${SHEET_NAME}`);
    }
  } catch (err) {
    console.log('   Buscando hoja existente...');
  }

  if (!spreadsheetId) {
    const createResponse = await sheets.spreadsheets.create({
      resource: {
        properties: { title: SHEET_NAME },
        sheets: [{ properties: { title: 'Restaurantes' } }]
      }
    });
    spreadsheetId = createResponse.data.spreadsheetId;
    console.log(`📄 Hoja creada en Google Drive`);
  }

  const headers = [
    'Nombre',
    'Teléfono',
    'Dirección',
    'Zona',
    'Rating',
    'Fecha Extracción',
    'Estado WhatsApp'
  ];

  const rows = [headers];
  for (const r of restaurants) {
    const estadoMap = {
      'pendiente': 'Pendiente',
      'enviado': '✅ Enviado',
      'sin_telefono': '📵 Sin teléfono',
      'sin_whatsapp': '📵 Sin WhatsApp',
      'error': '❌ Error'
    };

    rows.push([
      r.nombre || '',
      r.telefono || '',
      r.direccion || '',
      r.zona || '',
      r.rating || '',
      r.fecha ? new Date(r.fecha).toLocaleDateString('es-CO') : '',
      estadoMap[r.estado] || r.estado || 'Pendiente'
    ]);
  }

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Restaurantes'
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Restaurantes!A1',
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });

    console.log(`✅ ${restaurants.length} registros sincronizados en Google Sheets.`);
    console.log(`   Abre: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  } catch (err) {
    console.error('❌ Error al actualizar la hoja:', err.message);
  }
}

module.exports = { syncToSheets };
