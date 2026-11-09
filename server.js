require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "orders.json");
const MODE = process.env.PAYSTACK_SECRET_KEY?.startsWith("sk_live_") ? "live" : "test";

const products = [
  { id:"tee-original", name:"TTM.001 Original Tee", category:"tees", priceCents:35000, sizes:["XS","S","M","L","XL","2XL"], description:"Everyday fit · Cotton", tag:"ISSUE 001", active:true, image:"" },
  { id:"tee-crown", name:"Crown Graphic Tee", category:"tees", priceCents:39900, sizes:["XS","S","M","L","XL","2XL"], description:"Graphic edition · Relaxed fit", tag:"LIMITED", active:true, image:"" },
  { id:"tee-archive", name:"Made Original Tee", category:"tees", priceCents:32000, sizes:["XS","S","M","L","XL","2XL"], description:"Minimal logo · Cotton", tag:"NEW", active:true, image:"" },
  { id:"hoodie-version", name:"Version 001 Hoodie", category:"hoodies", priceCents:65000, sizes:["S","M","L","XL","2XL"], description:"Heavyweight streetwear", tag:"ISSUE 001", active:true, image:"" },
  { id:"hoodie-global", name:"Global Vision Hoodie", category:"hoodies", priceCents:79900, sizes:["S","M","L","XL","2XL"], description:"Statement graphic · Fleece", tag:"LIMITED", active:true, image:"" },
  { id:"cap-001", name:"TTM.001 Crown Cap", category:"accessories", priceCents:22000, sizes:["One size"], description:"Adjustable fit", tag:"ACCESSORY", active:true, image:"" }
];
const archive = [
  { number:"001", name:"The First Version", description:"The first chapter of TTM.001. Original ideas, first moves and the start of the journey.", status:"FOUNDATION / ARCHIVE" },
  { number:"002", name:"Made Original", description:"A graphic-led chapter about creating your own lane and evolving without permission.", status:"PAST DROP / ARCHIVE" },
  { number:"003", name:"Next Chapter", description:"A space for future releases. Add real campaign details when the collection is ready.", status:"COMING SOON" }
];
function ensureStore(){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});if(!fs.existsSync(DATA_FILE))fs.writeFileSync(DATA_FILE,JSON.stringify({orders:[]},null,2));}
function readStore(){ensureStore();return JSON.parse(fs.readFileSync(DATA_FILE,"utf8"));}
function writeStore(store){ensureStore();fs.writeFileSync(DATA_FILE,JSON.stringify(store,null,2));}

app.get("/api/health",(req,res)=>res.json({ok:true,paymentMode:MODE}));
app.get("/api/catalog",(req,res)=>res.json({products:products.filter(p=>p.active),archive}));

// Capture the raw webhook body for signature verification before JSON parsing.
app.post("/api/paystack/webhook", express.raw({type:"application/json"}), async (req,res)=>{
  const secret=process.env.PAYSTACK_SECRET_KEY;
  if(!secret)return res.status(503).send("Payment provider not configured");
  const signature=req.get("x-paystack-signature")||"";
  const expected=crypto.createHmac("sha512",secret).update(req.body).digest("hex");
  const a=Buffer.from(signature), b=Buffer.from(expected);
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b))return res.status(401).send("Invalid signature");
  let event;
  try{event=JSON.parse(req.body.toString("utf8"));}catch{return res.status(400).send("Invalid JSON");}
  if(event.event==="charge.success" && event.data?.reference){
    try{
      const verified=await verifyTransaction(event.data.reference);
      if(verified.status==="success" && verified.currency==="ZAR"){
        const store=readStore();
        const order=store.orders.find(o=>o.reference===verified.reference);
        if(order && verified.amount===order.totalCents && order.paymentStatus!=="paid"){
          order.paymentStatus="paid";order.paidAt=new Date().toISOString();writeStore(store);
        }
      }
    }catch(err){console.error("Webhook verification failed:",err.message);return res.status(500).send("Verification failed");}
  }
  return res.sendStatus(200);
});
app.use(express.json({limit:"20kb"}));
app.use(express.static(path.join(__dirname,"public")));

