const SPREADSHEET_ID = '1keP-JZV0c8p_3_-pzGpU4ifJ0u1WvY00GOQDRY-YL2U';
const SHEET_NAME = 'BASE PEDIDOS';
const PURCHASES_SHEET_NAME = 'COMPRAS';
const MOVEMENTS_SHEET_NAME = 'MOVIMIENTOS';
const PUBLICATIONS_SHEET_NAME = 'PUBLICACIONES';

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
  'Publicar',
  'Instagram estado',
  'Instagram texto',
  'Instagram comentario',
  'Mercado Libre estado',
  'Mercado Libre texto',
  'Mercado Libre comentario',
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

const PUBLICATION_HEADERS = [
  'ID',
  'Fecha',
  'Producto',
  'Referencia',
  'Canal',
  'Estado',
  'Texto',
  'Comentario',
  'Pedido ID',
  'Actualizado'
];

function setup() {
  ensureSheet_();
}

function prueba() {
  return 'OK';
}

function limpiarPublicacionesDePedidos() {
  ensureSheet_();

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const last = sh.getLastRow();

  if (last < 2) return 'No hay filas para revisar';

  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  let count = 0;

  values.forEach((row, index) => {
    const sheetRow = index + 2;
    const id = String(valueBy_(row, map, 'ID') || '');
    const estado = normalizeStatus_(valueBy_(row, map, 'Estado'));
    const publicar = String(valueBy_(row, map, 'Publicar') || '').toLowerCase();
    const instagramEstado = valueBy_(row, map, 'Instagram estado');
    const mercadoLibreEstado = valueBy_(row, map, 'Mercado Libre estado');
    const precio = Number(valueBy_(row, map, 'Precio total') || valueBy_(row, map, 'Precio') || 0);
    const sena = Number(valueBy_(row, map, 'SeÃ±a') || valueBy_(row, map, 'Seña') || 0);
    const hasPublicationTask = Boolean(instagramEstado || mercadoLibreEstado || publicar === 'pendiente');
    const looksLikeManualPublication = (
      id.indexOf('PUB-') === 0 ||
      (
        estado === 'Para entregar' &&
        !precio &&
        !sena &&
        hasPublicationTask
      )
    );

    if (looksLikeManualPublication) {
      const pedido = valueBy_(row, map, 'Pedido');
      const cliente = valueBy_(row, map, 'Cliente');
      const fechaCarga = valueBy_(row, map, 'Fecha carga') || new Date();
      const instagramTexto = valueBy_(row, map, 'Instagram texto') || pedido;
      const instagramComentario = valueBy_(row, map, 'Instagram comentario') || valueBy_(row, map, 'Nota');
      const mercadoLibreTexto = valueBy_(row, map, 'Mercado Libre texto') || pedido;
      const mercadoLibreComentario = valueBy_(row, map, 'Mercado Libre comentario') || valueBy_(row, map, 'Nota');

      if (instagramEstado) {
        savePublication_({
          id: 'PUBTASK-' + id + '-instagram',
          fecha: fechaCarga,
          producto: pedido || instagramTexto || '',
          referencia: cliente || '',
          canal: 'Instagram',
          estado: instagramEstado,
          texto: instagramTexto || '',
          comentario: instagramComentario || '',
          pedidoId: ''
        });
      }

      if (mercadoLibreEstado) {
        savePublication_({
          id: 'PUBTASK-' + id + '-mercadoLibre',
          fecha: fechaCarga,
          producto: pedido || mercadoLibreTexto || '',
          referencia: cliente || '',
          canal: 'Mercado Libre',
          estado: mercadoLibreEstado,
          texto: mercadoLibreTexto || '',
          comentario: mercadoLibreComentario || '',
          pedidoId: ''
        });
      }

      setCellByHeader_(sh, sheetRow, map, 'Estado', 'Solo publicar');
      setCellByHeader_(sh, sheetRow, map, 'Actualizado', new Date());
      count++;
    }
  });

  return 'Filas marcadas como Solo publicar: ' + count;
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'list';
  let result;

  try {
    ensureSheet_();

    if (action === 'diagnostico') {
      result = diagnostico_();

    } else if (action === 'list') {
      result = {
        ok: true,
        data: readOrders_(),
        purchases: readPurchases_(),
        movements: readMovements_(),
        publications: readPublications_()
      };

    } else if (action === 'save') {
      const order = decodePayload_(params.payload);
      saveOrder_(order);
      result = { ok: true, data: order };

    } else if (action === 'savePurchase') {
      const purchase = decodePayload_(params.payload);
      savePurchase_(purchase);
      result = { ok: true, data: purchase };

    } else if (action === 'saveMovement') {
      const movement = decodePayload_(params.payload);
      saveMovement_(movement);
      result = { ok: true, data: movement };

    } else if (action === 'savePublicationTask') {
      const task = decodePayload_(params.payload);
      savePublicationTask_(task);
      result = { ok: true, data: task };

    } else if (action === 'savePublication') {
      const publication = decodePayload_(params.payload);
      savePublication_(publication);
      result = { ok: true, data: publication };

    } else if (action === 'updatePublish') {
      updatePublish_(params.id, params.publicar);
      result = { ok: true };

    } else if (action === 'updateStatus') {
      updateStatus_(params.id, params.estado);
      result = { ok: true };

    } else {
      result = {
        ok: false,
        error: 'Accion GET no reconocida: ' + action
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

function ensureSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ordersSheet = ensureOneSheet_(ss, SHEET_NAME, HEADERS);
  const purchasesSheet = ensureOneSheet_(ss, PURCHASES_SHEET_NAME, PURCHASE_HEADERS);
  const movementsSheet = ensureOneSheet_(ss, MOVEMENTS_SHEET_NAME, MOVEMENT_HEADERS);
  const publicationsSheet = ensureOneSheet_(ss, PUBLICATIONS_SHEET_NAME, PUBLICATION_HEADERS);

  safeStyleHeader_(ordersSheet, HEADERS.length);
  safeStyleHeader_(purchasesSheet, PURCHASE_HEADERS.length);
  safeStyleHeader_(movementsSheet, MOVEMENT_HEADERS.length);
  safeStyleHeader_(publicationsSheet, PUBLICATION_HEADERS.length);
}

function ensureOneSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const lastCol = Math.max(sh.getLastColumn(), headers.length);
  const firstRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  if (firstRow[0] !== 'ID') {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sh;
  }

  const existing = firstRow.map(String);
  headers.forEach(header => {
    if (existing.indexOf(header) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(header);
    }
  });

  return sh;
}

function styleHeader_(sh, cols) {
  sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), cols))
    .setFontWeight('bold')
    .setBackground('#60BC48')
    .setFontColor('#000000');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, Math.max(sh.getLastColumn(), cols));
}

