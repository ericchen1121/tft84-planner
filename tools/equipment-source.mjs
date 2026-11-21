import {resolveAugmentText} from './augment-source.mjs';
const han=s=>/[\u3400-\u9fff]/.test(s||'');
const attributes=text=>Object.fromEntries([...text.matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1].toLowerCase(),m[2]]));
export function equipmentCategory(a){
 const tags=new Set([...(a.tags||[]),...(a.itemTags||[])]);
 for(const [category,tag]of [['radiant','Item.Equippable.Item.Radiant'],['artifact','Item.Equippable.Item.Artifact'],['emblem','Emblem'],['component','Component'],['support','Item.Equippable.Item.Support']])if(tags.has(tag)||tags.has('Item.Equippable.Item.'+category[0].toUpperCase()+category.slice(1)))return category;
 return tags.has('Item.Equippable.Item.Craftable')&&!tags.has('Item.Equippable.Item.Tacticians')?'normal':'other';
}
export function resolveEquipmentText(text,source){
 let dynamic=false;
 const prepared=String(text||'').replace(/<TFTAttribute\b([^>]*)\/?\s*>/gi,(_,raw)=>{
  const attrs=attributes(raw),id=attrs.attributeid;
  const values=source.attributeValues?.[id]||source.attributeCalcs?.[id]?.values;
  if(Array.isArray(values)&&values.length&&values.every(Number.isFinite)){
   const percent=(attrs.format||'').toLowerCase()==='percent';const precision=attrs.precision===undefined?2:Math.max(0,Math.min(6,Number(attrs.precision)||0));
   return [...new Set(values.map(n=>String(Number((percent?n*100:n).toFixed(precision)))+(percent?'%':'')))].join('/');
  }
  if(attrs.fallbackrow)return '<TFTCurveTable row="'+attrs.fallbackrow+'"'+(attrs.format?' format="'+attrs.format+'"':'')+'/>';
  dynamic=true;return '[current game value]';
 }).replace(/\{(?:ItemTags|Set19|Augment)\.[^}]+\}/g,()=>{dynamic=true;return '[current game value]';});
 const resolved=resolveAugmentText(prepared,source);return {...resolved,dynamic:resolved.dynamic||dynamic};
}
export function buildEquipmentSnapshot(en,zh,date){
 if(en._metadata?.set!=='TFTSet19'||zh._metadata?.set!=='TFTSet19'||en._metadata.coreHash!==zh._metadata.coreHash)throw Error('Equipment source set/release mismatch');
 const ids=new Set(en.items.map(a=>a.apiName)),byZh=new Map(zh.items.map(a=>[a.apiName,a]));if(ids.size!==en.items.length||ids.size<140)throw Error('Invalid item roster');
 const keys={health:'Health',mr:'Magic resist',manaregen:'Mana regeneration',ap:'Ability power',armor:'Armor',ad:'Attack damage',as:'Attack speed',omnivamp:'Omnivamp',critchance:'Critical strike chance',damageamp:'Damage amplification',dura:'Durability',mana:'Mana'};
 const items=en.items.map(a=>{
  const z=byZh.get(a.apiName),english=resolveEquipmentText(a.desc,a),chinese=han(z?.desc)?resolveEquipmentText(z.desc,a):null,recipe=a.composition||[];
  if(recipe.length&&(recipe.length!==2||recipe.some(id=>!ids.has(id))))throw Error('Invalid recipe '+a.apiName);
  const stats=[...(a.statLine||'').matchAll(/<TFTCurveTable\b([^>]*)\/?\s*>/gi)].map(m=>{const attrs=attributes(m[1]),key=(attrs.icon||'').replace(/^icon\./i,'').toLowerCase();if(!keys[key])throw Error('Unknown stat '+attrs.icon);return {key,label:keys[key],value:resolveEquipmentText(m[0],a).text};});
  return {id:a.apiName,name:a.name,name_zh:han(z?.name)?z.name:null,description:english.text,description_zh:chinese?.text||null,category:equipmentCategory(a),recipe,stats,image:'https://cdn.metatft.com/file/metatft/items/'+a.apiName.toLowerCase()+'.png',unique:Boolean(a.unique),from:ids.has(a.from)?a.from:null,upgrade:ids.has(a.upgrade)?a.upgrade:null,traits:(a.associatedTraits||[]).map(id=>{const t=en.traits.find(t=>t.apiName===id),z=zh.traits.find(t=>t.apiName===id);return t?{name:t.name,name_zh:han(z?.name)?z.name:null}:null;}).filter(Boolean),missing_values:[...new Set([...english.missing,...(chinese?.missing||[])])],conflicting_values:[...new Set([...english.conflicts,...(chinese?.conflicts||[])])],dynamic:english.dynamic||Boolean(chinese?.dynamic),source_data:{description:a.desc,description_zh:z?.desc||null,statLine:a.statLine,composition:recipe,tags:a.tags,curveValues:a.curveValues,curveTable:a.curveTable,attributeValues:a.attributeValues,attributeCalcs:a.attributeCalcs}};
 });
 return {set:'TFTSet19',mode:'PBE',patch:'19.1',snapshot_date:date,source:'https://www.metatft.com/items?set=TFTSet19',metadata:en._metadata,lookups:['https://data.metatft.com/lookups/TFTSet19_pbe_en_us.json','https://data.metatft.com/lookups/TFTSet19_pbe_zh_tw.json'],notes:'All source item entries are retained. Categories follow source item tags. Only explicit two-component compositions are recipes; radiant from/upgrade links are separate. Traditional Chinese falls back to English field by field. Dynamic and unconfirmed values are explicit.',items};
}
