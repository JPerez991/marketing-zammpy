const ExcelJS = require('exceljs');
const path = require('path');
const { loadJSON } = require('./utils');

const outputPath = path.join('C:\\Users\\O\\Desktop', 'Zammpy - Restaurantes Medellín.xlsx');

async function exportToExcel() {
  console.log('=== EXCEL: Exportando datos ===\n');

  const restaurants = loadJSON('./src/data/restaurantes.json') || [];

  if (restaurants.length === 0) {
    console.log('⚠️ No hay restaurantes para exportar. Ejecuta primero la opción 1.');
    return;
  }

  const workbook = new ExcelJS.Workbook();

  if (await fileExists(outputPath)) {
    await workbook.xlsx.readFile(outputPath);
    console.log('📄 Archivo existente actualizado');
  }

  let worksheet = workbook.getWorksheet('Restaurantes');
  if (!worksheet) {
    worksheet = workbook.addWorksheet('Restaurantes', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = [
      { header: 'Nombre', key: 'nombre', width: 40 },
      { header: 'Teléfono', key: 'telefono', width: 18 },
      { header: 'Dirección', key: 'direccion', width: 45 },
      { header: 'Ciudad', key: 'ciudad', width: 20 },
      { header: 'Rating', key: 'rating', width: 10 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Estado', key: 'estado', width: 18 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A73E8' } };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.commit();
  }

  const existingPhones = new Set();
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const phone = row.getCell(2).value;
      if (phone) existingPhones.add(String(phone));
    }
  });

  let added = 0;
  for (const r of restaurants) {
    if (r.telefono && existingPhones.has(r.telefono)) continue;
    if (!r.telefono && existingPhones.has(r.nombre)) continue;

    const estadoMap = {
      'pendiente': 'Pendiente',
      'enviado': 'Enviado',
      'sin_telefono': 'Sin teléfono',
      'sin_whatsapp': 'Sin WhatsApp',
      'error': 'Error'
    };

    worksheet.addRow({
      nombre: r.nombre || '',
      telefono: r.telefono || '',
      direccion: r.direccion || '',
      ciudad: r.ciudad || '',
      rating: r.rating || '',
      fecha: r.fecha ? new Date(r.fecha).toLocaleDateString('es-CO') : '',
      estado: estadoMap[r.estado] || r.estado || 'Pendiente'
    });

    existingPhones.add(r.telefono || r.nombre);
    added++;
  }

  if (added > 0) {
    const stateColors = {
      'Enviado': { fgColor: { argb: 'FFE6F4EA' }, font: { color: { argb: 'FF137333' } } },
      'Pendiente': { fgColor: { argb: 'FFFEF7E0' }, font: { color: { argb: 'FFE37400' } } },
      'Sin teléfono': { fgColor: { argb: 'FFFCE8E6' }, font: { color: { argb: 'FFC5221F' } } },
      'Sin WhatsApp': { fgColor: { argb: 'FFFCE8E6' }, font: { color: { argb: 'FFC5221F' } } },
      'Error': { fgColor: { argb: 'FFFCE8E6' }, font: { color: { argb: 'FFC5221F' } } }
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const estado = String(row.getCell(7).value || '');
        const style = stateColors[estado];
        if (style) {
          row.getCell(7).fill = { type: 'pattern', pattern: 'solid', ...style.fgColor };
          row.getCell(7).font = { ...style.font, bold: true };
        }
        row.alignment = { vertical: 'middle' };
        row.commit();
      }
    });
  }

  await workbook.xlsx.writeFile(outputPath);
  console.log(`✅ ${added} registros agregados al Excel.`);
  console.log(`📊 Total en archivo: ${worksheet.rowCount - 1} restaurantes`);
  console.log(`📁 Abre: ${outputPath}\n`);
}

async function fileExists(filePath) {
  try {
    await require('fs').promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = { exportToExcel };