function safeStyleHeader_(sh, cols) {
  try {
    styleHeader_(sh, cols);
  } catch (err) {
    // El formato no debe impedir que setup agregue las columnas necesarias.
    console.log('No se pudo aplicar formato a ' + sh.getName() + ': ' + (err.message || err));
  }
}

function diagnostico_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  const purchases = ss.getSheetByName(PURCHASES_SHEET_NAME);
  const movements = ss.getSheetByName(MOVEMENTS_SHEET_NAME);
  const publications = ss.getSheetByName(PUBLICATIONS_SHEET_NAME);

  return {
    ok: true,
    spreadsheetName: ss.getName(),
    spreadsheetId: ss.getId(),
    sheetName: sh.getName(),
    lastRow: sh.getLastRow(),
    headers: getHeaders_(sh),
    purchasesSheetName: purchases.getName(),
    purchasesLastRow: purchases.getLastRow(),
    purchasesHeaders: getHeaders_(purchases),
    movementsSheetName: movements.getName(),
    movementsLastRow: movements.getLastRow(),
    movementsHeaders: getHeaders_(movements),
    publicationsSheetName: publications.getName(),
    publicationsLastRow: publications.getLastRow(),
    publicationsHeaders: getHeaders_(publications)
  };
}

function readOrders_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const last = sh.getLastRow();

  if (last < 2) return [];

  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();

  return values.filter(r => valueBy_(r, map, 'ID')).map(r => {
    const precioTotal = valueBy_(r, map, 'Precio total') || valueBy_(r, map, 'Precio');
    const estadoHoja = normalizeStatus_(valueBy_(r, map, 'Estado'));
    const publicarHoja = valueBy_(r, map, 'Publicar');
    const instagramEstado = valueBy_(r, map, 'Instagram estado');
    const mercadoLibreEstado = valueBy_(r, map, 'Mercado Libre estado');
    const hasExplicitChannelStatus = Boolean(instagramEstado || mercadoLibreEstado);
    const legacyPending = estadoHoja === 'Para publicar' ||
      (
        String(publicarHoja).toLowerCase() === 'pendiente' &&
        !hasExplicitChannelStatus
      );

    return {
      id: valueBy_(r, map, 'ID'),
      fechaCarga: formatDate_(valueBy_(r, map, 'Fecha carga')),
      pedido: valueBy_(r, map, 'Pedido'),
      cliente: valueBy_(r, map, 'Cliente'),
      precioUnitario: valueBy_(r, map, 'Precio unitario') || valueBy_(r, map, 'Precio'),
      cantidad: valueBy_(r, map, 'Cantidad') || 1,
      precioTotal: precioTotal,
      precio: precioTotal,
      sena: valueBy_(r, map, 'Seña'),
      shareIri: valueBy_(r, map, 'Parte Iri'),
      shareMama: valueBy_(r, map, 'Parte mama'),
      estado: estadoHoja === 'Para publicar' ? 'Para entregar' : estadoHoja,
      publicar: estadoHoja === 'Para publicar' ? 'Pendiente' : publicarHoja,
      instagramEstado: instagramEstado || (legacyPending ? 'Pendiente' : ''),
      instagramTexto: valueBy_(r, map, 'Instagram texto') || valueBy_(r, map, 'Pedido'),
      instagramComentario: valueBy_(r, map, 'Instagram comentario'),
      mercadoLibreEstado: mercadoLibreEstado || (legacyPending ? 'Pendiente' : ''),
      mercadoLibreTexto: valueBy_(r, map, 'Mercado Libre texto') || valueBy_(r, map, 'Pedido'),
      mercadoLibreComentario: valueBy_(r, map, 'Mercado Libre comentario'),
      fechaCompromiso: formatDate_(valueBy_(r, map, 'Fecha compromiso')),
      nota: valueBy_(r, map, 'Nota'),
      actualizado: formatDateTime_(valueBy_(r, map, 'Actualizado'))
    };
  });
}

