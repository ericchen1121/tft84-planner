import fs from 'node:fs';
import {unitKey} from './metatft-recommendations.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const snapshot=read('dist/item-recommendations.json'),info=read('dist/info.json'),data=read('dist/units.json');
const allowed=new Set(snapshot.craftable_items),mana=['DA_SpearOfShojin','DA_BlueBuff','DA_AdaptiveHelm'];
const key=unitKey;
for(const u of data.units){
 const source=snapshot.units[key(u)],a=info.units[u.id];
 a.recommendation_source=source?'https://www.metatft.com/units/'+key(u)+'?set=TFTSet19':null;
 a.recommendation_status=source?.popular_items.length?'available':'no-pbe-data';
 if(!source?.popular_items.length){a.recommended_items=[];continue;}
 const pool=[...new Set([...source.popular_items,...source.build_items])].filter(id=>allowed.has(id));
 const caster=/Caster/.test(u.role)||u.name==='Sona',ranged=u.range>2;
 // Reserve a mana engine for casters; bow / burn cores lead ranged attackers.
 // Promote only items actually observed on this unit's source page.
 const engine=caster?pool.find(id=>mana.includes(id)):null;
 const core=[...(engine?[engine]:[]),...(ranged&&(u.role.includes('Marksman')||u.role.includes('Attack'))?['DA_GuinsoosRageblade','DA_RedBuff']:[])].filter(id=>pool.includes(id));
 a.recommended_items=[...new Set([...core,...pool.filter(id=>!caster||!mana.includes(id)||id===engine)])].slice(0,5);
}
info.recommendations={source:snapshot.source,mode:snapshot.mode,patch:snapshot.patch,set:snapshot.set,snapshot_date:snapshot.snapshot_date,window:snapshot.window};
if(!info.sources.includes(snapshot.source))info.sources.push(snapshot.source);
info.notes=info.notes.replace(/Recommendation slots are reserved,[^.]*\./,'').replace(/ Recommended items use the PBE[^]*$/,'')+` Recommended items use the PBE / ${snapshot.patch} snapshot dated ${snapshot.snapshot_date}; only normal craftable items, with source-listed role-specific core items promoted. One source-listed mana engine is shown per caster. Missing units stay empty.`;
fs.writeFileSync(new URL('../dist/info.json',import.meta.url),JSON.stringify(info,null,2)+'\n');
console.log('Recommendations:',data.units.filter(u=>info.units[u.id].recommended_items.length).length,'/',data.units.length);
