function populateRequiredTraits(){
 const words=$('required-query').value.trim().toLowerCase().split(/\s+/).filter(Boolean),grid=$('required-options');grid.replaceChildren();
 for(const trait of [...DATA.traits].sort((a,b)=>traitLabel(a.name).localeCompare(traitLabel(b.name),getLanguage()))){
  if(!words.every(word=>traitSearchText([trait.name]).toLowerCase().includes(word)))continue;
  const row=el('div','required-choice'),label=el('label'),check=el('input'),level=el('select');
  check.type='checkbox';check.checked=Object.hasOwn(state.required,trait.name);check.dataset.requiredTrait=trait.name;check.setAttribute('aria-label',t('Require {trait}',{trait:traitLabel(trait.name)}));
  label.append(check,el('span','',traitLabel(trait.name)));row.classList.toggle('selected',check.checked);
  for(const n of [...trait.breakpoints].sort((a,b)=>a-b))level.append(new Option(String(n),String(n)));
  level.value=String(state.required[trait.name]||Math.min(...trait.breakpoints));level.disabled=!check.checked;level.setAttribute('aria-label',t('Required tier for {trait}',{trait:traitLabel(trait.name)}));
  check.addEventListener('change',()=>{if(check.checked)state.required[trait.name]=Number(level.value);else delete state.required[trait.name];row.classList.toggle('selected',check.checked);level.disabled=!check.checked;renderRequirements();markDirty();});
  level.addEventListener('change',()=>{if(check.checked){state.required[trait.name]=Number(level.value);renderRequirements();markDirty();}});
  row.append(label,level);grid.append(row);
 }
 $('required-options-empty').hidden=grid.children.length>0;
}
function renderRequirements(){
 const list=$('required-list');list.replaceChildren();
 for(const [name,n]of Object.entries(state.required)){
  const row=el('div','required-row');row.append(el('span','',traitLabel(name)),el('strong','',state.requiredMode==='exact_tier'?t('tier {n}',{n}):'≥ '+n));
  const remove=el('button','text-button','×');remove.type='button';remove.setAttribute('aria-label',t('Remove required {trait}',{trait:traitLabel(name)}));remove.addEventListener('click',()=>{delete state.required[name];populateRequiredTraits();renderRequirements();markDirty();});row.append(remove);list.append(row);
 }
 const n=Object.keys(state.required).length;$('required-selected').textContent=t('{n} selected',{n});$('clear-required').disabled=n===0;
}
function requiredSummary(c){return Object.entries(c.required_traits||{}).map(([name,n])=>traitLabel(name)+' '+(c.required_trait_mode==='exact_tier'?t('tier {n}',{n}):'≥ '+n)).join(' · ');}
function bindRequirements(){
 $('required-query').addEventListener('input',populateRequiredTraits);
 $('required-mode').addEventListener('change',()=>{state.requiredMode=$('required-mode').value;renderRequirements();markDirty();});
 $('clear-required').addEventListener('click',()=>{state.required={};populateRequiredTraits();renderRequirements();markDirty();});
 renderRequirements();
}
