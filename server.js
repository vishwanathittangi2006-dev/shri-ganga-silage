const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-before-production';
const adminSessions = new Set();
const userSessions = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });

const seed = {
  nextInquiryId: 1,
  nextOrderId: 1,
  nextUserId: 1,
  crops: [
    {id:1,name:'Mandya VCF517',price:2.60,unit:'unit',image:'/assets/crops/mandya-vcf517-2.webp',image2:'/assets/crops/mandya-vcf517-1.webp',points_en:['Supplied nursery planting material shown in the original photo.','Use healthy, uniform planting material for a stronger nursery start.'],points_kn:['ನೀಡಿದ ಮೂಲ ಫೋಟೋದಲ್ಲಿರುವ ನರ್ಸರಿ ನೆಡುವ ವಸ್ತು.','ಆರೋಗ್ಯಕರ ಮತ್ತು ಸಮಾನ ನೆಡುವ ವಸ್ತು ಉತ್ತಮ ನರ್ಸರಿ ಆರಂಭಕ್ಕೆ ಸಹಾಯಕ.']},
    {id:2,name:'Co 86032',price:2.00,unit:'unit',image:'/assets/crops/co86032-1.webp',image2:null,points_en:['ICAR identifies Co 86032 as a major tropical sugarcane variety.','It has been widely cultivated in Karnataka and other southern states.'],points_kn:['ICAR ಪ್ರಕಾರ Co 86032 ಪ್ರಮುಖ ಉಷ್ಣವಲಯದ ಕಬ್ಬಿನ ತಳಿಯಾಗಿದೆ.','ಇದು ಕರ್ನಾಟಕ ಸೇರಿದಂತೆ ದಕ್ಷಿಣ ಭಾರತದ ಹಲವು ರಾಜ್ಯಗಳಲ್ಲಿ ವ್ಯಾಪಕವಾಗಿ ಬೆಳೆದಿದೆ.']},
    {id:3,name:'SNK 13374',price:2.80,unit:'unit',image:'/assets/crops/snk13374-2.webp',image2:'/assets/crops/snk13374-1.webp',points_en:['Also identified as CoSnk 20102 in Karnataka research material.','Reported as promising for northern dry-zone conditions, including moisture-stress areas.'],points_kn:['ಕರ್ನಾಟಕದ ಸಂಶೋಧನಾ ಮಾಹಿತಿಯಲ್ಲಿ ಇದನ್ನು CoSnk 20102 ಎಂದೂ ಗುರುತಿಸಲಾಗಿದೆ.','ಉತ್ತರ ಒಣ ವಲಯದ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ, ತೇವಾಂಶ ಕೊರತೆಯ ಪ್ರದೇಶಗಳಿಗೂ ಇದು ಭರವಸೆಯ ತಳಿಯಾಗಿದೆ.']},
    {id:4,name:'Pdn265',price:2.50,unit:'unit',image:'/assets/crops/pdn265-1.webp',image2:'/assets/crops/pdn265-2.webp',points_en:['Variety name and price are kept exactly as supplied with the photo.','Confirm local recommendations before large-area planting.'],points_kn:['ಫೋಟೋದಲ್ಲಿ ನೀಡಿದ ತಳಿ ಹೆಸರು ಮತ್ತು ಬೆಲೆಯನ್ನು ಹಾಗೆಯೇ ಉಳಿಸಲಾಗಿದೆ.','ದೊಡ್ಡ ಪ್ರದೇಶದಲ್ಲಿ ನೆಡುವ ಮೊದಲು ಸ್ಥಳೀಯ ಶಿಫಾರಸುಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.']}
  ],
  inquiries: [],
  orders: [],
  users: [],
  settings: {nursery_name:'Shri Ganga Silage Ankalgi',phone:'+91 XXXXX XXXXX',whatsapp:'+91 XXXXX XXXXX',address:'Ankalgi, Karnataka',instagram:'@your_nursery'}
};

