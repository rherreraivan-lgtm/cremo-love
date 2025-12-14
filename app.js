// Cremo Love — Control de ventas, inventario y caja diaria (solo en tu iPhone)
// Guarda todo en localStorage (no se sube a internet)

const PRICE = 6.0;     // precio de venta
const COST  = 1.25;    // costo unitario

const FLAVORS = [
  "Cremoso de Queso",
  "Cremoso de Coco",
  "Oreo",
  "Fresas con Crema",
  "Mora con crema",
  "Piña colada",
  "Ron con pasas",
  "Cremo Chocorramo"
];

const PAY_METHODS = ["Efectivo", "Zelle"];

// ---- Storage helpers ----
const DBKEY = "cremolove_db_v1";

function loadDB(){
  try { return JSON.parse(localStorage.getItem(DBKEY)) || {}; }
  catch { return {}; }
}
function saveDB(db){
  localStorage.setItem(DBKEY, JSON.stringify(db));
}
function isoToday(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off*60*1000);
  return local.toISOString().slice(0,10);
}
function money(n){ return `$${(Number(n)||0).toFixed(2)}`; }

let db = loadDB();
db.sales = db.sales || [];       // {id,date,flavor,qty,pay,total,cost,profit,notes}
db.cash  = db.cash  || {};       // date => {openCash, cardExpenses, otherNotes, actualCash}
db.stock = db.stock || {};       // flavor => number
FLAVORS.forEach(f => { if (db.stock[f] == null) db.stock[f] = 0; });

saveDB(db);

// ---- DOM ----
const $ = (id)=>document.getElementById(id);

function fillSelect(id, list){
  const s = $(id);
  s.innerHTML = "";
  list.forEach(v=>{
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    s.appendChild(o);
  });
}

function init(){
  // defaults
  $("saleDate").value = isoToday();
  $("cashDate").value = isoToday();
  $("reportFrom").value = isoToday();
  $("reportTo").value = isoToday();

  fillSelect("saleFlavor", FLAVORS);
  fillSelect("salePay", PAY_METHODS);
  fillSelect("stockFlavor", FLAVORS);

  renderStock();
  renderTodaySummary();
  renderSalesTable();
  renderCashPanel();
  renderReports();
}

