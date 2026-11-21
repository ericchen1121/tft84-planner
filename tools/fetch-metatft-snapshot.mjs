import fs from 'node:fs';
import {rankRecommendations,unitKey} from './metatft-recommendations.mjs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const data=read('dist/units.json'),codes=read('dist/team-codes.json'),previous=read('dist/item-recommendations.json');
const cache=process.argv[2]; // Optional previously fetched source folder for an offline rebuild.
const source='https://data.metatft.com/lookups/TFTSet19_pbe_en_us.json';
async function json(url,file){if(cache)return JSON.parse(fs.readFileSync(cache+'/'+file,'utf8'));const r=await fetch(url);if(!r.ok)throw Error(url+' HTTP '+r.status);return r.json();}
const en=await json(source,'lookup_en.json'),zh=await json(source.replace('en_us','zh_tw'),'lookup_zh.json');
if(en._metadata.set!=='TFTSet19'||zh._metadata.set!=='TFTSet19')throw Error('Unexpected lookup set');
const date=new Date().toISOString().slice(0,10),allowed=new Set(previous.craftable_items);
const bindings={...codes.units,...Object.fromEntries(codes.unavailable.map(u=>[u.id,u]))};
const snapshot={...previous,snapshot_date:date,lookup_release:en._metadata.release,units:{},notes:'PBE / 19.1, last 3 days, artifact_count=0. Top five normal items and top five all-normal builds ranked with MetaTFT unit-detail tier scoring. First-copy items only. Five displayed items are alternatives, not a five-item build. Source requests and ranked counts are retained per champion.'};
const localization={source:source.replace('en_us','zh_tw'),snapshot_date:date,metadata:zh._metadata,units:{},traits:{}};
let index=0;
async function worker(){while(index<data.units.length){const u=data.units[index++],binding=bindings[u.id];
 const api=binding.apiNames.find(n=>n.startsWith('DA_'))||binding.apiNames[0];
 const e=en.units.find(x=>x.apiName===api),z=zh.units.find(x=>x.apiName===api);
 if(!e||!z)throw Error('Missing exact identity '+u.name);
 localization.units[u.id]={apiName:api,name:e.name,name_zh:z.name};
 const urls={},raw={};
 for(const endpoint of ['unit_detail_items','unit_detail_overall']){
  const url=new URL('https://api-hc.metatft.com/tft-stat-api/'+endpoint);
  for(const [k,v]of Object.entries({queue:'pbe',patch:'19.1',days:'3',unit:api,...(endpoint==='unit_detail_items'?{artifact_count:'0'}:{})}))url.searchParams.set(k,v);
  const a=await json(url.href,'stats/'+u.id+'-'+endpoint+'.json');
  if(a.error||a.unit!==api||a.tft_set!=='TFTSet19'||a.queue_id!=='pbe')throw Error('Wrong stats for '+u.name);
  if(endpoint==='unit_detail_items'&&[...(a.item_games||[]),...(a.build_games||[])].some(g=>g.patch!=='19.1'))throw Error('Wrong patch '+u.name);
  urls[endpoint]=url.href;raw[endpoint]=a;
 }
 snapshot.units[unitKey(u)]={apiName:api,unit_id:u.id,request_urls:urls,updated:raw.unit_detail_items.updated,...rankRecommendations(raw.unit_detail_overall,raw.unit_detail_items,allowed)};
}}
await Promise.all(Array.from({length:4},worker));
snapshot.units=Object.fromEntries(data.units.map(u=>[unitKey(u),snapshot.units[unitKey(u)]]));
for(const trait of data.traits){const e=en.traits.find(x=>x.name===trait.name||x.name.replaceAll('/','|')===trait.name);if(!e)throw Error('Missing trait '+trait.name);const z=zh.traits.find(x=>x.apiName===e.apiName);localization.traits[trait.name]={apiName:e.apiName,name_zh:z?.name||null};}
const secondary_source='https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/tftchampions-teamplanner.json';
const secondary=await json(secondary_source,'riot_planner.json');
const audit={source,snapshot_date:date,metadata:en._metadata,units:{},conflicts:[],secondary_source,secondary_sets:Object.keys(secondary),secondary_result:secondary.TFTSet19?'TFTSet19 mapping is available; review before changing export IDs.':'No TFTSet19 mapping was available in the checked PBE planner dataset.'};
const byCode=new Map();
for(const u of data.units){const rows=en.units.filter(x=>bindings[u.id].apiNames.includes(x.apiName));audit.units[u.id]={name:u.name,candidates:rows.map(x=>({apiName:x.apiName,code:x.code}))};for(const code of new Set(rows.map(x=>x.code).filter(Boolean))){if(!byCode.has(code))byCode.set(code,[]);byCode.get(code).push(u.id);}}
audit.conflicts=[...byCode].filter(([,ids])=>ids.length>1).map(([code,ids])=>({code,ids,names:ids.map(id=>data.units.find(u=>u.id===id).name)}));
// Never silently rewrite a mapping when a PBE source changes or contradicts itself.
for(const [id,u]of Object.entries(codes.units))if(audit.units[id].candidates.some(x=>x.code!==u.code))throw Error('Planner mapping changed: review '+u.name);
const omitted=codes.unavailable.map(u=>u.id).sort(),conflicting=[...new Set(audit.conflicts.flatMap(c=>c.ids))].sort();
if(JSON.stringify(omitted)!==JSON.stringify(conflicting))throw Error('Planner conflicts changed; review the omitted champions before publishing.');
codes.last_verified=date;codes.audit='dist/team-code-audit.json';
for(const [path,value]of Object.entries({'dist/item-recommendations.json':snapshot,'dist/localization-source.json':localization,'dist/team-code-audit.json':audit,'dist/team-codes.json':codes}))fs.writeFileSync(new URL(path,root),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({recommendation_units:Object.keys(snapshot.units).length,planner_conflicts:audit.conflicts}));
