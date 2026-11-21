const AUGMENTS=JSON.parse(document.getElementById('augment-data').textContent);
const augmentUI={page:0,pageSize:24,selected:null};
const augmentColors={Silver:'#b8c7db',Gold:'#e4c17f',Prismatic:'#c2a4ff'};
function augmentDescription(a){return augmentText(a,getLanguage()).replaceAll('[unavailable]',t('[unavailable]')).replaceAll('[current game value]',t('Current game value')).replaceAll('[source values differ]',t('Unconfirmed value'));}
function augmentIcon(a){
 const wrap=el('span','augment-icon'),fallback=el('span','augment-icon-fallback','✦');wrap.dataset.tier=a.tier;wrap.title=t(a.tier);wrap.append(fallback);
 if(a.image){const image=new Image();image.alt='';image.loading='lazy';image.src=a.image;image.addEventListener('load',()=>{fallback.hidden=true;});image.addEventListener('error',()=>image.remove());wrap.append(image);}return wrap;
}
function augmentTags(a){const tags=el('div','augment-tags');tags.append(el('span','augment-tier',t(a.tier)),el('span','augment-type',t(a.type==='trait'?'Trait augment':'General augment')));for(const round of a.rounds)tags.append(el('span','augment-round',round));if(!a.rounds.length)tags.append(el('span','augment-round',t('Stage not listed')));for(const trait of a.traits)tags.append(el('span','augment-trait',getLanguage()==='zh-Hant'?(trait.name_zh||traitLabel(trait.name)):trait.name));return tags;}
function augmentNotes(a){
 const notes=el('div','augment-notes');
 if(getLanguage()==='zh-Hant'&&(!a.name_zh||!a.description_zh))notes.append(el('small','',t('Untranslated fields use English.')));
 if(a.missing_values.length||a.missing_values_zh.length)notes.append(el('small','source-missing',t('Some values are missing from the source.')));
 if(a.conflicting_values.length)notes.append(el('small','source-missing',t('Source values conflict; unconfirmed numbers are left blank.')));
 return notes;
}
function renderAugments(reset=false){
 if(reset)augmentUI.page=0;
 const rows=filterAugments(AUGMENTS.augments,{query:$('augment-query').value,tier:$('augment-tier').value,round:$('augment-round').value,type:$('augment-type').value},getLanguage());
 const pages=Math.max(1,Math.ceil(rows.length/augmentUI.pageSize));augmentUI.page=Math.min(augmentUI.page,pages-1);
 const fragment=document.createDocumentFragment();
 for(const a of rows.slice(augmentUI.page*augmentUI.pageSize,(augmentUI.page+1)*augmentUI.pageSize)){
  const card=el('button','info-card augment-card');card.type='button';card.style.setProperty('--augment-color',augmentColors[a.tier]);card.style.setProperty('--rarity',augmentColors[a.tier]);card.setAttribute('aria-label',t('View {name} augment',{name:augmentName(a,getLanguage())}));card.setAttribute('aria-haspopup','dialog');
  const header=el('div','augment-card-header'),title=el('div','augment-title');title.append(el('strong','',augmentName(a,getLanguage())));if(getLanguage()==='zh-Hant'&&a.name_zh)title.append(el('small','',a.name));header.append(augmentIcon(a),title);card.append(header,augmentTags(a),el('p','augment-description',augmentDescription(a)),augmentNotes(a),el('span','info-card-more',t('View full augment details')));card.addEventListener('click',()=>showAugment(a.id));fragment.append(card);
 }
 $('augment-grid').replaceChildren(fragment);$('augment-total').textContent=String(AUGMENTS.augments.length);$('augment-count').textContent=t('{n} / {total} augments',{n:rows.length,total:AUGMENTS.augments.length});$('augment-empty').hidden=rows.length>0;
 $('augment-page').textContent=t('Page {page} / {total}',{page:augmentUI.page+1,total:pages});$('augment-prev').disabled=augmentUI.page===0;$('augment-next').disabled=augmentUI.page>=pages-1;
 $('augment-snapshot').textContent='PBE / '+AUGMENTS.patch+' · '+AUGMENTS.snapshot_date;
}
function showAugment(id){
 const a=AUGMENTS.augments.find(a=>a.id===id);if(!a)return;augmentUI.selected=id;
 const content=el('div','augment-detail-content');content.style.setProperty('--augment-color',augmentColors[a.tier]);const header=el('div','augment-card-header'),title=el('div','augment-title'),heading=el('h2','',augmentName(a,getLanguage()));heading.id='augment-title';title.append(heading);if(getLanguage()==='zh-Hant'&&a.name_zh)title.append(el('p','',a.name));header.append(augmentIcon(a),title);content.append(header,augmentTags(a),el('p','augment-full-description',augmentDescription(a)),augmentNotes(a));
 const source=el('p','field-hint');source.append(document.createTextNode(t('Augment source:')+' '));const link=el('a','','MetaTFT · PBE / '+AUGMENTS.patch);link.href=AUGMENTS.source;link.target='_blank';link.rel='noopener noreferrer';source.append(link,document.createTextNode(' · '+AUGMENTS.snapshot_date));content.append(source);
 $('augment-detail').replaceChildren(content);if(!$('augment-dialog').open)$('augment-dialog').showModal();
}
function bindAugments(){
 $('augment-query').addEventListener('input',()=>renderAugments(true));for(const id of ['augment-tier','augment-round','augment-type'])$(id).addEventListener('change',()=>renderAugments(true));
 $('augment-reset').addEventListener('click',()=>{for(const id of ['augment-query','augment-tier','augment-round','augment-type'])$(id).value='';renderAugments(true);});
 for(const [id,delta]of [['augment-prev',-1],['augment-next',1]])$(id).addEventListener('click',()=>{augmentUI.page=Math.max(0,augmentUI.page+delta);renderAugments();$('augment-query').scrollIntoView({block:'center'});});
}
