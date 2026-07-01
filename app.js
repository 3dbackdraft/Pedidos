const API_URL = "https://script.google.com/macros/s/AKfycbzxZw_6sg86FlLSfnEkk4wvOfvdk2Xpr8WIjet0w3bwVe7PMzZlpMaoKzvGB0omy_Ym/exec";

const DEFAULT_STATUS = "Para hacer";
const HIDDEN_STATUSES = ["Finalizado"];
const PUBLISH_PENDING = "Pendiente";
const PUBLISH_DONE = "Publicado";
const PUBLISH_CHANNELS = {
  instagram: {
    key: "instagram",
    label: "Instagram",
    icon: "📱",
    statusField: "instagramEstado",
    textField: "instagramTexto",
    commentField: "instagramComentario"
  },
  mercadoLibre: {
    key: "mercadoLibre",
    label: "Mercado Libre",
    icon: "🛒",
    statusField: "mercadoLibreEstado",
    textField: "mercadoLibreTexto",
    commentField: "mercadoLibreComentario"
  }
};

let orders = [];
let purchases = [];
let movements = [];
let currentFilter = "Para hacer";
let currentSort = "nuevos";
let currentView = "pedidos";
let walletDateFrom = "";
let walletDateTo = "";
let savingOrder = false;
let savingPurchase = false;
let savingManualPublication = false;

const $ = (id) => document.getElementById(id);

const list = $("ordersList");
const statusMsg = $("statusMsg");
const dialog = $("orderDialog");
const form = $("orderForm");
const purchaseDialog = $("purchaseDialog");
const purchaseForm = $("purchaseForm");
const publicationDialog = $("publicationDialog");
const publicationForm = $("publicationForm");
const manualPublicationDialog = $("manualPublicationDialog");
const manualPublicationForm = $("manualPublicationForm");

function uid(prefix = "PED") {
  return prefix + "-" + new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
}