function uid(){
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

// ---- Sales ----
function addSale(){
  const date = $("saleDate").value || isoToday();
  const flavor = $("saleFlavor").value;
  const qty = Number($("saleQty").value || 0);
  const pay = $("salePay").value;
  const notes = ($("saleNotes").value || "").trim();

  if (!flavor) return alert("Elige un sabor.");
  if (!qty || qty <= 0) return alert("Cantidad inválida.");

  // inventario: no dejes bajar de 0 sin avisar
  if ((db.stock[flavor] || 0) < qty){
    const ok = confirm(`Inventario insuficiente de "${flavor}".\nStock: ${db.stock[flavor]||0}\nVas a vender: ${qty}\n\n¿Registrar igual?`);
    if (!ok) return;
  }

  const total = qty * PRICE;
  const cost  = qty * COST;
  const profit = total - cost;

  const sale = { id: uid(), date, flavor, qty, pay, total, cost, profit, notes };
  db.sales.push(sale);

  // descuenta stock
  db.stock[flavor] = (db.stock[flavor] || 0) - qty;

  saveDB(db);

  $("saleQty").value = "1";
  $("saleNotes").value = "";

  renderStock();
  renderTodaySummary();
  renderSalesTable();
  renderReports();

  alert("✅ Venta registrada");
}

function deleteSale(id){
  const s = db.sales.find(x=>x.id===id);
  if (!s) return;

  const ok = confirm("¿Eliminar esta venta? (Se devuelve el stock)");
  if (!ok) return;

  // devolver stock
  db.stock[s.flavor] = (db.stock[s.flavor] || 0) + Number(s.qty||0);

  db.sales = db.sales.filter(x=>x.id!==id);
  saveDB(db);

  renderStock();
  renderTodaySummary();
  renderSalesTable();
  renderReports();
}

// ---- Stock ----
function addStock(){
  const flavor = $("stockFlavor").value;
  const qty = Number($("stockQty").value || 0);
  if (!qty || qty <= 0) return alert("Cantidad inválida.");

  db.stock[flavor] = (db.stock[flavor] || 0) + qty;
  saveDB(db);

  $("stockQty").value = "";
  renderStock();
  alert("✅ Stock agregado");
}

function setStock(){
  const flavor = $("stockFlavor").value;
  const qty = Number($("stockQty").value || 0);
  if (qty < 0) return alert("No puede ser negativo.");

  db.stock[flavor] = qty;
  saveDB(db);

  $("stockQty").value = "";
  renderStock();
  alert("✅ Stock ajustado");
}

function renderStock(){
  const wrap = $("stockList");
  wrap.innerHTML = "";
  FLAVORS.forEach(f=>{
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `<div><b>${f}</b></div><div>${db.stock[f] ?? 0}</div>`;
    wrap.appendChild(row);
  });
}

// ---- Caja diaria ----
function saveCash(){
  const date = $("cashDate").value || isoToday();
  const openCash = Number($("openCash").value || 0);
  const cardExpenses = Number($("cardExpenses").value || 0);
  const actualCash = Number($("actualCash").value || 0);
  const otherNotes = ($("cashNotes").value || "").trim();

  db.cash[date] = { openCash, cardExpenses, actualCash, otherNotes };
  saveDB(db);

  renderCashPanel();
  renderReports();
  alert("✅ Caja guardada");
}

function getDayTotals(date){
  const daySales = db.sales.filter(s=>s.date===date);
  const revenue = daySales.reduce((a,s)=>a+(Number(s.total)||0),0);
  const cost = daySales.reduce((a,s)=>a+(Number(s.cost)||0),0);
  const profit = daySales.reduce((a,s)=>a+(Number(s.profit)||0),0);
  const cashRevenue = daySales.filter(s=>s.pay==="Efectivo").reduce((a,s)=>a+(Number(s.total)||0),0);
  const zelleRevenue = daySales.filter(s=>s.pay==="Zelle").reduce((a,s)=>a+(Number(s.total)||0),0);
  const units = daySales.reduce((a,s)=>a+(Number(s.qty)||0),0);
  return { daySales, revenue, cost, profit, cashRevenue, zelleRevenue, units };
}

function renderCashPanel(){
  const date = $("cashDate").value || isoToday();
  const c = db.cash[date] || { openCash:0, cardExpenses:0, actualCash:0, otherNotes:"" };

  $("openCash").value = c.openCash ?? 0;
  $("cardExpenses").value = c.cardExpenses ?? 0;
  $("actualCash").value = c.actualCash ?? 0;
  $("cashNotes").value = c.otherNotes ?? "";

  const t = getDayTotals(date);

  // esperado en caja: apertura + ventas efectivo (gastos por tarjeta NO afectan efectivo)
  const expectedCash = (Number(c.openCash)||0) + t.cashRevenue;
  const diff = (Number(c.actualCash)||0) - expectedCash;

  $("cashSummary").innerHTML = `
    <div class="card">
      <div><b>Resumen del día (${date})</b></div>
      <div>Ventas Totales: <b>${money(t.revenue)}</b> (Efectivo ${money(t.cashRevenue)} / Zelle ${money(t.zelleRevenue)})</div>
      <div>Costo: ${money(t.cost)} · Ganancia: <b>${money(t.profit)}</b></div>
      <div>Unidades vendidas: ${t.units}</div>
      <hr/>
      <div>Apertura efectivo: ${money(c.openCash)}</div>
      <div>Efectivo esperado en caja: <b>${money(expectedCash)}</b></div>
      <div>Efectivo contado: <b>${money(c.actualCash)}</b></div>
      <div>Diferencia: <b>${money(diff)}</b></div>
      <div>Gastos pagados con tarjeta: ${money(c.cardExpenses)}</div>
    </div>
  `;
}

function renderTodaySummary(){
  const date = isoToday();
  const t = getDayTotals(date);
  $("todaySummary").innerHTML = `
    <div class="card">
      <div><b>Hoy (${date})</b></div>
      <div>Ventas: <b>${money(t.revenue)}</b> · Ganancia: <b>${money(t.profit)}</b></div>
      <div>Efectivo: ${money(t.cashRevenue)} · Zelle: ${money(t.zelleRevenue)}</div>
      <div>Unidades: ${t.units}</div>
    </div>
  `;
}

// ---- Tabla ventas ----
function renderSalesTable(){
  const wrap = $("salesTable");
  wrap.innerHTML = "";

  const date = $("saleDate").value || isoToday();
  const daySales = db.sales.filter(s=>s.date===date).slice().reverse();

  if (!daySales.length){
    wrap.innerHTML = `<div class="muted">No hay ventas registradas en esta fecha.</div>`;
    return;
  }

  daySales.forEach(s=>{
    const row = document.createElement("div");
    row.className = "saleRow";
    row.innerHTML = `
      <div class="saleMain">
        <div><b>${s.flavor}</b> · x${s.qty} · ${s.pay}</div>
        <div class="muted">${money(s.total)} · Ganancia ${money(s.profit)}${s.notes?` · ${s.notes}`:""}</div>
      </div>
      <button class="btn danger" onclick="deleteSale('${s.id}')">Eliminar</button>
    `;
    wrap.appendChild(row);
  });
}

// ---- Reportes ----
function renderReports(){
  const from = $("reportFrom").value || isoToday();
  const to = $("reportTo").value || isoToday();

  const list = db.sales.filter(s => s.date >= from && s.date <= to);
  const revenue = list.reduce((a,s)=>a+(Number(s.total)||0),0);
  const cost = list.reduce((a,s)=>a+(Number(s.cost)||0),0);
  const profit = list.reduce((a,s)=>a+(Number(s.profit)||0),0);

  const cashRevenue = list.filter(s=>s.pay==="Efectivo").reduce((a,s)=>a+(Number(s.total)||0),0);
  const zelleRevenue = list.filter(s=>s.pay==="Zelle").reduce((a,s)=>a+(Number(s.total)||0),0);

  // gastos tarjeta en rango
  let cardExp = 0;
  Object.keys(db.cash).forEach(d=>{
    if (d >= from && d <= to) cardExp += Number(db.cash[d]?.cardExpenses || 0);
  });

  $("reportSummary").innerHTML = `
    <div class="card">
      <div><b>Reporte (${from} → ${to})</b></div>
      <div>Ventas: <b>${money(revenue)}</b> (Efectivo ${money(cashRevenue)} / Zelle ${money(zelleRevenue)})</div>
      <div>Costo: ${money(cost)} · Ganancia: <b>${money(profit)}</b></div>
      <div>Gastos con tarjeta (registrados en Caja): <b>${money(cardExp)}</b></div>
      <div>Ganancia neta estimada (Ganancia - Gastos tarjeta): <b>${money(profit - cardExp)}</b></div>
    </div>
  `;
}

function exportData(){
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cremolove_backup_${isoToday()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const obj = JSON.parse(r.result);
      if (!obj || typeof obj !== "object") throw new Error("Archivo inválido");
      db = obj;
      // asegurar estructuras
      db.sales = db.sales || [];
      db.cash  = db.cash  || {};
      db.stock = db.stock || {};
      FLAVORS.forEach(f => { if (db.stock[f] == null) db.stock[f] = 0; });
      saveDB(db);
      init();
      alert("✅ Datos importados");
    }catch(e){
      alert("❌ No se pudo importar: " + e.message);
    }
  };
  r.readAsText(file);
}

// ---- Wire UI events ----
window.addSale = addSale;
window.deleteSale = deleteSale;
window.addStock = addStock;
window.setStock = setStock;
window.saveCash = saveCash;
window.exportData = exportData;
window.importData = (evt)=> {
  const f = evt.target.files && evt.target.files[0];
  if (f) importData(f);
};

// live refresh
["saleDate"].forEach(id=>{
  $(id).addEventListener("change", ()=>{
    renderSalesTable();
  });
});
["cashDate"].forEach(id=>{
  $(id).addEventListener("change", ()=>{
    renderCashPanel();
  });
});
["reportFrom","reportTo"].forEach(id=>{
  $(id).addEventListener("change", renderReports);
});

document.addEventListener("DOMContentLoaded", init);