app.post("/api/checkout", async (req,res)=>{
  try{
    if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:"Online checkout is not configured yet. Add the payment provider's secret key to the server environment."});
    const email=String(req.body.email||"").trim().toLowerCase();
    const items=Array.isArray(req.body.items)?req.body.items:[];
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:"Enter a valid email address."});
    if(items.length<1 || items.length>20)return res.status(400).json({error:"Your cart is empty or contains too many different items."});
    let totalCents=0;const orderItems=[];
    for(const item of items){
      const p=products.find(x=>x.id===item.productId && x.active);
      const quantity=Number(item.quantity);
      if(!p || !Number.isInteger(quantity)||quantity<1||quantity>10)return res.status(400).json({error:"One of your items is invalid. Refresh the catalogue and try again."});
      const size=String(item.size||"");
      if(!p.sizes.includes(size))return res.status(400).json({error:`Choose a valid size for ${p.name}.`});
      totalCents+=p.priceCents*quantity;
      orderItems.push({productId:p.id,name:p.name,unitPriceCents:p.priceCents,quantity,size});
    }
    if(totalCents<200)return res.status(400).json({error:"Order total is below the payment provider's minimum."});
    const reference="TTM"+Date.now().toString(36).toUpperCase()+crypto.randomBytes(5).toString("hex").toUpperCase();
    const order={reference,email,items:orderItems,totalCents,currency:"ZAR",paymentStatus:"pending",mode:MODE,createdAt:new Date().toISOString()};
    const store=readStore();store.orders.push(order);writeStore(store);
    const origin=process.env.PUBLIC_BASE_URL;
    if(!origin || !origin.startsWith("https://"))return res.status(503).json({error:"Set PUBLIC_BASE_URL to your deployed HTTPS website URL before enabling checkout."});
    const apiRes=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{"Authorization":`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({email,amount:String(totalCents),currency:"ZAR",reference,callback_url:`${origin}/payment-return.html`})});
    const result=await apiRes.json();
    if(!apiRes.ok || !result.status || !result.data?.authorization_url){
      const latest=readStore();const failed=latest.orders.find(o=>o.reference===reference);if(failed)failed.paymentStatus="initialization_failed";writeStore(latest);
      return res.status(502).json({error:"Payment provider could not create checkout. Please try again later."});
    }
    return res.json({checkoutUrl:result.data.authorization_url,reference});
  }catch(err){console.error("Checkout error:",err);return res.status(500).json({error:"Checkout failed. Please try again."});}
});

async function verifyTransaction(reference){
  const r=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{"Authorization":`Bearer ${process.env.PAYSTACK_SECRET_KEY}`}});
  const body=await r.json();if(!r.ok||!body.status)throw new Error("Could not verify transaction");
  return body.data;
}
app.get("/payment-return.html",(req,res)=>res.sendFile(path.join(__dirname,"public","payment-return.html")));
app.get("/api/payment-status/:reference",async(req,res)=>{
  if(!process.env.PAYSTACK_SECRET_KEY)return res.status(503).json({error:"Payment verification unavailable"});
  try{
    const data=await verifyTransaction(req.params.reference);
    const store=readStore();const order=store.orders.find(o=>o.reference===data.reference);
    if(!order)return res.status(404).json({error:"Order not found"});
    if(data.status==="success" && data.currency==="ZAR" && data.amount===order.totalCents){
      if(order.paymentStatus!=="paid"){order.paymentStatus="paid";order.paidAt=new Date().toISOString();writeStore(store);}
      return res.json({status:"paid"});
    }
    return res.json({status:order.paymentStatus==="paid"?"paid":"pending"});
  }catch{return res.status(502).json({error:"Could not verify payment yet"});}
});
app.listen(PORT,()=>console.log(`TTM.001 store listening on port ${PORT} (${MODE} payments)`));
