const collabUnit=id=>DATA.units.find(unit=>unit.id===id);

function renderCollabPortraits(group){
 return group.map(id=>portrait(collabUnit(id),{name:false,imageUrl:COLLAB_PORTRAITS[id]}));
}

function renderCollab(){
 const [first,second]=appUI.collabFilters;
 const groupsByFirst=COLLAB_GROUPS.filter(group=>!first||group.includes(first));
 const firstOptions=new Set(COLLAB_GROUPS.flat());
 const secondOptions=new Set(groupsByFirst.flat());
 for(const [index,id,options] of [[0,'collab-first',firstOptions],[1,'collab-second',secondOptions]]){
  const select=$(id),other=appUI.collabFilters[1-index];
  const units=[...options].filter(unitId=>unitId!==other).map(collabUnit)
   .sort((a,b)=>unitLabel(a).localeCompare(unitLabel(b),getLanguage()));
  const placeholder=t(index===0?'First Collab champion':'Second Collab champion');
  select.replaceChildren(new Option(placeholder,''),...units.map(unit=>new Option(unitLabel(unit),unit.id)));
  select.value=appUI.collabFilters[index];
 }
 const selected=appUI.collabGroup;
 $('clear-collab').hidden=selected===null;
 $('collab-status').textContent=t(selected===null?'Choose one or two champions, then select a group.':'Selected Collab group');
 $('collab-selected').replaceChildren(...(selected===null?[]:renderCollabPortraits(COLLAB_GROUPS[selected])));
 const list=$('collab-options');
 list.replaceChildren();
 if(!first&&!second)return;
 COLLAB_GROUPS.forEach((group,index)=>{
  if(first&&!group.includes(first)||second&&!group.includes(second))return;
  const names=group.map(id=>unitLabel(collabUnit(id))).join(' · ');
  const button=el('button','outline-button');
  button.type='button';
  button.title=names;
  button.setAttribute('aria-label',names);
  button.setAttribute('aria-pressed',String(selected===index));
  button.append(...renderCollabPortraits(group));
  button.addEventListener('click',()=>{selectCollab(index);$('clear-collab').focus();});
  list.append(button);
 });
}

function bindCollabFilters(){
 for(const [index,id] of ['collab-first','collab-second'].entries()){
  $(id).addEventListener('change',()=>{
   appUI.collabFilters[index]=$(id).value;
   const [first,second]=appUI.collabFilters;
   if(first&&second&&!COLLAB_GROUPS.some(group=>group.includes(first)&&group.includes(second)))appUI.collabFilters[1-index]='';
   renderCollab();
  });
 }
}

function selectCollab(index){
 if(index!==appUI.collabGroup){
  appUI.collabGroup=index;
  for(const solver of Object.values(solverStates))solver.dirty=true;
  markDirty();
 }
 appUI.collabFilters=['',''];
 renderCollab();
}