function readPurchases_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PURCHASES_SHEET_NAME);
  const last = sh.getLastRow();

  if (last < 2) return [];

  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();

  return values.filter(r => valueBy_(r, map, 'ID')).map(r => ({
    id: valueBy_(r, map, 'ID'),
    fecha: formatDate_(valueBy_(r, map, 'Fecha')),
    billetera: valueBy_(r, map, 'Billetera') || 'iri',
    concepto: valueBy_(r, map, 'Concepto'),
    monto: valueBy_(r, map, 'Monto'),
    nota: valueBy_(r, map, 'Nota'),
    actualizado: formatDateTime_(valueBy_(r, map, 'Actualizado'))
  }));
}

function readMovements_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MOVEMENTS_SHEET_NAME);
  const last = sh.getLastRow();

  if (last < 2) return [];

  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();

  return values.filter(r => valueBy_(r, map, 'ID')).map(r => ({
    id: valueBy_(r, map, 'ID'),
    fecha: formatDateTime_(valueBy_(r, map, 'Fecha')),
    tipo: valueBy_(r, map, 'Tipo'),
    detalle: valueBy_(r, map, 'Detalle'),
    monto: valueBy_(r, map, 'Monto'),
    billetera: valueBy_(r, map, 'Billetera'),
    referencia: valueBy_(r, map, 'Referencia'),
    pedidoId: valueBy_(r, map, 'Pedido ID'),
    actualizado: formatDateTime_(valueBy_(r, map, 'Actualizado'))
  }));
}

