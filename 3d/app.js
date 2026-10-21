const $ = id => document.getElementById(id);
const viewer = $('viewer'), reel = $('reel');
let models, palette, current, brush, line, folder = [], ready = false, scrollTimer;
let inventory = null;
const inStock = color => inventory?.items.some(item => item?.brand === 'Bambu' && item.line === color.line && item.code === color.code && (item.stock_g === null || (typeof item.stock_g === 'number' && item.stock_g > 0))) || false;
const configurations = new Map(), lastColors = new Map();
const status = text => { $('status').textContent = text; };
const button = (text, action) => { const el = document.createElement('button'); el.textContent = text; el.addEventListener('click', action); return el; };
const pathEqual = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const startsWith = (a,b) => b.every((part,i) => a[i] === part);

function renderCatalog() {
  $('breadcrumbs').replaceChildren(button('Каталог', () => { folder=[]; renderCatalog(); }));
  folder.forEach((name,i) => $('breadcrumbs').append(button(' / '+name, () => {folder=folder.slice(0,i+1);renderCatalog();})));
  $('files').replaceChildren();
  const children = [...new Set(models.filter(m => startsWith(m.category,folder) && m.category.length>folder.length).map(m=>m.category[folder.length]))];
  children.forEach(name => $('files').append(button('▱ '+name, () => {folder.push(name);renderCatalog();})));
  models.filter(m => pathEqual(m.category,folder)).forEach(m => {
    const el = button('◇ '+m.name, () => openModel(m));
    const small=document.createElement('small');small.textContent=m.id;el.append(small);
    el.setAttribute('aria-current', String(m===current));$('files').append(el);
  });
}

function openModel(model) {
  if(current===model) return;
  current=model;
  const url=new URL(location.href);url.searchParams.set('id',model.id);history.replaceState(null,'',url);
  folder=[...model.category];
  if(matchMedia('(max-width:760px)').matches) $('catalog').open=false;
  ready=false; $('copy').disabled=true; $('manual').hidden=true;
  if(!configurations.has(model.id)) configurations.set(model.id, Object.fromEntries(model.parts.map((p,i)=>[p.material, findColor(i ? '10603':'11101')])));
  $('model-id').textContent=model.id;$('model-name').textContent=model.name;
  viewer.alt=`${model.name}, ${model.id}. Нажмите на часть, чтобы покрасить.`;
  status('Загрузка 3D-модели…');viewer.src=model.glb;viewer.cameraOrbit='0deg 25deg auto';
  renderCatalog();renderOrder();
}
function findColor(code) {
  for(const series of palette.series) {const c=series.colors.find(c=>c.code===code);if(c)return {...c,line:series.name,roughness:series.roughness};}
  throw new Error(`Цвет ${code} отсутствует в палитре`);
}
function applyMaterial(name,color) {
  const material=viewer.model?.getMaterialByName(name);
  if(!material) throw new Error(`В модели отсутствует материал «${name}»`);
  // model-viewer converts CSS hex from sRGB into the renderer's linear color space.
  material.pbrMetallicRoughness.setBaseColorFactor(color.hex);
  material.pbrMetallicRoughness.setRoughnessFactor(color.roughness);
  material.pbrMetallicRoughness.setMetallicFactor(0);
}
function paint(name) {
  if(!ready || !brush) return;
  try {applyMaterial(name,brush);configurations.get(current.id)[name]={...brush};renderOrder();
    status(`${current.parts.find(p=>p.material===name).label}: ${brush.line} ${brush.name}`);
  } catch(error) { status(error.message); }
}
function renderOrder() {
  const config=configurations.get(current.id);
  $('summary').textContent=`${current.id} ${current.name} · `+current.parts.map(p=>`${p.label.toLowerCase()}: ${config[p.material].line} ${config[p.material].name}${inStock(config[p.material]) ? ' (в наличии)' : ''}`).join(' · ');
  $('parts').replaceChildren();
  current.parts.forEach(p=>{
    const c=config[p.material], el=button('',()=>paint(p.material));
    el.disabled=!ready;el.title='Покрасить выбранным цветом';
    const dot=document.createElement('span');dot.className='dot';dot.style.background=c.hex;
    const label=document.createElement('span');label.textContent=p.label;
    const small=document.createElement('small');small.textContent=`${c.line} ${c.name} · ${c.code}`;label.append(small);el.append(dot,label);$('parts').append(el);
  });
}
viewer.addEventListener('load',()=>{
  if(!current || new URL(viewer.src,location.href).pathname!==new URL(current.glb,location.href).pathname)return;
  try {for(const [name,c] of Object.entries(configurations.get(current.id))) applyMaterial(name,c);
    ready=true;$('copy').disabled=false;renderOrder();status('Модель готова. Выберите цвет и нажмите на часть.');
  } catch(error) {status(error.message);}
});
viewer.addEventListener('error',()=>{ready=false;$('copy').disabled=true;renderOrder();status('Не удалось загрузить модель. Проверьте GLB и перезагрузите страницу.');});
let pointer;
viewer.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY,id:e.pointerId};});
viewer.addEventListener('pointermove',e=>{if(pointer && Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>7)pointer=null;});
viewer.addEventListener('pointercancel',()=>{pointer=null;});
viewer.addEventListener('pointerup',e=>{
  if(!pointer || e.pointerId!==pointer.id)return;pointer=null;
  if(!ready)return;
  const material=viewer.materialFromPoint(e.clientX,e.clientY);
  if(material && current.parts.some(p=>p.material===material.name))paint(material.name);
});

