import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {prepare,solve,DEFAULTS,solverDefaults,effectiveTraits,EMBLEM_TRAITS,filterRequiredRecords,solverTraitWeight,solverTraitPoints,isBacklineCarry} from '../src/solver.mjs';
import {TRAIT_ZH,t,traitLabel,traitSearchText,setLanguage,getLanguage,localizedStaticText} from '../src/i18n.mjs';
setLanguage('en');
const data=JSON.parse(fs.readFileSync(new URL('../dist/units.json',import.meta.url)));
const root=new URL('../',import.meta.url);
const get=p=>fs.readFileSync(new URL(p,root),'utf8');
const referenceKdaScores={3:2,5:3,7:4,10:5,13:6,15:7};
function referenceTraitPoints(trait,count,mode){
 const tier=Math.max(0,...trait.breakpoints.filter(point=>point<=count));
 if(trait.name==='K|DA')return referenceKdaScores[Math.min(tier,15)]||0;
 if(mode==='all_members'||(mode==='active_members'&&tier))return count;
 return tier;
}
function brute(data,c){
 const pool=data.units.filter(u=>!c.exclude_unit_ids.includes(u.id)&&(c.include_seven_cost||u.cost!==7));
 const members=new Map(data.traits.map(t=>[t.name,data.units.filter(u=>effectiveTraits(u,c).includes(t.name)).length]));
 const found=new Map();
 function check(team){
  if(team.reduce((s,u)=>s+u.slots,0)!==c.population)return;
  if(new Set(team.map(u=>u.exclusive_group||u.id)).size!==team.length)return;
  const target=team.filter(u=>u.cost===c.target_cost);
  if(target.length<(c.min_target_cost??c.min_four_cost)||team.filter(u=>u.cost===4).length>c.max_four_cost||team.filter(u=>u.cost===5).length>c.max_five_cost)return;
  if(team.filter(u=>u.range<=c.frontline_max_range).length<c.min_frontline)return;
  if(target.filter(u=>u.range>c.frontline_max_range&&c.backline_role_keywords.some(k=>u.role.includes(k))).length<(c.min_backline_target_cost??c.min_backline_four_cost))return;
  for(const [name,min]of Object.entries(c.required_traits||{})){
   const n=team.filter(u=>effectiveTraits(u,c).includes(name)).length*(name==='K|DA'?2:1)+(c.trait_bonuses?.[name]||0);
   const tier=Math.max(0,...data.traits.find(t=>t.name===name).breakpoints.filter(x=>x<=n));
   if(c.required_trait_mode==='exact_tier'?tier!==min:tier<min)return;
  }
  let score=0;
  for(const t of data.traits){if(!c.include_unique_traits&&members.get(t.name)<=1)continue;
   const n=team.filter(u=>effectiveTraits(u,c).includes(t.name)).length*(t.name==='K|DA'?2:1)+(c.trait_bonuses?.[t.name]||0);
   score+=referenceTraitPoints(t,n,c.score_mode);
  }
  if(score>=c.min_trait_score)found.set(team.map(u=>u.id).sort().join(','),score);
 }
 // Enumerate bit masks instead of using the optimized solver's recursion or pruning.
 for(let mask=1;mask<2**pool.length;mask++)check(pool.filter((_,i)=>(mask&(2**i))!==0));
 return found;
}
let cases=0;
function compare(d,c){
 const expected=brute(d,c),got=new Map();
 const result=solve(d,c,{onChunk:b=>{for(let p=0;p<b.length;p+=c.population+1){const ids=[...b.subarray(p,p+c.population)].filter(x=>x!==255).map(x=>d.units[x].id).sort().join(',');assert(!got.has(ids));got.set(ids,b[p+c.population]);}}});
 assert.equal(result.status,'COMPLETE');assert.equal(result.matches,expected.size);assert.deepEqual(got,expected);cases++;
}
const sample=structuredClone(data);sample.units=data.units.filter(u=>['u0','u7','u8','u15','u23','u38','u49','u51','u55','u58','u67','u74','u90','u92','u93'].includes(u.id));
for(const mode of ['active_members','breakpoint','all_members'])for(const unique of [true,false]){
 compare(sample,{...DEFAULTS,min_trait_score:10,score_mode:mode,include_unique_traits:unique});
 compare(sample,{...DEFAULTS,min_trait_score:12,score_mode:mode,include_unique_traits:unique,trait_bonuses:{Frontman:1,Arcanist:2,Producer:1}});
}
for(let i=0;i<18;i++){
 const d={source:'test',set:'test',traits:[{name:'A',breakpoints:[2,4]},{name:'B',breakpoints:[3,5]},{name:'C',breakpoints:[1,2]},{name:'Unique',breakpoints:[1]},{name:'Collab',breakpoints:[3,5]}],units:[]};
 for(let j=0;j<12;j++)d.units.push({id:'x'+j,name:j===11?'Sona':'X'+j,cost:[4,4,4,5,5,1,2,3,7,4,4,7][j],range:[4,4,1,1,2,1,4,0,1,5,1,0][j],role:'DA_Role_MagicCaster',slots:j===8?2:1,traits:j===11?['Collab']:j===0?['Unique','A']:j%3===0?['A','B']:j%3===1?['B','C']:['A','C'],exclusive_group:j===3||j===4?'mutual':'x'+j});
 const c={...DEFAULTS,population:4+i%4,min_four_cost:1+i%3,max_five_cost:2,min_frontline:1+i%3,min_backline_four_cost:1,min_trait_score:i%10,score_mode:['active_members','breakpoint','all_members'][i%3],include_unique_traits:i%2===0,include_seven_cost:i%3!==1,extra_traits:i%2?{x1:['Collab'],x5:['Collab']}:{},sona_feature_trait:i%2?'A':null,exclude_unit_ids:i%2?['x9']:[]};compare(d,c);
 compare(d,{...c,trait_bonuses:{A:1,B:2,Unique:1,Collab:3}});
 for(const required_trait_mode of ['at_least','exact_tier'])compare(d,{...c,trait_bonuses:{A:1,B:2},required_traits:{A:2,B:3},required_trait_mode});
 compare(d,{...DEFAULTS,population:5,min_four_cost:0,max_five_cost:2,min_frontline:0,min_backline_four_cost:0,min_trait_score:0,include_unique_traits:false,required_traits:{Unique:1,A:2},sona_feature_trait:'A',extra_traits:{x1:['A']}});
}
// A bonus can cross a threshold, score above population, or activate a trait
// before the first selected unit. This also catches unsafe mass-bound pruning.
const focused={traits:[{name:'A',breakpoints:[3,5]},{name:'B',breakpoints:[1]}],units:[{id:'one',name:'One',cost:4,range:1,slots:1,role:'Tank',traits:['A']},{id:'two',name:'Two',cost:4,range:4,slots:1,role:'Caster',traits:['A']},{id:'three',name:'Three',cost:1,range:1,slots:1,role:'Tank',traits:['B']}]};
for(const mode of ['active_members','breakpoint','all_members']){
 const c={...DEFAULTS,population:2,min_four_cost:0,min_frontline:0,min_backline_four_cost:0,min_trait_score:3,score_mode:mode};
 compare(focused,{...c,trait_bonuses:{A:1}});
 compare(focused,{...c,trait_bonuses:{A:5,B:2}});
 compare(focused,{...c,trait_bonuses:{A:0}});
}
compare(sample,{...DEFAULTS,population:4,min_frontline:4,min_backline_four_cost:2,min_trait_score:0});
for(const [cost,population,frontline,maxFive] of [[3,8,3,1],[2,7,2,0],[1,6,2,0]]){
 const profile=solverDefaults(cost);
 assert.deepEqual([profile.population,profile.min_target_cost,profile.min_backline_target_cost,profile.min_frontline,profile.max_four_cost,profile.max_five_cost],[population,3,1,frontline,2,maxFive]);
 const units=[[cost,1,'Tank'],[cost,1,'Tank'],[cost,4,'Marksman'],[cost,4,'Tank'],[4,1,'Tank'],[4,1,'Tank'],[4,4,'Caster'],[5,1,'Tank'],[5,4,'Marksman'],[cost===1?2:1,4,'Caster']];
 const fixture={traits:[{name:'A',breakpoints:[1]}],units:units.map(([cost,range,role],i)=>({id:'low'+i,name:'Low '+i,cost,range,role,slots:1,traits:['A']}))};
 const criteria={...profile,min_trait_score:0};
 assert(solve(fixture,criteria,{countOnly:true}).matches>0);
 compare(fixture,criteria);
}
const tierData={
 traits:[{name:'Arcanist',breakpoints:[2,4,6]},{name:'K|DA',breakpoints:[3,5,7,10,13,15,21]}],
 units:Array.from({length:4},(_,i)=>({...focused.units[0],id:'tier'+i,name:'Tier '+i,traits:['Arcanist','K|DA']}))
};
const tierConfig={...DEFAULTS,population:3,min_four_cost:0,min_frontline:0,min_backline_four_cost:0,min_trait_score:5};
const starTotals=[0,2,3,4,5,6,7,9,10,12,13,14,15,20,21,30];
const kdaPoints=[0,0,2,2,3,3,4,4,5,5,6,6,7,7,7,7];
for(const mode of ['breakpoint','active_members','all_members']){
 assert.deepEqual(starTotals.map(stars=>solverTraitPoints(tierData.traits[1],stars,mode)),kdaPoints);
}
const tierChunks=[];
assert.equal(solve(tierData,tierConfig,{onChunk:bytes=>tierChunks.push(bytes)}).histogram[5],4);
assert.equal(solve(tierData,{...tierConfig,population:2,min_trait_score:4,required_traits:{'K|DA':3},required_trait_mode:'exact_tier'}).histogram[4],6);
assert.equal(solve(tierData,{...tierConfig,population:2,min_trait_score:5,trait_bonuses:{'K|DA':1},required_traits:{'K|DA':5}}).histogram[5],6);
assert.deepEqual(filterRequiredRecords(tierData,tierChunks[0],{...tierConfig,required_traits:{'K|DA':5},required_trait_mode:'exact_tier'}),tierChunks[0]);
assert.equal(filterRequiredRecords(tierData,tierChunks[0],{...tierConfig,required_traits:{'K|DA':3},required_trait_mode:'exact_tier'}).length,0);
assert.throws(()=>prepare(data,{population:0}));assert.throws(()=>prepare(data,{extra_traits:{notAUnit:['A']}}));assert.throws(()=>prepare(data,{sona_feature_trait:'Fake'}));
for(const trait_bonuses of [{Unknown:1},{Frontman:-1},{Frontman:1.5},{Frontman:17},[],null])assert.throws(()=>prepare(data,{trait_bonuses}));
const timed=solve(data,{...DEFAULTS},{deadline:Date.now()-1});assert.equal(timed.status,'INCOMPLETE');
const html=get('dist/index.html');
assert.equal(get('index.html'),html,'Root GitHub Pages entry point must match dist');
assert(fs.existsSync(new URL('.nojekyll',root)),'Branch Pages must skip Jekyll processing');
assert.equal((html.match(/id="app-data"/g)||[]).length,1);
const capture=id=>html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'))?.[1];
const embedded=JSON.parse(capture('app-data'));assert.equal(embedded.units.length,94);assert.equal(embedded.traits.length,47);
const embeddedArt=JSON.parse(capture('art-data'));assert.equal(Object.keys(embeddedArt.units).length,94);assert.equal(Object.values(embeddedArt.units).filter(a=>a.url).length,91);
function verifyPreset(cost){
 const c=solverDefaults(cost),size=c.population+1,suffix=cost===4?'':'-'+cost,id='preset-data'+suffix;
 const bytes=zlib.gunzipSync(Buffer.from(capture(id),'base64'));
 const count=Number(html.match(new RegExp('id="'+id+'"[^>]*data-records="(\\d+)"'))?.[1]);
 assert(count>0);assert.equal(bytes.length,count*size);
 assert.deepEqual(bytes,fs.readFileSync(new URL('dist/preset'+suffix+'.bin',root)));
 const seen=new Set(),hist={};
 for(let p=0;p<bytes.length;p+=size){
  const row=bytes.subarray(p,p+size),score=row[c.population];
  assert(score>=c.min_trait_score);
  const ids=[...row.subarray(0,c.population)].filter(i=>i!==255).sort((a,b)=>a-b),key=ids.join(',');
  assert(!seen.has(key));seen.add(key);
  const team=ids.map(i=>data.units[i]),target=team.filter(u=>u.cost===cost);
  assert.equal(team.reduce((s,u)=>s+u.slots,0),c.population);
  assert.equal(new Set(team.map(u=>u.exclusive_group||u.id)).size,team.length);
  assert(target.length>=c.min_target_cost);
  assert(team.filter(u=>u.cost===4).length<=c.max_four_cost);
  assert(team.filter(u=>u.cost===5).length<=c.max_five_cost);
  assert(team.filter(u=>u.range<=c.frontline_max_range).length>=c.min_frontline);
  assert(target.filter(u=>u.range>c.frontline_max_range&&c.backline_role_keywords.some(k=>u.role.includes(k))).length>=c.min_backline_target_cost);
  const counts=new Map();
  for(const u of team)for(const trait of u.traits)counts.set(trait,(counts.get(trait)||0)+(trait==='K|DA'?2:1));
  const reference=data.traits.reduce((sum,t)=>sum+referenceTraitPoints(t,counts.get(t.name)||0,c.score_mode),0);
  assert.equal(score,reference);hist[score]=(hist[score]||0)+1;
 }
 return {bytes,count,hist};
}
const {bytes:preset,count:presetRows,hist}=verifyPreset(4);
const lowCostRows=Object.fromEntries([3,2,1].map(cost=>[cost,verifyPreset(cost).count]));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate DOM ids');
const app=get('src/app.js');for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(m[1]),'Missing element: '+m[1]);
function appFunction(name,next,context){const start=app.indexOf('function '+name+'(');assert(start>=0);const end=app.indexOf('\nfunction '+next+'(',start);assert(end>start);return new vm.Script('('+app.slice(start,end)+')').runInNewContext(context);}
const presetMatch=appFunction('isPreset','populateSelects',{solverDefaults});
assert(presetMatch({...DEFAULTS}));assert(!presetMatch({...DEFAULTS,trait_bonuses:{Frontman:1}}));assert(presetMatch({...DEFAULTS,trait_bonuses:{Frontman:0}}));
const bonusConfig={...DEFAULTS,population:2,min_four_cost:0,min_frontline:0,min_backline_four_cost:0,trait_bonuses:{A:1}};
const analyze=appFunction('analyze','traitChip',{DATA:focused,effectiveTraits,isBacklineCarry,solverTraitWeight,solverTraitPoints,traitByName:new Map(focused.traits.map((t,index)=>[t.name,{index}])),state:{config:bonusConfig}});
const displayed=analyze([0,1],bonusConfig);assert.equal(displayed.score,3);assert.equal(displayed.traits[0].count,3);assert.equal(displayed.traits[0].bonus,1);assert.equal(displayed.slots,2);
// Exercise the actual CSV exporter with an emblem-activated trait, without a browser.
let exported;
const controls=new Map();const exportState={config:bonusConfig,running:false,status:'COMPLETE',filtered:[{score:3,four:2}]};
const exportStart=app.indexOf('async function exportCsv('),exportEnd=app.indexOf('\nfunction bindEvents(',exportStart);
const exportFn=new vm.Script('('+app.slice(exportStart,exportEnd)+')').runInNewContext({state:exportState,DATA:focused,effectiveTraits,isBacklineCarry,solverTraitWeight,recordIds:()=>[0,1],fmt:String,t,traitLabel,getLanguage,unitLabel:u=>u.name,notify:()=>{},$:id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id);},Blob,setTimeout,download:(blob,name)=>{exported={blob,name};}});
await exportFn();const csvText=await exported.blob.text();const csvLines=csvText.trim().split('\r\n'),headers=csvLines[0].replace(/^\uFEFF/,'').split(','),cells=csvLines[1].split(',');
assert.equal(cells[headers.indexOf('trait_score')],'3');assert.equal(cells[headers.indexOf('population')],'2');assert.equal(cells[headers.indexOf('active_traits')],'"A:3"');assert.equal(cells[headers.indexOf('trait_bonuses')],'"A:+1"');assert.equal(exportState.exporting,false);
const expectedTranslations={'Heartsteel':'心鋼之聲','Frontman':'主唱','Classical':'古典樂','Collab':'合作','Swiftstriker':'迅捷先鋒','Hitmaker':'金曲製造機','Encore':'要不要來首安可曲','Juggernaut':'重裝戰士','Beach Pop':'海灘流行樂','Pentakill':'殺五社','Slayer':'殺戮者','Rock':'搖滾樂','Manager':'經紀人','EDM':'電子舞曲','Choreographer':'編舞者','Jazz':'爵士樂','Gu Feng':'古風','Hyperpop':'超流行','Ionic Spark':'離子火花','Prodigy':'不世之才'};
for(const [name,label]of Object.entries(expectedTranslations))assert.equal(TRAIT_ZH[name],label);
const localization=JSON.parse(fs.readFileSync(new URL('../dist/localization-source.json',import.meta.url),'utf8'));
for(const [name,a]of Object.entries(localization.traits))if(/[\u3400-\u9fff]/.test(a.name_zh||''))expectedTranslations[name]=a.name_zh;
const canonicalBefore=JSON.stringify(data);
setLanguage('zh-Hant');assert.equal(getLanguage(),'zh-Hant');
for(const trait of data.traits){assert.equal(traitLabel(trait.name),expectedTranslations[trait.name]||trait.name);assert(traitSearchText([trait.name]).includes(trait.name));if(expectedTranslations[trait.name])assert(traitSearchText([trait.name]).includes(expectedTranslations[trait.name]));}
assert.equal(t('Search criteria'),'搜尋條件');assert.equal(t('Unknown label'),'Unknown label');assert.equal(t('{n} results',{n:12}),'12 組');assert.equal(localizedStaticText(' 3 Choreographer '),' 3 編舞者 ');
const zhData={traits:[{name:'Frontman',breakpoints:[2]}],units:[{id:'a',name:'A',cost:4,range:1,slots:1,traits:['Frontman'],role:'Tank'},{id:'b',name:'B',cost:4,range:4,slots:1,traits:[],role:'Caster'}]};
const zhConfig={...bonusConfig,trait_bonuses:{Frontman:1}};let zhExport;
const zhFn=new vm.Script('('+app.slice(exportStart,exportEnd)+')').runInNewContext({state:{...exportState,config:zhConfig,filtered:[{score:2,four:2}]},DATA:zhData,effectiveTraits,isBacklineCarry,solverTraitWeight,recordIds:()=>[0,1],fmt:String,t,traitLabel,getLanguage,unitLabel:u=>u.name,notify:()=>{},$:()=>({}),Blob,setTimeout,download:(blob,name)=>{zhExport={blob,name};}});
await zhFn();const zhCsv=await zhExport.blob.text();assert(zhCsv.includes('羈絆分數'));assert(zhCsv.includes('"主唱:2"'));assert(zhCsv.includes('"主唱:+1"'));assert(zhCsv.includes('完整'));assert(zhExport.name.includes('zh-Hant'));
assert.equal(JSON.stringify(data),canonicalBefore,'Translations must not mutate solver data');
setLanguage('en');assert.equal(traitLabel('Frontman'),'Frontman');assert.equal(t('Search criteria'),'Search criteria');assert(ids.includes('language'));
// Check that changing the labels never changes canonical option values or selections.
class SelectStub{constructor(){this.options=[];this.value='';}replaceChildren(){this.options=[];this.value='';}append(option){this.options.push(option);if(this.options.length===1)this.value=option.value;}}
const selectNodes=new Map(['champion-filter','extra-unit','sona_feature_trait','extra-trait','emblem-trait','score-filter'].map(id=>[id,new SelectStub()]));
const populate=appFunction('populateSelects','applyCriteria',{DATA:data,ART:{units:{}},state:{records:[]},EMBLEM_TRAITS,t,traitLabel,getLanguage,unitLabel:u=>u.name,Option:class{constructor(text,value){this.text=text;this.value=value;}},document:{querySelectorAll:()=>[]},$:id=>selectNodes.get(id)});
populate();selectNodes.get('emblem-trait').value='Gu Feng';selectNodes.get('extra-trait').value='Prodigy';
assert.equal(selectNodes.get('emblem-trait').options.length,28);
assert.deepEqual(selectNodes.get('emblem-trait').options.map(o=>o.value).sort(),[...EMBLEM_TRAITS].sort());
assert.equal(selectNodes.get('extra-trait').options.length,47);
assert(!selectNodes.get('emblem-trait').options.some(o=>['Synthwave','Country','Producer'].includes(o.value)));
setLanguage('zh-Hant');populate();assert.equal(selectNodes.get('emblem-trait').value,'Gu Feng');assert.equal(selectNodes.get('extra-trait').value,'Prodigy');assert.equal(selectNodes.get('emblem-trait').options.find(o=>o.value==='Gu Feng').text,'古風');assert.equal(selectNodes.get('extra-trait').options.find(o=>o.value==='Prodigy').text,'不世之才');
setLanguage('en');populate();assert.equal(selectNodes.get('emblem-trait').value,'Gu Feng');assert.equal(selectNodes.get('emblem-trait').options.find(o=>o.value==='Gu Feng').text,'Gu Feng');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);new vm.Script(scripts.at(-1));
new vm.Script(capture('solver-source').replace(/^export /gm,'')+'\nself.onmessage=e=>{const {data,c}=e.data;const r=solve(data,c);self.postMessage(r)}');
assert(!html.includes('/*__'));assert(!html.includes('localhost'));
console.log(JSON.stringify({status:'PASS',reference_cases:cases,preset_rows:presetRows,low_cost_preset_rows:lowCostRows,histogram:hist,artwork_urls:91,translated_traits:Object.keys(TRAIT_ZH).length,locales:['zh-Hant','en'],checks:'Independent brute-force sets and scores; emblem bonuses; every preset record; DOM selectors; script syntax; exact supplied translations; bilingual lookup; localized CSV; canonical data and selections preserved across language switches'},null,2));

