// Simple store data (customize to your flavors)
const STORE_PHONE = "+13862780636"; // <-- REEMPLAZA con tu número WhatsApp en formato internacional (USA ej: +1303XXXXXXX)
const CURRENCY = "USD";
const PRODUCTS = [
  { id:"cl-coco",  name:"Cremoso de Coco",        price:6.00,
    img:"assets/img/cremoso_coco.png",
    sizes:["1 pieza"], toppings:["Coco rallado","Chispas"] },
  { id:"cl-queso", name:"Cremoso de Queso",       price:6.00,
    img:"assets/img/cremoso_queso.png",
    sizes:["1 pieza"], toppings:["Granola","Lechera"] },
  { id:"cl-mora",  name:"Cremoso con Mora",       price:6.00,
    img:"assets/img/cremoso_mora.png",
    sizes:["1 pieza"], toppings:["Moras extra"] },
  { id:"cl-fresas",name:"Fresas con Crema",       price:6.00,
    img:"assets/img/fresas_crema.png",
    sizes:["1 pieza"], toppings:["Fresa extra","Granola"] }
];

// Shipping zones (only applied when method = delivery)
const SHIPPING = {
  center: 3.00,
  near:   5.00,
  far:    8.00,
};

// Simple coupon engine
// Types: { type: 'percent'|'fixed', value: number }
const COUPONS = {
  "CREMO10": { type: "percent", value: 10 }, // 10% off
  "AMOR2":   { type: "fixed",   value: 2  }, // $2 off
};
function calcDiscount(subtotal, code){
  const c = COUPONS[(code||"").trim().toUpperCase()];
  if(!c) return 0;
  if(c.type === "percent") return subtotal * (c.value/100);
  if(c.type === "fixed")   return Math.min(c.value, subtotal);
  return 0;
}


const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const cart = {
  items: JSON.parse(localStorage.getItem("cart_items")||"[]"),
  save(){ localStorage.setItem("cart_items", JSON.stringify(this.items)) },
  add(item){
    const existing = this.items.find(x =>
      x.id===item.id && x.size===item.size && JSON.stringify(x.toppings)==JSON.stringify(item.toppings)
    );
    if(existing){ existing.qty += item.qty; }
    else { this.items.push(item) }
    this.save();
    renderCart();
  },
  inc(i){ this.items[i].qty++; this.save(); renderCart(); },
  dec(i){ this.items[i].qty = Math.max(1, this.items[i].qty-1); this.save(); renderCart(); },
  del(i){ this.items.splice(i,1); this.save(); renderCart(); },
  clear(){ this.items = []; this.save(); renderCart(); },
  total(){
    return this.items.reduce((s,it)=> s + it.price*it.qty, 0);
  }
};

function money(n){ return new Intl.NumberFormat('es-US',{style:'currency', currency:CURRENCY}).format(n) }

function computeTotals(){
  const subtotal = cart.total();
  const method = [...$$('input[name="method"]')].find(r=>r.checked).value;
  let shipping = 0;
  if(method==="delivery"){
    const zone = [...$$('input[name="zone"]')].find(r=>r.checked).value;
    shipping = SHIPPING[zone] || 0;
  }
  const coupon = $("#couponCode")?.value || "";
  const discount = calcDiscount(subtotal, coupon);
  const total = Math.max(0, subtotal - discount) + shipping;
  return {subtotal, discount, shipping, total};
}


