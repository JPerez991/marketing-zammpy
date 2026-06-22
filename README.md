# Marketing Zammpy

Automatización de marketing para **Zammpy** — plataforma de menús digitales para restaurantes en Medellín, Colombia.

## Funcionalidades

1. **Scraping Google Maps** — Extrae datos de restaurantes (nombre, teléfono, dirección, rating) por zonas de Medellín.
2. **WhatsApp Marketing** — Envía mensajes promocionales con imagen a los restaurantes usando `whatsapp-web.js`.
3. **Exportar a Excel** — Genera un archivo `.xlsx` estilizado en el escritorio.
4. **Google Sheets (opcional)** — Sincroniza los datos con una hoja de cálculo en Google Drive.
5. **Estado** — Muestra un resumen de restaurantes por estado y zona.

## Requisitos

- **Node.js** v18+ (probado en v22)
- **Google Chrome** instalado en `C:\Program Files\Google\Chrome\Application\chrome.exe` (o configurar ruta en `.env`)
- **WhatsApp** activo para escanear el código QR de autenticación
- Una **imagen promocional** en `C:\Users\O\Desktop\imagenZ.jpeg` (o configurar ruta en `.env`)

## Instalación

```bash
cd marketing-zammpy
npm install
```

## Configuración

Copia el archivo de ejemplo y ajusta los valores:

```bash
cp .env.example .env
```

Edita `.env` con tus rutas y preferencias:

| Variable | Descripción | Default |
|---|---|---|
| `CHROME_PATH` | Ruta al ejecutable de Chrome | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| `IMAGE_PATH` | Ruta a la imagen promocional | `C:\Users\O\Desktop\imagenZ.jpeg` |
| `SENDER_NUMBER` | Número de WhatsApp del remitente | `573502006159` |
| `MIN_DELAY_MS` | Delay mínimo entre mensajes (ms) | `45000` |
| `MAX_DELAY_MS` | Delay máximo entre mensajes (ms) | `65000` |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth (para Sheets) | — |
| `GOOGLE_CLIENT_SECRET` | Client Secret de Google OAuth (para Sheets) | — |

### Google Sheets (opcional)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto y activa **Google Sheets API**
3. Crea credenciales → **ID de cliente de OAuth** → **Aplicación de escritorio**
4. Descarga el JSON y guárdalo como `credentials.json` en la raíz del proyecto
5. Ejecuta la opción **6** del menú para autenticarte la primera vez

## Uso

```bash
npm start
```

Menú interactivo:

| Opción | Acción |
|---|---|
| 1 | Buscar restaurantes en Google Maps |
| 2 | Enviar mensajes por WhatsApp |
| 3 | Exportar a Excel |
| 4 | Ver estado actual |
| 5 | Ejecutar todo (Buscar + Excel) |
| 6 | Sincronizar con Google Sheets |
| 0 | Salir |

## Tests

```bash
npm test
```

## Estructura del proyecto

```
marketing-zammpy/
├── index.js              # Punto de entrada / menú CLI
├── package.json
├── .env.example          # Variables de entorno de ejemplo
├── .gitignore
├── src/
│   ├── config.js         # Configuración central
│   ├── utils.js          # Utilidades (JSON, teléfono, delays)
│   ├── scraper.js        # Scraping Google Maps
│   ├── sender.js         # Envío WhatsApp
│   ├── sheets.js         # Sincronización Google Sheets
│   ├── excel.js          # Exportación Excel
│   └── data/             # Archivos JSON de datos
└── test/
    └── utils.test.js     # Tests unitarios
```

## Licencia

Privado — Uso interno de Zammpy.