function loadDB(){
  if(!fs.existsSync(DB_FILE)){fs.writeFileSync(DB_FILE, JSON.stringify(seed,null,2)); return structuredClone(seed);}
  try{
    const d=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
    d.users ||= []; d.orders ||= []; d.inquiries ||= []; d.settings ||= seed.settings;
    d.nextUserId ||= Math.max(0,...d.users.map(u=>u.id||0))+1;
    d.nextOrderId ||= Math.max(0,...d.orders.map(o=>o.id||0))+1;
    d.nextInquiryId ||= Math.max(0,...d.inquiries.map(i=>i.id||0))+1;
    return d;
  }catch(e){console.error('Database read failed:',e);return structuredClone(seed);}
}
let db=loadDB();
function saveDB(){fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2));}
function json(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body)});res.end(body);}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>2e6){reject(new Error('Payload too large'));req.destroy();}});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{});}catch(e){reject(new Error('Invalid JSON'));}});req.on('error',reject);});}
function bearer(req){return (req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();}
function adminAuth(req){const t=bearer(req);return t&&adminSessions.has(t);}
function userFromReq(req){const t=bearer(req);const s=userSessions.get(t);if(!s)return null;return db.users.find(u=>u.id===s.userId)||null;}
function safePath(urlPath){const decoded=decodeURIComponent(urlPath.split('?')[0]);const normalized=path.normalize(decoded).replace(/^([.][.][/\\])+/, '');return path.join(PUBLIC, normalized==='/'?'index.html':normalized.replace(/^[/\\]+/,''));}
function contentType(file){const ext=path.extname(file).toLowerCase();return ({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'})[ext]||'application/octet-stream';}
function staticFile(req,res,urlPath){let file=safePath(urlPath);if(urlPath==='/admin')file=path.join(PUBLIC,'admin.html');if(urlPath==='/account')file=path.join(PUBLIC,'account.html');if(urlPath==='/checkout')file=path.join(PUBLIC,'checkout.html');if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(PUBLIC,'index.html');try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':contentType(file),'Cache-Control':'no-cache'});res.end(data);}catch(e){res.writeHead(500);res.end('Server error');}}
function parseId(v){const n=Number(v);return Number.isInteger(n)?n:0;}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){const hash=crypto.scryptSync(password,salt,64).toString('hex');return `${salt}:${hash}`;}
function verifyPassword(password,stored){try{const [salt,hash]=stored.split(':');const a=Buffer.from(hash,'hex');const b=crypto.scryptSync(password,salt,64);return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}}
function publicUser(u){return {id:u.id,name:u.name,phone:u.phone,email:u.email,address:u.address||{},created_at:u.created_at};}
function cleanAddress(a={}){return {fullName:String(a.fullName||'').trim(),phone:String(a.phone||'').trim(),addressLine1:String(a.addressLine1||'').trim(),addressLine2:String(a.addressLine2||'').trim(),village:String(a.village||'').trim(),taluk:String(a.taluk||'').trim(),district:String(a.district||'').trim(),state:String(a.state||'Karnataka').trim(),pincode:String(a.pincode||'').trim(),landmark:String(a.landmark||'').trim()};}
function validAddress(a){return a.fullName&&a.phone&&a.addressLine1&&a.village&&a.district&&a.state&&a.pincode;}

async function api(req,res,url){
  const pathname=url.pathname;
  if(req.method==='GET'&&pathname==='/api/health')return json(res,200,{ok:true,service:'Shri Ganga Silage Ankalgi API'});
  if(req.method==='GET'&&pathname==='/api/crops')return json(res,200,db.crops);
  if(req.method==='GET'&&pathname==='/api/settings')return json(res,200,db.settings);

  if(req.method==='POST'&&pathname==='/api/calculator'){
    const b=await readBody(req);const a=Math.max(0,Number(b.area)||0),u=Math.max(0,Number(b.unitsPerAcre)||0),p=Math.max(0,Number(b.price)||0);let acres=a;if(b.areaUnit==='gunta')acres=a/40;if(b.areaUnit==='hectare')acres=a*2.47105;return json(res,200,{crop:b.crop||'',acres,totalUnits:acres*u,estimatedCost:acres*u*p});
  }

  // Customer accounts
  if(req.method==='POST'&&pathname==='/api/auth/register'){
    const b=await readBody(req);const name=String(b.name||'').trim(),phone=String(b.phone||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
    if(name.length<2||phone.length<10||!email.includes('@')||password.length<6)return json(res,400,{error:'Enter a valid name, phone, email and a password of at least 6 characters.'});
    if(db.users.some(u=>u.email===email))return json(res,409,{error:'An account with this email already exists.'});
    const user={id:db.nextUserId++,name,phone,email,password_hash:hashPassword(password),address:{},created_at:new Date().toISOString()};db.users.push(user);saveDB();
    const token=crypto.randomBytes(32).toString('hex');userSessions.set(token,{userId:user.id,createdAt:Date.now()});return json(res,201,{token,user:publicUser(user)});
  }
  if(req.method==='POST'&&pathname==='/api/auth/login'){
    const b=await readBody(req);const email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');const u=db.users.find(x=>x.email===email);
    if(!u||!verifyPassword(password,u.password_hash))return json(res,401,{error:'Invalid email or password.'});
    const token=crypto.randomBytes(32).toString('hex');userSessions.set(token,{userId:u.id,createdAt:Date.now()});return json(res,200,{token,user:publicUser(u)});
  }
  if(req.method==='POST'&&pathname==='/api/auth/logout'){userSessions.delete(bearer(req));return json(res,200,{ok:true});}
  if(req.method==='GET'&&pathname==='/api/auth/me'){const u=userFromReq(req);if(!u)return json(res,401,{error:'Not logged in'});return json(res,200,{user:publicUser(u)});}
  if(req.method==='PUT'&&pathname==='/api/auth/profile'){
    const u=userFromReq(req);if(!u)return json(res,401,{error:'Login required'});const b=await readBody(req);const name=String(b.name||'').trim(),phone=String(b.phone||'').trim(),email=String(b.email||'').trim().toLowerCase();
    if(name.length<2||phone.length<10||!email.includes('@'))return json(res,400,{error:'Name, phone and valid email are required.'});
    if(db.users.some(x=>x.email===email&&x.id!==u.id))return json(res,409,{error:'That email is already used by another account.'});
    u.name=name;u.phone=phone;u.email=email;u.address=cleanAddress(b.address||u.address);saveDB();return json(res,200,{user:publicUser(u)});
  }
  if(req.method==='GET'&&pathname==='/api/my-orders'){
    const u=userFromReq(req);if(!u)return json(res,401,{error:'Login required'});return json(res,200,{orders:db.orders.filter(o=>o.userId===u.id)});
  }
  const myOrder=pathname.match(/^\/api\/my-orders\/(\d+)$/);if(req.method==='GET'&&myOrder){const u=userFromReq(req);if(!u)return json(res,401,{error:'Login required'});const o=db.orders.find(x=>x.id===parseId(myOrder[1])&&x.userId===u.id);if(!o)return json(res,404,{error:'Order not found'});return json(res,200,o);}

  if(req.method==='POST'&&pathname==='/api/inquiries'){
    const b=await readBody(req);if(!String(b.name||'').trim()||!String(b.phone||'').trim())return json(res,400,{error:'Name and phone are required.'});
    const item={id:db.nextInquiryId++,name:String(b.name).trim(),phone:String(b.phone).trim(),message:String(b.message||'').trim(),crop:String(b.crop||'').trim(),area:Number(b.area)||null,areaUnit:String(b.areaUnit||''),status:'new',created_at:new Date().toISOString()};db.inquiries.unshift(item);saveDB();return json(res,201,{ok:true,id:item.id});
  }
  if(req.method==='POST'&&pathname==='/api/orders'){
    const u=userFromReq(req);if(!u)return json(res,401,{error:'Please create an account or login before ordering.'});
    const b=await readBody(req);const address=cleanAddress(b.address||{});const items=Array.isArray(b.items)?b.items:[];
    if(!items.length)return json(res,400,{error:'Your order is empty.'});
    if(!validAddress(address))return json(res,400,{error:'Complete the delivery address, phone number and pincode.'});
    let safeItems=[];let total=0;
    for(const item of items){const crop=db.crops.find(c=>c.id===parseId(item.cropId));if(!crop)continue;const qty=Math.max(1,Number(item.quantity)||0);const unitPrice=Number(crop.price);const lineTotal=qty*unitPrice;safeItems.push({cropId:crop.id,name:crop.name,quantity:qty,unit:crop.unit,pricePerUnit:unitPrice,lineTotal});total+=lineTotal;}
    if(!safeItems.length)return json(res,400,{error:'No valid products were found.'});
    const order={id:db.nextOrderId++,orderNumber:`SGA-${String(Date.now()).slice(-7)}-${String(db.nextOrderId).padStart(3,'0')}`,userId:u.id,customer:{name:address.fullName,phone:address.phone,email:u.email},items:safeItems,totalAmount:total,address,status:'pending',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    db.orders.unshift(order);u.address=address;u.phone=address.phone;u.name=address.fullName;saveDB();return json(res,201,{ok:true,order});
  }

  // Admin office
  if(req.method==='POST'&&pathname==='/api/admin/login'){
    const b=await readBody(req);if(b.password!==ADMIN_PASSWORD)return json(res,401,{error:'Invalid password.'});const token=crypto.randomBytes(32).toString('hex');adminSessions.add(token);return json(res,200,{token});
  }
  if(pathname.startsWith('/api/admin/')){
    if(!adminAuth(req))return json(res,401,{error:'Unauthorized'});
    if(req.method==='POST'&&pathname==='/api/admin/logout'){adminSessions.delete(bearer(req));return json(res,200,{ok:true});}
    if(req.method==='GET'&&pathname==='/api/admin/dashboard')return json(res,200,{stats:{crops:db.crops.length,inquiries:db.inquiries.length,orders:db.orders.length,pendingOrders:db.orders.filter(o=>o.status==='pending').length,users:db.users.length},inquiries:db.inquiries,orders:db.orders,users:db.users.map(publicUser)});
    const om=pathname.match(/^\/api\/admin\/orders\/(\d+)$/);if(req.method==='PATCH'&&om){const b=await readBody(req);if(!['pending','confirmed','processing','ready','out-for-delivery','completed','cancelled'].includes(b.status))return json(res,400,{error:'Invalid status.'});const o=db.orders.find(x=>x.id===parseId(om[1]));if(!o)return json(res,404,{error:'Not found'});o.status=b.status;o.updated_at=new Date().toISOString();saveDB();return json(res,200,{ok:true});}
    const im=pathname.match(/^\/api\/admin\/inquiries\/(\d+)$/);if(req.method==='PATCH'&&im){const b=await readBody(req);if(!['new','contacted','closed'].includes(b.status))return json(res,400,{error:'Invalid status.'});const i=db.inquiries.find(x=>x.id===parseId(im[1]));if(!i)return json(res,404,{error:'Not found'});i.status=b.status;saveDB();return json(res,200,{ok:true});}
    if(req.method==='PUT'&&pathname==='/api/admin/settings'){const b=await readBody(req);for(const [k,v] of Object.entries(b))if(k in db.settings)db.settings[k]=String(v);saveDB();return json(res,200,{ok:true});}
  }
  return json(res,404,{error:'API route not found'});
}

const server=http.createServer(async(req,res)=>{const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);try{if(url.pathname.startsWith('/api/'))return await api(req,res,url);if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Method Not Allowed');}return staticFile(req,res,url.pathname);}catch(e){console.error(e);return json(res,500,{error:e.message||'Server error'});}});
server.listen(PORT,()=>console.log(`Shri Ganga Silage Ankalgi running at http://localhost:${PORT}`));
