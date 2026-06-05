/*
  Apps Script para conectar la web con Google Sheets - 3D Backdraft Pedidos.

  IMPORTANTE:
  - La hoja debe llamarse: BASE PEDIDOS
  - Pegá este archivo completo en Code.gs
  - Ejecutá setup() una vez para crear/acomodar encabezados
  - Implementar > Administrar implementaciones > Editar > Nueva versión
  - Usá la URL que termina en /exec en app.js
*/

const SPREADSHEET_ID = '1keP-JZV0c8p_3_-pzGpU4ifJ0u1WvY00GOQDRY-YL2U';
const SHEET_NAME = 'BASE PEDIDOS';

const HEADERS = [
  'ID',
  'Fecha carga',
  'Pedido',
  'Cliente',
  'Precio',
  'Seña',
  'Estado',
  'Fecha compromiso',
  'Nota',
  'Actualizado'
];

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  sh.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#00f022')
    .setFontColor('#000000');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, HEADERS.length);
}

function doGet(e) {
  ensureSheet_();

  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'list';

  let result;

  try {
    if (action === 'diagnostico') {
      result = diagnostico_();

    } else if (action === 'list') {
      result = { ok: true, data: readOrders_() };

    } else if (action === 'save') {
      const order = decodePayload_(params.payload);
      saveOrder_(order);
      result = { ok: true, data: order };

    } else if (action === 'updateStatus') {
      updateStatus_(params.id, params.estado);
      result = { ok: true };

    } else {
      result = {
        ok: false,
        error: 'Acción GET no reconocida: ' + action
      };
    }

  } catch (err) {
    result = {
      ok: false,
      error: err.message || String(err)
    };
  }

  return output_(result, params.callback);
}

function doPost(e) {
  ensureSheet_();

  try {
    const body = JSON.parse(e.postData.contents || '{}');

    if (body.action === 'save') {
      saveOrder_(body.order);
      return json_({ ok: true, data: body.order });
    }

    if (body.action === 'updateStatus') {
      updateStatus_(body.id, body.estado);
      return json_({ ok: true });
    }

    return json_({
      ok: false,
      error: 'Acción POST no reconocida: ' + body.action
    });

  } catch (err) {
    return json_({
      ok: false,
      error: err.message || String(err)
    });
  }
}

function ensureSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  const firstRow = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];

  if (firstRow[0] !== 'ID') {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function diagnostico_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  ensureSheet_();

  return {
    ok: true,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    sheetName: sh.getName(),
    lastRow: sh.getLastRow(),
    headers: sh.getRange(1, 1, 1, HEADERS.length).getValues()[0]
  };
}

function probarGuardado() {
  ensureSheet_();

  saveOrder_({
    id: 'TEST-' + new Date().getTime(),
    fechaCarga: new Date(),
    pedido: 'Prueba de conexión',
    cliente: 'Apps Script',
    precio: '',
    sena: '',
    estado: 'Para hacer',
    fechaCompromiso: '',
    nota: 'Si esta fila aparece, la conexión funciona.',
    actualizado: new Date()
  });
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
    estado: normalizeStatus_(r[6] || 'Para hacer'),
    fechaCompromiso: formatDate_(r[7]),
    nota: r[8],
    actualizado: formatDateTime_(r[9])
  }));
}

function saveOrder_(order) {
  if (!order || !order.id) {
    throw new Error('Pedido inválido: falta ID');
  }

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const row = findRowById_(sh, order.id);

  const values = [[
    order.id,
    order.fechaCarga || new Date(),
    order.pedido || '',
    order.cliente || '',
    order.precio || '',
    order.sena || '',
    normalizeStatus_(order.estado || 'Para hacer'),
    order.fechaCompromiso || '',
    order.nota || '',
    new Date()
  ]];

  if (row) {
    sh.getRange(row, 1, 1, HEADERS.length).setValues(values);
  } else {
    sh.appendRow(values[0]);
  }
}

function updateStatus_(id, estado) {
  if (!id) {
    throw new Error('Falta ID del pedido');
  }

  if (!estado) {
    throw new Error('Falta estado del pedido');
  }

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const row = findRowById_(sh, id);

  if (!row) {
    throw new Error('Pedido no encontrado en la hoja');
  }

  sh.getRange(row, 7).setValue(normalizeStatus_(estado));
  sh.getRange(row, 10).setValue(new Date());
}

function findRowById_(sh, id) {
  const last = sh.getLastRow();

  if (last < 2) return null;

  const ids = sh.getRange(2, 1, last - 1, 1).getValues().flat();
  const index = ids.findIndex(x => String(x) === String(id));

  return index >= 0 ? index + 2 : null;
}

function normalizeStatus_(status) {
  if (status === 'Hecho' || status === 'Entregado') return 'Para entregar';
  if (status === 'Espera de pago') return 'Para cobrar';
  return status || 'Para hacer';
}

function decodePayload_(payload) {
  if (!payload) {
    throw new Error('Falta payload');
  }

  const json = Utilities
    .newBlob(Utilities.base64DecodeWebSafe(payload))
    .getDataAsString('UTF-8');

  return JSON.parse(json);
}

function formatDate_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return value;
}

function formatDateTime_(value) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }

  return value;
}

function output_(obj, callback) {
  if (callback) {
    const safeCallback = String(callback).replace(/[^a-zA-Z0-9_.$]/g, '');

    return ContentService
      .createTextOutput(`${safeCallback}(${JSON.stringify(obj)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json_(obj);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
