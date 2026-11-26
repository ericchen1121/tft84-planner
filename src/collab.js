// Group numbers follow the attached Little Buddy Bot table.
const collabUnit=id=>DATA.units.find(unit=>unit.id===id);

function collabLabel(index){
 return t('Collab group {n}',{n:index+1});
}
function collabNames(group){
 return group.map(id=>unitLabel(collabUnit(id))).join(' · ');
}
function renderCollab(){
 const tokens=$('collab-query').value.toLowerCase().split(/[\s,，、]+/).filter(Boolean);
 const selected=appUI.collabGroup;
 $('clear-collab').hidden=selected===null;
 $('collab-selected').textContent=selected===null?t('No Collab group selected.'):collabLabel(selected)+' · '+collabNames(COLLAB_GROUPS[selected]);
 const list=$('collab-options');
 list.replaceChildren();
 if(!tokens.length)return;
 COLLAB_GROUPS.forEach((group,index)=>{
  const names=group.map(id=>unitSearchText(collabUnit(id)).toLowerCase());
  if(!tokens.every(token=>names.some(name=>name.includes(token))))return;
  const button=el('button','outline-button',collabLabel(index)+' · '+collabNames(group));
  button.type='button';
  button.setAttribute('aria-pressed',String(selected===index));
  button.addEventListener('click',()=>{selectCollab(index);$('collab-query').focus();});
  list.append(button);
 });
 if(!list.childElementCount)list.append(el('p','field-hint',t('No Collab groups match.')));
}
function selectCollab(index){
 if(index!==appUI.collabGroup){
  appUI.collabGroup=index;
  for(const solver of Object.values(solverStates))solver.dirty=true;
  markDirty();
 }
 $('collab-query').value='';
 renderCollab();
}