// Info metadata and display-only localization must preserve the full solver roster.
const info=JSON.parse(capture('info-data'));
assert.equal(Object.keys(info.units).length,data.units.length);
for(const u of data.units){const a=info.units[u.id];assert(a);assert(a.ability);assert(a.description);assert(!/DA_Role_|Image:|†/.test(a.description));assert(a.mana===null||/^\d+\/\d+$/.test(a.mana),'Invalid mana for '+u.name);if(u.unlock)assert(a.unlock,'Missing unlock for '+u.name);}
const infoControls=new Map(['info-query','info-cost','info-trait','info-unlock'].map(id=>[id,{value:''}]));
const helpers=new vm.Script(get('src/info.js')+';({unitLabel,unitSearchText,abilitySummary,infoUnits})').runInNewContext({DATA:data,INFO:info,getLanguage,traitSearchText,$:id=>infoControls.get(id)});
setLanguage('zh-Hant');assert.equal(helpers.unitLabel(data.units[0]),'伊莉絲');assert.equal(helpers.unitLabel(data.units.find(u=>u.name==='Leona')),'雷歐娜');
assert.equal(helpers.abilitySummary(data.units[1]),info.units.u1.full_description_zh);
assert.equal(helpers.abilitySummary(data.units[88]),info.units.u88.full_description);
assert.equal(info.units.u88.full_description_zh,null,'An outdated translation falls back to current English');
assert(helpers.unitSearchText(data.units[0]).includes('Elise'));assert(helpers.unitSearchText(data.units[0]).includes('伊莉絲'));
assert.equal(helpers.infoUnits().length,94);infoControls.get('info-query').value='伊莉絲';assert.equal(helpers.infoUnits()[0].id,'u0');infoControls.get('info-query').value='Elise';assert.equal(helpers.infoUnits()[0].id,'u0');
infoControls.get('info-query').value='';infoControls.get('info-cost').value='4';infoControls.get('info-trait').value='K|DA';const subset=helpers.infoUnits();assert(subset.length);assert(subset.every(u=>u.cost===4&&u.traits.includes('K|DA')));
infoControls.get('info-unlock').value='locked';assert(helpers.infoUnits().every(u=>info.units[u.id].full_unlock.length>0));
infoControls.get('info-cost').value='';infoControls.get('info-trait').value='';infoControls.get('info-unlock').value='';const all=helpers.infoUnits();assert(all.every((u,i)=>!i||all[i-1].cost>=u.cost));
setLanguage('en');assert.equal(helpers.unitLabel(data.units[0]),'Elise');assert.equal(helpers.abilitySummary(data.units[0]),info.units.u0.full_description);
assert.equal(JSON.stringify(data),canonicalBefore);assert.equal(fs.readFileSync(new URL('index.html',root),'utf8'),html);
console.log(JSON.stringify({info:'PASS',champions:all.length,translated_names:Object.values(info.units).filter(a=>a.name_zh).length,translated_summaries:Object.values(info.units).filter(a=>a.full_description_zh).length,bilingual_search:true,combined_filters:true,cost_descending:true}));