function readPublications_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PUBLICATIONS_SHEET_NAME);
  const last = sh.getLastRow();

  if (last < 2) return [];

  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const values = sh.getRange(2, 1, last - 1, headers.length).getValues();

  return values.filter(r => valueBy_(r, map, 'ID')).map(r => ({
    id: valueBy_(r, map, 'ID'),
    fecha: formatDate_(valueBy_(r, map, 'Fecha')),
    producto: valueBy_(r, map, 'Producto'),
    referencia: valueBy_(r, map, 'Referencia'),
    canal: valueBy_(r, map, 'Canal'),
    estado: valueBy_(r, map, 'Estado'),
    texto: valueBy_(r, map, 'Texto'),
    comentario: valueBy_(r, map, 'Comentario'),
    pedidoId: valueBy_(r, map, 'Pedido ID'),
    actualizado: formatDateTime_(valueBy_(r, map, 'Actualizado'))
  }));
}

function saveOrder_(order) {
  if (!order || !order.id) throw new Error('Pedido invalido: falta ID');

  if (isPublicationOnlyOrder_(order)) {
    savePublicationsFromOrder_(order);
    return;
  }

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, order.id);
  const targetRow = row || sh.getLastRow() + 1;
  const precioTotal = order.precioTotal || order.precio || '';

  setCellByHeader_(sh, targetRow, map, 'ID', order.id);
  setCellByHeader_(sh, targetRow, map, 'Fecha carga', order.fechaCarga || new Date());
  setCellByHeader_(sh, targetRow, map, 'Pedido', order.pedido || '');
  setCellByHeader_(sh, targetRow, map, 'Cliente', order.cliente || '');
  setCellByHeader_(sh, targetRow, map, 'Precio unitario', order.precioUnitario || '');
  setCellByHeader_(sh, targetRow, map, 'Cantidad', order.cantidad || '');
  setCellByHeader_(sh, targetRow, map, 'Precio total', precioTotal);
  setCellByHeader_(sh, targetRow, map, 'Precio', precioTotal);
  setCellByHeader_(sh, targetRow, map, 'Seña', order.sena || '');
  setCellByHeader_(sh, targetRow, map, 'Parte Iri', order.shareIri || '');
  setCellByHeader_(sh, targetRow, map, 'Parte mama', order.shareMama || '');
  setCellByHeader_(sh, targetRow, map, 'Estado', normalizeStatus_(order.estado));
  setCellByHeader_(sh, targetRow, map, 'Publicar', order.publicar || '');
  setCellByHeader_(sh, targetRow, map, 'Instagram estado', order.instagramEstado || '');
  setCellByHeader_(sh, targetRow, map, 'Instagram texto', order.instagramTexto || order.pedido || '');
  setCellByHeader_(sh, targetRow, map, 'Instagram comentario', order.instagramComentario || '');
  setCellByHeader_(sh, targetRow, map, 'Mercado Libre estado', order.mercadoLibreEstado || '');
  setCellByHeader_(sh, targetRow, map, 'Mercado Libre texto', order.mercadoLibreTexto || order.pedido || '');
  setCellByHeader_(sh, targetRow, map, 'Mercado Libre comentario', order.mercadoLibreComentario || '');
  setCellByHeader_(sh, targetRow, map, 'Fecha compromiso', order.fechaCompromiso || '');
  setCellByHeader_(sh, targetRow, map, 'Nota', order.nota || '');
  setCellByHeader_(sh, targetRow, map, 'Actualizado', new Date());

  savePublicationsFromOrder_(order);
}

