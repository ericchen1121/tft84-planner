import fs from 'node:fs';
import {buildEquipmentSnapshot} from './equipment-source.mjs';
const folder=process.argv[2];
async function lookup(lang){if(folder)return JSON.parse(fs.readFileSync(folder+'/'+lang+'.json','utf8'));const r=await fetch('https://data.metatft.com/lookups/TFTSet19_pbe_'+lang+'.json');if(!r.ok)throw Error('Lookup HTTP '+r.status);return r.json();}
const [en,zh]=await Promise.all([lookup('en_us'),lookup('zh_tw')]),snapshot=buildEquipmentSnapshot(en,zh,new Date().toISOString().slice(0,10));
fs.writeFileSync(new URL('../dist/equipment.json',import.meta.url),JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({items:snapshot.items.length,categories:Object.fromEntries([...new Set(snapshot.items.map(a=>a.category))].map(k=>[k,snapshot.items.filter(a=>a.category===k).length])),recipes:snapshot.items.filter(a=>a.recipe.length).length,chinese_names:snapshot.items.filter(a=>a.name_zh).length,missing:snapshot.items.filter(a=>a.missing_values.length).map(a=>a.id),conflicting:snapshot.items.filter(a=>a.conflicting_values.length).map(a=>a.id)}));
