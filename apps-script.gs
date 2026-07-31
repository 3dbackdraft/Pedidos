const SPREADSHEET_ID = '1keP-JZV0c8p_3_-pzGpU4ifJ0u1WvY00GOQDRY-YL2U';

const SHEET_NAME = 'BASE PEDIDOS';
const PURCHASES_SHEET_NAME = 'COMPRAS';
const MOVEMENTS_SHEET_NAME = 'MOVIMIENTOS';
const LEGACY_PUBLICATIONS_SHEET_NAME = 'PUBLICACIONES';

const HEADERS = [
  'ID',
  'Fecha carga',
  'Pedido',
  'Cliente',
  'Precio unitario',
  'Cantidad',
  'Precio total',
  'Precio',
  'Seña',
  'Parte Iri',
  'Parte mama',
  'Estado',
  'Fecha compromiso',
  'Nota',
  'Actualizado'
];

const PURCHASE_HEADERS = [
  'ID',
  'Fecha',
  'Billetera',
  'Concepto',
  'Monto',
  'Nota',
  'Actualizado'
];

const MOVEMENT_HEADERS = [
  'ID',
  'Fecha',
  'Tipo',
  'Detalle',
  'Monto',
  'Billetera',
  'Referencia',
  'Pedido ID',
  'Actualizado'
];

const LEGACY_PUBLICATION_COLUMNS = [
  'Publicar',
  'Instagram estado',
  'Instagram texto',
  'Instagram comentario',
  'Mercado Libre estado',
  'Mercado Libre texto',
  'Mercado Libre comentario'
];

function prueba() {
  setup();
  return 'OK. Pedidos, compras y movimientos listos. Publicaciones fuera del flujo.';
}

function setup() {
  ensureSheet_();
}

function limpiarPublicacionesDePlanilla() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ensureSheet_();

  const legacySheet = ss.getSheetByName(LEGACY_PUBLICATIONS_SHEET_NAME);
  if (legacySheet) {
    ss.deleteSheet(legacySheet);
  }

  const sh = ss.getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  let deletedRows = 0;
  let deletedColumns = 0;

  if (sh.getLastRow() > 1) {
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      if (isLegacyPublicationRow_(rows[i], map)) {
        sh.deleteRow(i + 2);
        deletedRows++;
      }
    }
  }

  for (let i = LEGACY_PUBLICATION_COLUMNS.length - 1; i >= 0; i--) {
    const idx = map[LEGACY_PUBLICATION_COLUMNS[i]];
    if (idx !== undefined) {
      sh.deleteColumn(idx + 1);
      deletedColumns++;
    }
  }

  return 'Listo. Se borro la hoja PUBLICACIONES, filas antiguas: ' + deletedRows + ', columnas antiguas: ' + deletedColumns + '.';
}

function doGet(e) {
  try {
    setup();

    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'list';
    let result;

    if (action === 'diagnostico') {
      result = diagnostico_();
    } else if (action === 'list') {
      result = {
        ok: true,
        data: readOrders_(),
        purchases: readPurchases_(),
        movements: readMovements_()
      };
    } else if (action === 'save') {
      const order = decodePayload_(params.payload);
      saveOrder_(order);
      result = {
        ok: true,
        data: readOrders_(),
        purchases: readPurchases_(),
        movements: readMovements_()
      };
    } else if (action === 'savePurchase') {
      const purchase = decodePayload_(params.payload);
      savePurchase_(purchase);
      result = {
        ok: true,
        data: readOrders_(),
        purchases: readPurchases_(),
        movements: readMovements_()
      };
    } else if (action === 'saveMovement') {
      const movement = decodePayload_(params.payload);
      saveMovement_(movement);
      result = {
        ok: true,
        data: readOrders_(),
        purchases: readPurchases_(),
        movements: readMovements_()
      };
    } else if (action === 'saveSale') {
      const sale = decodePayload_(params.payload);
      saveSale_(sale);
      result = {
        ok: true,
        data: readOrders_(),
        purchases: readPurchases_(),
        movements: readMovements_()
      };
    } else if (action === 'updateStatus') {
      updateStatus_(params.id, params.estado);
      result = {
        ok: true,
        data: readOrders_(),
        purchases: readPurchases_(),
        movements: readMovements_()
      };
    } else {
      throw new Error('Accion no reconocida: ' + action);
    }

    return output_(result, params.callback);
  } catch (err) {
    return output_({
      ok: false,
      error: err && err.message ? err.message : String(err)
    }, e && e.parameter ? e.parameter.callback : '');
  }
}

function ensureSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ordersSheet = ensureOneSheet_(ss, SHEET_NAME, HEADERS);
  const purchasesSheet = ensureOneSheet_(ss, PURCHASES_SHEET_NAME, PURCHASE_HEADERS);
  const movementsSheet = ensureOneSheet_(ss, MOVEMENTS_SHEET_NAME, MOVEMENT_HEADERS);

  safeStyleHeader_(ordersSheet, HEADERS.length);
  safeStyleHeader_(purchasesSheet, PURCHASE_HEADERS.length);
  safeStyleHeader_(movementsSheet, MOVEMENT_HEADERS.length);
}

function ensureOneSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }

  const currentHeaders = getHeaders_(sh);
  if (currentHeaders.length === 0 || currentHeaders.every(function(header) { return header === ''; })) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sh;
  }

  const existing = headerMap_(currentHeaders);
  headers.forEach(function(header) {
    if (existing[header] === undefined) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(header);
    }
  });

  return sh;
}

function safeStyleHeader_(sh, width) {
  try {
    styleHeader_(sh, width);
  } catch (err) {
    // Si la cuenta no permite alguna opcion visual, la app igual debe funcionar.
  }
}

function styleHeader_(sh, width) {
  if (!sh || width < 1) return;
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, width)
    .setFontWeight('bold')
    .setBackground('#52209d')
    .setFontColor('#ffffff');
  sh.autoResizeColumns(1, width);
}

function diagnostico_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const orders = ss.getSheetByName(SHEET_NAME);
  const purchases = ss.getSheetByName(PURCHASES_SHEET_NAME);
  const movements = ss.getSheetByName(MOVEMENTS_SHEET_NAME);
  const legacyPublications = ss.getSheetByName(LEGACY_PUBLICATIONS_SHEET_NAME);

  return {
    ok: true,
    spreadsheetId: SPREADSHEET_ID,
    ordersSheetName: orders.getName(),
    ordersLastRow: orders.getLastRow(),
    ordersHeaders: getHeaders_(orders),
    purchasesSheetName: purchases.getName(),
    purchasesLastRow: purchases.getLastRow(),
    purchasesHeaders: getHeaders_(purchases),
    movementsSheetName: movements.getName(),
    movementsLastRow: movements.getLastRow(),
    movementsHeaders: getHeaders_(movements),
    legacyPublicationsSheetExists: Boolean(legacyPublications)
  };
}

function readOrders_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  if (sh.getLastRow() <= 1) return [];

  const map = headerMap_(headers);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues();

  return rows
    .filter(function(row) {
      return !isLegacyPublicationRow_(row, map);
    })
    .map(function(row) {
      const precioTotal = valueBy_(row, map, 'Precio total') || valueBy_(row, map, 'Precio');
      return {
        id: valueBy_(row, map, 'ID'),
        fechaCarga: formatDate_(valueBy_(row, map, 'Fecha carga')),
        pedido: valueBy_(row, map, 'Pedido'),
        cliente: valueBy_(row, map, 'Cliente'),
        precioUnitario: valueBy_(row, map, 'Precio unitario'),
        cantidad: valueBy_(row, map, 'Cantidad'),
        precioTotal: precioTotal,
        precio: precioTotal,
        sena: valueFirstBy_(row, map, ['Seña', 'Sena', 'SeÃ±a']),
        shareIri: valueBy_(row, map, 'Parte Iri'),
        shareMama: valueBy_(row, map, 'Parte mama'),
        estado: normalizeStatus_(valueBy_(row, map, 'Estado')),
        fechaCompromiso: formatDate_(valueBy_(row, map, 'Fecha compromiso')),
        nota: valueBy_(row, map, 'Nota'),
        actualizado: formatDateTime_(valueBy_(row, map, 'Actualizado'))
      };
    });
}

