const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  dataDir: path.join(__dirname, 'data'),
  restaurantesFile: path.join(__dirname, 'data', 'restaurantes.json'),
  enviadosFile: path.join(__dirname, 'data', 'enviados.json'),
  credsFile: path.join(__dirname, '..', 'credentials.json'),
  tokenFile: path.join(__dirname, '..', 'token.json'),

  imagePath: process.env.IMAGE_PATH || 'C:\\Users\\O\\Desktop\\imagenZ.jpeg',
  chromePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  senderNumber: process.env.SENDER_NUMBER || '573502006159',

  minDelay: parseInt(process.env.MIN_DELAY_MS, 10) || 45000,
  maxDelay: parseInt(process.env.MAX_DELAY_MS, 10) || 65000,

  ciudades: [
    'Bogotá',
    'Medellín',
    'Cali',
    'Barranquilla',
    'Cartagena',
    'Bucaramanga',
    'Pereira',
    'Santa Marta',
    'Cúcuta',
    'Ibagué',
    'Villavicencio',
    'Manizales',
    'Pasto',
    'Neiva',
    'Armenia'
  ],

  messageText: `Le comparto una demostración de Zammpy, una plataforma de menús digitales para restaurantes que puede personalizarse con los colores y estilo de su marca.

📱 Demo: https://app.zammpy.com/preview/demo
🌐 Web: https://www.zammpy.com/
📷 Instagram: https://www.instagram.com/zammpy.app/

Si le interesa, los primeros negocios en unirse pueden acceder a 15 días gratis sin necesidad de tarjeta de crédito.

Si tiene alguna duda o desea más información, con gusto le ayudamos`
};
