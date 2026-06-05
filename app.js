const API_URL = "https://script.google.com/macros/s/AKfycbwGlarDJWfz6LrxvqLVPDBvbroJ9PADBXWspqnE_VFAJXcPZI5bVWt6Z1TTqjcDecc/exec";

const DEFAULT_STATUS = "Para hacer";
const HIDDEN_STATUSES = ["Finalizado"];

let orders = [];
let currentFilter = "Para hacer";
let savingOrder = false;

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
  if (status === "Hecho" || status === "Entregado") return "Para entregar";
  if (status === "Espera de pago") return "Para cobrar";
  return status || DEFAULT_STATUS;
}

function base64UrlEncodeUnicode(obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function api(action, payload = {}) {
  if (action === "list") {
    return jsonp(`${API_URL}?action=list`);
  }

  if (action === "save") {
    const encoded = base64UrlEncodeUnicode(payload.order);
    return jsonp(`${API_URL}?action=save&payload=${encodeURIComponent(encoded)}`);
  }

  if (action === "updateStatus") {
    const qs = new URLSearchParams({
      action: "updateStatus",
      id: payload.id,
      estado: payload.estado
    });
    return jsonp(`${API_URL}?${qs.toString()}`);
  }

  return Promise.reject(new Error("Acción no reconocida"));
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = "cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const sep = url.includes("?") ? "&" : "?";
    const script = document.createElement("script");

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("No respondió Google Sheets. Revisá la implementación /exec y permisos."));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      cleanup();
      if (!data || data.ok === false) {
        reject(new Error(data?.error || "Error al guardar en Google Sheets"));
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

async function loadOrders() {
  statusMsg.textContent = "Actualizando pedidos...";
  statusMsg.className = "status-msg";

  try {
    const result = await api("list");
    orders = (result.data || []).map(o => ({
      ...o,
      estado: normalizedStatus(o.estado)
    }));

    render();

    statusMsg.textContent = "Conectado a Google Sheets · los cambios se guardan en BASE PEDIDOS.";
    statusMsg.className = "status-msg ok";

  } catch (err) {
    statusMsg.textContent = err.message;
    statusMsg.className = "status-msg error";
  }
}

function activeOrders() {
  return orders.filter(o => !HIDDEN_STATUSES.includes(normalizedStatus(o.estado)));
}

function renderSummary() {
  const active = activeOrders();

  const counts = {
    "Para hacer": active.filter(o => normalizedStatus(o.estado) === "Para hacer").length,
    "Para entregar": active.filter(o => normalizedStatus(o.estado) === "Para entregar").length,
    "Para cobrar": active.filter(o => normalizedStatus(o.estado) === "Para cobrar").length,
    "Deudor": active.filter(o => normalizedStatus(o.estado) === "Deudor").length
  };

  $("summary").innerHTML = `
    <div class="summary-card"><div class="summary-icon">🖨️</div><strong>${counts["Para hacer"]}</strong><span>Para hacer</span></div>
    <div class="summary-card"><div class="summary-icon">🚗</div><strong>${counts["Para entregar"]}</strong><span>Para entregar</span></div>
    <div class="summary-card"><div class="summary-icon">💵</div><strong>${counts["Para cobrar"]}</strong><span>Para cobrar</span></div>
    <div class="summary-card"><div class="summary-icon">⚠️</div><strong>${counts["Deudor"]}</strong><span>Deudores</span></div>
  `;
}

function render() {
  renderSummary();

  const q = $("searchInput").value.toLowerCase().trim();
  let data = activeOrders();

  if (currentFilter !== "Todos") {
    data = data.filter(o => normalizedStatus(o.estado) === currentFilter);
  }

  if (q) {
    data = data.filter(o =>
      `${o.pedido} ${o.cliente} ${o.nota}`.toLowerCase().includes(q)
    );
  }

  data.sort((a, b) =>
    (a.fechaCompromiso || "9999-12-31").localeCompare(b.fechaCompromiso || "9999-12-31")
  );

  if (!data.length) {
    list.innerHTML = `<div class="empty">No hay pedidos activos en esta vista.</div>`;
    return;
  }

  list.innerHTML = data.map(orderCard).join("");
}

function orderCard(o) {
  const estado = normalizedStatus(o.estado);
  const debe = Number(o.precio || 0) - Number(o.sena || 0);

  const css =
    estado === "Deudor" ? "deudor" :
    estado === "Para cobrar" ? "espera" :
    estado === "Para entregar" ? "para-entregar" :
    "para-hacer";

  const icon =
    estado === "Deudor" ? "⚠️" :
    estado === "Para cobrar" ? "💵" :
    estado === "Para entregar" ? "🚗" :
    "🖨️";

  return `
    <details class="order-card ${css}">
      <summary class="card-summary">
        <div class="mini-icon">${icon}</div>
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
          ${actionButtons(o.id, estado)}
          <button onclick="editOrder('${o.id}')">✏️ Editar</button>
        </div>
      </div>
    </details>
  `;
}

function actionButtons(id, estado) {
  if (estado === "Para hacer") {
    return `<button class="quick" onclick="quickStatus('${id}', 'Para entregar')">🚗 Listo para entregar</button>`;
  }

  if (estado === "Para entregar") {
    return `<button class="quick" onclick="quickStatus('${id}', 'Para cobrar')">💵 Entregado · pasar a cobrar</button>`;
  }

  if (estado === "Para cobrar") {
    return `
      <button class="quick" onclick="quickStatus('${id}', 'Finalizado')">✅ Cobrado · finalizar</button>
      <button onclick="quickStatus('${id}', 'Deudor')">⚠️ Quedó debiendo</button>
    `;
  }

  if (estado === "Deudor") {
    return `<button class="quick" onclick="quickStatus('${id}', 'Finalizado')">✅ Pago recibido · finalizar</button>`;
  }

  return "";
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
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

  orders = orders.map(o =>
    o.id === id ? { ...o, estado, actualizado: new Date().toISOString() } : o
  );

  render();

  try {
    await api("updateStatus", { id, estado });

    statusMsg.textContent = "Estado actualizado y registrado en Google Sheets.";
    statusMsg.className = "status-msg ok";

    await loadOrders();

  } catch (err) {
    orders = previous;
    render();
    alert(err.message);
  }
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (savingOrder) return;

  savingOrder = true;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Guardando...";

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

  if (!order.pedido) {
    savingOrder = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Guardar en Sheet";
    return;
  }

  try {
    await api("save", { order });

    dialog.close();

    statusMsg.textContent = "Pedido guardado en Google Sheets.";
    statusMsg.className = "status-msg ok";

    await loadOrders();

    currentFilter = HIDDEN_STATUSES.includes(order.estado)
      ? "Para hacer"
      : order.estado;

    document.querySelectorAll(".tab").forEach(t =>
      t.classList.toggle("active", t.dataset.filter === currentFilter)
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
