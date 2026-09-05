const cfg=window.ATMO_CONFIG||{};
const configured=cfg.SUPABASE_URL&&!cfg.SUPABASE_URL.includes('YOUR_PROJECT')&&cfg.SUPABASE_ANON_KEY&&!cfg.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
const sb=configured?supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY):null;
const money=n=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(n||0));
const round1000=n=>Math.ceil((Number(n)||0)/1000)*1000;
const uid=()=>crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());
const defaultSettings={machinePerHour:2000,electricityPrice:3000,powerKw:.18,laborPerHour:30000,failureRate:.08,profitRate:.80,socialFee:.03,shopeeFee:.18,tiktokFee:.20};
let currentUser=null, data={settings:{...defaultSettings},materials:[],products:[],orders:[]};
const PRODUCT_PAGE_SIZE=10;
let productPage=1;
let productSearch='';
let orderSearch='';
let orderStatusFilter='';

const $=id=>document.getElementById(id), val=id=>$(id).value, num=id=>Number(val(id))||0, setVal=(id,v)=>{$(id).value=v??''}, fmt=n=>new Intl.NumberFormat('vi-VN').format(Number(n||0)), esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
function hoursFromHM(hours,minutes){return (Number(hours)||0)+((Number(minutes)||0)/60)}
function splitHours(totalHours){const totalMinutes=Math.round((Number(totalHours)||0)*60);return {hours:Math.floor(totalMinutes/60),minutes:totalMinutes%60}}
function formatDuration(totalHours){const t=splitHours(totalHours);return `${t.hours}h ${String(t.minutes).padStart(2,'0')}m`}
function nextProductCode(){const maxNo=data.products.reduce((max,p)=>{const m=String(p.code||'').match(/^ATMO-(\d+)$/i);return m?Math.max(max,Number(m[1])||0):max},0);return `ATMO-${String(maxNo+1).padStart(3,'0')}`}
function filteredProducts(){const q=productSearch.trim().toLocaleLowerCase('vi');if(!q)return data.products;return data.products.filter(p=>String(p.code||'').toLocaleLowerCase('vi').includes(q)||String(p.name||'').toLocaleLowerCase('vi').includes(q))}
function nextOrderCode(){
 const maxNo=data.orders.reduce((max,o)=>{
   const m=String(o.code||'').match(/^ATMO-DH-(\d+)$/i);
   return m?Math.max(max,Number(m[1])||0):max;
 },0);
 return `ATMO-DH-${String(maxNo+1).padStart(3,'0')}`;
}
function localDateISO(){
 const d=new Date(),off=d.getTimezoneOffset();
 return new Date(d.getTime()-off*60000).toISOString().slice(0,10);
}
function formatDateVN(value){
 if(!value)return '—';
 const [y,m,d]=String(value).slice(0,10).split('-');
 return y&&m&&d?`${d}/${m}/${y}`:value;
}
function filteredOrders(){
 const q=orderSearch.trim().toLocaleLowerCase('vi');
 return data.orders.filter(o=>{
   if(orderStatusFilter&&o.status!==orderStatusFilter)return false;
   if(!q)return true;
   const items=(o.items||[]).map(x=>`${x.productCode||''} ${x.productName||''} ${x.variant||''}`).join(' ');
   return `${o.code||''} ${o.customerName||''} ${o.customerPhone||''} ${o.channel||''} ${items}`.toLocaleLowerCase('vi').includes(q);
 });
}
function orderStatusClass(status){
 return ({'Mới':'new','Đang chuẩn bị':'preparing','Sẵn sàng':'ready','Đã giao':'done','Hủy':'cancelled'})[status]||'new';
}


function setSync(text,state=''){const el=$('syncStatus');if(!el)return;el.textContent=text;el.className='sync-status'+(state?' '+state:'')}
function unitCost(m){return m&&m.packQty?m.purchasePrice/m.packQty:0} function matById(id){return data.materials.find(m=>m.id===id)}

