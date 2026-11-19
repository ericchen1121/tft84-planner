'use strict';
const DATA=JSON.parse(document.getElementById('app-data').textContent);
const ART=JSON.parse(document.getElementById('art-data').textContent);
const INFO=JSON.parse(document.getElementById('info-data').textContent);
const ITEMS=JSON.parse(document.getElementById('item-data').textContent);
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat(getLanguage()==='zh-Hant'?'zh-TW':'en-US').format(n);
const rarity={1:'#8594aa',2:'#6fd6a6',3:'#78a7ff',4:'#b49aff',5:'#e4c17f',7:'#ef92a2'};
const state={chunks:[],records:[],filtered:[],page:0,pageSize:12,config:{...DEFAULTS},excluded:new Set(),extras:{},bonuses:{},workers:[],running:false,status:'LOADING',started:0,progress:[],searchId:0,preset:null,dirty:false,filterTimer:null};
const baseMembership=DATA.traits.map(t=>DATA.units.filter(u=>u.traits.includes(t.name)).length);
const traitByName=new Map(DATA.traits.map((t,i)=>[t.name,{...t,index:i,unique:baseMembership[i]===1}]));
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,4000);}
function setStatus(text,kind=''){state.statusBuilder=typeof text==='function'?text:()=>text;$('status-text').textContent=state.statusBuilder();$('status-strip').className='status-strip '+kind;}
function markDirty(){state.dirty=true;$('settings-changed').hidden=false;syncLabels();}
function syncLabels(){$('score-output').value=$('min_trait_score').value;$('range-label').textContent=$('frontline_max_range').value;}
function readConfig(){
 const form=$('criteria-form'),c={...DEFAULTS};
 for(const k of ['population','min_four_cost','max_five_cost','min_trait_score','min_frontline','frontline_max_range','min_backline_four_cost','max_seconds'])c[k]=Number(form.elements.namedItem(k).value);
 c.include_unique_traits=form.elements.namedItem('include_unique_traits').checked;
 c.include_seven_cost=form.elements.namedItem('include_seven_cost').checked;
 c.score_mode=$('score_mode').value;c.sona_feature_trait=$('sona_feature_trait').value||null;
 c.exclude_unit_ids=[...state.excluded];c.extra_traits=JSON.parse(JSON.stringify(state.extras));c.trait_bonuses={...state.bonuses};
 c.threads=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||4)-1));
 prepare(DATA,c);return c;
}
function isPreset(c){
 return ['population','min_four_cost','max_five_cost','min_trait_score','min_frontline','frontline_max_range','min_backline_four_cost','include_unique_traits','include_seven_cost','score_mode'].every(k=>c[k]===DEFAULTS[k])&&!c.sona_feature_trait&&!c.exclude_unit_ids.length&&!Object.keys(c.extra_traits).length&&!Object.values(c.trait_bonuses||{}).some(n=>n>0);
}
function populateSelects(){
 const saved=Object.fromEntries(['champion-filter','extra-unit','sona_feature_trait','extra-trait','emblem-trait','score-filter'].map(id=>[id,$(id).value]));
 for(const id of ['champion-filter','extra-unit','sona_feature_trait','extra-trait','emblem-trait','score-filter'])$(id).replaceChildren();
 $('champion-filter').append(new Option(t('Any champion'),''));$('sona_feature_trait').append(new Option(t('None specified'),''));$('score-filter').append(new Option(t('Any score'),'0'));
 const sorted=[...DATA.units].sort((a,b)=>a.name.localeCompare(b.name));
 for(const id of ['champion-filter','extra-unit'])for(const u of sorted)$(id).append(new Option(t('{name} · {cost}g',{name:unitLabel(u),cost:u.cost}),u.id));
 const traits=[...DATA.traits].sort((a,b)=>traitLabel(a.name).localeCompare(traitLabel(b.name),getLanguage()));
 for(const id of ['sona_feature_trait','extra-trait','emblem-trait'])for(const trait of traits){
  if(id==='emblem-trait'&&!EMBLEM_TRAITS.includes(trait.name))continue;
  $(id).append(new Option(traitLabel(trait.name),trait.name));
 }
 const maxScore=state.records.reduce((max,r)=>Math.max(max,r.score),40);
 for(let n=1;n<=maxScore;n++)$('score-filter').append(new Option(t('{n}+ synergy',{n}),String(n)));
 for(const [id,value]of Object.entries(saved))if([...$(id).options].some(option=>option.value===value))$(id).value=value;
 for(const img of document.querySelectorAll('[data-hero]')){const a=ART.units[img.dataset.hero];if(a?.url)img.src=a.url;img.addEventListener('error',()=>img.hidden=true);}
}
function portrait(u,{name=true,lazy=true}={}){
 const wrap=el('div',name?'champion':'');wrap.title=t('{name} · {cost}-cost · Range {range}{slots}\n{traits}{unlock}',{name:unitLabel(u),cost:u.cost,range:u.range,slots:u.slots>1?t(' · {n} slots',{n:u.slots}):'',traits:u.traits.map(name=>traitLabel(name)).join(' / '),unlock:u.unlock?t('\nUnlock required'):''});
 const p=el('div','portrait');p.style.setProperty('--rarity',rarity[u.cost]||rarity[1]);
 const fallback=el('span','fallback',u.name.replace(/\(.*\)/,'').trim().split(/\s+/).map(s=>s[0]).slice(0,2).join(''));
 p.append(fallback);
 const url=ART.units[u.id]?.url||INFO.units[u.id]?.image;
 if(url){const img=new Image();img.alt=unitLabel(u);img.loading=lazy?'lazy':'eager';img.referrerPolicy='no-referrer';img.src=url;img.addEventListener('load',()=>{fallback.hidden=true;});img.addEventListener('error',()=>{img.remove();fallback.hidden=false;});p.append(img);}
 p.append(el('span','cost-label',u.cost));wrap.append(p);if(name)wrap.append(el('div','champion-name',unitLabel(u).replace(/ \(.*\)/,'')));return wrap;
}
function analyze(ids,c=state.config){
 const team=ids.map(i=>DATA.units[i]),counts=new Map(Object.entries(c.trait_bonuses||{}));
 for(const u of team)for(const t of effectiveTraits(u,c))counts.set(t,(counts.get(t)||0)+1);
 const members=DATA.traits.map(t=>DATA.units.filter(u=>effectiveTraits(u,c).includes(t.name)).length);
 const traits=[];let score=0;
 for(const t of DATA.traits){const n=counts.get(t.name)||0,m=members[traitByName.get(t.name).index];if(!c.include_unique_traits&&m<=1)continue;
  const active=n>=Math.min(...t.breakpoints);
  const contribution=c.score_mode==='all_members'?n:!active?0:c.score_mode==='active_members'?n:Math.max(0,...t.breakpoints.filter(x=>x<=n));
  score+=contribution;if(active)traits.push({...t,count:n,bonus:c.trait_bonuses?.[t.name]||0,unique:m===1,contribution});
 }
 traits.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 return {team,traits,score,front:team.filter(u=>u.range<=c.frontline_max_range).length,back:team.filter(u=>u.cost===4&&u.range>c.frontline_max_range&&c.backline_role_keywords.some(k=>u.role.includes(k))).length,four:team.filter(u=>u.cost===4).length,five:team.filter(u=>u.cost===5).length,slots:team.reduce((s,u)=>s+u.slots,0),unlocks:team.filter(u=>u.unlock).length};
}
function traitChip(trait){
 const chip=el('span','trait-chip'+(trait.unique?' unique':'')+(trait.bonus?' boosted':''));chip.title=t('{name}: {base} champion counts{bonus} · Breakpoints {points} · Score +{score}',{name:traitLabel(trait.name),base:trait.count-(trait.bonus||0),bonus:trait.bonus?t(' + {bonus} bonus = {total} total',{bonus:trait.bonus,total:trait.count}):'',points:trait.breakpoints.join('/'),score:trait.contribution});
 const url=ART.traits[trait.name]?.url;if(url){const img=new Image();img.alt='';img.src=url;img.loading='lazy';img.addEventListener('error',()=>img.remove());chip.append(img);}else chip.append(el('span','','✦'));
 chip.append(el('span','',traitLabel(trait.name)),el('b','',trait.count));if(trait.bonus)chip.append(el('small','bonus-tag','+'+trait.bonus));return chip;
}
function ingest(chunk){
 state.chunks.push(chunk);const size=state.config.population+1;
 for(let i=0;i<chunk.length;i+=size){let four=0,unlocks=0;for(let k=0;k<size-1;k++){const index=chunk[i+k];if(index!==255){four+=+(DATA.units[index].cost===4);unlocks+=+DATA.units[index].unlock;}}
  state.records.push({chunk,offset:i,score:chunk[i+size-1],four,unlocks});}
}
function recordIds(r){const ids=[];for(let k=0;k<state.config.population;k++){const index=r.chunk[r.offset+k];if(index!==255)ids.push(index);}return ids;}
function clearResults(c){state.config=c;state.chunks=[];state.records=[];state.filtered=[];state.page=0;state.dirty=false;$('settings-changed').hidden=true;$('form-error').hidden=true;$('lineup-grid').replaceChildren();updateStats();}
function updateStats(){
 $('stat-count').textContent=fmt(state.records.length);
 const max=state.records.reduce((s,r)=>Math.max(s,r.score),0);$('stat-score').replaceChildren(document.createTextNode(String(max)),el('span','',t('pts')));
 for(let n=$('score-filter').options.length;n<=max;n++)$('score-filter').append(new Option(t('{n}+ synergy',{n}),String(n)));
 $('stat-pool').replaceChildren(document.createTextNode(String(prepare(DATA,state.config).pool.length)),el('span','',t('units')));
 $('export').disabled=state.running||!state.records.length;
}
function filterResults(reset=true){
 if(reset)state.page=0;
 const q=$('result-query').value.trim().toLowerCase(),unit=$('champion-filter').value,unitIndex=unit?DATA.units.findIndex(u=>u.id===unit):-1,minScore=Number($('score-filter').value),sort=$('sort').value;
 state.filtered=state.records.filter(r=>{
  if(r.score<minScore)return false;
  const ids=recordIds(r);if(unitIndex>=0&&!ids.includes(unitIndex))return false;
  if(q){const haystack=(ids.map(i=>unitSearchText(DATA.units[i])+' '+traitSearchText(effectiveTraits(DATA.units[i],state.config))).join(' ')+' '+traitSearchText(Object.keys(state.config.trait_bonuses||{}))).toLowerCase();if(!q.split(/\s+/).every(word=>haystack.includes(word)))return false;}
  return true;
 });
 state.filtered.sort((a,b)=>sort==='four'?b.four-a.four||b.score-a.score:sort==='unlocks'?a.unlocks-b.unlocks||b.score-a.score:b.score-a.score||b.four-a.four);
 renderResults();
}
function renderResults(){
 const maxPage=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));state.page=Math.min(state.page,maxPage-1);
 const start=state.page*state.pageSize,rows=state.filtered.slice(start,start+state.pageSize),fragment=document.createDocumentFragment();
 for(let i=0;i<rows.length;i++){
  const r=rows[i],a=analyze(recordIds(r)),card=el('article','lineup-card');
  const top=el('div','card-top');top.append(el('span','card-rank',t('LINEUP {n}',{n:String(start+i+1).padStart(3,'0')})));
  const badge=el('div','score-badge');badge.append(el('span','','✦'),el('strong','',r.score),el('span','',t('SYNERGY')));top.append(badge);card.append(top);
  const units=el('div','unit-row');units.style.gridTemplateColumns=`repeat(${Math.min(8,Math.max(a.team.length,1))},minmax(0,1fr))`;
  const ordered=[...a.team].sort((x,y)=>y.cost-x.cost||x.name.localeCompare(y.name));
  for(const u of ordered)units.append(portrait(u));
  if(a.team.length<8&&state.config.population===8)for(let k=a.team.length;k<8;k++){const blank=el('div','unit-placeholder','◈');blank.title=t('Baron Nashor uses an additional population slot');units.append(blank);}
  card.append(units);const traits=el('div','trait-chips');for(const t of a.traits)traits.append(traitChip(t));card.append(traits);
  const bottom=el('div','card-bottom'),metrics=el('div');
  for(const [value,label]of [[a.front,'front'],[a.four,'4-cost'],[a.five,'5-cost']]){const span=el('span');span.append(el('b','',value),document.createTextNode(' '+t(label)));metrics.append(span);}
  const btn=el('button','board-link');btn.append(document.createTextNode(t('View board')),el('span','','↗'));btn.addEventListener('click',()=>showBoard(r));bottom.append(metrics,btn);card.append(bottom);fragment.append(card);
 }
 $('lineup-grid').replaceChildren(fragment);$('empty-state').hidden=rows.length>0||state.running;
 $('empty-message').textContent=t(state.records.length?'Clear the result filters to see more lineups.':'Try a lower synergy score or fewer frontline units.');
 $('visible-count').textContent=t('{n} results',{n:fmt(state.filtered.length)});
 $('page-label').textContent=t('{start}–{end} of {n}',{start:state.filtered.length?fmt(start+1):0,end:fmt(Math.min(start+state.pageSize,state.filtered.length)),n:fmt(state.filtered.length)});
 $('prev').disabled=state.page===0;$('next').disabled=state.page>=maxPage-1;
 const c=state.config,bonusTotal=Object.values(c.trait_bonuses||{}).reduce((s,n)=>s+n,0);$('results-context').textContent=t('{population} population · {four}+ four-costs · {unique}{bonus}',{population:c.population,four:c.min_four_cost,unique:t(c.include_unique_traits?'Unique traits included':'Unique traits excluded'),bonus:bonusTotal?t(' · +{n} trait bonuses',{n:bonusTotal}):''});
}
function showBoard(r){
 state.boardRecord=r;
 const a=analyze(recordIds(r)),front=a.team.filter(u=>u.range<=state.config.frontline_max_range).sort((x,y)=>y.cost-x.cost),back=a.team.filter(u=>u.range>state.config.frontline_max_range);
 $('board-title').textContent=t('{score} synergy · {population} population',{score:a.score,population:a.slots});
 $('board-metrics').replaceChildren();for(const [v,label]of [[a.front,'frontline'],[a.four,'four-cost'],[a.five,'five-cost'],[a.back,'four-cost backline']]){const span=el('span');span.append(el('b','',v),document.createTextNode(t(label)));$('board-metrics').append(span);}
 const positions=new Map(),frontPositions=[1,2,3,4,5,0,6,8,9,10,11,12,7,13],backPositions=[22,24,23,21,25,26,27,15,17,16,14,18,19,20];
 front.forEach((u,i)=>positions.set(frontPositions[i],u));back.forEach((u,i)=>positions.set(backPositions[i],u));
 $('hex-board').replaceChildren();
 for(let i=0;i<28;i++){
  const cell=el('div','hex-cell'),u=positions.get(i);
  if(u){
   const p=portrait(u,{name:false,lazy:false}),image=p.querySelector('img');
   if(image){image.addEventListener('error',()=>cell.append(el('span','hex-fallback',unitLabel(u).slice(0,2))));cell.append(image);}
   else cell.append(el('span','hex-fallback',unitLabel(u).slice(0,2)));
   cell.append(el('span','hex-name',unitLabel(u).replace(/ \(.*\)/,'')));
   cell.title=t('{name} · {cost}-cost · Population {slots}',{name:unitLabel(u),cost:u.cost,slots:u.slots});
  }
  $('hex-board').append(cell);
 }
 $('board-traits').replaceChildren(...a.traits.map(traitChip));
 const unlocked=a.team.filter(u=>u.unlock);$('unlock-note').textContent=unlocked.length?t('Unlock required: {names}. Unlock history is not simulated.',{names:unlocked.map(u=>unitLabel(u)).join(', ')}):t('No unlock-tagged champions in this lineup.');
 if(!$('board-dialog').open)$('board-dialog').showModal();
}
function setRunning(on){state.running=on;$('search').disabled=on;$('stop').hidden=!on;$('progress').hidden=!on;$('export').disabled=on||!state.records.length;}
function terminate(){for(const w of state.workers)w.terminate();state.workers=[];if(state.workerUrl){URL.revokeObjectURL(state.workerUrl);state.workerUrl=null;}}
function finish(status,reason=''){
 terminate();setRunning(false);state.status=status;clearInterval(state.clockTimer);updateStats();filterResults();
 const seconds=((performance.now()-state.started)/1000).toFixed(1);
 const partial=status!=='COMPLETE';setStatus(()=>partial?t('{reason} · {n} partial matches',{reason:typeof reason==='function'?reason():t(reason||'Search stopped'),n:fmt(state.records.length)}):t('Search complete · {n} qualifying lineups',{n:fmt(state.records.length)}),partial?'partial':'');
 $('elapsed').textContent=seconds+'s';if(partial)notify(t('Partial results: the search did not enumerate every lineup.'));
}
async function runSearch(event){
 event?.preventDefault();if(state.running)return;if(state.exporting){notify(t('Wait for the CSV export to finish.'));return;}
 let c;try{if(!$('criteria-form').reportValidity())return;c=readConfig();}catch(e){$('form-error').textContent=t(e.message);$('form-error').hidden=false;return;}
 state.searchId++;const id=state.searchId;clearResults(c);state.started=performance.now();
 if(isPreset(c)&&state.preset){
  ingest(state.preset);state.status='COMPLETE';updateStats();filterResults();setStatus(()=>t('Complete preset · {n} verified lineups',{n:fmt(state.records.length)}));$('elapsed').textContent=t('Ready instantly');return;
 }
 if(typeof Worker==='undefined'){$('form-error').textContent=t('This browser does not support background workers. Use a recent Chrome, Edge, Firefox or Safari.');$('form-error').hidden=false;return;}
 setRunning(true);setStatus(()=>t('Searching all eligible combinations…'),'running');$('empty-state').hidden=true;
 const pool=prepare(DATA,c).pool;
 if(!pool.length){finish('COMPLETE');return;}
 const n=Math.min(c.threads,pool.length);let done=0,complete=true;
 const workerCode=$('solver-source').textContent.replace(/^export /gm,'')+`\nself.onmessage=e=>{try{const {data,c,firstIndices,deadline}=e.data;const result=solve(data,c,{firstIndices,deadline,onChunk:a=>self.postMessage({chunk:a},[a.buffer]),onProgress:p=>self.postMessage({progress:p})});self.postMessage({done:result});}catch(error){self.postMessage({error:error.message});}};`;
 state.workerUrl=URL.createObjectURL(new Blob([workerCode],{type:'application/javascript'}));state.progress=new Array(n).fill(null);
 state.clockTimer=setInterval(()=>{$('elapsed').textContent=((performance.now()-state.started)/1000).toFixed(0)+'s';},1000);
 const deadline=Date.now()+c.max_seconds*1000;
 for(let i=0;i<n;i++){
  const w=new Worker(state.workerUrl);state.workers.push(w);
  w.onmessage=e=>{if(id!==state.searchId||!state.running)return;const m=e.data;
   if(m.chunk)ingest(m.chunk);
   if(m.progress){state.progress[i]=m.progress;const nodes=state.progress.reduce((s,p)=>s+(p?.nodes||0),0);$('progress-caption').textContent=t('{n} matches collected · {nodes} branches checked',{n:fmt(state.records.length),nodes:fmt(nodes)});if(!state.lastUpdate||performance.now()-state.lastUpdate>1200){state.lastUpdate=performance.now();updateStats();}}
   if(m.error){finish('INCOMPLETE',()=>t('Search error: {error}',{error:m.error}));return;}
   if(m.done){done++;complete=complete&&m.done.status==='COMPLETE';if(done===n)finish(complete?'COMPLETE':'INCOMPLETE',complete?'':'Time limit reached');}
  };
  w.onerror=e=>{if(state.running)finish('INCOMPLETE',()=>t('Worker error: {error}',{error:e.message}));};
  w.postMessage({data:DATA,c,firstIndices:pool.map((_,k)=>k).filter(k=>k%n===i),deadline});
 }
}
function renderPool(){
 const q=$('pool-query').value.toLowerCase().trim(),fragment=document.createDocumentFragment();
 for(const u of DATA.units.filter(u=>(unitSearchText(u)+' '+traitSearchText(u.traits)).toLowerCase().includes(q))){const label=el('label','pool-item'+(state.excluded.has(u.id)?' disabled':''));label.append(portrait(u,{name:false}));const info=el('div','pool-info');info.append(el('strong','',unitLabel(u)),el('small','',u.traits.map(name=>traitLabel(name)).join(' · ')),el('small','',t('{cost}-cost · Range {range}{slots}{unlock}',{cost:u.cost,range:u.range,slots:u.slots>1?t(' · {n} slots',{n:u.slots}):'',unlock:u.unlock?t(' · Unlock'):''})));const check=el('input');check.type='checkbox';check.checked=!state.excluded.has(u.id);check.setAttribute('aria-label',t('Include {name}',{name:unitLabel(u)}));check.addEventListener('change',()=>{if(check.checked)state.excluded.delete(u.id);else state.excluded.add(u.id);label.classList.toggle('disabled',!check.checked);$('pool-selected').textContent=t('{n} selected',{n:DATA.units.length-state.excluded.size});markDirty();});label.append(info,check);fragment.append(label);}
 $('pool-grid').replaceChildren(fragment);$('pool-selected').textContent=t('{n} selected',{n:DATA.units.length-state.excluded.size});
}
function renderExtras(){
 $('extra-list').replaceChildren();for(const [id,traits]of Object.entries(state.extras))for(const trait of traits){const name=unitLabel(DATA.units.find(u=>u.id===id));const chip=el('span','extra-chip',name+' · '+traitLabel(trait));const button=el('button','','×');button.type='button';button.setAttribute('aria-label',t('Remove {trait} from {name}',{trait:traitLabel(trait),name}));button.addEventListener('click',()=>{state.extras[id]=state.extras[id].filter(t=>t!==trait);if(!state.extras[id].length)delete state.extras[id];renderExtras();markDirty();});chip.append(button);$('extra-list').append(chip);}
}
function renderBonuses(){
 const list=$('emblem-list');list.replaceChildren();
 for(const [trait,n]of Object.entries(state.bonuses)){
  const row=el('div','emblem-row');const imageUrl=ART.traits[trait]?.url;
  if(imageUrl){const img=new Image();img.src=imageUrl;img.alt='';img.addEventListener('error',()=>img.remove());row.append(img);}
  row.append(el('span','emblem-name',traitLabel(trait)));
  for(const delta of [-1,1]){
   if(delta===1)row.append(el('strong','emblem-value','+'+n));
   const button=el('button','emblem-step',delta===1?'+':'−');button.type='button';button.setAttribute('aria-label',t(delta===1?'Increase {trait} bonus':'Decrease {trait} bonus',{trait:traitLabel(trait)}));button.disabled=delta===1&&n>=16;
   button.addEventListener('click',()=>setBonus(trait,n+delta));row.append(button);
  }
  list.append(row);
 }
 $('emblem-total').textContent=t('+{n} total',{n:Object.values(state.bonuses).reduce((s,n)=>s+n,0)});
}
function setBonus(trait,n){
 const proposed={...state.bonuses};if(n<=0)delete proposed[trait];else proposed[trait]=n;
 try{prepare(DATA,{...DEFAULTS,population:Number($('population').value),trait_bonuses:proposed});}
 catch(e){notify(t(e.message));return;}
 state.bonuses=proposed;renderBonuses();markDirty();
}
function download(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportCsv(){
 if(state.running||!state.filtered.length)return;
 const exportRows=state.filtered.slice();state.exporting=true;$('search').disabled=true;$('language').disabled=true;
 $('export').disabled=true;notify(t('Preparing {n} lineups…',{n:fmt(exportRows.length)}));
 const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
 const columns=['number','trait_score','population','four_cost','five_cost','frontline_count','backline_four_cost','champions','active_traits','trait_bonuses','unlock_units','status'];
 const englishHeaders={frontline_count:'frontline',champions:'units'};
 const parts=['\uFEFF'+columns.map(key=>getLanguage()==='en'?(englishHeaders[key]||key):t(key)).join(',')+'\r\n'];
 try{
  // Compute membership once for the export rather than once for every row.
  const c=state.config,membership=new Map(DATA.traits.map(t=>[t.name,DATA.units.filter(u=>effectiveTraits(u,c).includes(t.name)).length]));
  for(let start=0;start<exportRows.length;start+=1000){
   let text='';for(let i=start;i<Math.min(start+1000,exportRows.length);i++){
    const r=exportRows[i],team=recordIds(r).map(index=>DATA.units[index]),counts=new Map(Object.entries(c.trait_bonuses||{}));
    for(const u of team)for(const t of effectiveTraits(u,c))counts.set(t,(counts.get(t)||0)+1);
    const active=DATA.traits.filter(trait=>(c.include_unique_traits||membership.get(trait.name)>1)&&(counts.get(trait.name)||0)>=Math.min(...trait.breakpoints)).map(trait=>traitLabel(trait.name)+':'+counts.get(trait.name)).join('; ');
    text+=[i+1,r.score,team.reduce((s,u)=>s+u.slots,0),r.four,team.filter(u=>u.cost===5).length,team.filter(u=>u.range<=c.frontline_max_range).length,team.filter(u=>u.cost===4&&u.range>c.frontline_max_range&&c.backline_role_keywords.some(k=>u.role.includes(k))).length,quote(team.map(u=>unitLabel(u)).join(' | ')),quote(active),quote(Object.entries(c.trait_bonuses||{}).map(([name,n])=>traitLabel(name)+':+'+n).join('; ')),quote(team.filter(u=>u.unlock).map(u=>unitLabel(u)).join(' | ')),t(state.status)].join(',')+'\r\n';
   }parts.push(text);await new Promise(resolve=>setTimeout(resolve,0));
  }
  download(new Blob(parts,{type:'text/csv;charset=utf-8'}),`eightfold-${getLanguage()}-${state.status==='COMPLETE'?'complete':'PARTIAL'}-${exportRows.length}.csv`);notify(t('Exported {n} lineups.',{n:fmt(exportRows.length)}));
 }catch(e){notify(t('Export failed: {error}',{error:e.message}));}finally{state.exporting=false;$('search').disabled=false;$('export').disabled=false;$('language').disabled=false;}
}
function bindEvents(){
 $('criteria-form').addEventListener('submit',runSearch);$('criteria-form').addEventListener('input',markDirty);
 for(const button of document.querySelectorAll('[data-step]'))button.addEventListener('click',()=>{const [id,delta]=button.dataset.step.split(':'),input=$(id);input.value=Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)+Number(delta)));markDirty();});
 $('reset').addEventListener('click',()=>{$('criteria-form').reset();state.excluded.clear();state.extras={};state.bonuses={};renderExtras();renderBonuses();syncLabels();markDirty();notify(t('Default criteria restored.'));});
 $('language').addEventListener('change',()=>applyLanguage($('language').value));
 $('add-emblem').addEventListener('click',()=>{const trait=$('emblem-trait').value;setBonus(trait,(state.bonuses[trait]||0)+1);});
 $('stop').addEventListener('click',()=>finish('INCOMPLETE','Stopped by you'));
 $('result-query').addEventListener('input',()=>{clearTimeout(state.filterTimer);state.filterTimer=setTimeout(()=>filterResults(),180);});
 for(const id of ['champion-filter','score-filter','sort'])$(id).addEventListener('change',()=>filterResults());
 $('prev').addEventListener('click',()=>{if(state.page>0){state.page--;renderResults();$('lineup-grid').scrollIntoView({behavior:'smooth',block:'start'});}});
 $('next').addEventListener('click',()=>{state.page++;renderResults();$('lineup-grid').scrollIntoView({behavior:'smooth',block:'start'});});
 $('export').addEventListener('click',exportCsv);$('open-pool').addEventListener('click',()=>{renderPool();$('pool-dialog').showModal();});$('open-help').addEventListener('click',()=>$('help-dialog').showModal());
 for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>$(button.dataset.close).close());
 for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
 $('pool-query').addEventListener('input',renderPool);$('select-all').addEventListener('click',()=>{state.excluded.clear();renderPool();markDirty();});$('select-none').addEventListener('click',()=>{state.excluded=new Set(DATA.units.map(u=>u.id));renderPool();markDirty();});
 $('add-extra').addEventListener('click',()=>{const id=$('extra-unit').value,trait=$('extra-trait').value;if(DATA.units.find(u=>u.id===id).traits.includes(trait)){notify(t('This champion already has that trait.'));return;}state.extras[id]=[...new Set([...(state.extras[id]||[]),trait])];renderExtras();markDirty();});
 window.addEventListener('beforeunload',e=>{if(state.running){e.preventDefault();e.returnValue='';}});
}
const staticTranslations=[];
function captureStaticTranslations(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const node=walker.currentNode;if(!node.parentElement?.closest('script,style')&&node.textContent.trim())staticTranslations.push({node,source:node.textContent});}
 for(const node of document.querySelectorAll('[aria-label],[placeholder],meta[name="description"]'))for(const attr of ['aria-label','placeholder','content'])if(node.hasAttribute(attr))staticTranslations.push({node,attr,source:node.getAttribute(attr)});
}
function applyLanguage(language,initial=false){
 setLanguage(language);document.documentElement.lang=getLanguage();document.title=t('Eightfold — TFT Lineup Explorer');$('language').value=getLanguage();
 try{localStorage.setItem('eightfold-language',getLanguage());}catch{}
 for(const entry of staticTranslations){if(!entry.node.isConnected)continue;const value=localizedStaticText(entry.source);if(entry.attr)entry.node.setAttribute(entry.attr,value);else entry.node.textContent=value;}
 if(initial)return;
 populateSelects();renderExtras();renderBonuses();updateStats();filterResults(false);populateInfoTraits();if(state.view==='info')renderInfo();if($('info-dialog').open&&state.infoUnit)showInfo(state.infoUnit);
 if(state.statusBuilder)$('status-text').textContent=state.statusBuilder();
 if($('pool-dialog').open)renderPool();if($('board-dialog').open&&state.boardRecord)showBoard(state.boardRecord);
 if(state.status==='COMPLETE'&&isPreset(state.config))$('elapsed').textContent=t('Ready instantly');
}
async function init(){
 captureStaticTranslations();let preferred='zh-Hant';try{preferred=localStorage.getItem('eightfold-language')||preferred;}catch{}
 applyLanguage(preferred,true);populateSelects();bindEvents();bindInfo();syncLabels();renderBonuses();
 try{
  const encoded=$('preset-data').textContent.trim(),compressed=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if(typeof DecompressionStream==='undefined')throw Error(t('Preset decompression is not supported in this browser.'));
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  state.preset=new Uint8Array(await new Response(stream).arrayBuffer());
  if(state.preset.length!==68766*9)throw Error(t('Preset failed its integrity check.'));
  clearResults({...DEFAULTS});ingest(state.preset);state.status='COMPLETE';updateStats();filterResults();setStatus(()=>t('Complete preset · {n} verified lineups',{n:'68,766'}));$('elapsed').textContent=t('Ready instantly');
 }catch(e){state.status='READY';setStatus(()=>t('Ready for a fresh search. {error}',{error:e.message}),'partial');clearResults({...DEFAULTS});renderResults();}
}
init();