function readPurchases_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PURCHASES_SHEET_NAME);
  const headers = getHeaders_(sh);
  if (sh.getLastRow() <= 1) return [];

  const map = headerMap_(headers);
  return sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues().map(function(row) {
    return {
      id: valueBy_(row, map, 'ID'),
      fecha: formatDate_(valueBy_(row, map, 'Fecha')),
      billetera: valueBy_(row, map, 'Billetera'),
      concepto: valueBy_(row, map, 'Concepto'),
      monto: valueBy_(row, map, 'Monto'),
      nota: valueBy_(row, map, 'Nota'),
      actualizado: formatDateTime_(valueBy_(row, map, 'Actualizado'))
    };
  });
}

function readMovements_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MOVEMENTS_SHEET_NAME);
  const headers = getHeaders_(sh);
  if (sh.getLastRow() <= 1) return [];

  const map = headerMap_(headers);
  return sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).getValues().map(function(row) {
    return {
      id: valueBy_(row, map, 'ID'),
      fecha: formatDate_(valueBy_(row, map, 'Fecha')),
      tipo: valueBy_(row, map, 'Tipo'),
      detalle: valueBy_(row, map, 'Detalle'),
      monto: valueBy_(row, map, 'Monto'),
      billetera: valueBy_(row, map, 'Billetera'),
      referencia: valueBy_(row, map, 'Referencia'),
      pedidoId: valueBy_(row, map, 'Pedido ID'),
      actualizado: formatDateTime_(valueBy_(row, map, 'Actualizado'))
    };
  });
}

function saveOrder_(order) {
  if (!order || !order.id) throw new Error('Pedido invalido: falta ID');
  if (!order.pedido) throw new Error('Falta el nombre del pedido');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, order.id);
  const targetRow = row || sh.getLastRow() + 1;
  const now = new Date();
  const total = number_(order.precioTotal || order.precio);
  const shareIri = number_(order.shareIri);
  const shareMama = number_(order.shareMama);

  setCellByHeader_(sh, targetRow, map, 'ID', order.id);
  setCellByHeader_(sh, targetRow, map, 'Fecha carga', order.fechaCarga || today_());
  setCellByHeader_(sh, targetRow, map, 'Pedido', order.pedido || '');
  setCellByHeader_(sh, targetRow, map, 'Cliente', order.cliente || '');
  setCellByHeader_(sh, targetRow, map, 'Precio unitario', number_(order.precioUnitario));
  setCellByHeader_(sh, targetRow, map, 'Cantidad', number_(order.cantidad) || 1);
  setCellByHeader_(sh, targetRow, map, 'Precio total', total);
  setCellByHeader_(sh, targetRow, map, 'Precio', total);
  setCellByHeader_(sh, targetRow, map, 'Seña', number_(order.sena));
  setCellByHeader_(sh, targetRow, map, 'Parte Iri', shareIri || Math.round(total / 2));
  setCellByHeader_(sh, targetRow, map, 'Parte mama', shareMama || total - Math.round(total / 2));
  setCellByHeader_(sh, targetRow, map, 'Estado', normalizeStatus_(order.estado || 'Para hacer'));
  setCellByHeader_(sh, targetRow, map, 'Fecha compromiso', order.fechaCompromiso || '');
  setCellByHeader_(sh, targetRow, map, 'Nota', order.nota || '');
  setCellByHeader_(sh, targetRow, map, 'Actualizado', now);
}