function isPublicationOnlyOrder_(order) {
  if (!order) return false;

  const id = String(order.id || '');
  const estado = String(order.estado || '');
  const hasPublicationChannel = Boolean(order.instagramEstado || order.mercadoLibreEstado);
  const hasPrice = Number(order.precioTotal || order.precio || order.precioUnitario || 0) > 0 ||
    Number(order.sena || 0) > 0;

  return estado === 'Solo publicar' ||
    id.indexOf('PUB-') === 0 ||
    (
      hasPublicationChannel &&
      !hasPrice &&
      !order.cliente
    );
}

function savePublicationsFromOrder_(order) {
  if (!order) return;

  if (!isPublicationOnlyOrder_(order)) return;

  if (order.instagramEstado) {
    savePublication_({
      id: 'PUBTASK-' + order.id + '-instagram',
      fecha: order.fechaCarga || new Date(),
      producto: order.pedido || order.instagramTexto || '',
      referencia: order.cliente || '',
      canal: 'Instagram',
      estado: order.instagramEstado,
      texto: order.instagramTexto || order.pedido || '',
      comentario: order.instagramComentario || order.nota || '',
      pedidoId: ''
    });
  }

  if (order.mercadoLibreEstado) {
    savePublication_({
      id: 'PUBTASK-' + order.id + '-mercadoLibre',
      fecha: order.fechaCarga || new Date(),
      producto: order.pedido || order.mercadoLibreTexto || '',
      referencia: order.cliente || '',
      canal: 'Mercado Libre',
      estado: order.mercadoLibreEstado,
      texto: order.mercadoLibreTexto || order.pedido || '',
      comentario: order.mercadoLibreComentario || order.nota || '',
      pedidoId: ''
    });
  }
}

function savePublicationTask_(task) {
  if (!task || !task.id) throw new Error('Publicacion invalida: falta ID');
  if (!task.channel) throw new Error('Publicacion invalida: falta canal');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, task.id);

  if (!row) throw new Error('Pedido no encontrado en la hoja');

  const channel = String(task.channel);

  if (channel === 'instagram') {
    setCellByHeader_(sh, row, map, 'Instagram estado', task.estado || '');
    setCellByHeader_(sh, row, map, 'Instagram texto', task.texto || '');
    setCellByHeader_(sh, row, map, 'Instagram comentario', task.comentario || '');

  } else if (channel === 'mercadoLibre') {
    setCellByHeader_(sh, row, map, 'Mercado Libre estado', task.estado || '');
    setCellByHeader_(sh, row, map, 'Mercado Libre texto', task.texto || '');
    setCellByHeader_(sh, row, map, 'Mercado Libre comentario', task.comentario || '');

  } else {
    throw new Error('Canal de publicacion no reconocido: ' + channel);
  }

  setCellByHeader_(sh, row, map, 'Actualizado', new Date());

  savePublicationFromTask_(task, rowValuesFromSheet_(sh, row, headers.length), map);
}

function savePublicationFromTask_(task, rowValues, orderMap) {
  if (!task.estado) return;

  const pedido = valueBy_(rowValues, orderMap, 'Pedido');
  const cliente = valueBy_(rowValues, orderMap, 'Cliente');
  const fechaCarga = valueBy_(rowValues, orderMap, 'Fecha carga');
  const channelLabel = task.channel === 'mercadoLibre' ? 'Mercado Libre' : 'Instagram';

  savePublication_({
    id: 'PUBTASK-' + task.id + '-' + task.channel,
    fecha: fechaCarga || new Date(),
    producto: pedido || task.texto || '',
    referencia: cliente || '',
    canal: channelLabel,
    estado: task.estado || '',
    texto: task.texto || pedido || '',
    comentario: task.comentario || '',
    pedidoId: task.id
  });
}