function selectCenter() {
  const rect=reel.getBoundingClientRect(), center=rect.left+rect.width/2;
  const items=[...reel.children];if(!items.length)return;
  const nearest=items.reduce((a,b)=>Math.abs(a.getBoundingClientRect().left+28-center)<Math.abs(b.getBoundingClientRect().left+28-center)?a:b);
  const c=line.colors[Number(nearest.dataset.index)];
  brush={...c,line:line.name,roughness:line.roughness};lastColors.set(line.name,c.code);
  items.forEach(el=>el.setAttribute('aria-pressed',String(el===nearest)));
  $('color-bar').style.background=c.hex;$('color-name').textContent=`${line.name} · ${c.name}`;
  $('availability').hidden=!inventory;
  $('availability').textContent=inStock(brush)?'в наличии · отправим быстрее':'под заказ катушки, +2–3 дня';
  $('availability').classList.toggle('available',inStock(brush));
  $('color-code').textContent=`${c.code} / ${c.hex}${c.approx?' / приблизительный цвет':''}`;
}
function centerSwatch(el,smooth=true) {
  if(!el)return;
  reel.scrollTo({left:el.offsetLeft-reel.clientWidth/2+el.clientWidth/2,behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
}
function renderPalette(series) {
  clearTimeout(scrollTimer);line=series;
  $('tabs').replaceChildren(...palette.series.map(s=>{const el=button(s.name,()=>renderPalette(s));el.setAttribute('aria-pressed',String(s===line));return el;}));
  const visible=series.colors.map((c,i)=>({c,i})).filter(({c})=>!$('stock-only').checked || inStock({...c,line:series.name}));
  reel.replaceChildren(...visible.map(({c,i})=>{const el=button('',()=>centerSwatch(el));el.className='swatch';el.style.background=c.hex;el.dataset.index=i;const available=inStock({...c,line:series.name});el.classList.toggle('in-stock',available);el.title=`${c.name} (${c.code})${available?' — в наличии':''}`;el.setAttribute('aria-label',`${series.name} ${c.name}, ${c.code}`);if(available)el.setAttribute('aria-description','In stock');return el;}));
  $('palette-empty').hidden=visible.length>0;
  $('palette-marker').hidden=!visible.length;
  if(!visible.length){brush=null;$('color-name').textContent=series.name;$('color-code').textContent='Нет цветов в наличии в этой линейке';$('availability').hidden=true;$('color-bar').style.background='transparent';return;}
  const wanted=lastColors.get(series.name),index=Math.max(0,visible.findIndex(({c})=>c.code===wanted));
  requestAnimationFrame(()=>{if(line!==series || !reel.children[index])return;centerSwatch(reel.children[index],false);selectCenter();});
}
$('stock-only').addEventListener('change',()=>renderPalette(line));
reel.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(selectCenter,130);});
reel.addEventListener('scrollend',selectCenter);
reel.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();reel.scrollLeft+=e.deltaY;}},{passive:false});
// Touch uses native scrolling; a mouse can also drag the reel.
let drag, suppressReelClick=false;
reel.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){drag={x:e.clientX,left:reel.scrollLeft,moved:false,target:e.target};}});
window.addEventListener('pointermove',e=>{if(!drag)return;if(Math.abs(e.clientX-drag.x)>5){drag.moved=true;reel.style.scrollSnapType='none';reel.style.scrollBehavior='auto';reel.scrollLeft=drag.left-(e.clientX-drag.x);}});
window.addEventListener('pointerup',()=>{if(!drag)return;const moved=drag.moved;drag=null;reel.style.scrollSnapType='';reel.style.scrollBehavior='';if(moved){suppressReelClick=true;setTimeout(()=>suppressReelClick=false,0);selectCenter();centerSwatch(reel.querySelector('[aria-pressed="true"]'));}});
window.addEventListener('pointercancel',()=>{drag=null;reel.style.scrollSnapType='';reel.style.scrollBehavior='';});
reel.addEventListener('click',e=>{if(suppressReelClick){e.preventDefault();e.stopImmediatePropagation();}},true);
new ResizeObserver(()=>{const el=reel.querySelector('[aria-pressed="true"]');if(el)centerSwatch(el,false);}).observe(reel);
$('rotate').addEventListener('click',()=>{viewer.autoRotate=!viewer.autoRotate;$('rotate').setAttribute('aria-pressed',String(viewer.autoRotate));$('rotate').textContent=`Вращение: ${viewer.autoRotate?'вкл.':'выкл.'}`;});
$('reset').addEventListener('click',()=>{viewer.resetTurntableRotation();viewer.cameraOrbit='0deg 0deg auto';viewer.jumpCameraToGoal();});
$('copy').addEventListener('click',async()=>{const text=$('summary').textContent;try{await navigator.clipboard.writeText(text);status('Скопировано. Отправьте сочетание для заказа.');}catch{ $('manual').hidden=false;$('manual-text').value=text;$('manual-text').focus();$('manual-text').select();status('Выделен текст заказа для ручного копирования.'); }});
const catalogMedia=matchMedia('(max-width:760px)');
const syncCatalog=()=>{$('catalog').open=!catalogMedia.matches;};
catalogMedia.addEventListener('change',syncCatalog);syncCatalog();

