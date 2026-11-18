import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {prepare,solve,DEFAULTS,effectiveTraits,EMBLEM_TRAITS} from '../src/solver.mjs';
import {TRAIT_ZH,t,traitLabel,traitSearchText,setLanguage,getLanguage,localizedStaticText} from '../src/i18n.mjs';
setLanguage('en');
const data=JSON.parse(fs.readFileSync(new URL('../dist/units.json',import.meta.url)));
const root=new URL('../',import.meta.url);
const get=p=>fs.readFileSync(new URL(p,root),'utf8');
function brute(data,c){
 const pool=data.units.filter(u=>!c.exclude_unit_ids.includes(u.id)&&(c.include_seven_cost||u.cost!==7));
 const members=new Map(data.traits.map(t=>[t.name,data.units.filter(u=>effectiveTraits(u,c).includes(t.name)).length]));
 const found=new Map();
 function check(team){
  if(team.reduce((s,u)=>s+u.slots,0)!==c.population)return;
  if(new Set(team.map(u=>u.exclusive_group||u.id)).size!==team.length)return;
  if(team.filter(u=>u.cost===4).length<c.min_four_cost||team.filter(u=>u.cost===5).length>c.max_five_cost)return;
  if(team.filter(u=>u.range<=c.frontline_max_range).length<c.min_frontline)return;
  if(team.filter(u=>u.cost===4&&u.range>c.frontline_max_range&&c.backline_role_keywords.some(k=>u.role.includes(k))).length<c.min_backline_four_cost)return;
  let score=0;
  for(const t of data.traits){if(!c.include_unique_traits&&members.get(t.name)<=1)continue;
   const n=team.filter(u=>effectiveTraits(u,c).includes(t.name)).length+(c.trait_bonuses?.[t.name]||0);
   if(c.score_mode==='all_members')score+=n;
   else if(n>=Math.min(...t.breakpoints))score+=c.score_mode==='active_members'?n:Math.max(...t.breakpoints.filter(p=>p<=n));
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
const compressed=Buffer.from(capture('preset-data'),'base64');const preset=zlib.gunzipSync(compressed);assert.equal(preset.length,68766*9);
assert.deepEqual(preset,fs.readFileSync(new URL('dist/preset.bin',root)));
const seen=new Set(),hist={};
for(let p=0;p<preset.length;p+=9){const row=preset.subarray(p,p+9);assert(row[8]>=16);const ids=[...row.subarray(0,8)].filter(i=>i!==255).sort((a,b)=>a-b);const key=ids.join(',');assert(!seen.has(key));seen.add(key);const team=ids.map(i=>data.units[i]);assert.equal(team.reduce((s,u)=>s+u.slots,0),8);assert(team.filter(u=>u.cost===4).length>=3);assert(team.filter(u=>u.cost===5).length<=1);assert(team.filter(u=>u.range<=2).length>=5);assert(team.filter(u=>u.cost===4&&u.range>2&&DEFAULTS.backline_role_keywords.some(k=>u.role.includes(k))).length>=2);const counts=new Map();for(const u of team)for(const t of u.traits)counts.set(t,(counts.get(t)||0)+1);const score=data.traits.reduce((s,t)=>s+((counts.get(t.name)||0)>=Math.min(...t.breakpoints)?counts.get(t.name):0),0);assert.equal(score,row[8]);hist[score]=(hist[score]||0)+1;}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate DOM ids');
const app=get('src/app.js');for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(m[1]),'Missing element: '+m[1]);
function appFunction(name,next,context){const start=app.indexOf('function '+name+'(');assert(start>=0);const end=app.indexOf('\nfunction '+next+'(',start);assert(end>start);return new vm.Script('('+app.slice(start,end)+')').runInNewContext(context);}
const presetMatch=appFunction('isPreset','populateSelects',{DEFAULTS});
assert(presetMatch({...DEFAULTS}));assert(!presetMatch({...DEFAULTS,trait_bonuses:{Frontman:1}}));assert(presetMatch({...DEFAULTS,trait_bonuses:{Frontman:0}}));
const bonusConfig={...DEFAULTS,population:2,min_four_cost:0,min_frontline:0,min_backline_four_cost:0,trait_bonuses:{A:1}};
const analyze=appFunction('analyze','traitChip',{DATA:focused,effectiveTraits,traitByName:new Map(focused.traits.map((t,index)=>[t.name,{index}])),state:{config:bonusConfig}});
const displayed=analyze([0,1],bonusConfig);assert.equal(displayed.score,3);assert.equal(displayed.traits[0].count,3);assert.equal(displayed.traits[0].bonus,1);assert.equal(displayed.slots,2);
// Exercise the actual CSV exporter with an emblem-activated trait, without a browser.
let exported;
const controls=new Map();const exportState={config:bonusConfig,running:false,status:'COMPLETE',filtered:[{score:3,four:2}]};
const exportStart=app.indexOf('async function exportCsv('),exportEnd=app.indexOf('\nfunction bindEvents(',exportStart);
const exportFn=new vm.Script('('+app.slice(exportStart,exportEnd)+')').runInNewContext({state:exportState,DATA:focused,effectiveTraits,recordIds:()=>[0,1],fmt:String,t,traitLabel,getLanguage,notify:()=>{},$:id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id);},Blob,setTimeout,download:(blob,name)=>{exported={blob,name};}});
await exportFn();const csvText=await exported.blob.text();const csvLines=csvText.trim().split('\r\n'),headers=csvLines[0].replace(/^\uFEFF/,'').split(','),cells=csvLines[1].split(',');
assert.equal(cells[headers.indexOf('trait_score')],'3');assert.equal(cells[headers.indexOf('population')],'2');assert.equal(cells[headers.indexOf('active_traits')],'"A:3"');assert.equal(cells[headers.indexOf('trait_bonuses')],'"A:+1"');assert.equal(exportState.exporting,false);
const expectedTranslations={'Heartsteel':'心鋼之聲','Frontman':'主唱','Classical':'古典樂','Collab':'合作','Swiftstriker':'迅捷先鋒','Hitmaker':'金曲製造機','Encore':'要不要來首安可曲','Juggernaut':'重裝戰士','Beach Pop':'海灘流行樂','Pentakill':'殺五社','Slayer':'殺戮者','Rock':'搖滾樂','Manager':'經紀人','EDM':'電子舞曲','Choreographer':'編舞者','Jazz':'爵士樂','Gu Feng':'國風','Hyperpop':'超能流行','Ionic Spark':'離子火花','Prodigy':'不世之才'};
assert.deepEqual(TRAIT_ZH,expectedTranslations);
const canonicalBefore=JSON.stringify(data);
setLanguage('zh-Hant');assert.equal(getLanguage(),'zh-Hant');
for(const trait of data.traits){assert.equal(traitLabel(trait.name),expectedTranslations[trait.name]||trait.name);assert(traitSearchText([trait.name]).includes(trait.name));if(expectedTranslations[trait.name])assert(traitSearchText([trait.name]).includes(expectedTranslations[trait.name]));}
assert.equal(t('Search criteria'),'搜尋條件');assert.equal(t('Unknown label'),'Unknown label');assert.equal(t('{n} results',{n:12}),'12 組');assert.equal(localizedStaticText(' 3 Choreographer '),' 3 編舞者 ');
const zhData={traits:[{name:'Frontman',breakpoints:[2]}],units:[{id:'a',name:'A',cost:4,range:1,slots:1,traits:['Frontman'],role:'Tank'},{id:'b',name:'B',cost:4,range:4,slots:1,traits:[],role:'Caster'}]};
const zhConfig={...bonusConfig,trait_bonuses:{Frontman:1}};let zhExport;
const zhFn=new vm.Script('('+app.slice(exportStart,exportEnd)+')').runInNewContext({state:{...exportState,config:zhConfig,filtered:[{score:2,four:2}]},DATA:zhData,effectiveTraits,recordIds:()=>[0,1],fmt:String,t,traitLabel,getLanguage,notify:()=>{},$:()=>({}),Blob,setTimeout,download:(blob,name)=>{zhExport={blob,name};}});
await zhFn();const zhCsv=await zhExport.blob.text();assert(zhCsv.includes('羈絆分數'));assert(zhCsv.includes('"主唱:2"'));assert(zhCsv.includes('"主唱:+1"'));assert(zhCsv.includes('完整'));assert(zhExport.name.includes('zh-Hant'));
assert.equal(JSON.stringify(data),canonicalBefore,'Translations must not mutate solver data');
setLanguage('en');assert.equal(traitLabel('Frontman'),'Frontman');assert.equal(t('Search criteria'),'Search criteria');assert(ids.includes('language'));
// Check that changing the labels never changes canonical option values or selections.
class SelectStub{constructor(){this.options=[];this.value='';}replaceChildren(){this.options=[];this.value='';}append(option){this.options.push(option);if(this.options.length===1)this.value=option.value;}}
const selectNodes=new Map(['champion-filter','extra-unit','sona_feature_trait','extra-trait','emblem-trait','score-filter'].map(id=>[id,new SelectStub()]));
const populate=appFunction('populateSelects','portrait',{DATA:data,ART:{units:{}},state:{records:[]},EMBLEM_TRAITS,t,traitLabel,getLanguage,Option:class{constructor(text,value){this.text=text;this.value=value;}},document:{querySelectorAll:()=>[]},$:id=>selectNodes.get(id)});
populate();selectNodes.get('emblem-trait').value='Gu Feng';selectNodes.get('extra-trait').value='Prodigy';
assert.equal(selectNodes.get('emblem-trait').options.length,28);
assert.deepEqual(selectNodes.get('emblem-trait').options.map(o=>o.value).sort(),[...EMBLEM_TRAITS].sort());
assert.equal(selectNodes.get('extra-trait').options.length,47);
assert(!selectNodes.get('emblem-trait').options.some(o=>['Synthwave','Country','Producer'].includes(o.value)));
setLanguage('zh-Hant');populate();assert.equal(selectNodes.get('emblem-trait').value,'Gu Feng');assert.equal(selectNodes.get('extra-trait').value,'Prodigy');assert.equal(selectNodes.get('emblem-trait').options.find(o=>o.value==='Gu Feng').text,'國風');assert.equal(selectNodes.get('extra-trait').options.find(o=>o.value==='Prodigy').text,'不世之才');
setLanguage('en');populate();assert.equal(selectNodes.get('emblem-trait').value,'Gu Feng');assert.equal(selectNodes.get('emblem-trait').options.find(o=>o.value==='Gu Feng').text,'Gu Feng');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);new vm.Script(scripts.at(-1));
new vm.Script(capture('solver-source').replace(/^export /gm,'')+'\nself.onmessage=e=>{const {data,c}=e.data;const r=solve(data,c);self.postMessage(r)}');
assert(!html.includes('/*__'));assert(!html.includes('localhost'));
console.log(JSON.stringify({status:'PASS',reference_cases:cases,preset_rows:seen.size,histogram:hist,artwork_urls:91,translated_traits:Object.keys(TRAIT_ZH).length,locales:['zh-Hant','en'],checks:'Independent brute-force sets and scores; emblem bonuses; every preset record; DOM selectors; script syntax; exact supplied translations; bilingual lookup; localized CSV; canonical data and selections preserved across language switches'},null,2));
