export const EQUIPMENT_CATEGORIES={normal:'Normal items',radiant:'Radiant items',emblem:'Emblems',artifact:'Artifacts',component:'Components',support:'Support items',other:'Special items'};
export function equipmentName(a,language){return language==='zh-Hant'&&a.name_zh?a.name_zh:a.name;}
export function equipmentText(a,language){return language==='zh-Hant'&&a.description_zh?a.description_zh:a.description;}
export function filterEquipment(items,{query='',category='',craftable='',component=''}={},language='zh-Hant'){
 const order=Object.keys(EQUIPMENT_CATEGORIES),byId=new Map(items.map(a=>[a.id,a])),words=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return items.filter(a=>{
  if(category&&a.category!==category||craftable==='yes'&&!a.recipe.length||craftable==='no'&&a.recipe.length||component&&!a.recipe.includes(component))return false;
  const ingredients=a.recipe.map(id=>byId.get(id));
  const text=[a.name,a.name_zh,a.description,a.description_zh,...a.traits.flatMap(t=>[t.name,t.name_zh]),...ingredients.flatMap(a=>a?[a.name,a.name_zh]:[])].join(' ').toLowerCase();
  return words.every(word=>text.includes(word));
 }).sort((a,b)=>order.indexOf(a.category)-order.indexOf(b.category)||equipmentName(a,language).localeCompare(equipmentName(b,language),language==='zh-Hant'?'zh-TW':'en')||a.id.localeCompare(b.id));
}
