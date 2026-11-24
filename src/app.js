'use strict';
const DATA=JSON.parse(document.getElementById('app-data').textContent);
const ART=JSON.parse(document.getElementById('art-data').textContent);
const INFO=JSON.parse(document.getElementById('info-data').textContent);
const ITEMS=JSON.parse(document.getElementById('item-data').textContent);
const $=id=>document.getElementById(id);
const fmt=n=>new Intl.NumberFormat(getLanguage()==='zh-Hant'?'zh-TW':'en-US').format(n);
const rarity={1:'#8594aa',2:'#6fd6a6',3:'#78a7ff',4:'#b49aff',5:'#e4c17f',7:'#ef92a2'};
const solverStates=Object.fromEntries(Object.entries(SOLVER_VIEWS).map(([view,cost])=>{
 const defaults=solverDefaults(cost);
 return [view,{defaults,config:{...defaults},records:[],filtered:[],page:0,pageSize:12,
  excluded:new Set(),extras:{},bonuses:{},required:{},requiredMode:'at_least',workers:[],
  running:false,status:'LOADING',searchId:0,preset:null,dirty:false,elapsed:''}];
}));
let state=solverStates.solver,initialPickers;
const appUI={view:'solver',infoUnit:null};
const criteriaNumbers=['population','min_target_cost','max_four_cost','max_five_cost','min_trait_score','min_frontline','frontline_max_range','min_backline_target_cost','max_seconds'];
const criteriaChoices=['include_unique_traits','include_seven_cost','score_mode','sona_feature_trait'];
const solverPickers=['result-query','champion-filter','score-filter','sort','required-query','pool-query','extra-unit','extra-trait','emblem-trait'];
const baseMembership=DATA.traits.map(t=>DATA.units.filter(u=>u.traits.includes(t.name)).length);
const traitByName=new Map(DATA.traits.map((t,i)=>[t.name,{...t,index:i,unique:baseMembership[i]===1}]));
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').hidden=true,4000);}
function renderSearchStatus(){
 $('status-text').textContent=state.statusBuilder?.()??t('Loading the verified preset…');
 $('status-strip').className='status-strip '+(state.statusKind||'');
 $('elapsed').textContent=state.elapsed==='instant'?t('Ready instantly'):state.elapsed;
 $('progress-caption').textContent=state.branches?t('{n} matches collected · {nodes} branches checked',{n:fmt(state.records.length),nodes:fmt(state.branches)}):t('Searching all eligible combinations…');
}
function setStatus(text,kind='',solver=state){solver.statusBuilder=typeof text==='function'?text:()=>text;solver.statusKind=kind;if(solver===state)renderSearchStatus();}
function markDirty(){renderDesktopLayout();state.dirty=true;$('settings-changed').hidden=false;syncLabels();}
function syncLabels(){$('score-output').value=$('min_trait_score').value;$('range-label').textContent=$('frontline_max_range').value;}
function readConfig(){
 const form=$('criteria-form'),c={...state.defaults};
 for(const k of criteriaNumbers)c[k]=Number(form.elements.namedItem(k).value);
 c.include_unique_traits=form.elements.namedItem('include_unique_traits').checked;
 c.include_seven_cost=form.elements.namedItem('include_seven_cost').checked;
 c.score_mode=$('score_mode').value;c.sona_feature_trait=$('sona_feature_trait').value||null;
 c.exclude_unit_ids=[...state.excluded];c.extra_traits=JSON.parse(JSON.stringify(state.extras));c.trait_bonuses={...state.bonuses};
 c.required_traits={...state.required};c.required_trait_mode=state.requiredMode;
 c.threads=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||4)-1));
 prepare(DATA,c);return c;
}
function isPreset(c,defaults=solverDefaults(c.target_cost)){
 return ['population','target_cost','max_four_cost','max_five_cost','min_trait_score','min_frontline','frontline_max_range','include_unique_traits','include_seven_cost','score_mode'].every(k=>c[k]===defaults[k])&&
  (c.min_target_cost??c.min_four_cost)===defaults.min_target_cost&&(c.min_backline_target_cost??c.min_backline_four_cost)===defaults.min_backline_target_cost&&
  !c.sona_feature_trait&&!c.exclude_unit_ids.length&&!Object.keys(c.extra_traits).length&&!Object.values(c.trait_bonuses||{}).some(n=>n>0);
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
function applyCriteria(values){
 const form=$('criteria-form');
 for(const name of [...criteriaNumbers,...criteriaChoices]){
  const input=form.elements.namedItem(name);
  if(input.type==='checkbox')input.checked=values[name];
  else input.value=values[name]??'';
 }
 $('required-mode').value=state.requiredMode;
 syncLabels();
}
function renderSolverLabels(){
 const cost=state.defaults.target_cost,label=t(cost+'-cost');
 $('four-cost-hero').hidden=cost!==4;
 $('low-cost-hero').hidden=cost===4;
 $('low-cost-title').textContent=t(cost+'-cost Solver');
 $('target-cost-dot').style.background=rarity[cost];
 $('target-cost-min-label').textContent=t('{cost} minimum',{cost:label});
 $('target-backline-label').textContent=cost===4?t('4-cost backline'):t('{cost} backline carry minimum',{cost:label});
 $('max-four-field').hidden=cost===4;
 $('sort-core').textContent=t('Most {cost} champions',{cost:label});
}
function activateSolver(view){
 const next=solverStates[view],changed=next!==state;
 if(changed){
  if(state.exporting){notify(t('Wait for the CSV export to finish.'));return false;}
  clearTimeout(state.filterTimer);
  const form=$('criteria-form');
  state.inputs=Object.fromEntries([...criteriaNumbers,...criteriaChoices].map(name=>{
   const input=form.elements.namedItem(name);
   return [name,input.type==='checkbox'?input.checked:input.value];
  }));
  state.pickers=Object.fromEntries(solverPickers.map(id=>[id,$(id).value]));
  state=next;
  applyCriteria(state.inputs||state.defaults);
  $('form-error').hidden=true;
  updateStats();
  for(const [id,value]of Object.entries(state.pickers||initialPickers))$(id).value=value;
  populateRequiredTraits();renderRequirements();renderExtras();renderBonuses();
  if(typeof renderDesktopLayout==='function')renderDesktopLayout();
 }
 if(changed||!state.presetTask){
  renderSolverLabels();renderSearchControls();renderSearchStatus();updateStats();filterResults(false);
 }
 state.presetTask??=loadPreset(state);
 return true;
}
function portrait(u,{name=true,lazy=true,interactive=false}={}){
 const wrap=el(interactive?'button':'div',name?'champion':'');if(interactive){wrap.type='button';wrap.classList.add('champion-info-button');wrap.setAttribute('aria-label',t('View {name} details',{name:unitLabel(u)}));wrap.setAttribute('aria-haspopup','dialog');wrap.setAttribute('aria-controls','info-dialog');wrap.addEventListener('click',()=>showInfo(u.id));}wrap.title=t('{name} · {cost}-cost · Range {range}{slots}\n{traits}{unlock}',{name:unitLabel(u),cost:u.cost,range:u.range,slots:u.slots>1?t(' · {n} slots',{n:u.slots}):'',traits:u.traits.map(name=>traitLabel(name)).join(' / '),unlock:hasInfoUnlock(u)?t('\nUnlock required'):''});
 const p=el('div','portrait');p.style.setProperty('--rarity',rarity[u.cost]||rarity[1]);
 const fallback=el('span','fallback',u.name.replace(/\(.*\)/,'').trim().split(/\s+/).map(s=>s[0]).slice(0,2).join(''));
 p.append(fallback);
 const url=ART.units[u.id]?.url||INFO.units[u.id]?.image;
 if(url){const img=new Image();img.alt=unitLabel(u);img.loading=lazy?'lazy':'eager';img.referrerPolicy='no-referrer';img.src=url;img.addEventListener('load',()=>{fallback.hidden=true;});img.addEventListener('error',()=>{img.remove();fallback.hidden=false;});p.append(img);}
 p.append(el('span','cost-label',u.cost));const frame=el('div','portrait-frame');frame.append(p);if(hasInfoUnlock(u)){const badge=el('span','unlock-badge');badge.setAttribute('role','img');badge.setAttribute('aria-label',t('Unlock required'));badge.title=t('Unlock required');frame.append(badge);}wrap.append(frame);if(name)wrap.append(el('div','champion-name',unitLabel(u).replace(/ \(.*\)/,'')));return wrap;
}
function analyze(ids,c=state.config){
 const team=ids.map(i=>DATA.units[i]),counts=new Map(Object.entries(c.trait_bonuses||{}));
 for(const u of team)for(const t of effectiveTraits(u,c))counts.set(t,(counts.get(t)||0)+solverTraitWeight(t));
 const members=DATA.traits.map(t=>DATA.units.filter(u=>effectiveTraits(u,c).includes(t.name)).length);
 const traits=[];let score=0;
 for(const t of DATA.traits){const n=counts.get(t.name)||0,m=members[traitByName.get(t.name).index];if(!c.include_unique_traits&&m<=1)continue;
  const active=n>=Math.min(...t.breakpoints);
  const contribution=solverTraitPoints(t,n,c.score_mode);
  score+=contribution;if(active)traits.push({...t,count:n,bonus:c.trait_bonuses?.[t.name]||0,unique:m===1,contribution});
 }
 traits.sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
 const core=team.filter(u=>u.cost===c.target_cost);
 return {team,traits,score,front:team.filter(u=>u.range<=c.frontline_max_range).length,back:core.filter(u=>isBacklineCarry(u,c)).length,target:core.length,four:team.filter(u=>u.cost===4).length,five:team.filter(u=>u.cost===5).length,slots:team.reduce((s,u)=>s+u.slots,0),unlocks:team.filter(u=>u.unlock).length};
}
function traitChip(trait){
 const chip=el('span','trait-chip'+(trait.unique?' unique':'')+(trait.bonus?' boosted':''));
 const stars=solverTraitWeight(trait.name)===2;
 chip.title=t(stars?'{name}: {base} total stars (2 per champion){bonus} · Breakpoints {points} · Score +{score}':'{name}: {base} champion counts{bonus} · Breakpoints {points} · Score +{score}',{name:traitLabel(trait.name),base:trait.count-(trait.bonus||0),bonus:trait.bonus?t(' + {bonus} bonus = {total} total',{bonus:trait.bonus,total:trait.count}):'',points:trait.breakpoints.join('/'),score:trait.contribution});
 const url=ART.traits[trait.name]?.url;if(url){const img=new Image();img.alt='';img.src=url;img.loading='lazy';img.addEventListener('error',()=>img.remove());chip.append(img);}else chip.append(el('span','','✦'));
 chip.append(el('span','',traitLabel(trait.name)),el('b','',stars?trait.count+'★':trait.count));if(trait.bonus)chip.append(el('small','bonus-tag','+'+trait.bonus));return chip;
}
function ingest(chunk,solver=state){
 const {population,target_cost}=solver.config,size=population+1;
 for(let i=0;i<chunk.length;i+=size){let four=0,target=0,unlocks=0;for(let k=0;k<population;k++){const u=DATA.units[chunk[i+k]];if(u){four+=+(u.cost===4);target+=+(u.cost===target_cost);unlocks+=+u.unlock;}}
  solver.records.push({chunk,offset:i,score:chunk[i+population],four,target,unlocks});}
}
function recordIds(r){const ids=[];for(let k=0;k<state.config.population;k++){const index=r.chunk[r.offset+k];if(index!==255)ids.push(index);}return ids;}
function clearResults(c){state.config=c;state.records=[];state.filtered=[];state.page=0;state.dirty=false;$('settings-changed').hidden=true;$('form-error').hidden=true;$('lineup-grid').replaceChildren();updateStats();}
function updateStats(){
 $('stat-count').textContent=fmt(state.records.length);
 const max=state.records.reduce((s,r)=>Math.max(s,r.score),0);$('stat-score').replaceChildren(document.createTextNode(String(max)),el('span','',t('pts')));
 for(let n=$('score-filter').options.length;n<=max;n++)$('score-filter').append(new Option(t('{n}+ synergy',{n}),String(n)));
 $('stat-pool').replaceChildren(document.createTextNode(String(prepare(DATA,state.config).pool.length)),el('span','',t('units')));
 $('export').disabled=state.running||state.exporting||!state.records.length;
}
function filterResults(reset=true){
 if(reset)state.page=0;
 const q=$('result-query').value.trim().toLowerCase(),unit=$('champion-filter').value,unitIndex=unit?DATA.units.findIndex(u=>u.id===unit):-1,minScore=Number($('score-filter').value),sort=$('sort').value;
 state.filtered=state.records.filter(r=>{
  if(r.score<minScore)return false;
  if(unitIndex<0&&!q)return true;
  const ids=recordIds(r);if(unitIndex>=0&&!ids.includes(unitIndex))return false;
  if(q){const haystack=(ids.map(i=>unitSearchText(DATA.units[i])+' '+traitSearchText(effectiveTraits(DATA.units[i],state.config))).join(' ')+' '+traitSearchText(Object.keys(state.config.trait_bonuses||{}))).toLowerCase();if(!q.split(/\s+/).every(word=>haystack.includes(word)))return false;}
  return true;
 });
 state.filtered.sort((a,b)=>sort==='core'?b.target-a.target||b.score-a.score:sort==='unlocks'?a.unlocks-b.unlocks||b.score-a.score:b.score-a.score||b.target-a.target);
 renderResults();
}
function renderResults(){
 const c=state.config,cost=t(c.target_cost+'-cost');
 const maxPage=Math.max(1,Math.ceil(state.filtered.length/state.pageSize));state.page=Math.min(state.page,maxPage-1);
 const start=state.page*state.pageSize,rows=state.filtered.slice(start,start+state.pageSize),fragment=document.createDocumentFragment();
 for(let i=0;i<rows.length;i++){
  const r=rows[i],a=analyze(recordIds(r)),card=el('article','lineup-card');
  const top=el('div','card-top');top.append(el('span','card-rank',t('LINEUP {n}',{n:String(start+i+1).padStart(3,'0')})));
  const badge=el('div','score-badge');badge.append(el('span','','✦'),el('strong','',r.score),el('span','',t('SYNERGY')));top.append(badge);card.append(top);
  const units=el('div','unit-row');units.style.gridTemplateColumns=`repeat(${Math.min(8,a.slots)},minmax(0,1fr))`;
  const ordered=[...a.team].sort((x,y)=>y.cost-x.cost||x.name.localeCompare(y.name));
  for(const u of ordered)units.append(portrait(u,{interactive:true}));
  for(let k=a.team.length;k<a.slots;k++){const blank=el('div','unit-placeholder','◈');blank.title=t('Baron Nashor uses an additional population slot');units.append(blank);}
  card.append(units);const traits=el('div','trait-chips');for(const t of a.traits)traits.append(traitChip(t));card.append(traits);
  const bottom=el('div','card-bottom'),metrics=el('div');
  const counts=[[a.front,'front'],[a.target,c.target_cost+'-cost'],[a.five,'5-cost']];
  if(c.target_cost!==4)counts.splice(2,0,[a.four,'4-cost']);
  for(const [value,label]of counts){const span=el('span');span.append(el('b','',value),document.createTextNode(' '+t(label)));metrics.append(span);}
  const btn=el('button','board-link');btn.append(document.createTextNode(t('View board')),el('span','','↗'));btn.addEventListener('click',()=>showBoard(r));const actions=el('div','lineup-actions');actions.append(teamCodeButton(ordered),btn);bottom.append(metrics,actions);card.append(bottom);fragment.append(card);
 }
 $('lineup-grid').replaceChildren(fragment);$('empty-state').hidden=rows.length>0||state.running||state.status==='LOADING';
 $('empty-message').textContent=t(state.records.length?'Clear the result filters to see more lineups.':'Try a lower synergy score or fewer frontline units.');
 $('visible-count').textContent=t('{n} results',{n:fmt(state.filtered.length)});
 $('page-label').textContent=t('{start}–{end} of {n}',{start:state.filtered.length?fmt(start+1):0,end:fmt(Math.min(start+state.pageSize,state.filtered.length)),n:fmt(state.filtered.length)});
 $('prev').disabled=state.page===0;$('next').disabled=state.page>=maxPage-1;
 const bonusTotal=Object.values(c.trait_bonuses||{}).reduce((s,n)=>s+n,0);
 const coreContext=c.target_cost===4?'{population} population · {min}+ {cost} · {unique}{bonus}':'{population} population · {min}+ {cost} · Up to {max} four-costs · {unique}{bonus}';
 $('results-context').textContent=t(coreContext,{population:c.population,min:c.min_target_cost,max:c.max_four_cost,cost,unique:t(c.include_unique_traits?'Unique traits included':'Unique traits excluded'),bonus:bonusTotal?t(' · +{n} trait bonuses',{n:bonusTotal}):''});
 const required=requiredSummary(c);if(required)$('results-context').textContent+=' · '+required;
}
function showBoard(r){
 state.boardRecord=r;
 const a=analyze(recordIds(r)),front=a.team.filter(u=>u.range<=state.config.frontline_max_range).sort((x,y)=>y.cost-x.cost),back=a.team.filter(u=>u.range>state.config.frontline_max_range);
 $('board-title').textContent=t('{score} synergy · {population} population',{score:a.score,population:a.slots});
 const cost=state.config.target_cost,metrics=[[a.front,t('frontline')],[a.four,t('four-cost')],[a.five,t('five-cost')],[a.back,cost===4?t('four-cost backline'):t('{cost} backline carry',{cost:t(cost+'-cost')})]];
 if(cost!==4)metrics.splice(1,0,[a.target,t(cost+'-cost')]);
 $('board-metrics').replaceChildren();for(const [v,label]of metrics){const span=el('span');span.append(el('b','',v),document.createTextNode(label));$('board-metrics').append(span);}
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
 $('board-copy').replaceChildren(teamCodeButton([...a.team].sort((x,y)=>y.cost-x.cost||x.name.localeCompare(y.name))));
 const unlocked=a.team.filter(u=>u.unlock);$('unlock-note').textContent=unlocked.length?t('Unlock required: {names}. Unlock history is not simulated.',{names:unlocked.map(u=>unitLabel(u)).join(', ')}):t('No unlock-tagged champions in this lineup.');
 if(!$('board-dialog').open)$('board-dialog').showModal();
}
function renderSearchControls(){
 $('search').disabled=state.running||state.exporting||state.status==='LOADING';
 $('stop').hidden=!state.running;$('progress').hidden=!state.running;
 $('settings-changed').hidden=!state.dirty;
}
function finish(status,reason='',solver=state){
 for(const worker of solver.workers)worker.terminate();
 solver.workers=[];
 if(solver.workerUrl){URL.revokeObjectURL(solver.workerUrl);solver.workerUrl=null;}
 clearInterval(solver.clockTimer);solver.status=status;solver.running=false;
 solver.elapsed=((performance.now()-solver.started)/1000).toFixed(1)+'s';
 const partial=status!=='COMPLETE',count=solver.records.length;
 setStatus(()=>partial?t('{reason} · {n} partial matches',{reason:typeof reason==='function'?reason():t(reason||'Search stopped'),n:fmt(count)}):t('Search complete · {n} qualifying lineups',{n:fmt(count)}),partial?'partial':'',solver);
 if(solver===state){
  renderSearchControls();updateStats();filterResults();
  if(partial)notify(t('Partial results: the search did not enumerate every lineup.'));
 }
}
function showPreset(solver,bytes){
 ingest(bytes,solver);solver.status='COMPLETE';solver.elapsed='instant';
 setStatus(()=>t('Complete preset · {n} verified lineups',{n:fmt(solver.records.length)}),'',solver);
 if(solver===state){renderSearchControls();updateStats();filterResults(false);}
}
async function runSearch(event){
 event?.preventDefault();if(state.running||state.status==='LOADING')return;if(state.exporting){notify(t('Wait for the CSV export to finish.'));return;}
 let c;try{if(!$('criteria-form').reportValidity())return;c=readConfig();}catch(e){$('form-error').textContent=t(e.message);$('form-error').hidden=false;return;}
 const solver=state,id=++solver.searchId;
 clearResults(c);solver.started=performance.now();solver.branches=0;solver.elapsed='';
 if(isPreset(c,solver.defaults)&&solver.preset){
  showPreset(solver,filterRequiredRecords(DATA,solver.preset,c));return;
 }
 if(typeof Worker==='undefined'){$('form-error').textContent=t('This browser does not support background workers. Use a recent Chrome, Edge, Firefox or Safari.');$('form-error').hidden=false;return;}
 solver.running=true;renderSearchControls();updateStats();setStatus(()=>t('Searching all eligible combinations…'),'running',solver);$('empty-state').hidden=true;
 const pool=prepare(DATA,c).pool;
 if(!pool.length){finish('COMPLETE');return;}
 const n=Math.min(c.threads,pool.length);let done=0,complete=true;
 const workerCode=$('solver-source').textContent.replace(/^export /gm,'')+`\nself.onmessage=e=>{try{const {data,c,firstIndices,deadline}=e.data;const result=solve(data,c,{firstIndices,deadline,onChunk:a=>self.postMessage({chunk:a},[a.buffer]),onProgress:p=>self.postMessage({progress:p})});self.postMessage({done:result});}catch(error){self.postMessage({error:error.message});}};`;
 solver.workerUrl=URL.createObjectURL(new Blob([workerCode],{type:'application/javascript'}));solver.progress=new Array(n).fill(null);solver.lastUpdate=0;
 solver.clockTimer=setInterval(()=>{solver.elapsed=((performance.now()-solver.started)/1000).toFixed(0)+'s';if(state===solver)$('elapsed').textContent=solver.elapsed;},1000);
 const deadline=Date.now()+c.max_seconds*1000;
 try{
  for(let i=0;i<n;i++){
   const w=new Worker(solver.workerUrl);solver.workers.push(w);
   w.onmessage=e=>{if(id!==solver.searchId||!solver.running)return;const m=e.data;
    if(m.chunk)ingest(m.chunk,solver);
    if(m.progress){
     solver.progress[i]=m.progress;solver.branches=solver.progress.reduce((sum,p)=>sum+(p?.nodes||0),0);
     if(state===solver&&performance.now()-solver.lastUpdate>1200){solver.lastUpdate=performance.now();renderSearchStatus();updateStats();}
    }
    if(m.error){finish('INCOMPLETE',()=>t('Search error: {error}',{error:m.error}),solver);return;}
    if(m.done){done++;complete=complete&&m.done.status==='COMPLETE';if(done===n)finish(complete?'COMPLETE':'INCOMPLETE',complete?'':'Time limit reached',solver);}
   };
   w.onerror=e=>{if(solver.running&&id===solver.searchId)finish('INCOMPLETE',()=>t('Worker error: {error}',{error:e.message}),solver);};
   w.postMessage({data:DATA,c,firstIndices:pool.map((_,k)=>k).filter(k=>k%n===i),deadline});
  }
 }catch(e){finish('INCOMPLETE',()=>t('Worker error: {error}',{error:e.message}),solver);}
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
 try{prepare(DATA,{...state.defaults,population:Number($('population').value),trait_bonuses:proposed});}
 catch(e){notify(t(e.message));return;}
 state.bonuses=proposed;renderBonuses();markDirty();
}
function download(blob,name){const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportCsv(){
 if(state.running||!state.filtered.length)return;
 const exportRows=state.filtered.slice();state.exporting=true;$('search').disabled=true;$('language').disabled=true;
 $('export').disabled=true;notify(t('Preparing {n} lineups…',{n:fmt(exportRows.length)}));
 const quote=s=>'"'+String(s).replaceAll('"','""')+'"';
 const c=state.config,lowCost=c.target_cost<4;
 const columns=['number','trait_score','population','four_cost','five_cost','frontline_count','backline_four_cost'];
 if(lowCost)columns.push('target_cost','target_cost_count','backline_target_cost');
 columns.push('champions','active_traits','trait_bonuses','unlock_units','status');
 const englishHeaders={frontline_count:'frontline',champions:'units'};
 const parts=['\uFEFF'+columns.map(key=>getLanguage()==='en'?(englishHeaders[key]||key):t(key)).join(',')+'\r\n'];
 try{
  // Compute membership once for the export rather than once for every row.
  const membership=new Map(DATA.traits.map(t=>[t.name,DATA.units.filter(u=>effectiveTraits(u,c).includes(t.name)).length]));
  for(let start=0;start<exportRows.length;start+=1000){
   let text='';for(let i=start;i<Math.min(start+1000,exportRows.length);i++){
    const r=exportRows[i],team=recordIds(r).map(index=>DATA.units[index]),counts=new Map(Object.entries(c.trait_bonuses||{}));
    for(const u of team)for(const t of effectiveTraits(u,c))counts.set(t,(counts.get(t)||0)+solverTraitWeight(t));
    const active=DATA.traits.filter(trait=>(c.include_unique_traits||membership.get(trait.name)>1)&&(counts.get(trait.name)||0)>=Math.min(...trait.breakpoints)).map(trait=>traitLabel(trait.name)+':'+counts.get(trait.name)).join('; ');
    const carries=team.filter(u=>isBacklineCarry(u,c));
    const numbers=[i+1,r.score,team.reduce((s,u)=>s+u.slots,0),r.four,team.filter(u=>u.cost===5).length,team.filter(u=>u.range<=c.frontline_max_range).length,carries.filter(u=>u.cost===4).length];
    if(lowCost)numbers.push(c.target_cost,r.target,carries.filter(u=>u.cost===c.target_cost).length);
    text+=[...numbers,quote(team.map(u=>unitLabel(u)).join(' | ')),quote(active),quote(Object.entries(c.trait_bonuses||{}).map(([name,n])=>traitLabel(name)+':+'+n).join('; ')),quote(team.filter(u=>u.unlock).map(u=>unitLabel(u)).join(' | ')),t(state.status)].join(',')+'\r\n';
   }parts.push(text);await new Promise(resolve=>setTimeout(resolve,0));
  }
  download(new Blob(parts,{type:'text/csv;charset=utf-8'}),`eightfold-${lowCost?c.target_cost+'cost-':''}${getLanguage()}-${state.status==='COMPLETE'?'complete':'PARTIAL'}-${exportRows.length}.csv`);notify(t('Exported {n} lineups.',{n:fmt(exportRows.length)}));
 }catch(e){notify(t('Export failed: {error}',{error:e.message}));}finally{state.exporting=false;$('search').disabled=false;$('export').disabled=false;$('language').disabled=false;}
}
function bindEvents(){
 $('criteria-form').addEventListener('submit',runSearch);$('criteria-form').addEventListener('input',markDirty);
 for(const button of document.querySelectorAll('[data-step]'))button.addEventListener('click',()=>{const [id,delta]=button.dataset.step.split(':'),input=$(id);input.value=Math.max(Number(input.min),Math.min(Number(input.max),Number(input.value)+Number(delta)));markDirty();});
 $('reset').addEventListener('click',()=>{$('criteria-form').reset();state.excluded.clear();state.extras={};state.bonuses={};state.required={};state.requiredMode='at_least';applyCriteria(state.defaults);renderRequirements();populateRequiredTraits();renderExtras();renderBonuses();markDirty();notify(t('Default criteria restored.'));});
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
 window.addEventListener('beforeunload',e=>{if(Object.values(solverStates).some(solver=>solver.running)){e.preventDefault();e.returnValue='';}});
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
 renderDesktopLayout();if(initial)return;
 populateSelects();populateRequiredTraits();renderRequirements();renderExtras();renderBonuses();renderSolverLabels();updateStats();filterResults(false);populateInfoTraits();if(appUI.view==='info')renderInfo();populateAugmentTagFilters();if(appUI.view==='augments')renderAugments();populateEquipmentFilters();if(appUI.view==='equipment')renderEquipment();if(appUI.view==='simulator')renderSimulator();if($('equipment-dialog').open&&equipmentUI.selected)showEquipment(equipmentUI.selected);if($('augment-dialog').open&&augmentUI.selected)showAugment(augmentUI.selected);if($('info-dialog').open&&appUI.infoUnit)showInfo(appUI.infoUnit);
 renderSearchStatus();
 if($('pool-dialog').open)renderPool();if($('board-dialog').open&&state.boardRecord)showBoard(state.boardRecord);
}
async function loadPreset(solver){
 try{
  const {target_cost,population}=solver.defaults;
  const presetData=$('preset-data'+(target_cost===4?'':'-'+target_cost)),encoded=presetData.textContent.trim(),compressed=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if(typeof DecompressionStream==='undefined')throw Error(t('Preset decompression is not supported in this browser.'));
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  if(bytes.length!==Number(presetData.dataset.records)*(population+1))throw Error(t('Preset failed its integrity check.'));
  solver.preset=bytes;showPreset(solver,bytes);
 }catch(e){
  solver.status='READY';setStatus(()=>t('Ready for a fresh search. {error}',{error:e.message}),'partial',solver);
  if(solver===state){renderSearchControls();filterResults(false);}
 }
}
function init(){
 captureStaticTranslations();let preferred='zh-Hant';try{preferred=localStorage.getItem('eightfold-language')||preferred;}catch{}
 applyLanguage(preferred,true);populateSelects();
 initialPickers=Object.fromEntries(solverPickers.map(id=>[id,$(id).value]));
 applyCriteria(state.defaults);populateRequiredTraits();bindEvents();bindRequirements();bindDesktopLayout();bindInfo();renderBonuses();
}
init();