const itemData=JSON.parse(capture('item-data'));
assert.equal(itemData.mode,'PBE');assert.equal(itemData.patch,'19.1');assert.equal(itemData.set,'TFTSet19');assert.equal(itemData.items.length,144);
const itemIds=new Set(itemData.items.map(item=>item.id));assert.equal(itemIds.size,144);
for(const item of itemData.items){assert(item.source.endsWith('?set=TFTSet19'));assert(item.image.endsWith(item.id.toLowerCase()+'.png'));assert(!/18_Emblem|Potion18/.test(item.id));}
assert(itemIds.has('DA_IonicSpark19_Emblem'));assert(itemIds.has('DA_TrueDamage19_Emblem'));assert(!itemIds.has('DA_18_EmblemCoven'));
let missing=0,unlocks=0;
for(const u of data.units){const a=info.units[u.id];assert(a.full_description.length>30);assert(/^\d+\/\d+$/.test(a.full_mana));assert.equal(a.source_missing_values,a.full_description.includes('[unavailable]'));assert(Array.isArray(a.full_unlock));assert(Array.isArray(a.recommended_items));assert(a.recommended_items.length<=5);for(const id of a.recommended_items)assert(itemIds.has(id));missing+=+a.source_missing_values;unlocks+=+(a.full_unlock.length>0);}
assert.equal(missing,11);assert.equal(unlocks,32);assert(info.units.u0.full_description.includes('280/330/400'));assert(info.units.u49.full_description.includes('235/350/2000'));assert(info.units.u88.full_description.includes('30%/30%/100% Omnivamp'));
assert.equal(info.units.u30.full_mana,'0/55');assert.equal(info.units.u59.full_mana,'0/25');assert.equal(info.units.u83.full_mana,'40/100');
assert.equal(data.units[1].range,4);assert(isBacklineCarry(data.units[1],DEFAULTS));
assert.equal(data.units[52].range,4);assert(data.units[91].traits.includes('Choreographer'));
assert(!get('src/info.js').includes("['Population',u.slots]"));assert(!get('src/info.js').includes("t('{n} slots'"));assert(get('src/info.js').includes('infoUnlockBlock(u),recommendedEquipment(u)'));assert(get('src/info.js').includes('slot<5'));
console.log(JSON.stringify({full_skills:94,source_placeholders:missing,visible_unlock_conditions:unlocks,equipment_catalog:itemData.items.length,equipment_mode:itemData.mode,equipment_patch:itemData.patch,reserved_slots:5,population_labels_in_info:false}));