try {
  const responses=await Promise.all(['models.json','palette.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);return r.json();})));
  [models,palette]=responses;
  try {
    const response=await fetch('inventory.json', {signal: AbortSignal.timeout(5000)});
    if(response.ok){const data=await response.json();if(Array.isArray(data.items))inventory=data;}
  } catch { /* Optional inventory: keep the original catalog usable. */ }
  $('stock-filter').hidden=!inventory;
  if(!models.length || !palette.series?.length)throw new Error('Каталог или палитра пусты');
  const initialModel=models.find(m=>m.id===new URLSearchParams(location.search).get('id'))||models[0];
  folder=[...initialModel.category];lastColors.set('PLA Matte','11101');lastColors.set('PLA Basic','10603');renderPalette(palette.series.find(s=>s.name==='PLA Matte')||palette.series[0]);
  await Promise.race([customElements.whenDefined('model-viewer'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('3D-просмотрщик не загрузился с jsDelivr. Проверьте интернет')),20000))]);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){viewer.autoRotate=false;$('rotate').textContent='Вращение: выкл.';$('rotate').setAttribute('aria-pressed','false');}
  openModel(initialModel);
}catch(error){status(`Не удалось открыть каталог: ${error.message}. Запустите python -m http.server 8000 в папке проекта.`);}