function calc(p){const s=data.settings,plateQty=Math.max(1,Number(p.plateQty)||1),hours=Number(p.plateHours)||0;
 const plastics=(p.plastics||[]).reduce((sum,x)=>sum+(Number(x.qty)||0)/plateQty*unitCost(matById(x.materialId)),0);
 const acc=(p.accessories||[]).reduce((sum,x)=>sum+(Number(x.qty)||0)*unitCost(matById(x.materialId)),0);
 const pack=(p.packaging||[]).reduce((sum,x)=>sum+(Number(x.qty)||0)*unitCost(matById(x.materialId)),0);
 const electricityPlate=hours*s.powerKw*s.electricityPrice,electricity=electricityPlate/plateQty,machinePlate=hours*s.machinePerHour,machine=machinePlate/plateQty;
 const post=((Number(p.supportMinutes)||0)+(Number(p.surfaceMinutes)||0))/60*s.laborPerHour;
 const pre=plastics+acc+pack+electricity+machine+post+(Number(p.otherCost)||0),failure=pre*s.failureRate,cost=pre+failure;
 return {plastics,acc,pack,electricityPlate,electricity,machinePlate,machine,post,pre,failure,cost,direct:round1000(cost*(1+s.profitRate)),social:round1000(cost*(1+s.profitRate)/(1-s.socialFee)),shopee:round1000(cost*(1+s.profitRate)/(1-s.shopeeFee)),tiktok:round1000(cost*(1+s.profitRate)/(1-s.tiktokFee))};}

const LOGIN_URL = new URL('index.html', window.location.href).href;

async function init(){
  if(!configured){
    alert('Chưa cấu hình Supabase trong config.js.');
    window.location.replace(LOGIN_URL);
    return;
  }

  try{
    const {data:{session},error}=await sb.auth.getSession();
    if(error) throw error;
    if(!session){
      window.location.replace(LOGIN_URL);
      return;
    }

    currentUser=session.user;
    $('userEmail').textContent=currentUser.email||'';
    await loadCloud();
    renderAll();

    sb.auth.onAuthStateChange((event,nextSession)=>{
      if(event==='SIGNED_OUT' || !nextSession){
        window.location.replace(LOGIN_URL);
      }
    });
  }catch(err){
    console.error('ATMO init error:',err);
    alert('Không thể tải dữ liệu: '+(err?.message||err));
  }
}

$('btnLogout').onclick=async()=>{
  const {error}=await sb.auth.signOut();
  if(error){
    alert('Không thể đăng xuất: '+error.message);
    return;
  }
  window.location.replace(LOGIN_URL);
};

async function loadCloud(){setSync('Đang tải…','saving');const uid=currentUser.id;
 const [m,p,s,o,oi]=await Promise.all([
  sb.from('materials').select('*').eq('user_id',uid).order('created_at'),
  sb.from('products').select('*').eq('user_id',uid).order('created_at'),
  sb.from('app_settings').select('settings').eq('user_id',uid).maybeSingle(),
  sb.from('orders').select('*').eq('user_id',uid).order('created_at',{ascending:false}),
  sb.from('order_items').select('*').eq('user_id',uid).order('created_at')
 ]);
 const err=m.error||p.error||s.error||o.error||oi.error;if(err){setSync('Lỗi đồng bộ','error');throw err}
 data.materials=(m.data||[]).map(r=>({id:r.id,code:r.code,name:r.name,group:r.group_name,unit:r.unit,packQty:Number(r.pack_qty),purchasePrice:Number(r.purchase_price)}));
 data.products=(p.data||[]).map(r=>({id:r.id,code:r.code,name:r.name,plateQty:Number(r.plate_qty),plateHours:Number(r.plate_hours),plastics:r.plastics||[],accessories:r.accessories||[],packaging:r.packaging||[],supportMinutes:Number(r.support_minutes||0),surfaceMinutes:Number(r.surface_minutes||0),otherCost:Number(r.other_cost||0)}));
 const itemMap={};(oi.data||[]).forEach(r=>{(itemMap[r.order_id]??=[]).push({id:r.id,productId:r.product_id,productCode:r.product_code,productName:r.product_name,variant:r.variant||'',qty:Number(r.quantity)||1})});
 data.orders=(o.data||[]).map(r=>({id:r.id,code:r.order_code,customerName:r.customer_name,customerPhone:r.customer_phone||'',channel:r.channel,status:r.status,orderDate:r.order_date,dueDate:r.due_date||'',note:r.note||'',items:itemMap[r.id]||[]}));
 data.settings={...defaultSettings,...(s.data?.settings||{})};setSync('Đã đồng bộ');}
