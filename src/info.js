// Display-only metadata. Unit IDs, trait keys and solver input remain canonical.
function unitLabel(u){return getLanguage()==='zh-Hant'?(INFO.units[u.id]?.name_zh||u.name):u.name;}
function unitSearchText(u){return u.name+' '+(INFO.units[u.id]?.name_zh||'');}
function abilityLabel(u){const a=INFO.units[u.id];return getLanguage()==='zh-Hant'?(a?.ability_zh||a?.ability||''):a?.ability||'';}
function abilitySummary(u){const a=INFO.units[u.id];return a?.full_description||(getLanguage()==='zh-Hant'?(a?.description_zh||a?.description||''):a?.description||'');}
function hasInfoUnlock(u){const a=INFO.units[u.id];return Array.isArray(a?.full_unlock)?a.full_unlock.length>0:u.unlock;}
function infoUnlockLines(u){const a=INFO.units[u.id];if(!hasInfoUnlock(u))return [];if(getLanguage()==='zh-Hant'&&a.unlock_zh)return [a.unlock_zh];return a.full_unlock||[a.unlock||t('Unlock required')];}
function infoPortrait(u,options){const p=portrait(u,options);p.title=unitLabel(u)+' · '+u.cost+'g · '+t('Range {range}',{range:u.range});return p;}
function numericDescription(u,cls){
 const paragraph=el('p',cls),text=abilitySummary(u).replaceAll('[unavailable]',t('[unavailable]')).replaceAll('?',t('[unavailable]'));
 for(const part of text.split(/(\d+(?:\.\d+)?%?(?:\/\d+(?:\.\d+)?%?)+)/g)){if(/^\d+(?:\.\d+)?%?\//.test(part))paragraph.append(el('span','skill-value',part));else paragraph.append(document.createTextNode(part));}
 return paragraph;
}
function infoUnlockBlock(u){
 const block=el('div','info-unlock-block');block.append(el('strong','',t(hasInfoUnlock(u)?'Unlock condition':'No unlock required')));
 if(hasInfoUnlock(u)){const list=el('ul');for(const line of infoUnlockLines(u))list.append(el('li','',line));block.append(list);}return block;
}
function recommendedEquipment(u){
 const box=el('div','recommended-equipment'),heading=el('div','equipment-heading');heading.append(el('strong','',t('Recommended items')),el('small','','PBE / 19.1'));box.append(heading);
 const row=el('div','equipment-slots');row.setAttribute('aria-label',t('Five reserved recommended item slots'));
 const recommended=INFO.units[u.id]?.recommended_items||[];
 for(let slot=0;slot<5;slot++){
  const item=ITEMS.items.find(item=>item.id===recommended[slot]),circle=el('span','equipment-slot'+(item?'':' empty'));circle.dataset.slot=String(slot+1);
  if(item){const label=getLanguage()==='zh-Hant'?(item.name_zh||item.name):item.name;circle.title=label;const img=new Image();img.src=item.image;img.alt=label;img.loading='lazy';img.addEventListener('error',()=>{img.remove();circle.classList.add('empty');circle.textContent='◇';});circle.append(img);}else{circle.textContent='◇';circle.title=t('Recommendation slot {n} · Not set',{n:slot+1});}
  row.append(circle);
 }
 box.append(row);if(!recommended.length)box.append(el('small','equipment-pending',t('Reserved · Recommendations not set')));return box;
}
function roleLabel(u){const role=u.role.replace('DA_Role_','').replace('_Manaless','');const labels={MagicTank:['Magic tank','魔法坦克'],AttackTank:['Attack tank','物理坦克'],MagicCaster:['Magic caster','魔法法師'],AttackCaster:['Attack caster','物理法師'],MagicFighter:['Magic fighter','魔法鬥士'],AttackFighter:['Attack fighter','物理鬥士'],MagicAssassin:['Magic assassin','魔法刺客'],AttackAssassin:['Attack assassin','物理刺客'],AttackMarksman:['Attack marksman','物理射手'],MagicMarksman:['Magic marksman','魔法射手'],AttackSpecialist_Ammo:['Attack specialist','物理專家'],MagicSpecialist:['Magic specialist','魔法專家']};return labels[role]?.[getLanguage()==='zh-Hant'?1:0]||role.replace(/_/g,' ');}
function infoUnits(){
 const words=$('info-query').value.trim().toLowerCase().split(/\s+/).filter(Boolean),cost=Number($('info-cost').value),trait=$('info-trait').value,unlock=$('info-unlock').value;
 return DATA.units.filter(u=>{
  if(cost&&u.cost!==cost||trait&&!u.traits.includes(trait)||unlock==='locked'&&!hasInfoUnlock(u)||unlock==='open'&&hasInfoUnlock(u))return false;
  const a=INFO.units[u.id],haystack=[unitSearchText(u),traitSearchText(u.traits),a?.ability,a?.ability_zh,roleLabel(u)].join(' ').toLowerCase();
  return words.every(word=>haystack.includes(word));
 }).sort((a,b)=>b.cost-a.cost||a.name.localeCompare(b.name));
}
function populateInfoTraits(){
 const select=$('info-trait'),value=select.value;select.replaceChildren(new Option(t('All traits'),''));
 for(const trait of [...DATA.traits].sort((a,b)=>traitLabel(a.name).localeCompare(traitLabel(b.name),getLanguage())))select.append(new Option(traitLabel(trait.name),trait.name));
 if([...select.options].some(o=>o.value===value))select.value=value;
}
function infoTraits(u){const row=el('div','info-traits');for(const name of u.traits){const chip=el('span','trait-chip');const url=ART.traits[name]?.url;if(url){const img=new Image();img.alt='';img.loading='lazy';img.src=url;img.addEventListener('error',()=>img.remove());chip.append(img);}chip.append(document.createTextNode(traitLabel(name)));row.append(chip);}return row;}
function renderInfo(){
 const units=infoUnits(),fragment=document.createDocumentFragment();
 for(const u of units){
  const card=el('button','info-card');card.type='button';card.style.setProperty('--rarity',rarity[u.cost]||rarity[1]);card.setAttribute('aria-label',t('View {name} details',{name:unitLabel(u)}));
  const top=el('div','info-card-top');top.append(infoPortrait(u,{name:false}));const title=el('div','info-card-title');title.append(el('strong','',unitLabel(u)),el('small','',roleLabel(u)));top.append(title,el('span','info-cost',u.cost+'g'));card.append(top,infoTraits(u));
  const a=INFO.units[u.id],metadata=el('div','info-meta');metadata.append(el('span','',t('Range {range}',{range:u.range})),el('span','',t('Mana')+' '+(a.full_mana||a.mana||'—')));card.append(metadata);
  const ability=el('div','info-ability');ability.append(el('strong','',abilityLabel(u)),el('small','star-scaling',t('Values: 1★ / 2★ / 3★')),numericDescription(u,''));if(a.source_missing_values)ability.append(el('small','source-missing',t('Some values depend on the board or are missing from the source.')));
  card.append(ability,infoUnlockBlock(u),recommendedEquipment(u),el('span','info-card-more',t('View details →')));card.addEventListener('click',()=>showInfo(u.id));fragment.append(card);
 }
 $('info-grid').replaceChildren(fragment);$('info-count').textContent=t('{n} / {total} champions',{n:units.length,total:DATA.units.length});$('info-empty').hidden=units.length>0;
}
function showInfo(id){
 const u=DATA.units.find(u=>u.id===id);if(!u)return;state.infoUnit=id;const a=INFO.units[id],content=el('div');
 const header=el('div','info-detail-header');header.append(infoPortrait(u,{name:false,lazy:false}));const title=el('div');title.append(el('span','eyebrow',t('CHAMPION INFO')));const name=el('h2','',unitLabel(u));name.id='info-title';title.append(name,el('p','',roleLabel(u)));header.append(title);content.append(header,infoTraits(u));
 const stats=el('div','info-detail-stats');for(const [label,value]of [['Cost',u.cost+'g'],['Attack range',u.range],['Mana',a.full_mana||a.mana||'—']]){const item=el('div');item.append(el('small','',t(label)),el('strong','',value));stats.append(item);}content.append(stats);
 content.append(el('h3','',abilityLabel(u)),el('small','star-scaling',t('Values: 1★ / 2★ / 3★')),numericDescription(u,'info-description'));
 if(a.source_missing_values)content.append(el('p','source-missing',t('Some values depend on the board or are missing from the source.')));
 content.append(infoUnlockBlock(u),recommendedEquipment(u));
 content.append(el('p','field-hint',t('PBE source values; damage and healing scale with stats. Skills follow the source language.')));
 const source=el('p','field-hint',t('References:')+' ');for(const [label,url]of [['MetaTFT','https://www.metatft.com/new-set'],['tactics.tools','https://tactics.tools/info/set-update']]){const link=el('a','',label+' ↗');link.href=url;link.target='_blank';link.rel='noopener noreferrer';source.append(link,document.createTextNode(' '));}content.append(source);
 $('info-detail').replaceChildren(content);if(!$('info-dialog').open)$('info-dialog').showModal();
}
function switchView(view,focus=false){
 const info=view==='info';state.view=info?'info':'solver';$('info-panel').hidden=!info;$('solver-panel').hidden=info;
 for(const name of ['solver','info']){const tab=$('tab-'+name),active=name===state.view;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
 if(info)renderInfo();if(focus)$('tab-'+state.view).focus();
 const hash=info?'#info':'#solver';if(location.hash!==hash)history.replaceState(null,'',hash);
}
function bindInfo(){
 for(const name of ['solver','info']){const tab=$('tab-'+name);tab.addEventListener('click',()=>switchView(name));tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();switchView(e.key==='Home'?'solver':e.key==='End'?'info':state.view==='info'?'solver':'info',true);}});}
 $('info-query').addEventListener('input',renderInfo);for(const id of ['info-cost','info-trait','info-unlock'])$(id).addEventListener('change',renderInfo);
 $('info-reset').addEventListener('click',()=>{for(const id of ['info-query','info-cost','info-trait','info-unlock'])$(id).value='';renderInfo();});
 window.addEventListener('hashchange',()=>switchView(location.hash==='#info'?'info':'solver'));populateInfoTraits();switchView(location.hash==='#info'?'info':'solver');
}
