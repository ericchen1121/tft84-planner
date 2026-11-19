function populateRequiredTraits(){
 const select=$('required-trait'),saved=select.value,level=$('required-level').value;select.replaceChildren();
 for(const trait of [...DATA.traits].sort((a,b)=>traitLabel(a.name).localeCompare(traitLabel(b.name),getLanguage())))select.append(new Option(traitLabel(trait.name),trait.name));
 if([...select.options].some(o=>o.value===saved))select.value=saved;
 populateRequiredLevels(level);
}
function populateRequiredLevels(saved=''){
 const trait=DATA.traits.find(t=>t.name===$('required-trait').value),select=$('required-level');select.replaceChildren();
 for(const level of [...(trait?.breakpoints||[])].sort((a,b)=>a-b))select.append(new Option(String(level),String(level)));
 if([...select.options].some(o=>o.value===saved))select.value=saved;
}
function renderRequirements(){
 const list=$('required-list');list.replaceChildren();
 for(const [name,n]of Object.entries(state.required)){
  const row=el('div','required-row');row.append(el('span','',traitLabel(name)),el('strong','',state.requiredMode==='exact_tier'?t('tier {n}',{n}):'≥ '+n));
  const remove=el('button','text-button','×');remove.type='button';remove.setAttribute('aria-label',t('Remove required {trait}',{trait:traitLabel(name)}));remove.addEventListener('click',()=>{delete state.required[name];renderRequirements();markDirty();});row.append(remove);list.append(row);
 }
}
function requiredSummary(c){return Object.entries(c.required_traits||{}).map(([name,n])=>traitLabel(name)+' '+(c.required_trait_mode==='exact_tier'?t('tier {n}',{n}):'≥ '+n)).join(' · ');}
function bindRequirements(){
 $('required-trait').addEventListener('change',()=>populateRequiredLevels());
 $('required-mode').addEventListener('change',()=>{state.requiredMode=$('required-mode').value;renderRequirements();markDirty();});
 $('add-required').addEventListener('click',()=>{
  const name=$('required-trait').value,n=Number($('required-level').value);if(!name||!n)return;
  state.required[name]=n;renderRequirements();markDirty();
 });
}
