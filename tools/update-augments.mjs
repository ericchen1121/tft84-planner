import fs from 'node:fs';
import {buildAugmentSnapshot} from './augment-source.mjs';
const folder=process.argv[2];
async function lookup(lang){if(folder)return JSON.parse(fs.readFileSync(folder+'/'+lang+'.json','utf8'));const r=await fetch('https://data.metatft.com/lookups/TFTSet19_pbe_'+lang+'.json');if(!r.ok)throw Error('Lookup HTTP '+r.status);return r.json();}
const [en,zh]=await Promise.all([lookup('en_us'),lookup('zh_tw')]);
const snapshot=buildAugmentSnapshot(en,zh,new Date().toISOString().slice(0,10));
fs.writeFileSync(new URL('../dist/augments.json',import.meta.url),JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({augments:snapshot.augments.length,chinese_names:snapshot.augments.filter(a=>a.name_zh).length,chinese_descriptions:snapshot.augments.filter(a=>a.description_zh).length,missing:snapshot.augments.filter(a=>a.missing_values.length||a.missing_values_zh.length).map(a=>a.id),dynamic:snapshot.augments.filter(a=>a.dynamic).map(a=>a.id)}));