function money(value) {
  if (value === "" || value === null || value === undefined) {
    return "$ 0";
  }

  const n = Number(value);

  if (Number.isNaN(n)) {
    return "$ 0";
  }

  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function normalizedStatus(status) {
  if (status === "Hecho" || status === "Entregado") {
    return "Para entregar";
  }

  if (status === "Espera de pago") {
    return "Para cobrar";
  }

  return status || DEFAULT_STATUS;
}

function numberValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function totalPrice(order) {
  const explicitTotal = numberValue(order.precioTotal);
  if (explicitTotal > 0) return explicitTotal;

  const legacyPrice = numberValue(order.precio);
  if (legacyPrice > 0) return legacyPrice;

  return numberValue(order.precioUnitario) * numberValue(order.cantidad);
}

function publishPending(order) {
  if (!order) return false;
  return publicationTasks(order).some((task) => task.pending);
}

function publicationStatus(order, channel) {
  return String(order?.[channel.statusField] || "").trim();
}

function publicationPending(order, channel) {
  const status = publicationStatus(order, channel);
  return status.toLowerCase() === PUBLISH_PENDING.toLowerCase();
}

function publicationDone(order, channel) {
  const status = publicationStatus(order, channel);
  return status.toLowerCase() === PUBLISH_DONE.toLowerCase();
}

function publicationText(order, channel) {
  return order?.[channel.textField] || order?.pedido || "";
}

function publicationComment(order, channel) {
  return order?.[channel.commentField] || "";
}

function publicationTasks(order) {
  if (!order) return [];

  return Object.values(PUBLISH_CHANNELS).map((channel) => ({
    order,
    channel,
    pending: publicationPending(order, channel),
    done: publicationDone(order, channel),
    text: publicationText(order, channel),
    comment: publicationComment(order, channel)
  }));
}

function movementDate(value) {
  return value?.actualizado || value?.fecha || value?.fechaCarga || "";
}

function dateOnly(value) {
  return String(value || "").slice(0, 10);
}

function inWalletDateRange(value) {
  const date = dateOnly(value);

  if (!date) return !walletDateFrom && !walletDateTo;
  if (walletDateFrom && date < walletDateFrom) return false;
  if (walletDateTo && date > walletDateTo) return false;

  return true;
}

function filterByWalletDate(data, getDate) {
  if (!walletDateFrom && !walletDateTo) return data;
  return data.filter((item) => inWalletDateRange(getDate(item)));
}

function buildFallbackMovements() {
  const purchaseMovements = purchases.map((p) => ({
    id: p.id || uid("MOV"),
    fecha: p.fecha || "",
    tipo: "Compra",
    detalle: p.concepto || "Compra",
    monto: numberValue(p.monto) * -1,
    referencia: p.nota || ""
  }));

  const orderMovements = orders
    .filter((o) => ["Finalizado", "Deudor"].includes(normalizedStatus(o.estado)))
    .map((o) => {
      const estado = normalizedStatus(o.estado);
      const total = totalPrice(o);
      const debt = Math.max(total - numberValue(o.sena), 0);

      return {
        id: `${o.id}-${estado}`,
        fecha: o.actualizado || o.fechaCarga || "",
        tipo: estado === "Finalizado" ? "Cobro" : "Deudor",
        detalle: o.pedido || "Pedido",
        monto: estado === "Finalizado" ? total : debt,
        referencia: o.cliente || ""
      };
    });

  return [...purchaseMovements, ...orderMovements]
    .sort((a, b) => movementDate(b).localeCompare(movementDate(a)));
}

function base64UrlEncodeUnicode(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);

  let binary = "";

  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function compactOrder(order) {
  return {
    id: order.id,
    fechaCarga: order.fechaCarga,
    pedido: order.pedido,
    cliente: order.cliente,
    precioUnitario: order.precioUnitario,
    cantidad: order.cantidad,
    precioTotal: order.precioTotal,
    precio: order.precio,
    sena: order.sena,
    estado: order.estado,
    publicar: order.publicar,
    instagramEstado: order.instagramEstado,
    instagramTexto: order.instagramTexto,
    instagramComentario: order.instagramComentario,
    mercadoLibreEstado: order.mercadoLibreEstado,
    mercadoLibreTexto: order.mercadoLibreTexto,
    mercadoLibreComentario: order.mercadoLibreComentario,
    nota: order.nota,
    actualizado: order.actualizado
  };
}

function api(action, payload = {}) {
  if (action === "list") {
    return jsonp(`${API_URL}?action=list`);
  }

  if (action === "diagnostico") {
    return jsonp(`${API_URL}?action=diagnostico`);
  }

  if (action === "save") {
    const encoded = base64UrlEncodeUnicode(compactOrder(payload.order));
    return jsonp(`${API_URL}?action=save&payload=${encodeURIComponent(encoded)}`);
  }

  if (action === "savePurchase") {
    const encoded = base64UrlEncodeUnicode(payload.purchase);
    return jsonp(`${API_URL}?action=savePurchase&payload=${encodeURIComponent(encoded)}`);
  }

  if (action === "updateStatus") {
    const qs = new URLSearchParams({
      action: "updateStatus",
      id: payload.id,
      estado: payload.estado
    });

    return jsonp(`${API_URL}?${qs.toString()}`);
  }

  if (action === "updatePublish") {
    const qs = new URLSearchParams({
      action: "updatePublish",
      id: payload.id,
      publicar: payload.publicar
    });

    return jsonp(`${API_URL}?${qs.toString()}`);
  }

  if (action === "savePublicationTask") {
    const encoded = base64UrlEncodeUnicode(payload.task);
    return jsonp(`${API_URL}?action=savePublicationTask&payload=${encodeURIComponent(encoded)}`);
  }

  return Promise.reject(new Error("Accion no reconocida"));
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "cb_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    const sep = url.includes("?") ? "&" : "?";
    const script = document.createElement("script");

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "No respondio Google Sheets. Revisa la implementacion /exec y permisos."
        )
      );
    }, 45000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();

      if (!data || data.ok === false) {
        reject(
          new Error(
            data?.error ||
            "Error al guardar en Google Sheets"
          )
        );
      } else {
        resolve(data);
      }
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo conectar con Google Sheets"));
    };

    script.src = `${url}${sep}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

async function loadData() {
  statusMsg.textContent = "Actualizando pedidos, compras y billetera...";
  statusMsg.className = "status-msg";

  try {
    const result = await api("list");

    orders = (result.data || []).map((o) => {
      const estado = normalizedStatus(o.estado);
      const legacyPending =
        estado === "Para publicar" ||
        String(o.publicar || "").toLowerCase() === PUBLISH_PENDING.toLowerCase();

      return {
        ...o,
        estado: estado === "Para publicar" ? "Para entregar" : estado,
        instagramEstado: legacyPending && !o.instagramEstado
          ? PUBLISH_PENDING
          : o.instagramEstado,
        mercadoLibreEstado: legacyPending && !o.mercadoLibreEstado
          ? PUBLISH_PENDING
          : o.mercadoLibreEstado,
        instagramTexto: o.instagramTexto || o.pedido || "",
        mercadoLibreTexto: o.mercadoLibreTexto || o.pedido || "",
        publicar: legacyPending ? PUBLISH_PENDING : o.publicar
      };
    });

    purchases = result.purchases || [];
    movements = result.movements || [];

    render();

    statusMsg.textContent =
      "Conectado a Google Sheets. Cambios guardados en BASE PEDIDOS, COMPRAS y MOVIMIENTOS.";

    statusMsg.className = "status-msg ok";
  } catch (err) {
    statusMsg.textContent = err.message;
    statusMsg.className = "status-msg error";
  }
}

function activeOrders() {
  return orders.filter((o) =>
    !HIDDEN_STATUSES.includes(
      normalizedStatus(o.estado)
    )
  );
}

function renderSummary() {
  const active = activeOrders();

  const counts = {
    "Para hacer": active.filter((o) => normalizedStatus(o.estado) === "Para hacer").length,
    "Para entregar": active.filter((o) => normalizedStatus(o.estado) === "Para entregar").length,
    "Para publicar": active.reduce((sum, o) =>
      sum + publicationTasks(o).filter((task) => task.pending).length,
      0
    ),
    "Para cobrar": active.filter((o) => normalizedStatus(o.estado) === "Para cobrar").length,
    "Deudor": active.filter((o) => normalizedStatus(o.estado) === "Deudor").length
  };

  $("summary").innerHTML = `
    <div class="summary-card">
      <div class="summary-icon">🖨️</div>
      <strong>${counts["Para hacer"]}</strong>
      <span>Para hacer</span>
    </div>

    <div class="summary-card">
      <div class="summary-icon">🚗</div>
      <strong>${counts["Para entregar"]}</strong>
      <span>Para entregar</span>
    </div>

    <div class="summary-card">
      <div class="summary-icon">📸</div>
      <strong>${counts["Para publicar"]}</strong>
      <span>Para publicar</span>
    </div>

    <div class="summary-card">
      <div class="summary-icon">💵</div>
      <strong>${counts["Para cobrar"]}</strong>
      <span>Para cobrar</span>
    </div>

    <div class="summary-card">
      <div class="summary-icon">⚠️</div>
      <strong>${counts["Deudor"]}</strong>
      <span>Deudores</span>
    </div>
  `;
}

function renderMetrics() {
  const scopedOrders = filterByWalletDate(orders, movementDate);
  const scopedPurchases = filterByWalletDate(purchases, (p) => p.fecha || p.actualizado);

  const sold = scopedOrders.filter((o) => normalizedStatus(o.estado) === "Finalizado");
  const toCollect = scopedOrders.filter((o) => normalizedStatus(o.estado) === "Para cobrar");
  const debtors = scopedOrders.filter((o) => normalizedStatus(o.estado) === "Deudor");
  const toDeliver = scopedOrders.filter((o) => normalizedStatus(o.estado) === "Para entregar");
  const inProduction = scopedOrders.filter((o) => normalizedStatus(o.estado) === "Para hacer");

  const salesTotal = sold.reduce((sum, o) => sum + totalPrice(o), 0);
  const toCollectTotal = toCollect.reduce((sum, o) => sum + Math.max(totalPrice(o) - numberValue(o.sena), 0), 0);
  const debtorsTotal = debtors.reduce((sum, o) => sum + Math.max(totalPrice(o) - numberValue(o.sena), 0), 0);
  const toDeliverTotal = toDeliver.reduce((sum, o) => sum + Math.max(totalPrice(o) - numberValue(o.sena), 0), 0);
  const inProductionTotal = inProduction.reduce((sum, o) => sum + totalPrice(o), 0);
  const profit = salesTotal * 0.5;
  const purchasesTotal = scopedPurchases.reduce((sum, p) => sum + numberValue(p.monto), 0);
  const balance = profit - purchasesTotal;
  const receivableTotal = toCollectTotal + debtorsTotal;
  const pipelineTotal = receivableTotal + toDeliverTotal + inProductionTotal;

  $("metrics").innerHTML = `
    <div class="metric-card">
      <span>Ingresó cobrado</span>
      <strong>${money(salesTotal)}</strong>
    </div>

    <div class="metric-card">
      <span>Ganancia 50%</span>
      <strong>${money(profit)}</strong>
    </div>

    <div class="metric-card">
      <span>Compras</span>
      <strong>${money(purchasesTotal)}</strong>
    </div>

    <div class="metric-card ${balance < 0 ? "negative" : "positive"}">
      <span>Balance</span>
      <strong>${money(balance)}</strong>
    </div>

    <div class="metric-card soft">
      <span>Para cobrar</span>
      <strong>${money(toCollectTotal)}</strong>
    </div>

    <div class="metric-card warn">
      <span>Deudores</span>
      <strong>${money(debtorsTotal)}</strong>
    </div>

    <div class="metric-card soft">
      <span>Listo para entregar</span>
      <strong>${money(toDeliverTotal)}</strong>
    </div>

    <div class="metric-card">
      <span>En producción</span>
      <strong>${money(inProductionTotal)}</strong>
    </div>

    <div class="metric-card">
      <span>Potencial activo</span>
      <strong>${money(pipelineTotal)}</strong>
    </div>
  `;

  $("walletNotes").innerHTML = `
    <article class="wallet-note">
      <strong>Disponible real</strong>
      <span>Ganancia cobrada menos compras: ${money(balance)}.</span>
    </article>

    <article class="wallet-note">
      <strong>Plata pendiente de entrar</strong>
      <span>Entre para cobrar y deudores: ${money(receivableTotal)}.</span>
    </article>

    <article class="wallet-note">
      <strong>Trabajo que todavía puede convertirse en cobro</strong>
      <span>Pedidos para entregar y en producción: ${money(toDeliverTotal + inProductionTotal)}.</span>
    </article>
  `;
}

function renderPurchases() {
  const latest = filterByWalletDate([...purchases], (p) => p.fecha || p.actualizado)
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    .slice(0, 5);

  $("purchaseList").innerHTML = latest.length
    ? latest.map((p) => `
      <article class="purchase-item">
        <div>
          <strong>${escapeHTML(p.concepto || "Compra sin detalle")}</strong>
          <span>${escapeHTML(p.fecha || "")}</span>
        </div>
        <b>${money(p.monto)}</b>
      </article>
    `).join("")
    : `<div class="empty compact-empty">Todavia no hay compras cargadas.</div>`;
}

function renderMovements() {
  const data = filterByWalletDate(
    movements.length ? movements : buildFallbackMovements(),
    movementDate
  )
    .sort((a, b) => movementDate(b).localeCompare(movementDate(a)))
    .slice(0, 12);

  $("movementList").innerHTML = data.length
    ? data.map((m) => {
      const amount = numberValue(m.monto);
      const isOut = amount < 0 || String(m.tipo || "").toLowerCase() === "compra";

      return `
        <article class="movement-item ${isOut ? "out" : "in"}">
          <div>
            <strong>${escapeHTML(m.tipo || "Movimiento")}</strong>
            <span>${escapeHTML(m.detalle || "")}</span>
            <small>${escapeHTML(m.fecha || "")}${m.referencia ? ` · ${escapeHTML(m.referencia)}` : ""}</small>
          </div>
          <b>${money(amount)}</b>
        </article>
      `;
    }).join("")
    : `<div class="empty compact-empty">Todavia no hay movimientos cargados.</div>`;
}

function sortOrders(data) {
  const sorted = [...data];

  if (currentSort === "nuevos") {
    sorted.sort((a, b) =>
      (b.fechaCarga || "").localeCompare(a.fechaCarga || "")
    );
  }

  if (currentSort === "viejos") {
    sorted.sort((a, b) =>
      (a.fechaCarga || "").localeCompare(b.fechaCarga || "")
    );
  }

  if (currentSort === "cliente") {
    sorted.sort((a, b) =>
      (a.cliente || "").localeCompare(
        b.cliente || "",
        "es",
        { sensitivity: "base" }
      )
    );
  }

  if (currentSort === "deuda") {
    sorted.sort((a, b) => {
      const deudaA = totalPrice(a) - numberValue(a.sena);
      const deudaB = totalPrice(b) - numberValue(b.sena);

      return deudaB - deudaA;
    });
  }

  if (currentSort === "monto") {
    sorted.sort((a, b) => totalPrice(b) - totalPrice(a));
  }

  return sorted;
}

function render() {
  renderSummary();
  renderMetrics();
  renderPurchases();
  renderMovements();
  renderView();

  const q = $("searchInput")
    .value
    .toLowerCase()
    .trim();

  let data = activeOrders();

  if (currentFilter !== "Todos") {
    data = currentFilter === "Para publicar"
      ? data.filter(publishPending)
      : data.filter((o) =>
          normalizedStatus(o.estado) === currentFilter
        );
  }

  if (q) {
    data = data.filter((o) =>
      `${o.pedido} ${o.cliente} ${o.nota}`
        .toLowerCase()
        .includes(q)
    );
  }

  data = sortOrders(data);

  if (currentFilter === "Para publicar") {
    const tasks = data.flatMap((order) =>
      publicationTasks(order).filter((task) => task.pending)
    );

    if (!tasks.length) {
      list.innerHTML = `
        <div class="empty">
          No hay publicaciones pendientes.
        </div>
      `;

      return;
    }

    list.innerHTML = tasks.map(publicationTaskCard).join("");
    return;
  }

  if (!data.length) {
    list.innerHTML = `
      <div class="empty">
        No hay pedidos activos en esta vista.
      </div>
    `;

    return;
  }

  list.innerHTML = data.map(orderCard).join("");
}

function renderView() {
  $("ordersView").classList.toggle("hidden", currentView !== "pedidos");
  $("walletView").classList.toggle("hidden", currentView !== "billetera");
  $("publicationTools").classList.toggle(
    "hidden",
    currentView !== "pedidos" || currentFilter !== "Para publicar"
  );

  document
    .querySelectorAll(".view-tab")
    .forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.view === currentView)
    );
}

function publicationTaskCard(task) {
  const { order, channel, text, comment } = task;
  const total = totalPrice(order);

  return `
    <details class="order-card para-publicar publication-card">

      <summary class="card-summary publication-summary">

        <div class="mini-icon">
          ${channel.icon}
        </div>

        <div class="summary-main">

          <h3 class="order-title">
            ${escapeHTML(order.pedido || "Publicación sin nombre")}
          </h3>

          <p class="client-line">
            ${escapeHTML(order.cliente || "sin referencia")}
          </p>

        </div>

        <span class="badge">
          ${escapeHTML(channel.label)}
        </span>

      </summary>

      <div class="card-detail">

        <div class="meta">
          <span>Canal: ${channel.icon} ${escapeHTML(channel.label)}</span>
          <span>Cliente: ${escapeHTML(order.cliente || "sin cliente")}</span>
          ${total ? `<span>Total: ${money(total)}</span>` : ""}
          ${order.cantidad ? `<span>Cantidad: ${escapeHTML(order.cantidad)}</span>` : ""}
        </div>

        <div class="publication-copy">
          <strong>Info para publicar</strong>
          <p>${escapeHTML(text || "Sin texto cargado.")}</p>
        </div>

        <div class="publication-copy comment">
          <strong>Comentario</strong>
          <p>${escapeHTML(comment || "Sin comentario.")}</p>
        </div>

        <div class="card-actions">

          <button class="quick" onclick="openPublicationEditor('${order.id}', '${channel.key}')">
            ✏️ Editar publicación
          </button>

          <button onclick="markChannelPublished('${order.id}', '${channel.key}')">
            ✅ Marcar publicado
          </button>

        </div>

      </div>

    </details>
  `;
}

function orderCard(o) {
  const estado = normalizedStatus(o.estado);
  const total = totalPrice(o);
  const debe = total - numberValue(o.sena);

  const css =
    estado === "Deudor"
      ? "deudor"
      : estado === "Para cobrar"
        ? "espera"
        : publishPending(o)
          ? "para-publicar"
          : estado === "Para entregar"
            ? "para-entregar"
            : "para-hacer";

  const icon =
    estado === "Deudor"
      ? "⚠️"
      : estado === "Para cobrar"
        ? "💵"
        : publishPending(o)
          ? "📸"
          : estado === "Para entregar"
            ? "🚗"
            : "🖨️";

  const badge = publishPending(o) && estado === "Para entregar"
    ? "Para entregar + publicar"
    : estado;
  const pendingLabels = publicationTasks(o)
    .filter((task) => task.pending)
    .map((task) => task.channel.label);

  return `
    <details class="order-card ${css}">

      <summary class="card-summary">

        <div class="mini-icon">
          ${icon}
        </div>

        <div class="summary-main">

          <h3 class="order-title">
            ${escapeHTML(o.pedido || "Pedido sin nombre")}
          </h3>

          <p class="client-line">
            Para: ${escapeHTML(o.cliente || "sin cliente")}
          </p>

        </div>

        <span class="badge">
          ${escapeHTML(badge)}
        </span>

      </summary>

      <div class="card-detail">

        <div class="meta">

          <span>Unitario: ${money(o.precioUnitario || total)}</span>
          <span>Cantidad: ${escapeHTML(o.cantidad || 1)}</span>
          <span>Total: ${money(total)}</span>

          ${
            o.sena
              ? `<span>Seña/pagado: ${money(o.sena)}</span>`
              : ""
          }

          ${
            total
              ? `<span>Debe: ${money(Math.max(debe, 0))}</span>`
              : ""
          }

          ${
            o.fechaCarga
              ? `<span>Cargado: ${escapeHTML(o.fechaCarga)}</span>`
              : ""
          }

          ${
            pendingLabels.length
              ? `<span>Publicar: ${escapeHTML(pendingLabels.join(" + "))}</span>`
              : ""
          }

        </div>

        ${
          o.nota
            ? `<p class="note">${escapeHTML(o.nota)}</p>`
            : `<p class="note muted-note">Sin observaciones cargadas.</p>`
        }

        <div class="card-actions">

          ${actionButtons(o)}

          <button onclick="editOrder('${o.id}')">
            ✏️ Editar
          </button>

        </div>

      </div>

    </details>
  `;
}

function actionButtons(o) {
  const id = o.id;
  const estado = normalizedStatus(o.estado);
  const publishButtons = publicationTasks(o)
    .filter((task) => task.pending)
    .map((task) => `
      <button onclick="openPublicationEditor('${id}', '${task.channel.key}')">
        ${task.channel.icon} Editar ${task.channel.label}
      </button>
    `)
    .join("");

  if (estado === "Para hacer") {
    return `
      <button class="quick" onclick="finishProduction('${id}')">
        ✅ Sale de producción
      </button>
    `;
  }

  if (estado === "Para entregar") {
    return `
      ${publishButtons}
      <button class="quick" onclick="quickStatus('${id}', 'Para cobrar')">
        💵 Entregado · pasar a cobrar
      </button>
    `;
  }

  if (estado === "Para cobrar") {
    return `
      <button class="quick" onclick="quickStatus('${id}', 'Finalizado')">
        ✅ Cobrado · finalizar
      </button>

      <button onclick="quickStatus('${id}', 'Deudor')">
        ⚠️ Quedo debiendo
      </button>
    `;
  }

  if (estado === "Deudor") {
    return `
      <button class="quick" onclick="quickStatus('${id}', 'Finalizado')">
        ✅ Pago recibido · finalizar
      </button>
    `;
  }

  return "";
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/[&<>'"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[c]));
}

function openForm(order = null) {
  form.reset();

  $("dialogTitle").textContent =
    order
      ? "Editar pedido"
      : "Nuevo pedido";

  const unit = order?.precioUnitario || order?.precio || "";
  const qty = order?.cantidad || (order ? 1 : "");
  const total = order?.precioTotal || order?.precio || "";

  $("orderId").value = order?.id || "";
  $("pedido").value = order?.pedido || "";
  $("cliente").value = order?.cliente || "";
  $("precioUnitario").value = unit;
  $("cantidad").value = qty;
  $("precioTotal").value = total;
  $("sena").value = order?.sena || "";
  $("estado").value =
    normalizedStatus(order?.estado) || DEFAULT_STATUS;
  $("publicar").checked = publishPending(order);
  $("nota").value = order?.nota || "";
  $("stateField").classList.toggle("hidden", !order);
  $("publishField").classList.add("hidden");

  dialog.showModal();
}

function openPurchaseForm() {
  purchaseForm.reset();
  $("purchaseDate").value = todayISO();
  purchaseDialog.showModal();
}

function openManualPublicationForm() {
  manualPublicationForm.reset();
  $("manualInstagram").checked = true;
  $("manualMercadoLibre").checked = true;
  manualPublicationDialog.showModal();
}

function openPublicationForm(order, channel) {
  publicationForm.reset();

  $("publicationOrderId").value = order.id;
  $("publicationChannel").value = channel.key;
  $("publicationTitle").textContent = `Publicar en ${channel.label}`;
  $("publicationProduct").textContent = order.pedido || "Pedido sin nombre";
  $("publicationText").value = publicationText(order, channel);
  $("publicationComment").value = publicationComment(order, channel);
  $("publicationStatus").value = publicationDone(order, channel)
    ? PUBLISH_DONE
    : PUBLISH_PENDING;

  publicationDialog.showModal();
}

function syncTotalFromInputs() {
  const unit = numberValue($("precioUnitario").value);
  const qty = numberValue($("cantidad").value);

  if (unit > 0 && qty > 0) {
    $("precioTotal").value = Math.round(unit * qty);
  }
}

window.editOrder = function(id) {
  const order = orders.find((o) => o.id === id);

  if (order) {
    openForm(order);
  }
};

window.openPublicationEditor = function(id, channelKey) {
  const order = orders.find((o) => o.id === id);
  const channel = PUBLISH_CHANNELS[channelKey];

  if (order && channel) {
    openPublicationForm(order, channel);
  }
};

window.finishProduction = async function(id) {
  const withPhotos = confirm(
    "Cuando sale de Para hacer: ¿tambien hay que publicarlo porque sacaron fotos?\n\nAceptar: Para publicar\nCancelar: Solo para entregar"
  );

  const previous = orders;

  orders = orders.map((o) =>
    o.id === id
      ? {
          ...o,
          estado: "Para entregar",
          publicar: withPhotos ? PUBLISH_PENDING : "",
          instagramEstado: withPhotos ? PUBLISH_PENDING : "",
          instagramTexto: withPhotos ? publicationText(o, PUBLISH_CHANNELS.instagram) : o.instagramTexto,
          mercadoLibreEstado: withPhotos ? PUBLISH_PENDING : "",
          mercadoLibreTexto: withPhotos ? publicationText(o, PUBLISH_CHANNELS.mercadoLibre) : o.mercadoLibreTexto,
          actualizado: new Date().toISOString()
        }
      : o
  );

  render();

  try {
    await api("updateStatus", { id, estado: "Para entregar" });
    await api("savePublicationTask", {
      task: {
        id,
        channel: "instagram",
        estado: withPhotos ? PUBLISH_PENDING : "",
        texto: orders.find((o) => o.id === id)?.pedido || "",
        comentario: orders.find((o) => o.id === id)?.instagramComentario || ""
      }
    });
    await api("savePublicationTask", {
      task: {
        id,
        channel: "mercadoLibre",
        estado: withPhotos ? PUBLISH_PENDING : "",
        texto: orders.find((o) => o.id === id)?.pedido || "",
        comentario: orders.find((o) => o.id === id)?.mercadoLibreComentario || ""
      }
    });
    await api("updatePublish", { id, publicar: withPhotos ? PUBLISH_PENDING : "" });

    statusMsg.textContent = withPhotos
      ? "Pedido enviado a Para entregar y Para publicar."
      : "Pedido enviado a Para entregar.";

    statusMsg.className = "status-msg ok";

    await loadData();
  } catch (err) {
    orders = previous;
    render();
    alert(err.message);
  }
};

window.markChannelPublished = async function(id, channelKey) {
  const channel = PUBLISH_CHANNELS[channelKey];
  if (!channel) return;

  const previous = orders;

  orders = orders.map((o) =>
    o.id === id
      ? {
          ...o,
          [channel.statusField]: PUBLISH_DONE,
          actualizado: new Date().toISOString()
        }
      : o
  );

  render();

  try {
    const order = orders.find((o) => o.id === id);

    await api("savePublicationTask", {
      task: {
        id,
        channel: channel.key,
        estado: PUBLISH_DONE,
        texto: publicationText(order, channel),
        comentario: publicationComment(order, channel)
      }
    });

    if (!publishPending(order)) {
      await api("updatePublish", { id, publicar: PUBLISH_DONE });
    }

    statusMsg.textContent = `${channel.label} marcado como publicado.`;
    statusMsg.className = "status-msg ok";

    await loadData();
  } catch (err) {
    orders = previous;
    render();
    alert(err.message);
  }
};

window.quickStatus = async function(id, estado) {
  const previous = orders;

  orders = orders.map((o) =>
    o.id === id
      ? {
          ...o,
          estado,
          actualizado: new Date().toISOString()
        }
      : o
  );

  render();

  try {
    await api(
      "updateStatus",
      { id, estado }
    );

    statusMsg.textContent =
      "Estado actualizado y registrado en Google Sheets.";

    statusMsg.className = "status-msg ok";

    await loadData();
  } catch (err) {
    orders = previous;
    render();
    alert(err.message);
  }
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (savingOrder) {
    return;
  }

  savingOrder = true;

  const submitBtn =
    form.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  const id = $("orderId").value || uid();
  const existing = orders.find((o) => o.id === id);
  const isNewOrder = !existing;
  const unit = numberValue($("precioUnitario").value);
  const qty = numberValue($("cantidad").value) || 1;
  const total = numberValue($("precioTotal").value) || (unit * qty);

  const order = {
    id,
    fechaCarga: existing?.fechaCarga || todayISO(),
    pedido: $("pedido").value.trim(),
    cliente: $("cliente").value.trim(),
    precioUnitario: unit || "",
    cantidad: qty || "",
    precioTotal: total || "",
    precio: total || "",
    sena: $("sena").value,
    estado: isNewOrder ? DEFAULT_STATUS : ($("estado").value || DEFAULT_STATUS),
    publicar: isNewOrder ? "" : (existing?.publicar || ""),
    instagramEstado: isNewOrder
      ? ""
      : existing?.instagramEstado || "",
    instagramTexto: existing?.instagramTexto || $("pedido").value.trim(),
    instagramComentario: existing?.instagramComentario || "",
    mercadoLibreEstado: isNewOrder
      ? ""
      : existing?.mercadoLibreEstado || "",
    mercadoLibreTexto: existing?.mercadoLibreTexto || $("pedido").value.trim(),
    mercadoLibreComentario: existing?.mercadoLibreComentario || "",
    nota: $("nota").value.trim(),
    actualizado: new Date().toISOString()
  };

  if (!order.pedido) {
    savingOrder = false;

    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar en Sheet";

    return;
  }

  try {
    await api("save", { order });

    dialog.close();

    statusMsg.textContent =
      "Pedido guardado en Google Sheets.";

    statusMsg.className = "status-msg ok";

    await loadData();

    currentFilter =
      HIDDEN_STATUSES.includes(order.estado)
        ? "Para hacer"
        : order.estado;

    document
      .querySelectorAll(".tab")
      .forEach((t) =>
        t.classList.toggle(
          "active",
          t.dataset.filter === currentFilter
        )
      );

    render();
  } catch (err) {
    alert(err.message);
  } finally {
    savingOrder = false;

    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar en Sheet";
  }
});

purchaseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (savingPurchase) {
    return;
  }

  savingPurchase = true;

  const submitBtn =
    purchaseForm.querySelector('button[type="submit"]');

  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  const purchase = {
    id: uid("COM"),
    fecha: $("purchaseDate").value || todayISO(),
    concepto: $("purchaseConcept").value.trim(),
    monto: $("purchaseAmount").value,
    nota: $("purchaseNote").value.trim(),
    actualizado: new Date().toISOString()
  };

  if (!purchase.concepto || !purchase.monto) {
    savingPurchase = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar compra";
    return;
  }

  try {
    await api("savePurchase", { purchase });
    purchaseDialog.close();
    statusMsg.textContent = "Compra guardada en Google Sheets.";
    statusMsg.className = "status-msg ok";
    await loadData();
  } catch (err) {
    alert(err.message);
  } finally {
    savingPurchase = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar compra";
  }
});

manualPublicationForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (savingManualPublication) {
    return;
  }

  const instagram = $("manualInstagram").checked;
  const mercadoLibre = $("manualMercadoLibre").checked;

  if (!instagram && !mercadoLibre) {
    alert("Elegí Instagram, Mercado Libre o ambos.");
    return;
  }

  savingManualPublication = true;

  const submitBtn = manualPublicationForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Creando...";

  const text = $("manualPublicationText").value.trim();
  const comment = $("manualPublicationComment").value.trim();
  const id = uid("PUB");

  const order = {
    id,
    fechaCarga: todayISO(),
    pedido: text,
    cliente: $("manualPublicationClient").value.trim(),
    precioUnitario: "",
    cantidad: 1,
    precioTotal: "",
    precio: "",
    sena: "",
    estado: "Para entregar",
    publicar: PUBLISH_PENDING,
    instagramEstado: instagram ? PUBLISH_PENDING : "",
    instagramTexto: instagram ? text : "",
    instagramComentario: instagram ? comment : "",
    mercadoLibreEstado: mercadoLibre ? PUBLISH_PENDING : "",
    mercadoLibreTexto: mercadoLibre ? text : "",
    mercadoLibreComentario: mercadoLibre ? comment : "",
    nota: comment,
    actualizado: new Date().toISOString()
  };

  if (!order.pedido) {
    savingManualPublication = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Crear publicación";
    return;
  }

  try {
    await api("save", { order });
    manualPublicationDialog.close();
    statusMsg.textContent = "Publicación manual creada.";
    statusMsg.className = "status-msg ok";
    await loadData();
    currentView = "pedidos";
    currentFilter = "Para publicar";

    document
      .querySelectorAll(".tab")
      .forEach((t) =>
        t.classList.toggle(
          "active",
          t.dataset.filter === currentFilter
        )
      );

    render();
  } catch (err) {
    alert(err.message);
  } finally {
    savingManualPublication = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Crear publicación";
  }
});

publicationForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = $("publicationOrderId").value;
  const channel = PUBLISH_CHANNELS[$("publicationChannel").value];

  if (!id || !channel) {
    return;
  }

  const status = $("publicationStatus").value;
  const text = $("publicationText").value.trim();
  const comment = $("publicationComment").value.trim();
  const previous = orders;

  orders = orders.map((o) =>
    o.id === id
      ? {
          ...o,
          [channel.statusField]: status,
          [channel.textField]: text,
          [channel.commentField]: comment,
          actualizado: new Date().toISOString()
        }
      : o
  );

  render();

  const submitBtn = publicationForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

  try {
    await api("savePublicationTask", {
      task: {
        id,
        channel: channel.key,
        estado: status,
        texto: text,
        comentario: comment
      }
    });

    const order = orders.find((o) => o.id === id);

    await api("updatePublish", {
      id,
      publicar: publishPending(order)
        ? PUBLISH_PENDING
        : PUBLISH_DONE
    });

    publicationDialog.close();
    statusMsg.textContent = `Publicacion de ${channel.label} guardada.`;
    statusMsg.className = "status-msg ok";
    await loadData();
  } catch (err) {
    orders = previous;
    render();
    alert(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar publicación";
  }
});

$("newOrderBtn").addEventListener("click", () => {
  openForm();
});

$("newPurchaseBtn").addEventListener("click", openPurchaseForm);

$("newManualPublicationBtn").addEventListener("click", openManualPublicationForm);

$("closeDialogBtn").addEventListener("click", () => {
  dialog.close();
});

$("closePurchaseDialogBtn").addEventListener("click", () => {
  purchaseDialog.close();
});

$("closePublicationDialogBtn").addEventListener("click", () => {
  publicationDialog.close();
});

$("closeManualPublicationDialogBtn").addEventListener("click", () => {
  manualPublicationDialog.close();
});

$("syncBtn").addEventListener("click", loadData);

$("searchInput").addEventListener("input", render);

$("sortSelect").addEventListener("change", (e) => {
  currentSort = e.target.value;
  render();
});

$("walletDateFrom").addEventListener("change", (e) => {
  walletDateFrom = e.target.value;
  render();
});

$("walletDateTo").addEventListener("change", (e) => {
  walletDateTo = e.target.value;
  render();
});

$("clearWalletDatesBtn").addEventListener("click", () => {
  walletDateFrom = "";
  walletDateTo = "";
  $("walletDateFrom").value = "";
  $("walletDateTo").value = "";
  render();
});

$("precioUnitario").addEventListener("input", syncTotalFromInputs);
$("cantidad").addEventListener("input", syncTotalFromInputs);

document
  .querySelectorAll(".tab")
  .forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) =>
          t.classList.remove("active")
        );

      tab.classList.add("active");

      currentFilter = tab.dataset.filter;

      render();
    });
  });

document
  .querySelectorAll(".view-tab")
  .forEach((tab) => {
    tab.addEventListener("click", () => {
      currentView = tab.dataset.view;
      renderView();
    });
  });

loadData();