async function saveSettingsCloud(){setSync('Đang lưu…','saving');const {error}=await sb.from('app_settings').upsert({user_id:currentUser.id,settings:data.settings,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error){setSync('Lỗi đồng bộ','error');throw error}setSync('Đã đồng bộ')}
async function upsertMaterial(m){setSync('Đang lưu…','saving');const row={id:m.id,user_id:currentUser.id,code:m.code,name:m.name,group_name:m.group,unit:m.unit,pack_qty:m.packQty,purchase_price:m.purchasePrice,updated_at:new Date().toISOString()};const {error}=await sb.from('materials').upsert(row);if(error){setSync('Lỗi đồng bộ','error');throw error}setSync('Đã đồng bộ')}
async function deleteMaterialCloud(id){setSync('Đang lưu…','saving');const {error}=await sb.from('materials').delete().eq('id',id);if(error){setSync('Lỗi đồng bộ','error');throw error}setSync('Đã đồng bộ')}
async function upsertProduct(p){setSync('Đang lưu…','saving');const row={id:p.id,user_id:currentUser.id,code:p.code,name:p.name,plate_qty:p.plateQty,plate_hours:p.plateHours,plastics:p.plastics,accessories:p.accessories,packaging:p.packaging,support_minutes:p.supportMinutes,surface_minutes:p.surfaceMinutes,other_cost:p.otherCost,updated_at:new Date().toISOString()};const {error}=await sb.from('products').upsert(row);if(error){setSync('Lỗi đồng bộ','error');throw error}setSync('Đã đồng bộ')}
async function deleteProductCloud(id){setSync('Đang lưu…','saving');const {error}=await sb.from('products').delete().eq('id',id);if(error){setSync('Lỗi đồng bộ','error');throw error}setSync('Đã đồng bộ')}
async function upsertOrder(o){
 setSync('Đang lưu…','saving');
 const row={id:o.id,user_id:currentUser.id,order_code:o.code,customer_name:o.customerName,customer_phone:o.customerPhone||'',channel:o.channel,status:o.status,order_date:o.orderDate,due_date:o.dueDate||null,note:o.note||'',updated_at:new Date().toISOString()};
 const {error}=await sb.from('orders').upsert(row);if(error){setSync('Lỗi đồng bộ','error');throw error}
 const {error:delErr}=await sb.from('order_items').delete().eq('order_id',o.id);if(delErr){setSync('Lỗi đồng bộ','error');throw delErr}
 const rows=(o.items||[]).map(x=>({id:x.id||uid(),order_id:o.id,user_id:currentUser.id,product_id:x.productId||null,product_code:x.productCode||'',product_name:x.productName||'',variant:x.variant||'',quantity:Math.max(1,Number(x.qty)||1)}));
 if(rows.length){const {error:itemErr}=await sb.from('order_items').insert(rows);if(itemErr){setSync('Lỗi đồng bộ','error');throw itemErr}}
 setSync('Đã đồng bộ');
}
async function deleteOrderCloud(id){
 setSync('Đang lưu…','saving');
 const {error}=await sb.from('orders').delete().eq('id',id);
 if(error){setSync('Lỗi đồng bộ','error');throw error}
 setSync('Đã đồng bộ');
}
async function updateOrderStatus(id,status){
 const {error}=await sb.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)throw error;
 const o=data.orders.find(x=>x.id===id);if(o)o.status=status;
}