function savePurchase_(purchase) {
  if (!purchase || !purchase.id) throw new Error('Compra invalida: falta ID');
  if (!purchase.concepto) throw new Error('Falta concepto de compra');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PURCHASES_SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, purchase.id);
  const targetRow = row || sh.getLastRow() + 1;
  const now = new Date();

  setCellByHeader_(sh, targetRow, map, 'ID', purchase.id);
  setCellByHeader_(sh, targetRow, map, 'Fecha', purchase.fecha || today_());
  setCellByHeader_(sh, targetRow, map, 'Billetera', purchase.billetera || 'iri');
  setCellByHeader_(sh, targetRow, map, 'Concepto', purchase.concepto || '');
  setCellByHeader_(sh, targetRow, map, 'Monto', number_(purchase.monto));
  setCellByHeader_(sh, targetRow, map, 'Nota', purchase.nota || '');
  setCellByHeader_(sh, targetRow, map, 'Actualizado', now);

  saveMovement_({
    id: 'MOV-' + purchase.id,
    fecha: purchase.fecha || today_(),
    tipo: 'Compra',
    detalle: purchase.concepto || '',
    monto: -Math.abs(number_(purchase.monto)),
    billetera: purchase.billetera || 'iri',
    referencia: 'Compra',
    pedidoId: '',
    actualizado: now
  });
}

function saveMovement_(movement) {
  if (!movement || !movement.id) throw new Error('Movimiento invalido: falta ID');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MOVEMENTS_SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, movement.id);
  const targetRow = row || sh.getLastRow() + 1;
  const now = new Date();

  setCellByHeader_(sh, targetRow, map, 'ID', movement.id);
  setCellByHeader_(sh, targetRow, map, 'Fecha', movement.fecha || today_());
  setCellByHeader_(sh, targetRow, map, 'Tipo', movement.tipo || '');
  setCellByHeader_(sh, targetRow, map, 'Detalle', movement.detalle || '');
  setCellByHeader_(sh, targetRow, map, 'Monto', number_(movement.monto));
  setCellByHeader_(sh, targetRow, map, 'Billetera', movement.billetera || '');
  setCellByHeader_(sh, targetRow, map, 'Referencia', movement.referencia || '');
  setCellByHeader_(sh, targetRow, map, 'Pedido ID', movement.pedidoId || '');
  setCellByHeader_(sh, targetRow, map, 'Actualizado', movement.actualizado || now);
}

function saveSale_(sale) {
  if (!sale || !sale.id) throw new Error('Venta invalida: falta ID');
  if (!sale.detalle) throw new Error('Falta detalle de venta');

  const total = number_(sale.total);
  const shareIri = number_(sale.shareIri) || Math.round(total / 2);
  const shareMama = number_(sale.shareMama) || Math.max(total - shareIri, 0);
  const now = sale.actualizado || new Date();

  saveMovement_({
    id: sale.id + '-IRI',
    fecha: sale.fecha || today_(),
    tipo: 'Venta',
    detalle: sale.detalle,
    monto: shareIri,
    billetera: 'iri',
    referencia: sale.referencia || '',
    pedidoId: sale.id,
    actualizado: now
  });

  saveMovement_({
    id: sale.id + '-MAMA',
    fecha: sale.fecha || today_(),
    tipo: 'Venta',
    detalle: sale.detalle,
    monto: shareMama,
    billetera: 'mama',
    referencia: sale.referencia || '',
    pedidoId: sale.id,
    actualizado: now
  });
}

