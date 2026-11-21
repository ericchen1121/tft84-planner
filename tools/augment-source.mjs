const han=value=>/[\u3400-\u9fff]/.test(value||'');
const decode=text=>text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,x=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[x]));
export function resolveAugmentText(text,source){
 const missing=new Set(),conflicts=new Set();let dynamic=false;
 const result=String(text||'').replace(/<TFTCurveTable\b([^>]*)\/?\s*>/gi,(_,attrs)=>{
  const attributes=Object.fromEntries([...attrs.matchAll(/([\w]+)="([^"]*)"/g)].map(m=>[m[1].toLowerCase(),m[2]]));
  const row=attributes.row,table={...source.curveTable,...source.curveValues};
  const key=Object.keys(table).find(k=>k.toLowerCase()===row?.toLowerCase()),pairs=table[key];
  if(!Array.isArray(pairs)||!pairs.length){missing.add(row||'unknown');return '[unavailable]';}
  const raw=Object.entries(source.curveTable||{}).find(([k])=>k.toLowerCase()===row?.toLowerCase())?.[1];
  const valuesFromLookup=Object.entries(source.curveValues||{}).find(([k])=>k.toLowerCase()===row?.toLowerCase())?.[1];
  if(raw&&valuesFromLookup&&valuesFromLookup.some(([column,value])=>raw.some(p=>p[0]===column&&p[1]!==value))){conflicts.add(row);return '[source values differ]';}
  let values;
  if(attributes.column){const exact=pairs.find(p=>Number(p[0])===Number(attributes.column));if(!exact){missing.add(row+' column '+attributes.column);return '[unavailable]';}values=[exact[1]];}
  else values=[...new Set(pairs.map(p=>p[1]))];
  const format=(attributes.format||'').toLowerCase(),percent=['percent','p','percentminusone','invertedpercent'].includes(format);
  return values.map(value=>{
   if(!Number.isFinite(value)){missing.add(row);return '[unavailable]';}
   let n=format==='percentminusone'?(value-1)*100:format==='invertedpercent'?(1-value)*100:percent?value*100:value;
   const precision=attributes.precision===undefined?2:Math.max(0,Math.min(6,Number(attributes.precision)||0));n=Number(n.toFixed(precision));
   return String(n)+(percent?'%':'');
  }).join('/');
 }).replace(/<TFTAttribute\b[^>]*>/gi,()=>{dynamic=true;return '[current game value]';})
 .replace(/\{Augment\.[^}]+\}/g,()=>{dynamic=true;return '[current game value]';})
 .replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'');
 return {text:decode(result).replace(/\r\n/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim(),missing:[...missing],conflicts:[...conflicts],dynamic};
}
export function buildAugmentSnapshot(en,zh,date){
 if(en._metadata?.set!=='TFTSet19'||zh._metadata?.set!=='TFTSet19'||en._metadata.coreHash!==zh._metadata.coreHash)throw Error('PBE lookup set/release mismatch');
 const identity=a=>[a.apiName,a.curve,a.rarity,(a.rounds||[]).join(',')].join('|');
 const ids=new Set(),byZh=new Map(zh.augments.map(a=>[identity(a),a]));
 const augments=en.augments.map(a=>{
  const id=identity(a);if(ids.has(id)||!['Silver','Gold','Prismatic'].includes(a.rarity)||!a.name||!a.desc)throw Error('Invalid augment identity '+a.apiName);ids.add(id);
  const z=byZh.get(id),english=resolveAugmentText(a.desc,a),chinese=han(z?.desc)?resolveAugmentText(z.desc,a):null;
  const icon=a.icon?.split('/').at(-1).split('.')[0].toLowerCase();
  return {id,apiName:a.apiName,name:a.name,name_zh:han(z?.name)?z.name:null,description:english.text,description_zh:chinese?.text||null,tier:a.rarity,type:a.type||'regular',rounds:a.rounds||[],traits:(a.associatedTraits||[]).map(id=>{const t=en.traits.find(t=>t.apiName===id),z=zh.traits.find(t=>t.apiName===id);return t?{id,name:t.name.replaceAll('K/DA','K|DA'),name_zh:han(z?.name)?z.name:null}:null;}).filter(Boolean),image:icon?'https://cdn.metatft.com/file/metatft/augments/'+icon+'.png':null,missing_values:english.missing,missing_values_zh:chinese?.missing||[],conflicting_values:[...new Set([...english.conflicts,...(chinese?.conflicts||[])])],dynamic:english.dynamic,source_data:{description:a.desc,description_zh:z?.desc||null,curveValues:a.curveValues||{},curveTable:a.curveTable||{}}};
 });
 if(augments.length<300)throw Error('Unexpectedly incomplete augment roster');
 return {set:'TFTSet19',mode:'PBE',patch:'19.1',snapshot_date:date,source:'https://www.metatft.com/new-set',lookups:['https://data.metatft.com/lookups/TFTSet19_pbe_en_us.json','https://data.metatft.com/lookups/TFTSet19_pbe_zh_tw.json'],metadata:en._metadata,notes:'Only source-provided Traditional Chinese is used, independently for names and descriptions. Missing fields fall back to English. Curve values use the same English PBE release. Dynamic game counters and unavailable source values are explicit. Round availability is copied, not inferred.',augments};
}
