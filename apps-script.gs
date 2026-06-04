/*
  Apps Script para conectar la web con Google Sheets.

  Pasos:
  1) En tu Google Sheet: Extensiones > Apps Script.
  2) Pegá este código.
  3) Cambiá SPREADSHEET_ID por el ID de tu planilla.
  4) Implementar > Nueva implementación > Aplicación web.
  5) Ejecutar como: tú misma. Acceso: cualquier usuario con el enlace.
  6) Copiá la URL /exec y pegala en app.js, constante API_URL.
*/

const SPREADSHEET_ID = '1tdoH27uxutOiy1FOhPS7KOnF49XRIoYLwf01hx4boi8';
const SHEET_NAME = 'BASE PEDIDOS';
const HEADERS = ['ID', 'Fecha carga', 'Pedido', 'Cliente', 'Precio', 'Seña', 'Estado', 'Fecha compromiso', 'Nota', 'Actualizado'];

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.clear();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#00f022').setFontColor('#000000');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, HEADERS.length);
}

function doGet(e) {
  ensureSheet_();
  return json_({ ok: true, data: readOrders_() });
}

function doPost(e) {
  ensureSheet_();
  const body = JSON.parse(e.postData.contents || '{}');

  if (body.action === 'save') {
    saveOrder_(body.order);
    return json_({ ok: true });
  }

  if (body.action === 'updateStatus') {
    updateStatus_(body.id, body.estado);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: 'Acción no reconocida' });
}

function ensureSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  const firstRow = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (firstRow[0] !== 'ID') sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
}

function readOrders_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const last = sh.getLastRow();
  if (last < 2) return [];

  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  return values.filter(r => r[0]).map(r => ({
    id: r[0],
    fechaCarga: formatDate_(r[1]),
    pedido: r[2],
    cliente: r[3],
    precio: r[4],
    sena: r[5],
    estado: r[6] || 'Para hacer',
    fechaCompromiso: formatDate_(r[7]),
    nota: r[8],
    actualizado: r[9]
  }));
}

function saveOrder_(order) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const row = findRowById_(sh, order.id);
  const values = [[
    order.id,
    order.fechaCarga || new Date(),
    order.pedido || '',
    order.cliente || '',
    order.precio || '',
    order.sena || '',
    order.estado || 'Para hacer',
    order.fechaCompromiso || '',
    order.nota || '',
    new Date()
  ]];

  if (row) sh.getRange(row, 1, 1, HEADERS.length).setValues(values);
  else sh.appendRow(values[0]);
}

function updateStatus_(id, estado) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const row = findRowById_(sh, id);
  if (!row) throw new Error('Pedido no encontrado');
  sh.getRange(row, 7).setValue(estado);
  sh.getRange(row, 10).setValue(new Date());
}

function findRowById_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return null;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues().flat();
  const index = ids.findIndex(x => String(x) === String(id));
  return index >= 0 ? index + 2 : null;
}

function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
