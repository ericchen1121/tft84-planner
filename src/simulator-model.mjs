export const SIMULATOR_CELLS=28;
export function emptySimulator(){return {version:1,board:Array(SIMULATOR_CELLS).fill(null),augments:[null,null,null],nextId:1};}
export function simulatorItemSlots(ids,context){return ids.reduce((n,id)=>n+(context.rules.threeSlotItems.includes(id)?3:1),0);}
function simulatorEquipped(items,id,unit,context){
 const item=context.items.find(i=>i.id===id);
 if(!item||!context.rules.equipmentIds.includes(id))throw Error('This item cannot be equipped.');
 const existing=items.map(id=>context.items.find(i=>i.id===id));
 if(item.unique&&items.includes(id))throw Error('This unique item is already equipped.');
 const native=new Set(unit.traits);
 if(item.category==='emblem'&&(item.traits||[]).some(t=>native.has(t.name)||(existing.some(e=>e?.traits?.some(x=>x.name===t.name)))))throw Error('This champion already has that trait.');
 if(item.category==='component'){
  for(let index=0;index<items.length;index++){
   if(existing[index]?.category!=='component')continue;
   const recipe=context.items.find(e=>context.rules.equipmentIds.includes(e.id)&&e.recipe.length===2&&[...e.recipe].sort().join('|')===[items[index],id].sort().join('|'));
   if(recipe){const result=[...items];result.splice(index,1);return simulatorEquipped(result,recipe.id,unit,context);}
  }
 }
 if(simulatorItemSlots(items,context)+(context.rules.threeSlotItems.includes(id)?3:1)>3)throw Error('This champion has no free item slots.');
 return [...items,id];
}
export function simulatorTransition(current,action,context){
 const state={...current,board:current.board.map(u=>u?{...u,items:[...u.items]}:null),augments:[...current.augments]};
 const cell=action.cell;
 const validCell=n=>Number.isInteger(n)&&n>=0&&n<SIMULATOR_CELLS;
 const requireCell=n=>{if(!validCell(n))throw Error('Choose a valid board hex.');};
 const requireUnit=n=>{if(!validCell(n)||!state.board[n])throw Error('Select a champion on the board first.');return state.board[n];};
 switch(action.type){
  case 'add':{
   const unit=context.units.find(u=>u.id===action.unitId);if(!unit)throw Error('Unknown champion.');
   if(cell!==undefined){requireCell(cell);if(state.board[cell])throw Error('This hex is occupied.');}
   const target=validCell(cell)&&!state.board[cell]?cell:state.board.findIndex(u=>!u);if(target<0)throw Error('The board is full.');
   state.board[target]={uid:state.nextId++,unitId:unit.id,stars:1,items:[],collab:false,sonaBand:''};break;
  }
  case 'move':{requireCell(cell);requireUnit(action.from);if(cell===action.from)return current;[state.board[cell],state.board[action.from]]=[state.board[action.from],state.board[cell]];break;}
  case 'remove':requireCell(cell);state.board[cell]=null;break;
  case 'stars':{const unit=requireUnit(cell);if(!Number.isInteger(action.stars)||action.stars<1||action.stars>4)throw Error('Choose a star level from 1 to 4.');unit.stars=action.stars;break;}
  case 'equip':{const placed=requireUnit(cell),unit=context.units.find(u=>u.id===placed.unitId);placed.items=simulatorEquipped(placed.items,action.itemId,unit,context);break;}
  case 'remove-item':{const placed=requireUnit(cell);if(!Number.isInteger(action.index)||action.index<0||action.index>=placed.items.length)throw Error('Unknown item slot.');placed.items.splice(action.index,1);break;}
  case 'move-item':{
   const from=requireUnit(action.from),to=requireUnit(cell);if(action.from===cell)return current;
   if(!Number.isInteger(action.index)||!from.items[action.index])throw Error('Unknown item slot.');
   to.items=simulatorEquipped(to.items,from.items[action.index],context.units.find(u=>u.id===to.unitId),context);from.items.splice(action.index,1);break;
  }
  case 'collab':requireUnit(cell).collab=Boolean(action.enabled);break;
  case 'sona':{const placed=requireUnit(cell);if(context.units.find(u=>u.id===placed.unitId)?.name!=='Sona'||action.trait&&!context.rules.sonaBands.includes(action.trait))throw Error('Choose a valid Sona band.');placed.sonaBand=action.trait;break;}
  case 'augment':{
   if(!Number.isInteger(action.slot)||action.slot<0||action.slot>2)throw Error('Choose one of the three augment slots.');
   if(action.id!==null&&!context.augments.some(a=>a.id===action.id))throw Error('Unknown augment.');
   if(action.id!==null&&state.augments.some((id,index)=>index!==action.slot&&id===action.id))throw Error('This augment is already selected.');state.augments[action.slot]=action.id;break;
  }
  case 'clear':return emptySimulator();
  default:throw Error('Unknown simulator action.');
 }
 return state;
}
export function restoreSimulator(value,context){
 if(!value||value.version!==1||!Array.isArray(value.board)||value.board.length!==SIMULATOR_CELLS||!Array.isArray(value.augments)||value.augments.length!==3)throw Error('Invalid saved simulator.');
 const fresh=emptySimulator(),uids=new Set();let maxId=0;
 for(let cell=0;cell<SIMULATOR_CELLS;cell++){
  const placed=value.board[cell];if(placed===null)continue;
  if(!placed||!Number.isSafeInteger(placed.uid)||placed.uid<1||uids.has(placed.uid)||!Array.isArray(placed.items)||placed.items.length>3)throw Error('Invalid saved simulator.');
  uids.add(placed.uid);maxId=Math.max(maxId,placed.uid);
  const unit=context.units.find(u=>u.id===placed.unitId);if(!unit||!Number.isInteger(placed.stars)||placed.stars<1||placed.stars>4)throw Error('Invalid saved simulator.');
  if(typeof placed.collab!=='boolean'||typeof placed.sonaBand!=='string'||placed.sonaBand&&(unit.name!=='Sona'||!context.rules.sonaBands.includes(placed.sonaBand)))throw Error('Invalid saved simulator.');
  let items=[];for(const id of placed.items)items=simulatorEquipped(items,id,unit,context);
  // Saved components must retain their exact identities, without an implicit recipe rewrite.
  if(JSON.stringify(items)!==JSON.stringify(placed.items))throw Error('Invalid saved simulator.');
  fresh.board[cell]={uid:placed.uid,unitId:unit.id,stars:placed.stars,items,collab:placed.collab,sonaBand:placed.sonaBand};
 }
 for(let slot=0;slot<3;slot++)fresh.augments=simulatorTransition(fresh,{type:'augment',slot,id:value.augments[slot]},context).augments;
 if(maxId>=Number.MAX_SAFE_INTEGER-1)throw Error('Invalid saved simulator.');fresh.nextId=maxId+1;return fresh;
}
export function simulatorTraits(state,context){
 const groups=new Map();let population=0;
 for(const placed of state.board){
  if(!placed)continue;const unit=context.units.find(u=>u.id===placed.unitId);population+=unit.slots;
  const key=unit.exclusive_group||unit.id,traits=new Set(unit.traits);
  if(placed.collab)traits.add('Collab');if(placed.sonaBand)traits.add(placed.sonaBand);
  for(const id of placed.items)for(const trait of context.items.find(i=>i.id===id)?.traits||[])traits.add(trait.name);
  if(!groups.has(key))groups.set(key,new Map());const contributions=groups.get(key);
  for(const name of traits)contributions.set(name,Math.max(contributions.get(name)||0,name==='K|DA'?placed.stars:1));
 }
 const rows=context.traits.map(trait=>{
  const count=[...groups.values()].reduce((n,m)=>n+(m.get(trait.name)||0),0),tier=Math.max(0,...trait.breakpoints.filter(n=>n<=count));
  return {...trait,count,tier,next:trait.breakpoints.find(n=>n>count)||null};
 }).filter(t=>t.count>0).sort((a,b)=>Number(b.tier>0)-Number(a.tier>0)||b.tier-a.tier||b.count-a.count||a.name.localeCompare(b.name));
 return {rows,population,champions:state.board.filter(Boolean).length};
}