function switchTab(name){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id===`tab-${name}`))}document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
const productSearchInput=$('productSearch');if(productSearchInput){productSearchInput.oninput=()=>{productSearch=productSearchInput.value||'';productPage=1;renderProducts()}}const clearProductSearch=$('btnClearProductSearch');if(clearProductSearch){clearProductSearch.onclick=()=>{productSearch='';if(productSearchInput)productSearchInput.value='';productPage=1;renderProducts();productSearchInput?.focus()}}$('btnProductPrev').onclick=()=>{if(productPage>1){productPage--;renderProducts()}};$('btnProductNext').onclick=()=>{const total=Math.max(1,Math.ceil(filteredProducts().length/PRODUCT_PAGE_SIZE));if(productPage<total){productPage++;renderProducts()}};
const orderSearchInput=$('orderSearch');
if(orderSearchInput)orderSearchInput.oninput=()=>{orderSearch=orderSearchInput.value||'';renderOrders()};
const clearOrderSearch=$('btnClearOrderSearch');
if(clearOrderSearch)clearOrderSearch.onclick=()=>{orderSearch='';if(orderSearchInput)orderSearchInput.value='';renderOrders();orderSearchInput?.focus()};
const orderStatusFilterEl=$('orderStatusFilter');
if(orderStatusFilterEl)orderStatusFilterEl.onchange=()=>{orderStatusFilter=orderStatusFilterEl.value||'';renderOrders()};