function renderProducts(){
  const wrap = $("#products");
  wrap.innerHTML = "";
  for(const p of PRODUCTS){
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}">
      <div class="pad">
        <div class="row"><h3>${p.name}</h3><div class="badge">${money(p.price)}</div></div>
        <label>Tamaño
          <select data-sel="size">
            ${p.sizes.map(s=>`<option>${s}</option>`).join("")}
          </select>
        </label>
        <label>Toppings (opcional)
          <select data-sel="topping">
            <option value="">Ninguno</option>
            ${p.toppings.map(t=>`<option>${t}</option>`).join("")}
          </select>
        </label>
        <div class="row">
          <div class="qty">
            <button data-act="minus">–</button>
            <span data-field="qty">1</span>
            <button data-act="plus">+</button>
          </div>
          <button class="cta" data-act="add" data-id="${p.id}">Añadir</button>
        </div>
      </div>
    `;
    let qty = 1;
    card.querySelector('[data-act="minus"]').onclick = ()=>{ qty = Math.max(1, qty-1); card.querySelector('[data-field="qty"]').textContent = qty; };
    card.querySelector('[data-act="plus"]').onclick = ()=>{ qty = qty+1; card.querySelector('[data-field="qty"]').textContent = qty; };
    card.querySelector('[data-act="add"]').onclick = ()=>{
      const size = card.querySelector('[data-sel="size"]').value;
      const topping = card.querySelector('[data-sel="topping"]').value;
      const item = {
        id: p.id, title: p.name, price: p.price, qty,
        size, toppings: topping? [topping]: [],
      };
      cart.add(item);
    };
    wrap.appendChild(card);
  }
}

function renderCart(){
  const wrap = $("#cartItems");
  wrap.innerHTML = "";
  if(cart.items.length===0){
    wrap.innerHTML = '<p class="muted">Tu carrito está vacío.</p>';
  } else {
    cart.items.forEach((it, i)=>{
      const el = document.createElement("div");
      el.className = "cart-item";
      el.innerHTML = `
        <div class="title">${it.title}</div>
        <div class="muted">${it.size}${it.toppings?.length? " · "+it.toppings.join(", "): ""}</div>
        <div class="row" style="margin-left:auto">
          <div class="qty">
            <button data-act="dec">–</button><span>${it.qty}</span><button data-act="inc">+</button>
          </div>
          <div class="price">${money(it.price*it.qty)}</div>
          <button class="ghost" data-act="del">✕</button>
        </div>
      `;
      el.querySelector('[data-act="inc"]').onclick = ()=> cart.inc(i);
      el.querySelector('[data-act="dec"]').onclick = ()=> cart.dec(i);
      el.querySelector('[data-act="del"]').onclick = ()=> cart.del(i);
      wrap.appendChild(el);
    });
  }
  const t = computeTotals();
  $("#cartTotal").textContent = money(t.total);

  // Show breakdown details inline
  let details = document.querySelector("#totalDetails");
  if(!details){
    details = document.createElement("div");
    details.id = "totalDetails";
    details.className = "muted xs";
    document.querySelector(".cart-summary").appendChild(details);
  }
  details.innerHTML = `Subtotal: ${money(t.subtotal)} · Descuento: -${money(t.discount)} · Envío: ${money(t.shipping)}`;

}

function buildMessage(){
  const name = $("#custName").value.trim();
  const phone = $("#custPhone").value.trim();
  const method = [...$$('input[name="method"]')].find(r=>r.checked).value;
  const address = $("#custAddress").value.trim();
  const time = $("#custTime").value;
  const notes = $("#orderNotes").value.trim();
  const lines = [];
  lines.push("🧾 *Nuevo pedido Cremo Love*");
  lines.push(`👤 Cliente: ${name}`);
  lines.push(`📞 Tel: ${phone}`);
  lines.push(`🚚 Método: ${method==="pickup"?"Recoger":"Domicilio"}`);
  if(method==="delivery" && address) lines.push(`📍 Dirección: ${address}`);
  lines.push(`⏰ Hora: ${time}`);
  lines.push("");
  lines.push("*Detalle:*");
  cart.items.forEach(it=>{
    lines.push(`• ${it.title} (${it.size}${it.toppings?.length? " · "+it.toppings.join(", "): ""}) × ${it.qty} — ${money(it.price*it.qty)}`);
  });
  const t = computeTotals();
  lines.push("");
  lines.push(`Subtotal: ${money(t.subtotal)}`);
  lines.push(`Descuento: -${money(t.discount)}`);
  lines.push(`Envío: ${money(t.shipping)}`);
  lines.push(`*Total:* ${money(t.total)}`);
  if(notes) { lines.push(""); lines.push(`📝 Notas: ${notes}`); }
  lines.push("");
  lines.push("— Pedido generado desde la app para llevar.");
  return lines.join("\n");
}

function sendWhatsApp(){
  if(cart.items.length===0){ alert("Tu carrito está vacío."); return; }
  const name = $("#custName").value.trim();
  const phone = $("#custPhone").value.trim();
  if(!name || !phone){ alert("Completa tu nombre y teléfono."); return; }
  const method = [...$$('input[name="method"]')].find(r=>r.checked).value;
  if(method==="delivery" && !$("#custAddress").value.trim()){
    alert("Ingresa la dirección para domicilio.");
    return;
  }
  const msg = encodeURIComponent(buildMessage());
  const url = `https://wa.me/${STORE_PHONE.replace(/\D/g,"")}?text=${msg}`;
  window.open(url, "_blank");
}

function buildMailto(){
  const subject = encodeURIComponent("Nuevo pedido Cremo Love");
  const body = encodeURIComponent(buildMessage());
  return `mailto:orders@example.com?subject=${subject}&body=${body}`; // <-- Cambia el correo si lo usas
}

function setup(){
  $("#year").textContent = new Date().getFullYear();
  renderProducts();
  renderCart();
  $("#clearCart").onclick = ()=> cart.clear();
  $("#sendWA").onclick = sendWhatsApp;
  $("#couponCode")?.addEventListener("input", renderCart);
  $$("input[name=\"zone\"]").forEach(z=> z.addEventListener("change", renderCart));
  $$("input[name=\"method\"]").forEach(m=> m.addEventListener("change", renderCart));
  $("#mailtoLink").onclick = (e)=>{ e.currentTarget.href = buildMailto(); };
  const methodRadios = $$('input[name="method"]');
  methodRadios.forEach(r=> r.addEventListener("change", ()=>{
    $("#addressWrap").classList.toggle("hidden", document.querySelector('input[name="method"]:checked').value!=="delivery");
  }));
  // PWA Install
  let deferredPrompt = null;
  const installBtn = $("#installBtn");
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    installBtn.hidden = true;
    deferredPrompt = null;
  });
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js');
  }
}
setup();
