const state = { products: [], archive: [], cart: loadCart(), filter: "all" };
const $ = (s) => document.querySelector(s);
const money = (cents) => new Intl.NumberFormat("en-ZA", { style:"currency", currency:"ZAR" }).format(cents / 100);
function loadCart(){ try { return JSON.parse(localStorage.getItem("ttm001-cart") || "[]"); } catch { return []; } }
function saveCart(){ localStorage.setItem("ttm001-cart", JSON.stringify(state.cart)); renderCart(); }
function escapeHtml(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

async function init(){
  $("#year").textContent = new Date().getFullYear();
  $("#menuBtn").addEventListener("click", () => $("#navLinks").classList.toggle("show"));
  $("#navLinks").querySelectorAll("a").forEach(a => a.addEventListener("click", () => $("#navLinks").classList.remove("show")));
  $("#openCart").addEventListener("click", openCart);
  $("#closeCart").addEventListener("click", closeCart);
  $("#drawerBackdrop").addEventListener("click", closeCart);
  $("#checkoutForm").addEventListener("submit", checkout);
  document.querySelectorAll(".filter").forEach(b => b.addEventListener("click", () => {
    state.filter = b.dataset.filter;
    document.querySelectorAll(".filter").forEach(x => x.classList.toggle("active", x === b));
    renderProducts();
  }));
  try {
    const r = await fetch("/api/catalog");
    if (!r.ok) throw new Error("Could not load catalogue");
    const data = await r.json();
    state.products = data.products || [];
    state.archive = data.archive || [];
    renderProducts(); renderArchive(); renderCart();
  } catch {
    $("#productGrid").innerHTML = '<p>Catalogue unavailable. Please refresh or contact the store.</p>';
    $("#archiveGrid").innerHTML = '<p>Archive unavailable right now.</p>';
  }
}
function renderProducts(){
  const list = state.products.filter(p => state.filter === "all" ? p.active : p.category === state.filter).filter(p => p.active);
  $("#productGrid").innerHTML = list.map(p => `
    <article class="product-card">
      <div class="product-art">${p.image ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">` : `<span class="art-mark">001</span>`}${p.tag ? `<span class="tag">${escapeHtml(p.tag)}</span>` : ""}</div>
      <div class="product-info"><h3>${escapeHtml(p.name)}</h3><p class="product-meta">${escapeHtml(p.description || "TTM.001 original streetwear")}</p>
      <div class="product-row"><span class="price">${money(p.priceCents)}</span><button class="add-button" data-add="${escapeHtml(p.id)}">ADD TO CART +</button></div></div>
    </article>`).join("") || "<p>No products in this category yet.</p>";
  document.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => addToCart(b.dataset.add)));
}
function renderArchive(){
  $("#archiveGrid").innerHTML = state.archive.map(a => `<article class="archive-card"><div><span class="archive-num">${escapeHtml(a.number)}</span><h3>${escapeHtml(a.name)}</h3><p>${escapeHtml(a.description)}</p></div><span class="archive-status">${escapeHtml(a.status)}</span></article>`).join("") || "<p>New chapters coming soon.</p>";
}
function addToCart(id){
  const p = state.products.find(x => x.id === id); if (!p) return;
  const existing = state.cart.find(x => x.id === id);
  if (existing) existing.quantity = Math.min(10, existing.quantity + 1);
  else state.cart.push({ id, quantity: 1, size: p.sizes?.[0] || "One size" });
  saveCart(); openCart();
}
function renderCart(){
  const count = state.cart.reduce((n,x)=>n+x.quantity,0);
  $("#cartCount").textContent = count;
  const lines = state.cart.map(item => {
    const p = state.products.find(x => x.id === item.id); if (!p) return "";
    return `<div class="cart-line"><div><h3>${escapeHtml(p.name)}</h3><p>${money(p.priceCents)} each</p>
      <label for="size-${escapeHtml(p.id)}">Size</label><br><select id="size-${escapeHtml(p.id)}" data-size="${escapeHtml(p.id)}">${(p.sizes || ["One size"]).map(s=>`<option ${s===item.size?"selected":""}>${escapeHtml(s)}</option>`).join("")}</select>
      <div class="qty-controls"><button data-minus="${escapeHtml(p.id)}" aria-label="Decrease quantity">−</button><span>${item.quantity}</span><button data-plus="${escapeHtml(p.id)}" aria-label="Increase quantity">+</button></div></div>
      <button class="remove-item" data-remove="${escapeHtml(p.id)}">Remove</button></div>`;
  }).join("");
  $("#cartItems").innerHTML = lines || "<p>Your cart is empty.</p>";
  const subtotal = state.cart.reduce((sum,item)=>sum+(state.products.find(p=>p.id===item.id)?.priceCents || 0)*item.quantity,0);
  $("#cartSubtotal").textContent = money(subtotal);
  document.querySelectorAll("[data-minus]").forEach(b=>b.addEventListener("click",()=>changeQty(b.dataset.minus,-1)));
  document.querySelectorAll("[data-plus]").forEach(b=>b.addEventListener("click",()=>changeQty(b.dataset.plus,1)));
  document.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{state.cart=state.cart.filter(x=>x.id!==b.dataset.remove);saveCart();}));
  document.querySelectorAll("[data-size]").forEach(s=>s.addEventListener("change",()=>{const i=state.cart.find(x=>x.id===s.dataset.size);if(i){i.size=s.value;saveCart();}}));
}
function changeQty(id, delta){const i=state.cart.find(x=>x.id===id);if(!i)return;i.quantity+=delta;if(i.quantity<1)state.cart=state.cart.filter(x=>x.id!==id);if(i.quantity>10)i.quantity=10;saveCart();}
function openCart(){$("#drawerBackdrop").hidden=false;$("#cartDrawer").classList.add("open");$("#cartDrawer").setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}
function closeCart(){$("#drawerBackdrop").hidden=true;$("#cartDrawer").classList.remove("open");$("#cartDrawer").setAttribute("aria-hidden","true");document.body.style.overflow="";}
async function checkout(e){
  e.preventDefault();
  const message=$("#checkoutMessage"), button=$("#checkoutButton");
  if(!state.cart.length){message.textContent="Your cart is empty.";message.className="form-message error";return;}
  button.disabled=true;button.textContent="PREPARING SECURE CHECKOUT…";message.textContent="Creating your order securely…";message.className="form-message";
  try{
    const email=$("#customerEmail").value.trim();
    const items=state.cart.map(i=>({productId:i.id,quantity:i.quantity,size:i.size}));
    const response=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,items})});
    const data=await response.json();
    if(!response.ok) throw new Error(data.error || "Checkout could not be started.");
    if(!data.checkoutUrl) throw new Error("Payment provider did not return a checkout link.");
    window.location.assign(data.checkoutUrl);
  }catch(err){message.textContent=err.message+" Your cart has been kept.";message.className="form-message error";button.disabled=false;button.textContent="TRY SECURE CHECKOUT AGAIN ↗";}
}
document.addEventListener("DOMContentLoaded", init);