function renderMaterials(){const tb=document.querySelector('#materialTable tbody');tb.innerHTML='';if(!data.materials.length){tb.innerHTML='<tr><td colspan="8" class="empty">Chưa có nguyên vật liệu.</td></tr>';return}data.materials.forEach(m=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${esc(m.code)}</td><td>${esc(m.name)}</td><td><span class="badge ${m.group}">${m.group}</span></td><td>${esc(m.unit||'')}</td><td class="num">${fmt(m.packQty)}</td><td class="num">${money(m.purchasePrice)}</td><td class="num">${money(unitCost(m))}</td><td class="actions"><button class="small-btn" data-edit="${m.id}">Sửa</button><button class="small-btn danger" data-del="${m.id}">Xóa</button></td>`;tb.appendChild(tr)});tb.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openMaterial(b.dataset.edit));tb.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Xóa nguyên vật liệu này?')){try{await deleteMaterialCloud(b.dataset.del);data.materials=data.materials.filter(x=>x.id!==b.dataset.del);renderAll()}catch(e){alert(e.message)}}})}
function renderProducts(){const tb=document.querySelector('#productTable tbody');tb.innerHTML='';const filtered=filteredProducts();const totalPages=Math.max(1,Math.ceil(filtered.length/PRODUCT_PAGE_SIZE));productPage=Math.min(Math.max(1,productPage),totalPages);const startIndex=(productPage-1)*PRODUCT_PAGE_SIZE;const pageRows=filtered.slice(startIndex,startIndex+PRODUCT_PAGE_SIZE);if(!pageRows.length){tb.innerHTML=`<tr><td colspan="8" class="empty">${productSearch?'Không tìm thấy sản phẩm phù hợp.':'Chưa có sản phẩm. Bấm “Thêm sản phẩm” để bắt đầu.'}</td></tr>`}else{pageRows.forEach(p=>{const c=calc(p),tr=document.createElement('tr');tr.innerHTML=`<td data-label="Mã SP"><span class="product-code">${esc(p.code)}</span></td><td data-label="Tên sản phẩm"><span class="product-name">${esc(p.name)}</span></td><td data-label="Giá vốn" class="num"><span class="cost-price">${money(c.cost)}</span></td><td data-label="Trực tiếp" class="num"><span class="sale-price direct">${money(c.direct)}</span></td><td data-label="MXH" class="num"><span class="sale-price social">${money(c.social)}</span></td><td data-label="Shopee" class="num"><span class="sale-price shopee">${money(c.shopee)}</span></td><td data-label="TikTok" class="num"><span class="sale-price tiktok">${money(c.tiktok)}</span></td><td data-label="Thao tác" class="actions"><button class="small-btn" data-edit="${p.id}">Sửa</button><button class="small-btn danger" data-del="${p.id}">Xóa</button></td>`;tb.appendChild(tr)})}const pageInfo=$('productPageInfo'),pageNo=$('productPageNumber'),prev=$('btnProductPrev'),next=$('btnProductNext');if(pageInfo){const from=filtered.length?startIndex+1:0;const to=Math.min(startIndex+PRODUCT_PAGE_SIZE,filtered.length);pageInfo.textContent=`Hiển thị ${from}–${to} / ${filtered.length} sản phẩm`}if(pageNo)pageNo.textContent=`${productPage} / ${totalPages}`;if(prev)prev.disabled=productPage<=1;if(next)next.disabled=productPage>=totalPages;tb.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openProduct(b.dataset.edit));tb.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{if(confirm('Xóa sản phẩm này?')){try{await deleteProductCloud(b.dataset.del);data.products=data.products.filter(x=>x.id!==b.dataset.del);renderProducts()}catch(e){alert(e.message)}}})}

function renderOrders(){
 const tb=document.querySelector('#orderTable tbody');if(!tb)return;
 const rows=filteredOrders();tb.innerHTML='';
 const pending=data.orders.filter(o=>o.status==='Mới').length;
 const preparing=data.orders.filter(o=>o.status==='Đang chuẩn bị').length;
 const ready=data.orders.filter(o=>o.status==='Sẵn sàng').length;
 $('orderPendingCount').textContent=pending;$('orderPreparingCount').textContent=preparing;$('orderReadyCount').textContent=ready;$('orderTotalCount').textContent=data.orders.length;
 if(!rows.length){tb.innerHTML=`<tr><td colspan="7" class="empty">${orderSearch||orderStatusFilter?'Không tìm thấy đơn hàng phù hợp.':'Chưa có đơn hàng. Bấm “Thêm đơn hàng” để bắt đầu.'}</td></tr>`;return}
 rows.forEach(o=>{
   const items=(o.items||[]).map(x=>`<div class="order-item-summary"><strong>${esc(x.productName||x.productCode)}</strong><span>${x.variant?esc(x.variant)+' · ':''}SL ${fmt(x.qty)}</span></div>`).join('');
   const tr=document.createElement('tr');
   tr.innerHTML=`<td data-label="Mã đơn"><strong class="order-code">${esc(o.code)}</strong><small>${formatDateVN(o.orderDate)}</small></td>
<td data-label="Khách hàng"><strong>${esc(o.customerName)}</strong>${o.customerPhone?`<small>${esc(o.customerPhone)}</small>`:''}</td>
<td data-label="Sản phẩm">${items||'—'}</td>
<td data-label="Kênh"><span class="order-channel">${esc(o.channel)}</span></td>
<td data-label="Hẹn giao"><strong>${formatDateVN(o.dueDate)}</strong></td>
<td data-label="Trạng thái"><select class="order-status-select status-${orderStatusClass(o.status)}" data-status-id="${o.id}">
${['Mới','Đang chuẩn bị','Sẵn sàng','Đã giao','Hủy'].map(s=>`<option value="${s}" ${s===o.status?'selected':''}>${s}</option>`).join('')}
</select></td>
<td data-label="Thao tác" class="actions"><button class="small-btn" data-order-edit="${o.id}">Sửa</button><button class="small-btn danger" data-order-del="${o.id}">Xóa</button></td>`;
   tb.appendChild(tr);
 });
 tb.querySelectorAll('[data-order-edit]').forEach(b=>b.onclick=()=>openOrder(b.dataset.orderEdit));
 tb.querySelectorAll('[data-order-del]').forEach(b=>b.onclick=async()=>{if(confirm('Xóa đơn hàng này?')){try{await deleteOrderCloud(b.dataset.orderDel);data.orders=data.orders.filter(x=>x.id!==b.dataset.orderDel);renderOrders()}catch(e){alert(e.message)}}});
 tb.querySelectorAll('[data-status-id]').forEach(s=>s.onchange=async()=>{const old=data.orders.find(o=>o.id===s.dataset.statusId)?.status;try{await updateOrderStatus(s.dataset.statusId,s.value);renderOrders()}catch(e){s.value=old||'Mới';alert(e.message)}});
}
function buildOrderItems(values=[]){
 const c=$('orderItemRows');c.innerHTML='';
 const list=values.length?values:[{}];
 list.forEach(v=>{
   const row=$('orderItemTemplate').content.firstElementChild.cloneNode(true);
   const sel=row.querySelector('.order-product-select'),variant=row.querySelector('.order-variant'),qty=row.querySelector('.order-qty');
   sel.innerHTML='<option value="">-- Chọn sản phẩm --</option>'+data.products.map(p=>`<option value="${p.id}">${esc(p.code)} · ${esc(p.name)}</option>`).join('');
   sel.value=v.productId||'';variant.value=v.variant||'';qty.value=v.qty||1;
   row.querySelector('.order-item-remove').onclick=()=>{row.remove();if(!c.children.length)buildOrderItems([])};
   c.appendChild(row);
 });
}
function readOrderItems(){
 return [...document.querySelectorAll('#orderItemRows .order-item-row')].map(row=>{
   const productId=row.querySelector('.order-product-select').value;
   const p=data.products.find(x=>x.id===productId);
   return {id:uid(),productId:productId||null,productCode:p?.code||'',productName:p?.name||'',variant:row.querySelector('.order-variant').value.trim(),qty:Math.max(1,Number(row.querySelector('.order-qty').value)||1)};
 }).filter(x=>x.productId);
}
function currentOrderFromForm(){
 return {id:val('orderId')||uid(),code:val('oCode').trim()||nextOrderCode(),customerName:val('oCustomerName').trim(),customerPhone:val('oCustomerPhone').trim(),channel:val('oChannel'),status:val('oStatus'),orderDate:val('oOrderDate')||localDateISO(),dueDate:val('oDueDate'),note:val('oNote').trim(),items:readOrderItems()};
}
function openOrder(id){
 const o=id?data.orders.find(x=>x.id===id):null;
 setVal('orderId',o?.id||'');setVal('oCode',o?.code||nextOrderCode());setVal('oCustomerName',o?.customerName||'');setVal('oCustomerPhone',o?.customerPhone||'');setVal('oChannel',o?.channel||'Trực tiếp');setVal('oStatus',o?.status||'Mới');setVal('oOrderDate',o?.orderDate||localDateISO());setVal('oDueDate',o?.dueDate||'');setVal('oNote',o?.note||'');
 buildOrderItems(o?.items||[]);
 $('orderDialogTitle').textContent=o?`Sửa ${o.code}`:'Thêm đơn hàng';
 $('orderDialog').showModal();
}
function renderSettings(){const s=data.settings;setVal('sMachinePerHour',s.machinePerHour);setVal('sElectricityPrice',s.electricityPrice);setVal('sPowerKw',s.powerKw);setVal('sLaborPerHour',s.laborPerHour);setVal('sFailureRate',s.failureRate*100);setVal('sProfitRate',s.profitRate*100);setVal('sSocialFee',s.socialFee*100);setVal('sShopeeFee',s.shopeeFee*100);setVal('sTikTokFee',s.tiktokFee*100)}function renderAll(){renderMaterials();renderProducts();renderOrders();renderSettings()}
function openMaterial(id){const m=id?matById(id):null;setVal('materialId',m?.id||'');setVal('mCode',m?.code||'');setVal('mName',m?.name||'');setVal('mGroup',m?.group||'Nhựa');setVal('mUnit',m?.unit||'');setVal('mPackQty',m?.packQty||'');setVal('mPurchasePrice',m?.purchasePrice||'');$('materialDialogTitle').textContent=m?'Sửa nguyên vật liệu':'Thêm nguyên vật liệu';$('materialDialog').showModal()}
$('btnAddMaterial').onclick=()=>openMaterial();$('btnSaveMaterial').onclick=async e=>{e.preventDefault();const id=val('materialId')||uid(),obj={id,code:val('mCode').trim(),name:val('mName').trim(),group:val('mGroup'),unit:val('mUnit').trim(),packQty:num('mPackQty'),purchasePrice:num('mPurchasePrice')};if(!obj.code||!obj.name||obj.packQty<=0)return alert('Vui lòng nhập đủ thông tin nguyên vật liệu.');try{await upsertMaterial(obj);const i=data.materials.findIndex(x=>x.id===id);i>=0?data.materials[i]=obj:data.materials.push(obj);renderAll();$('materialDialog').close()}catch(err){alert(err.message)}};
function groupMaterials(group){return data.materials.filter(m=>m.group===group)}function buildRows(containerId,group,values=[],plastic=false){const c=$(containerId);c.innerHTML='';for(let i=0;i<3;i++){const row=$('materialRowTemplate').content.firstElementChild.cloneNode(true),sel=row.querySelector('.mat-select'),qty=row.querySelector('.mat-qty'),u=row.querySelector('.unit-label');sel.innerHTML='<option value="">-- Không dùng --</option>'+groupMaterials(group).map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');const v=values[i]||{};sel.value=v.materialId||'';qty.value=v.qty??'';u.textContent=plastic?'g/PEI':'/SP';sel.onchange=updatePreview;qty.oninput=updatePreview;c.appendChild(row)}}
function readRows(containerId){return [...document.querySelectorAll(`#${containerId} .material-row`)].map(r=>({materialId:r.querySelector('.mat-select').value,qty:Number(r.querySelector('.mat-qty').value)||0})).filter(x=>x.materialId&&x.qty>0)}
function currentProductFromForm(){return {id:val('productId')||uid(),code:val('pCode').trim()||nextProductCode(),name:val('pName').trim(),plateQty:num('pPlateQty'),plateHours:hoursFromHM(num('pPlateHoursHour'),num('pPlateHoursMinute')),plastics:readRows('plasticRows'),accessories:readRows('accessoryRows'),packaging:readRows('packagingRows'),supportMinutes:num('pSupportMinutes'),surfaceMinutes:num('pSurfaceMinutes'),otherCost:num('pOtherCost')}}
function updatePreview(){const c=calc(currentProductFromForm());$('costPreview').innerHTML=`<div>Nhựa/SP<strong>${money(c.plastics)}</strong></div><div>Điện + máy/SP<strong>${money(c.electricity+c.machine)}</strong></div><div>Hậu xử lý/SP<strong>${money(c.post)}</strong></div><div>Giá vốn/SP<strong>${money(c.cost)}</strong></div><div>Trực tiếp<strong>${money(c.direct)}</strong></div><div>MXH<strong>${money(c.social)}</strong></div><div>Shopee<strong>${money(c.shopee)}</strong></div><div>TikTok<strong>${money(c.tiktok)}</strong></div>`}
function openProduct(id){const p=id?data.products.find(x=>x.id===id):null;setVal('productId',p?.id||'');setVal('pCode',p?.code||nextProductCode());setVal('pName',p?.name||'');setVal('pPlateQty',p?.plateQty||1);const _time=splitHours(p?.plateHours||0);setVal('pPlateHoursHour',_time.hours);setVal('pPlateHoursMinute',_time.minutes);setVal('pSupportMinutes',p?.supportMinutes||0);setVal('pSurfaceMinutes',p?.surfaceMinutes||0);setVal('pOtherCost',p?.otherCost||0);buildRows('plasticRows','Nhựa',p?.plastics||[],true);buildRows('accessoryRows','Phụ kiện',p?.accessories||[]);buildRows('packagingRows','Bao bì',p?.packaging||[]);$('productDialogTitle').textContent=p?'Sửa sản phẩm':'Thêm sản phẩm';['pPlateQty','pPlateHoursHour','pPlateHoursMinute','pSupportMinutes','pSurfaceMinutes','pOtherCost'].forEach(id=>$(id).oninput=updatePreview);updatePreview();$('productDialog').showModal()}
$('btnAddProduct').onclick=()=>openProduct();$('btnSaveProduct').onclick=async e=>{e.preventDefault();const p=currentProductFromForm();if(!p.name||p.plateQty<1)return alert('Vui lòng nhập Tên sản phẩm và số SP/PEI.');const _minute=num('pPlateHoursMinute');if(_minute<0||_minute>59)return alert('Phút in phải từ 0 đến 59.');try{await upsertProduct(p);const i=data.products.findIndex(x=>x.id===p.id);i>=0?data.products[i]=p:data.products.push(p);renderProducts();$('productDialog').close()}catch(err){alert(err.message)}};

$('btnAddOrder').onclick=()=>openOrder();
$('btnAddOrderItem').onclick=()=>{const current=readOrderItems();buildOrderItems([...current,{}])};
$('btnSaveOrder').onclick=async e=>{
 e.preventDefault();const o=currentOrderFromForm();
 if(!o.customerName)return alert('Vui lòng nhập tên khách hàng.');
 if(!o.items.length)return alert('Vui lòng thêm ít nhất 1 sản phẩm vào đơn.');
 try{
   await upsertOrder(o);
   const i=data.orders.findIndex(x=>x.id===o.id);i>=0?data.orders[i]=o:data.orders.unshift(o);
   renderOrders();$('orderDialog').close();
 }catch(err){alert(err.message)}
};
$('btnSaveSettings').onclick=async()=>{data.settings={machinePerHour:num('sMachinePerHour'),electricityPrice:num('sElectricityPrice'),powerKw:num('sPowerKw'),laborPerHour:num('sLaborPerHour'),failureRate:num('sFailureRate')/100,profitRate:num('sProfitRate')/100,socialFee:num('sSocialFee')/100,shopeeFee:num('sShopeeFee')/100,tiktokFee:num('sTikTokFee')/100};try{await saveSettingsCloud();renderProducts();alert('Đã lưu thiết lập.')}catch(e){alert(e.message)}};
$('btnExport').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`atmo-costing-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
$('fileImport').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const incoming=JSON.parse(await f.text());if(!incoming.materials||!incoming.products||!incoming.settings)throw new Error('File JSON không đúng định dạng.');if(!confirm('Nhập dữ liệu sẽ ghi thêm/cập nhật dữ liệu hiện tại. Tiếp tục?'))return;for(const m of incoming.materials){m.id=m.id||uid();await upsertMaterial(m)}for(const p of incoming.products){p.id=p.id||uid();await upsertProduct(p)}
if(Array.isArray(incoming.orders)){for(const o of incoming.orders){o.id=o.id||uid();o.code=o.code||nextOrderCode();await upsertOrder(o)}}
data.settings={...defaultSettings,...incoming.settings};await saveSettingsCloud();await loadCloud();renderAll();alert('Đã nhập dữ liệu và đồng bộ lên cloud.')}catch(err){alert(err.message)}finally{e.target.value=''}};
init();
