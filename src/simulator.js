const SIMULATOR_RULES=JSON.parse(document.getElementById('simulator-rules').textContent);
const simulatorUI={value:emptySimulator(),selected:null,history:[],palette:'units',pickerSlot:0,pickerPage:0,pickerPageSize:18};
function simulatorCostColor(cost){return ({1:'#9ca3af',2:'#4ade80',3:'#60a5fa',4:'#c084fc',5:'#facc15'})[cost]||rarity[cost]||rarity[1];}
function simulatorContext(){return {units:DATA.units,traits:DATA.traits,items:EQUIPMENT.items,augments:AUGMENTS.augments,rules:SIMULATOR_RULES};}
function simulatorSave(){try{localStorage.setItem('eightfold-simulator-v1',JSON.stringify(simulatorUI.value));}catch{}}
function simulatorApply(action){
 try{
  const next=simulatorTransition(simulatorUI.value,action,simulatorContext());if(next===simulatorUI.value)return;
  simulatorUI.history.push(simulatorUI.value);if(simulatorUI.history.length>40)simulatorUI.history.shift();simulatorUI.value=next;
  if(action.type==='add'){const cell=next.board.findIndex(u=>u?.uid===next.nextId-1);simulatorUI.selected=cell;}
  if(action.type==='move')simulatorUI.selected=action.cell;if(action.type==='remove'&&simulatorUI.selected===action.cell)simulatorUI.selected=null;if(action.type==='clear')simulatorUI.selected=null;
  const focused=document.activeElement?.id;simulatorSave();renderSimulatorBoard();renderSimulatorAugments();if(focused&&$(focused))$(focused).focus({preventScroll:true});
 }catch(error){notify(t(error.message));}
}
function simulatorImage(item,className=''){const image=new Image();image.src=item.image;image.alt=equipmentName(item,getLanguage());image.className=className;image.dataset.itemCategory=item.category;image.loading='lazy';image.draggable=false;image.addEventListener('error',()=>{image.hidden=true;});return image;}
function simulatorDrag(node,payload){
 node.draggable=false;node.querySelectorAll('img').forEach(image=>{image.draggable=false;});node.addEventListener('dragstart',event=>event.preventDefault());node.dataset.simDraggable='true';let drag=null;
 const cleanup=()=>{if(!drag)return;cancelAnimationFrame(drag.frame);drag.ghost?.remove();const pointerId=drag.pointerId;drag=null;window.removeEventListener('blur',cleanup);if(node.hasPointerCapture(pointerId))node.releasePointerCapture(pointerId);document.querySelectorAll('.drag-over,.sim-dragging,.drop-remove').forEach(e=>e.classList.remove('drag-over','sim-dragging','drop-remove'));$('sim-delete-zone').textContent=t('Drag board champions or equipped items back here to remove them');};
 const autoScroll=()=>{if(!drag?.active)return;const y=drag.lastY,delta=y<55?-Math.ceil((55-y)/4):y>innerHeight-55?Math.ceil((y-innerHeight+55)/4):0;if(delta)window.scrollBy(0,Math.max(-18,Math.min(18,delta)));drag.frame=requestAnimationFrame(autoScroll);};
 node.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.stopPropagation();drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,active:false};node.setPointerCapture(event.pointerId);window.addEventListener('blur',cleanup,{once:true});});
 node.addEventListener('pointermove',event=>{
  if(!drag||event.pointerId!==drag.pointerId)return;
  if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<8)return;
  event.preventDefault();drag.lastY=event.clientY;if(!drag.active){drag.active=true;drag.frame=requestAnimationFrame(autoScroll);node.classList.add('sim-dragging');drag.ghost=el('div','sim-drag-ghost');drag.ghost.setAttribute('aria-hidden','true');drag.ghost.inert=true;const clone=node.cloneNode(true);clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));drag.ghost.append(clone);document.body.append(drag.ghost);$('sim-delete-zone').textContent=t('Drop here to remove from the board');}
  drag.ghost.style.left=(event.clientX-35)+'px';drag.ghost.style.top=(event.clientY-40)+'px';
  document.querySelectorAll('.drag-over,.drop-remove').forEach(e=>e.classList.remove('drag-over','drop-remove'));
  const target=document.elementFromPoint(event.clientX,event.clientY),hex=target?.closest('.sim-cell'),palette=target?.closest('#sim-palette');if(hex)hex.classList.add('drag-over');if(palette&&!payload.kind.includes('palette'))palette.classList.add('drop-remove');
 });
 node.addEventListener('pointerup',event=>{if(!drag||drag.pointerId!==event.pointerId)return;const active=drag.active,target=document.elementFromPoint(event.clientX,event.clientY),hex=target?.closest('.sim-cell'),remove=target?.closest('#sim-palette');cleanup();if(active){event.preventDefault();simulatorUI.suppressClickUntil=performance.now()+250;if(hex)simulatorHandleCell(payload,Number(hex.dataset.cell));else if(remove)simulatorHandleRemove(payload);}});
 node.addEventListener('pointercancel',cleanup);node.addEventListener('lostpointercapture',cleanup);
}
function simulatorReadDrag(event){try{const raw=event.dataTransfer?.getData('application/x-eightfold-simulator');if(!raw||raw.length>2048)return null;return JSON.parse(raw);}catch{return null;}}
function simulatorCanDrop(event){return [...(event.dataTransfer?.types||[])].includes('application/x-eightfold-simulator');}
function simulatorDropCell(event,cell){
 const data=simulatorReadDrag(event);if(!data)return;event.preventDefault();event.stopPropagation();event.currentTarget.classList.remove('drag-over');
 simulatorHandleCell(data,cell);
}
function simulatorHandleCell(data,cell){
 if(data.kind==='unit-palette'){if(simulatorUI.value.board[cell]){notify(t('This hex is occupied.'));return;}simulatorApply({type:'add',cell,unitId:data.unitId});}
 if(data.kind==='unit-board'&&simulatorUI.value.board[data.from]?.uid===data.uid)simulatorApply({type:'move',from:data.from,cell});
 if(data.kind==='item-palette')simulatorApply({type:'equip',cell,itemId:data.itemId});
 if(data.kind==='item-board'&&simulatorUI.value.board[data.from]?.uid===data.uid)simulatorApply({type:'move-item',from:data.from,cell,index:data.index});
}
function simulatorDeleteDrop(event){
 const data=simulatorReadDrag(event);if(!data)return;event.preventDefault();event.stopPropagation();$('sim-palette').classList.remove('drop-remove');$('sim-delete-zone').classList.remove('drag-over');
 simulatorHandleRemove(data);
}
function simulatorHandleRemove(data){
 if(data.kind==='unit-board'&&simulatorUI.value.board[data.from]?.uid===data.uid)simulatorApply({type:'remove',cell:data.from});
 if(data.kind==='item-board'&&simulatorUI.value.board[data.from]?.uid===data.uid)simulatorApply({type:'remove-item',cell:data.from,index:data.index});
}
function renderSimulatorBoard(){
 const value=simulatorUI.value,context=simulatorContext(),summary=simulatorTraits(value,context),fragment=document.createDocumentFragment();
 for(let cell=0;cell<SIMULATOR_CELLS;cell++){
  const row=Math.floor(cell/7),col=cell%7,placed=value.board[cell],unit=placed?DATA.units.find(u=>u.id===placed.unitId):null;
  const hex=el('button','sim-cell'+(placed?' occupied':'')+(simulatorUI.selected===cell?' selected':''));hex.id='sim-cell-'+cell;hex.type='button';hex.dataset.row=String(row);hex.dataset.cell=String(cell);hex.style.gridColumn=(col*2+1+row%2)+' / span 2';hex.style.gridRow=String(row+1);hex.setAttribute('aria-pressed',String(simulatorUI.selected===cell));if(unit){hex.dataset.cost=String(unit.cost);hex.style.setProperty('--sim-cost-color',simulatorCostColor(unit.cost));}
  hex.setAttribute('aria-label',placed?t('Row {row}, hex {col}: {name}, {stars} stars',{row:row+1,col:col+1,name:unitLabel(unit),stars:placed.stars}):t('Row {row}, hex {col}: empty',{row:row+1,col:col+1}));
  const inner=el('span','sim-hex-inner');hex.append(inner);
  if(unit){
   inner.append(el('span','sim-empty',unit.name.slice(0,2)));const url=ART.units[unit.id]?.url||INFO.units[unit.id]?.image;
   if(url){const image=new Image();image.src=url;image.alt='';image.className='sim-unit-image';image.draggable=false;image.addEventListener('error',()=>image.remove());inner.append(image);}
   inner.append(el('span','sim-stars','★'.repeat(placed.stars)),el('span','sim-unit-name',unitLabel(unit)));
   const itemRow=el('span','sim-unit-items');placed.items.forEach((id,index)=>{const item=equipmentById.get(id),slot=el('span','sim-board-item');slot.dataset.itemCategory=item.category;slot.title=equipmentName(item,getLanguage());slot.append(simulatorImage(item));appendArtifactBadge(slot,item);simulatorDrag(slot,{kind:'item-board',from:cell,index,uid:placed.uid});slot.addEventListener('click',event=>{event.stopPropagation();simulatorUI.selected=cell;renderSimulatorBoard();});itemRow.append(slot);});inner.append(itemRow);simulatorDrag(hex,{kind:'unit-board',from:cell,uid:placed.uid});
  }else inner.append(el('span','sim-empty','＋'));
  hex.addEventListener('click',()=>{const selected=simulatorUI.selected;if(!placed&&selected!==null&&value.board[selected])simulatorApply({type:'move',from:selected,cell});else{simulatorUI.selected=cell;renderSimulatorBoard();$('sim-cell-'+cell).focus({preventScroll:true});}});
  hex.addEventListener('keydown',event=>{if((event.key==='Delete'||event.key==='Backspace')&&placed){event.preventDefault();simulatorApply({type:'remove',cell});}});
  hex.addEventListener('dragover',event=>{if(simulatorCanDrop(event)){event.preventDefault();hex.classList.add('drag-over');}});hex.addEventListener('dragleave',()=>hex.classList.remove('drag-over'));hex.addEventListener('drop',event=>simulatorDropCell(event,cell));fragment.append(hex);
 }
 const ids=[...new Set(value.board.filter(Boolean).map(placed=>placed.unitId))],team=ids.map(id=>DATA.units.find(unit=>unit.id===id)),copy=teamCodeButton(team);copy.id='sim-copy-code-button';copy.classList.add('outline-button');
 if(!team.length)copy.title=t('Add champions to the board before copying.');
 if(ids.length<summary.champions)copy.title+=' · '+t('Repeated champions are exported once.');
 $('sim-copy-team-code').replaceChildren(copy);
 $('sim-board').replaceChildren(fragment);$('sim-board-count').textContent=t('{champions} champions · {population} population',{champions:summary.champions,population:summary.population});$('sim-undo').disabled=!simulatorUI.history.length;
 const traits=document.createDocumentFragment();for(const trait of summary.rows){const line=el('div','sim-trait'+(trait.tier?' active':''));const icon=el('span');if(ART.traits[trait.name]?.url){const image=new Image();image.src=ART.traits[trait.name].url;image.alt='';image.loading='lazy';image.addEventListener('error',()=>image.remove());icon.append(image);}const name=el('span','',traitLabel(trait.name));name.append(el('small','',trait.breakpoints.join(' / ')));line.append(icon,name,el('b','',String(trait.count)+(trait.name==='K|DA'?'★':'')));line.title=t('Active tier {tier} · Next {next}',{tier:trait.tier,next:trait.next||'—'});traits.append(line);}
 $('sim-trait-list').replaceChildren(traits);$('sim-trait-empty').hidden=summary.rows.length>0;renderSimulatorInspector();
}
function renderSimulatorInspector(){
 const root=$('sim-inspector'),cell=simulatorUI.selected,placed=cell===null?null:simulatorUI.value.board[cell];root.replaceChildren(el('h2','',t('Selected champion')));
 if(!placed){root.append(el('p','field-hint',t('Select a champion on the board to change stars or equipment.')));return;}
 const unit=DATA.units.find(u=>u.id===placed.unitId);root.append(el('strong','sim-selected-name',unitLabel(unit)));
 const stars=el('div','sim-star-controls');stars.setAttribute('role','group');stars.setAttribute('aria-label',t('Star level'));for(let n=1;n<=4;n++){const button=el('button','',n+'★');button.id='sim-stars-'+n;button.type='button';button.setAttribute('aria-pressed',String(placed.stars===n));button.setAttribute('aria-label',t('Set {n} stars',{n}));button.addEventListener('click',()=>simulatorApply({type:'stars',cell,stars:n}));stars.append(button);}root.append(stars);
 const items=el('div','sim-equipped-list');placed.items.forEach((id,index)=>{const item=equipmentById.get(id),button=el('button','sim-equipped-item');button.type='button';button.setAttribute('aria-label',t('Remove {name}',{name:equipmentName(item,getLanguage())}));button.dataset.itemCategory=item.category;button.title=t('Click to remove · Drag to transfer');button.append(simulatorImage(item),el('span','','×'));appendArtifactBadge(button,item);button.addEventListener('click',()=>simulatorApply({type:'remove-item',cell,index}));simulatorDrag(button,{kind:'item-board',from:cell,index,uid:placed.uid});items.append(button);});root.append(items,el('p','field-hint',t('{n} / 3 item slots',{n:simulatorItemSlots(placed.items,simulatorContext())})));
 if(!unit.traits.includes('Collab')){const label=el('label'),input=el('input');input.type='checkbox';input.id='sim-collab';input.checked=placed.collab;input.addEventListener('change',()=>simulatorApply({type:'collab',cell,enabled:input.checked}));label.append(input,document.createTextNode(t('Collab champion this game')));root.append(label);}
 if(unit.name==='Sona'){const label=el('label','',t('Featured band')),select=el('select');select.id='sim-sona-band';select.setAttribute('aria-label',t('Featured band'));select.append(new Option(t('None specified'),''));for(const trait of SIMULATOR_RULES.sonaBands)select.append(new Option(traitLabel(trait),trait));select.value=placed.sonaBand;select.addEventListener('change',()=>simulatorApply({type:'sona',cell,trait:select.value}));label.append(select);root.append(label);}
 const remove=el('button','outline-button',t('Remove champion'));remove.type='button';remove.addEventListener('click',()=>simulatorApply({type:'remove',cell}));root.append(remove);
}
function renderSimulatorAugments(){
 const fragment=document.createDocumentFragment();for(let slot=0;slot<3;slot++){
  const a=AUGMENTS.augments.find(a=>a.id===simulatorUI.value.augments[slot]),wrapper=el('div','sim-augment-slot'+(a?' filled':'')),button=el('button','sim-augment-choice');button.type='button';button.setAttribute('aria-label',t('Choose augment {n}',{n:slot+1}));button.setAttribute('aria-haspopup','dialog');wrapper.style.setProperty('--augment-color',a?augmentColors[a.tier]:'#50617d');
  if(a){button.append(augmentIcon(a),el('strong','',augmentName(a,getLanguage())),augmentEffectTags(a));button.title=augmentDescription(a);const clear=el('button','sim-augment-clear','×');clear.type='button';clear.setAttribute('aria-label',t('Clear augment {n}',{n:slot+1}));clear.addEventListener('click',()=>simulatorApply({type:'augment',slot,id:null}));wrapper.append(clear);}else button.append(el('span','sim-empty','＋'),el('strong','',t('Augment {n}',{n:slot+1})),el('small','',t('Search by name or category')));
  button.addEventListener('click',()=>openSimulatorAugment(slot));wrapper.append(button);fragment.append(wrapper);
 }$('sim-augment-slots').replaceChildren(fragment);
}
function populateSimulatorFilters(){
 for(const [id,options]of [['sim-unit-cost',[['',t('All costs')],...[1,2,3,4,5,7].map(n=>[String(n),n+'g'])]],['sim-unit-trait',[['',t('All traits')],...DATA.traits.map(trait=>[trait.name,traitLabel(trait.name)])]],['sim-item-category',[['',t('All equipment')],...Object.entries(EQUIPMENT_CATEGORIES).map(([id,label])=>[id,t(label)])]],['sim-augment-tag',[['',t('All effect categories')],...AUGMENT_TAGS.map(tag=>[tag.id,augmentTagLabel(tag,getLanguage())])]]]){const select=$(id),value=select.value;select.replaceChildren(...options.map(([id,label])=>new Option(label,id)));select.value=value;}
}
function renderSimulatorPalette(){
 const equipment=simulatorUI.palette==='items',query=$('sim-query').value.trim().toLowerCase().split(/\s+/).filter(Boolean),fragment=document.createDocumentFragment();let count=0;
 $('sim-unit-cost').hidden=equipment;$('sim-unit-trait').hidden=equipment;$('sim-item-category').hidden=!equipment;for(const name of ['units','items'])$('sim-tab-'+name).setAttribute('aria-pressed',String(simulatorUI.palette===name));
 if(!equipment){
  const cost=Number($('sim-unit-cost').value),trait=$('sim-unit-trait').value;
  for(const unit of [...DATA.units].sort((a,b)=>a.cost-b.cost||a.name.localeCompare(b.name))){if(cost&&unit.cost!==cost||trait&&!unit.traits.includes(trait)||!query.every(word=>(unitSearchText(unit)+' '+traitSearchText(unit.traits)).toLowerCase().includes(word)))continue;count++;
   const card=el('button','sim-palette-card');card.type='button';card.dataset.unitId=unit.id;card.dataset.cost=String(unit.cost);card.style.setProperty('--sim-cost-color',simulatorCostColor(unit.cost));card.setAttribute('aria-label',t('Add {name} to board',{name:unitLabel(unit)}));card.append(portrait(unit));card.addEventListener('click',()=>simulatorApply({type:'add',unitId:unit.id,cell:simulatorUI.selected!==null&&!simulatorUI.value.board[simulatorUI.selected]?simulatorUI.selected:undefined}));simulatorDrag(card,{kind:'unit-palette',unitId:unit.id});fragment.append(card);
  }
 }else{
  const rows=filterEquipment(EQUIPMENT.items,{query:$('sim-query').value,category:$('sim-item-category').value},getLanguage()).filter(i=>SIMULATOR_RULES.equipmentIds.includes(i.id));
  for(const item of rows){count++;const card=el('button','sim-palette-card');card.type='button';card.dataset.itemId=item.id;card.setAttribute('aria-label',t('Equip {name}',{name:equipmentName(item,getLanguage())}));card.title=equipmentName(item,getLanguage())+'\n'+equipmentText(item,getLanguage());const art=el('span','sim-item-art');art.dataset.itemCategory=item.category;art.append(simulatorImage(item));appendArtifactBadge(art,item);card.append(art,el('span','',equipmentName(item,getLanguage())));card.addEventListener('click',()=>simulatorApply({type:'equip',cell:simulatorUI.selected,itemId:item.id}));simulatorDrag(card,{kind:'item-palette',itemId:item.id});fragment.append(card);}
 }
 $('sim-catalog').replaceChildren(fragment);$('sim-palette-count').textContent=t('{n} available',{n:count});$('sim-palette-empty').hidden=count>0;
}
function openSimulatorAugment(slot){simulatorUI.pickerSlot=slot;simulatorUI.pickerPage=0;$('sim-augment-query').value='';$('sim-augment-tag').value='';$('sim-augment-tier').value='';renderSimulatorPicker();$('sim-augment-dialog').showModal();$('sim-augment-query').focus();}
function renderSimulatorPicker(reset=false){
 if(reset)simulatorUI.pickerPage=0;const tag=$('sim-augment-tag').value,rows=filterAugments(AUGMENTS.augments,{query:$('sim-augment-query').value,tags:tag?[tag]:[],tier:$('sim-augment-tier').value},getLanguage()),pages=Math.max(1,Math.ceil(rows.length/simulatorUI.pickerPageSize));simulatorUI.pickerPage=Math.min(simulatorUI.pickerPage,pages-1);const fragment=document.createDocumentFragment();
 for(const a of rows.slice(simulatorUI.pickerPage*simulatorUI.pickerPageSize,(simulatorUI.pickerPage+1)*simulatorUI.pickerPageSize)){
  const button=el('button','sim-picker-choice');button.type='button';button.style.setProperty('--augment-color',augmentColors[a.tier]);button.disabled=simulatorUI.value.augments.some((id,index)=>index!==simulatorUI.pickerSlot&&id===a.id);button.setAttribute('aria-label',t('Select {name}',{name:augmentName(a,getLanguage())}));
  const header=el('div','augment-card-header'),title=el('div','augment-title');title.append(el('strong','',augmentName(a,getLanguage())),el('small','',t(a.tier)));header.append(augmentIcon(a),title);button.append(header,augmentEffectTags(a),el('p','',augmentDescription(a)));button.addEventListener('click',()=>{simulatorApply({type:'augment',slot:simulatorUI.pickerSlot,id:a.id});$('sim-augment-dialog').close();});fragment.append(button);
 }$('sim-augment-results').replaceChildren(fragment);$('sim-picker-empty').hidden=rows.length>0;$('sim-picker-count').textContent=t('{n} / {total} augments',{n:rows.length,total:AUGMENTS.augments.length});$('sim-picker-page').textContent=t('Page {page} / {total}',{page:simulatorUI.pickerPage+1,total:pages});$('sim-picker-prev').disabled=simulatorUI.pickerPage===0;$('sim-picker-next').disabled=simulatorUI.pickerPage>=pages-1;
}
function renderSimulator(){populateSimulatorFilters();renderSimulatorBoard();renderSimulatorAugments();renderSimulatorPalette();if($('sim-augment-dialog').open)renderSimulatorPicker();}
function bindSimulator(){
 try{const saved=localStorage.getItem('eightfold-simulator-v1');if(saved)simulatorUI.value=restoreSimulator(JSON.parse(saved),simulatorContext());}catch{}
 $('simulator-panel').addEventListener('click',event=>{if(performance.now()<(simulatorUI.suppressClickUntil||0)){event.preventDefault();event.stopImmediatePropagation();}},true);
 $('sim-clear').addEventListener('click',()=>simulatorApply({type:'clear'}));$('sim-undo').addEventListener('click',()=>{if(!simulatorUI.history.length)return;simulatorUI.value=simulatorUI.history.pop();simulatorUI.selected=null;simulatorSave();renderSimulatorBoard();renderSimulatorAugments();});
 $('sim-query').addEventListener('input',renderSimulatorPalette);for(const id of ['sim-unit-cost','sim-unit-trait','sim-item-category'])$(id).addEventListener('change',renderSimulatorPalette);
 for(const name of ['units','items'])$('sim-tab-'+name).addEventListener('click',()=>{simulatorUI.palette=name;$('sim-query').value='';renderSimulatorPalette();});
 $('sim-palette').addEventListener('dragover',event=>{if(simulatorCanDrop(event)){event.preventDefault();$('sim-palette').classList.add('drop-remove');}});$('sim-palette').addEventListener('dragleave',event=>{if(!$('sim-palette').contains(event.relatedTarget))$('sim-palette').classList.remove('drop-remove');});$('sim-palette').addEventListener('drop',simulatorDeleteDrop);
 $('sim-augment-query').addEventListener('input',()=>renderSimulatorPicker(true));for(const id of ['sim-augment-tag','sim-augment-tier'])$(id).addEventListener('change',()=>renderSimulatorPicker(true));for(const [id,delta]of [['sim-picker-prev',-1],['sim-picker-next',1]])$(id).addEventListener('click',()=>{simulatorUI.pickerPage+=delta;renderSimulatorPicker();$('sim-augment-query').scrollIntoView({block:'center'});});
 populateSimulatorFilters();
}