// Requirements are independent of whether unique traits contribute to score.
for(const required_trait_mode of ['at_least','exact_tier'])for(const include_unique_traits of [true,false])for(const n of [0,1,3,5]){
 compare(focused,{...DEFAULTS,population:2,min_four_cost:0,min_frontline:0,min_backline_four_cost:0,min_trait_score:0,trait_bonuses:{A:n},required_traits:{A:3},required_trait_mode,include_unique_traits});
}
for(const required_traits of [{Unknown:2},{Classical:3},{Classical:-1},{Classical:4.5},[],null])assert.throws(()=>prepare(data,{required_traits}));
assert.throws(()=>prepare(data,{required_trait_mode:'bad'}));
assert.equal(filterRequiredRecords(data,preset,DEFAULTS),preset,'Unconstrained cache must be reused');
const requiredCounts={};
for(const required_trait_mode of ['at_least','exact_tier'])for(const required_traits of [{Classical:4},{Classical:4,Frontman:2}]){
 const cfg={...DEFAULTS,required_traits,required_trait_mode},expected=[];
 for(let offset=0;offset<preset.length;offset+=9){const team=[...preset.subarray(offset,offset+8)].filter(i=>i!==255).map(i=>data.units[i]);let accept=true;
  for(const [name,min]of Object.entries(required_traits)){const count=team.filter(u=>u.traits.includes(name)).length;const active=Math.max(0,...data.traits.find(t=>t.name===name).breakpoints.filter(n=>n<=count));if(required_trait_mode==='exact_tier'?active!==min:active<min)accept=false;}
  if(accept)expected.push(...preset.subarray(offset,offset+9));
 }
 const got=filterRequiredRecords(data,preset,cfg);assert.deepEqual([...got],expected);requiredCounts[required_trait_mode+JSON.stringify(required_traits)]=got.length/9;
}
assert(requiredCounts['at_least{"Classical":4}']>0);
assert(presetMatch({...DEFAULTS,required_traits:{Classical:4}}),'Trait-only constraints can filter the complete cache');
console.log(JSON.stringify({required_traits:'PASS',independent_cases:cases,preset_subsets:requiredCounts}));
