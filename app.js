/*
  CONFIGURACIÓN
  1) Pegá acá la URL de tu Apps Script terminado en /exec.
  2) Si queda vacío, la app funciona en modo prueba con localStorage.
*/
const API_URL = "https://script.google.com/macros/s/AKfycbxo2sr9yn75hlKcfXbPQtLargXs_DsoXwdCkihJuNt8Crw-hcKYx0uV2skem-lvrzJ7zg/exec";

const DEFAULT_STATUS = "Para hacer";
const STATUSES = ["Para hacer", "Hecho", "Entregado", "Espera de pago", "Deudor"];

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
    "Para hacer": orders.filter(o => o.estado === "Para hacer").length,
    "Hecho": orders.filter(o => o.estado === "Hecho").length,
    "Espera de pago": orders.filter(o => o.estado === "Espera de pago").length,
    "Deudor": orders.filter(o => o.estado === "Deudor").length,
  };

  $("summary").innerHTML = `
    <div class="summary-card"><div class="summary-icon">🖨️</div><strong>${counts["Para hacer"]}</strong><span>Para hacer</span></div>
    <div class="summary-card"><div class="summary-icon">🚗</div><strong>${counts["Hecho"]}</strong><span>Para entregar</span></div>
    <div class="summary-card"><div class="summary-icon">💵</div><strong>${counts["Espera de pago"]}</strong><span>Espera pago</span></div>
    <div class="summary-card"><div class="summary-icon">⚠️</div><strong>${counts["Deudor"]}</strong><span>Deudores</span></div>
  `;
}

function render() {
  renderSummary();
  const q = $("searchInput").value.toLowerCase().trim();
  let data = [...orders];

  if (currentFilter !== "Todos") data = data.filter(o => o.estado === currentFilter);
  if (q) data = data.filter(o => `${o.pedido} ${o.cliente} ${o.nota}`.toLowerCase().includes(q));

  data.sort((a, b) => (a.fechaCompromiso || "9999-12-31").localeCompare(b.fechaCompromiso || "9999-12-31"));

  if (!data.length) {
    list.innerHTML = `<div class="empty">No hay pedidos en esta vista.</div>`;
    return;
  }

  list.innerHTML = data.map(orderCard).join("");
}

function orderCard(o) {
  const debe = Number(o.precio || 0) - Number(o.sena || 0);
  const css = o.estado === "Deudor" ? "deudor" : o.estado === "Espera de pago" ? "espera" : o.estado === "Hecho" ? "hecho" : o.estado === "Entregado" ? "entregado" : "";
  const icon = o.estado === "Deudor" ? "⚠️" : o.estado === "Espera de pago" ? "💵" : o.estado === "Hecho" ? "🚗" : o.estado === "Entregado" ? "✅" : "🖨️";
  const nextButton = o.estado === "Para hacer"
    ? `<button class="quick" onclick="quickStatus('${o.id}', 'Hecho')">Marcar hecho</button>`
    : o.estado === "Hecho"
      ? `<button class="quick" onclick="quickStatus('${o.id}', 'Entregado')">Marcar entregado</button>`
      : `<button onclick="quickStatus('${o.id}', 'Para hacer')">Volver a hacer</button>`;

  return `
    <article class="order-card ${css}" data-icon="${icon}">
      <div class="order-head">
        <h3 class="order-title">${escapeHTML(o.pedido)}</h3>
        <span class="badge">${escapeHTML(o.estado || DEFAULT_STATUS)}</span>
      </div>
      <div class="meta">
        <span>Para: ${escapeHTML(o.cliente || "sin cliente")}</span>
        <span>${money(o.precio)}</span>
        ${o.sena ? `<span>Seña: ${money(o.sena)}</span>` : ""}
        ${o.precio ? `<span>Debe: ${money(Math.max(debe, 0))}</span>` : ""}
        ${o.fechaCompromiso ? `<span>Entrega: ${escapeHTML(o.fechaCompromiso)}</span>` : ""}
      </div>
      ${o.nota ? `<p class="note">${escapeHTML(o.nota)}</p>` : ""}
      <div class="card-actions">
        ${nextButton}
        <button onclick="editOrder('${o.id}')">Editar</button>
        <button onclick="quickStatus('${o.id}', 'Espera de pago')">Espera pago</button>
        <button onclick="quickStatus('${o.id}', 'Deudor')">Deudor</button>
      </div>
    </article>
  `;
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
  $("estado").value = order?.estado || DEFAULT_STATUS;
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