function updateStatus_(id, estado) {
  if (!id) throw new Error('Falta ID');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, id);
  if (!row) throw new Error('No se encontro el pedido ' + id);

  const normalized = normalizeStatus_(estado);
  setCellByHeader_(sh, row, map, 'Estado', normalized);
  setCellByHeader_(sh, row, map, 'Actualizado', new Date());

  const rowValues = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  const pedido = valueBy_(rowValues, map, 'Pedido');
  const total = number_(valueBy_(rowValues, map, 'Precio total') || valueBy_(rowValues, map, 'Precio'));
  const shareIri = number_(valueBy_(rowValues, map, 'Parte Iri')) || Math.round(total / 2);
  const shareMama = number_(valueBy_(rowValues, map, 'Parte mama')) || total - shareIri;

  if (normalized === 'Finalizado') {
    saveMovement_({
      id: 'MOV-' + id + '-COBRO-IRI',
      fecha: today_(),
      tipo: 'Cobro',
      detalle: pedido,
      monto: shareIri,
      billetera: 'iri',
      referencia: 'Pedido finalizado',
      pedidoId: id
    });
    saveMovement_({
      id: 'MOV-' + id + '-COBRO-MAMA',
      fecha: today_(),
      tipo: 'Cobro',
      detalle: pedido,
      monto: shareMama,
      billetera: 'mama',
      referencia: 'Pedido finalizado',
      pedidoId: id
    });
  }

  if (normalized === 'Deudor') {
    saveMovement_({
      id: 'MOV-' + id + '-DEUDOR',
      fecha: today_(),
      tipo: 'Deuda',
      detalle: pedido,
      monto: total,
      billetera: '',
      referencia: 'Pedido marcado como deudor',
      pedidoId: id
    });
  }
}

function isLegacyPublicationRow_(row, map) {
  const id = String(valueBy_(row, map, 'ID') || '');
  const estado = normalizeStatus_(valueBy_(row, map, 'Estado'));
  const pedido = valueBy_(row, map, 'Pedido');

  if (!id && !pedido) return false;
  if (id.indexOf('PUB-') === 0 || id.indexOf('PUBTASK-') === 0) return true;
  return estado === 'Solo publicar';
}

function normalizeStatus_(status) {
  if (status === 'Hecho' || status === 'Entregado') return 'Para entregar';
  if (status === 'Espera de pago') return 'Para cobrar';
  return status || 'Para hacer';
}

function getHeaders_(sh) {
  if (!sh || sh.getLastColumn() < 1) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function(header) {
    return String(header || '').trim();
  });
}

function headerMap_(headers) {
  const map = {};
  headers.forEach(function(header, idx) {
    if (header) map[header] = idx;
  });
  return map;
}

function findRowById_(sh, id) {
  if (!id || sh.getLastRow() <= 1) return 0;
  const ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}

function rowValuesFromSheet_(sh, row, width) {
  return sh.getRange(row, 1, 1, width).getValues()[0];
}

function valueBy_(row, map, header) {
  const idx = map[header];
  return idx === undefined ? '' : row[idx];
}

function valueFirstBy_(row, map, headers) {
  for (let i = 0; i < headers.length; i++) {
    const value = valueBy_(row, map, headers[i]);
    if (value !== '' && value !== null && value !== undefined) return value;
  }
  return '';
}

function setCellByHeader_(sh, row, map, header, value) {
  if (map[header] === undefined) return;
  sh.getRange(row, map[header] + 1).setValue(value);
}

function number_(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let raw = String(value || '').trim();
  if (!raw) return 0;

  const isNegative = raw.charAt(0) === '-';
  raw = raw.replace(/[^\d,.]/g, '');

  if (raw.indexOf(',') !== -1 && raw.indexOf('.') !== -1) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.indexOf(',') !== -1) {
    const commaParts = raw.split(',');
    const last = commaParts[commaParts.length - 1];
    raw = last.length === 3
      ? commaParts.join('')
      : commaParts.slice(0, -1).join('') + '.' + last;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    raw = raw.replace(/\./g, '');
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;

  return isNegative ? -n : n;
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value);
}

function formatDateTime_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  }
  return String(value);
}

function decodePayload_(payload) {
  if (!payload) throw new Error('Falta payload');
  const decoded = decodeURIComponent(payload);

  try {
    return JSON.parse(decoded);
  } catch (jsonErr) {
    const padded = decoded + '===='.slice((decoded.length % 4) || 4);
    const bytes = Utilities.base64DecodeWebSafe(padded);
    const json = Utilities.newBlob(bytes).getDataAsString('UTF-8');
    return JSON.parse(json);
  }
}

function output_(obj, callback) {
  if (callback) {
    const safeCallback = String(callback).replace(/[^a-zA-Z0-9_.$]/g, '');
    return ContentService
      .createTextOutput(safeCallback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