function savePublication_(publication) {
  if (!publication || !publication.id) throw new Error('Publicacion invalida: falta ID');
  if (!publication.producto && !publication.texto) throw new Error('Falta producto o texto de publicacion');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PUBLICATIONS_SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, publication.id);
  const targetRow = row || sh.getLastRow() + 1;

  setCellByHeader_(sh, targetRow, map, 'ID', publication.id);
  setCellByHeader_(sh, targetRow, map, 'Fecha', publication.fecha || new Date());
  setCellByHeader_(sh, targetRow, map, 'Producto', publication.producto || publication.texto || '');
  setCellByHeader_(sh, targetRow, map, 'Referencia', publication.referencia || '');
  setCellByHeader_(sh, targetRow, map, 'Canal', publication.canal || '');
  setCellByHeader_(sh, targetRow, map, 'Estado', publication.estado || 'Pendiente');
  setCellByHeader_(sh, targetRow, map, 'Texto', publication.texto || publication.producto || '');
  setCellByHeader_(sh, targetRow, map, 'Comentario', publication.comentario || '');
  setCellByHeader_(sh, targetRow, map, 'Pedido ID', publication.pedidoId || '');
  setCellByHeader_(sh, targetRow, map, 'Actualizado', new Date());
}

function savePurchase_(purchase) {
  if (!purchase || !purchase.id) throw new Error('Compra invalida: falta ID');
  if (!purchase.concepto) throw new Error('Falta detalle de la compra');
  if (!purchase.monto) throw new Error('Falta monto de la compra');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(PURCHASES_SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, purchase.id);
  const targetRow = row || sh.getLastRow() + 1;

  setCellByHeader_(sh, targetRow, map, 'ID', purchase.id);
  setCellByHeader_(sh, targetRow, map, 'Fecha', purchase.fecha || new Date());
  setCellByHeader_(sh, targetRow, map, 'Billetera', purchase.billetera || 'iri');
  setCellByHeader_(sh, targetRow, map, 'Concepto', purchase.concepto || '');
  setCellByHeader_(sh, targetRow, map, 'Monto', purchase.monto || '');
  setCellByHeader_(sh, targetRow, map, 'Nota', purchase.nota || '');
  setCellByHeader_(sh, targetRow, map, 'Actualizado', new Date());

  saveMovement_({
    id: 'MOV-' + purchase.id,
    fecha: purchase.fecha || new Date(),
    tipo: 'Compra',
    detalle: purchase.concepto || '',
    monto: Number(purchase.monto || 0) * -1,
    billetera: purchase.billetera || 'iri',
    referencia: purchase.nota || '',
    pedidoId: ''
  });
}

