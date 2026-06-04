/*
  CONFIGURACIÓN
  1) Pegá acá la URL de tu Apps Script terminado en /exec.
  2) Si queda vacío, la app funciona en modo prueba con localStorage.
*/
const API_URL = "https://script.google.com/macros/s/AKfycbxo2sr9yn75hlKcfXbPQtLargXs_DsoXwdCkihJuNt8Crw-hcKYx0uV2skem-lvrzJ7zg/exec";

const DEFAULT_STATUS = "Para hacer";
const STATUSES = ["Para hacer", "Para entregar", "Espera de pago", "Deudor", "Entregado"];

let orders = [];
let currentFilter = "Para hacer";

const $ = (id) => document.getElementById(id);
const list = $("ordersList");
const statusMsg = $("statusMsg");
const dialog = $("orderDialog");
const form = $("orderForm");

function uid() {
  return "PED-" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function money(value) {
  if (value === "" || value === null || value === undefined) return "Sin precio";
  const n = Number(value);
  if (Number.isNaN(n)) return "Sin precio";
  return n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function api(action, payload = {}) {
  if (!API_URL) return localApi(action, payload);

  const options = action === "list"
    ? {}
    : { method: "POST", body: JSON.stringify({ action, ...payload }) };

  const url = action === "list" ? `${API_URL}?action=list` : API_URL;
  const res = await fetch(url, options);
  if (!res.ok) throw new Error("No se pudo conectar con Google Sheets");
  return res.json();
}

function localApi(action, payload) {
  const key = "pedidos_3d_backdraft";
  const saved = JSON.parse(localStorage.getItem(key) || "[]");

  if (action === "list") return Promise.resolve({ ok: true, data: saved });
  if (action === "save") {
    const incoming = payload.order;
    const idx = saved.findIndex(o => o.id === incoming.id);
    const next = idx >= 0 ? saved.map(o => o.id === incoming.id ? incoming : o) : [incoming, ...saved];
    localStorage.setItem(key, JSON.stringify(next));
    return Promise.resolve({ ok: true, data: incoming });
  }
  if (action === "updateStatus") {
    const next = saved.map(o => o.id === payload.id ? { ...o, estado: payload.estado, actualizado: new Date().toISOString() } : o);
    localStorage.setItem(key, JSON.stringify(next));
    return Promise.resolve({ ok: true });
  }
}

async function loadOrders() {
  statusMsg.textContent = "Actualizando pedidos...";
  try {
    const result = await api("list");
    orders = result.data || [];
    render();
    statusMsg.textContent = API_URL ? "Conectado a Google Sheets." : "Modo prueba local: pegá tu URL de Apps Script en app.js para conectar la planilla.";
  } catch (err) {
    statusMsg.textContent = err.message;
  }
}

function renderSummary() {
  const counts = {
    "Para hacer": orders.filter(o => normalizedStatus(o.estado) === "Para hacer").length,
    "Para entregar": orders.filter(o => normalizedStatus(o.estado) === "Para entregar").length,
    "Espera de pago": orders.filter(o => normalizedStatus(o.estado) === "Espera de pago").length,
    "Deudor": orders.filter(o => normalizedStatus(o.estado) === "Deudor").length,
  };

  $("summary").innerHTML = `
    <div class="summary-card"><div class="summary-icon">🖨️</div><strong>${counts["Para hacer"]}</strong><span>Para hacer</span></div>
    <div class="summary-card"><div class="summary-icon">🚗</div><strong>${counts["Para entregar"]}</strong><span>Para entregar</span></div>
    <div class="summary-card"><div class="summary-icon">💵</div><strong>${counts["Espera de pago"]}</strong><span>Espera pago</span></div>
    <div class="summary-card"><div class="summary-icon">⚠️</div><strong>${counts["Deudor"]}</strong><span>Deudores</span></div>
  `;
}

function render() {
  renderSummary();
  const q = $("searchInput").value.toLowerCase().trim();
  let data = [...orders];

  if (currentFilter !== "Todos") data = data.filter(o => normalizedStatus(o.estado) === currentFilter);
  if (q) data = data.filter(o => `${o.pedido} ${o.cliente} ${o.nota}`.toLowerCase().includes(q));

  data.sort((a, b) => (a.fechaCompromiso || "9999-12-31").localeCompare(b.fechaCompromiso || "9999-12-31"));

  if (!data.length) {
    list.innerHTML = `<div class="empty">No hay pedidos en esta vista.</div>`;
    return;
  }

  list.innerHTML = data.map(orderCard).join("");
}

function normalizedStatus(status) {
  if (status === "Hecho") return "Para entregar";
  return status || DEFAULT_STATUS;
}

function orderCard(o) {
  const estado = normalizedStatus(o.estado);
  const debe = Number(o.precio || 0) - Number(o.sena || 0);
  const css = estado === "Deudor" ? "deudor" : estado === "Espera de pago" ? "espera" : estado === "Para entregar" ? "para-entregar" : estado === "Entregado" ? "entregado" : "para-hacer";
  const icon = estado === "Deudor" ? "⚠️" : estado === "Espera de pago" ? "💵" : estado === "Para entregar" ? "🚗" : estado === "Entregado" ? "✅" : "🖨️";
  const actions = actionButtons(o.id, estado);

  return `
    <details class="order-card ${css}" data-icon="${icon}">
      <summary class="card-summary">
        <div class="mini-icon" aria-hidden="true">${icon}</div>
        <div class="summary-main">
          <h3 class="order-title">${escapeHTML(o.pedido || "Pedido sin nombre")}</h3>
          <p class="client-line">Para: ${escapeHTML(o.cliente || "sin cliente")}</p>
        </div>
        <span class="badge">${escapeHTML(estado)}</span>
      </summary>

      <div class="card-detail">
        <div class="meta">
          <span>Precio: ${money(o.precio)}</span>
          ${o.sena ? `<span>Seña/pagado: ${money(o.sena)}</span>` : ""}
          ${o.precio ? `<span>Debe: ${money(Math.max(debe, 0))}</span>` : ""}
          ${o.fechaCompromiso ? `<span>Entrega: ${escapeHTML(o.fechaCompromiso)}</span>` : ""}
          ${o.fechaCarga ? `<span>Cargado: ${escapeHTML(o.fechaCarga)}</span>` : ""}
        </div>
        ${o.nota ? `<p class="note">${escapeHTML(o.nota)}</p>` : `<p class="note muted-note">Sin observaciones cargadas.</p>`}
        <div class="card-actions">
          ${actions}
          <button onclick="editOrder('${o.id}')">Editar detalle</button>
        </div>
      </div>
    </details>
  `;
}

function actionButtons(id, estado) {
  if (estado === "Para hacer") {
    return `<button class="quick" onclick="quickStatus('${id}', 'Para entregar')">🚗 Pasar a entregar</button>`;
  }
  if (estado === "Para entregar") {
    return `<button class="quick" onclick="quickStatus('${id}', 'Espera de pago')">💵 Espera de pago</button>`;
  }
  if (estado === "Espera de pago") {
    return `<button class="quick" onclick="quickStatus('${id}', 'Deudor')">⚠️ Marcar deudor</button><button onclick="quickStatus('${id}', 'Entregado')">✅ Cerrar</button>`;
  }
  if (estado === "Deudor") {
    return `<button class="quick" onclick="quickStatus('${id}', 'Entregado')">✅ Pago recibido / cerrar</button>`;
  }
  return `<button onclick="quickStatus('${id}', 'Para hacer')">Reabrir</button>`;
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function openForm(order = null) {
  form.reset();
  $("dialogTitle").textContent = order ? "Editar pedido" : "Nuevo pedido";
  $("orderId").value = order?.id || "";
  $("pedido").value = order?.pedido || "";
  $("cliente").value = order?.cliente || "";
  $("precio").value = order?.precio || "";
  $("sena").value = order?.sena || "";
  $("fechaCompromiso").value = order?.fechaCompromiso || "";
  $("estado").value = normalizedStatus(order?.estado) || DEFAULT_STATUS;
  $("nota").value = order?.nota || "";
  dialog.showModal();
}

window.editOrder = function(id) {
  const order = orders.find(o => o.id === id);
  if (order) openForm(order);
};

window.quickStatus = async function(id, estado) {
  const previous = orders;
  orders = orders.map(o => o.id === id ? { ...o, estado, actualizado: new Date().toISOString() } : o);
  render();
  try {
    await api("updateStatus", { id, estado });
  } catch (err) {
    orders = previous;
    render();
    alert(err.message);
  }
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("orderId").value || uid();
  const existing = orders.find(o => o.id === id);
  const order = {
    id,
    fechaCarga: existing?.fechaCarga || todayISO(),
    pedido: $("pedido").value.trim(),
    cliente: $("cliente").value.trim(),
    precio: $("precio").value,
    sena: $("sena").value,
    estado: $("estado").value || DEFAULT_STATUS,
    fechaCompromiso: $("fechaCompromiso").value,
    nota: $("nota").value.trim(),
    actualizado: new Date().toISOString()
  };

  if (!order.pedido) return;

  try {
    await api("save", { order });
    dialog.close();
    await loadOrders();
    currentFilter = order.estado;
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.filter === currentFilter));
    render();
  } catch (err) {
    alert(err.message);
  }
});

$("newOrderBtn").addEventListener("click", () => openForm());
$("closeDialogBtn").addEventListener("click", () => dialog.close());
$("syncBtn").addEventListener("click", loadOrders);
$("searchInput").addEventListener("input", render);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentFilter = tab.dataset.filter;
    render();
  });
});

loadOrders();
