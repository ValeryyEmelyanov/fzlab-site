const message=document.getElementById('message');
try {
  const response=await fetch('../../3d/models.json');
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const models=(await response.json()).filter(model=>model.group==='podstavki'||model.category?.some(category=>category.includes('Для стола')));
  for(const model of models){
    const card=document.createElement('article');card.className='card';
    const href=`../../3d/?id=${encodeURIComponent(model.id)}`;
    const preview=document.createElement('a');preview.className='preview';preview.href=href;preview.setAttribute('aria-label',`Открыть ${model.name} в 3D`);
    if(model.preview){const img=document.createElement('img');img.src=new URL(model.preview,new URL('../../3d/',location.href));img.alt=model.name;img.width=960;img.height=720;preview.append(img);}
    const content=document.createElement('div');content.className='content';
    const id=document.createElement('span');id.className='id';id.textContent=model.id;
    const title=document.createElement('h2');title.textContent=model.name;
    const link=document.createElement('a');link.className='choose';link.href=href;link.textContent='Выбрать цвет →';
    content.append(id,title,link);card.append(preview,content);document.getElementById('models').append(card);
  }
  message.textContent=models.length?'':'Подставки скоро появятся в каталоге.';message.hidden=!!models.length;
}catch(error){message.textContent='Не удалось загрузить модели. Обновите страницу или попробуйте позже.';console.error(error);}
