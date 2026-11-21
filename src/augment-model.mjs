export function augmentName(a,language){return language==='zh-Hant'&&a.name_zh?a.name_zh:a.name;}
export function augmentText(a,language){return language==='zh-Hant'&&a.description_zh?a.description_zh:a.description;}
export function filterAugments(augments,{query='',tier='',round='',type=''}={},language='zh-Hant'){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean),tiers={Silver:1,Gold:2,Prismatic:3};
 return augments.filter(a=>{
  if(tier&&a.tier!==tier||type&&a.type!==type)return false;
  if(round&&(round==='unknown'?a.rounds.length>0:!a.rounds.includes(round)))return false;
  const text=[a.name,a.name_zh,a.description,a.description_zh,...a.traits.flatMap(t=>[t.name,t.name_zh])].join(' ').toLowerCase();
  return words.every(word=>text.includes(word));
 }).sort((a,b)=>tiers[a.tier]-tiers[b.tier]||augmentName(a,language).localeCompare(augmentName(b,language),language==='zh-Hant'?'zh-TW':'en')||a.id.localeCompare(b.id));
}
