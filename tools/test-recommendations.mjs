import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const info=read('dist/info.json'),data=read('dist/units.json'),items=read('dist/items.json'),snapshot=read('dist/item-recommendations.json');
assert.equal(snapshot.mode,'PBE');assert.equal(snapshot.patch,'19.1');assert.equal(snapshot.set,'TFTSet19');
assert.equal(Object.keys(snapshot.units).length,94);assert.equal(snapshot.craftable_items.length,36);
const allowed=new Set(snapshot.craftable_items),catalog=new Set(items.items.map(x=>x.id));
for(const id of allowed){assert(catalog.has(id));assert(!/Artifact|Radiant|Emblem|Component|Tactician|Heavenscale|Chalice|Zekes|Randuins/.test(id));}
const mana=new Set(['DA_SpearOfShojin','DA_BlueBuff','DA_AdaptiveHelm']);
let count=0;
for(const u of data.units){const a=info.units[u.id],list=a.recommended_items;
 assert.equal(new Set(list).size,list.length,u.name+' duplicate item');
 if(!list.length){assert.equal(snapshot.units[Object.keys(snapshot.units).find(key=>snapshot.units[key].unit_id===u.id)]?.popular_items.length,0);assert.equal(a.recommendation_status,'no-pbe-data');continue;}
 count++;assert(list.length>=3&&list.length<=5,u.name+' source-backed alternatives');
 const key=a.recommendation_source.split('/units/')[1].split('?')[0],source=snapshot.units[key];assert(source,u.name+' source mapping');
 assert(a.recommendation_source.endsWith('?set=TFTSet19'));
 for(const [index,id]of list.entries()){
  assert(allowed.has(id),u.name+' noncraftable '+id);
  assert([...source.popular_items,...source.build_items].includes(id),u.name+' unsupported recommendation');
  if((/Caster/.test(u.role)||u.name==='Sona')&&mana.has(id))assert(index<3,u.name+' mana engine outside first three');
  if(u.range>2&&(u.role.includes('Marksman')||u.role.includes('Attack'))&&['DA_GuinsoosRageblade','DA_RedBuff'].includes(id))assert(index<3,u.name+' ranged core outside first three');
 }
}
assert.equal(count,94);
assert(info.units.u49.recommended_items.length,'Ahri must use DA_19_Ahri stats');
assert(info.units.u31.recommended_items.length,'Seraphine must use DA_Seraphine19_Indie stats');
console.log(JSON.stringify({recommendations:'PASS',units:count,missing:[],craftable_items:allowed.size,unique:true,source_backed:true,backline_core_first_three:true}));