function updateStatus_(id, estado) {
  if (!id) throw new Error('Falta ID del pedido');
  if (!estado) throw new Error('Falta estado del pedido');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, id);

  if (!row) throw new Error('Pedido no encontrado en la hoja');

  setCellByHeader_(sh, row, map, 'Estado', normalizeStatus_(estado));
  setCellByHeader_(sh, row, map, 'Actualizado', new Date());

  const normalized = normalizeStatus_(estado);
  const rowValues = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  const pedido = valueBy_(rowValues, map, 'Pedido');
  const cliente = valueBy_(rowValues, map, 'Cliente');
  const precio = Number(valueBy_(rowValues, map, 'Precio total') || valueBy_(rowValues, map, 'Precio') || 0);
  const sena = Number(valueBy_(rowValues, map, 'Seña') || valueBy_(rowValues, map, 'SeÃ±a') || 0);
  const shareIri = Number(valueBy_(rowValues, map, 'Parte Iri') || 0) || Math.round(precio * 0.5);
  const shareMama = Number(valueBy_(rowValues, map, 'Parte mama') || 0) || Math.round(precio * 0.5);
  const deuda = Math.max(precio - sena, 0);

  if (normalized === 'Finalizado') {
    saveMovement_({
      id: 'MOV-' + id + '-COBRO-IRI',
      fecha: new Date(),
      tipo: 'Cobro',
      detalle: pedido || 'Pedido cobrado',
      monto: shareIri,
      billetera: 'iri',
      referencia: cliente || '',
      pedidoId: id
    });

    saveMovement_({
      id: 'MOV-' + id + '-COBRO-MAMA',
      fecha: new Date(),
      tipo: 'Cobro',
      detalle: pedido || 'Pedido cobrado',
      monto: shareMama,
      billetera: 'mama',
      referencia: cliente || '',
      pedidoId: id
    });
  }

  if (normalized === 'Deudor') {
    saveMovement_({
      id: 'MOV-' + id + '-DEUDOR',
      fecha: new Date(),
      tipo: 'Deudor',
      detalle: pedido || 'Pedido con deuda',
      monto: deuda,
      billetera: '',
      referencia: cliente || '',
      pedidoId: id
    });
  }
}

function saveMovement_(movement) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MOVEMENTS_SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, movement.id);
  const targetRow = row || sh.getLastRow() + 1;

  setCellByHeader_(sh, targetRow, map, 'ID', movement.id);
  setCellByHeader_(sh, targetRow, map, 'Fecha', movement.fecha || new Date());
  setCellByHeader_(sh, targetRow, map, 'Tipo', movement.tipo || '');
  setCellByHeader_(sh, targetRow, map, 'Detalle', movement.detalle || '');
  setCellByHeader_(sh, targetRow, map, 'Monto', movement.monto || '');
  setCellByHeader_(sh, targetRow, map, 'Billetera', movement.billetera || '');
  setCellByHeader_(sh, targetRow, map, 'Referencia', movement.referencia || '');
  setCellByHeader_(sh, targetRow, map, 'Pedido ID', movement.pedidoId || '');
  setCellByHeader_(sh, targetRow, map, 'Actualizado', new Date());
}

function updatePublish_(id, publicar) {
  if (!id) throw new Error('Falta ID del pedido');

  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const row = findRowById_(sh, id);

  if (!row) throw new Error('Pedido no encontrado en la hoja');

  setCellByHeader_(sh, row, map, 'Publicar', publicar || '');
  setCellByHeader_(sh, row, map, 'Actualizado', new Date());
}

function findRowById_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return null;

  const headers = getHeaders_(sh);
  const map = headerMap_(headers);
  const idCol = map['ID'];

  if (!idCol) return null;

  const ids = sh.getRange(2, idCol, last - 1, 1).getValues().flat();
  const index = ids.findIndex(x => String(x) === String(id));

  return index >= 0 ? index + 2 : null;
}

function getHeaders_(sh) {
  const cols = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, cols).getValues()[0];
}

function headerMap_(headers) {
  const map = {};
  headers.forEach((header, index) => {
    const key = String(header);
    if (key && !map[key]) {
      map[key] = index + 1;
    }
  });
  return map;
}

function valueBy_(row, map, header) {
  const col = map[header];
  return col ? row[col - 1] : '';
}

function setCellByHeader_(sh, row, map, header, value) {
  const col = map[header];
  if (col) sh.getRange(row, col).setValue(value);
}

function rowValuesFromSheet_(sh, row, cols) {
  return sh.getRange(row, 1, 1, cols).getValues()[0];
}

function normalizeStatus_(status) {
  if (status === 'Hecho' || status === 'Entregado') return 'Para entregar';
  if (status === 'Espera de pago') return 'Para cobrar';
  return status || 'Para hacer';
}

function decodePayload_(payload) {
  if (!payload) throw new Error('Falta payload');

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

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
