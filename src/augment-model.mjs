export const AUGMENT_TAGS=[
 {id:'equipment',en:'Equipment',zh:'裝備',color:'#60a5fa',icon:'◇',description:'Grants equipment, components or equipment tools.',description_zh:'提供散件、成裝、神器、輔助裝、光明裝、轉職或裝備工具。'},
 {id:'trait',en:'Traits',zh:'特性',color:'#c084fc',icon:'✦',description:'Trait bonuses, trait synergy or emblem access.',description_zh:'特性強化、特性配合，或提供徽章與轉職途徑。'},
 {id:'combat',en:'Combat',zh:'戰鬥',color:'#fb7185',icon:'⚔',description:'Stats, damage, healing, shields, control or team capacity.',description_zh:'提供能力數值、傷害、治療、護盾、控制或隊伍容量。'},
 {id:'economy',en:'Economy',zh:'經濟',color:'#fbbf24',icon:'＄',description:'Gold, shop rerolls, XP or resource rewards.',description_zh:'提供金錢、重抽、經驗或其他資源獎勵。'},
 {id:'growth',en:'Growth',zh:'成長',color:'#4ade80',icon:'↗',description:'Later-round rewards, recurring income or permanent scaling; not a timer within combat.',description_zh:'後續回合的延遲獎勵、持續資源或永久成長；不含單場戰鬥內的計時觸發。'},
 {id:'strategy',en:'Strategic',zh:'策略',color:'#fb923c',icon:'⌘',description:'Needs deliberate positioning, team-building, resource management, a quest or a trade-off.',description_zh:'需要配合站位、編隊、資源管理、任務條件或風險取捨。'},
 {id:'prismatic-cap',en:'Prismatic trait cap',zh:'稜彩羈絆上限',color:'#e879f9',icon:'◆',description:'Explicit Prismatic trait quests. Separate from Prismatic augment rarity.',description_zh:'明確提供稜彩特性任務與彩羈絆上限；與增幅裝置本身的稜彩階級分開。'},
 {id:'hero',en:'Hero upgrade',zh:'角色強化',color:'#f472b6',icon:'★',description:'Changes a specific champion’s ability or role to make them a carry.',description_zh:'改變特定棋子的技能或定位，讓其成為主力輸出。'},
 {id:'units',en:'Champion resources',zh:'棋子資源',color:'#22d3ee',icon:'♟',description:'Champions, duplicators, upgrades, transformations or training dummies.',description_zh:'提供棋子、複製器、升星、棋子轉化或訓練假人。'},
 {id:'health',en:'Tactician health',zh:'棋手生命／容錯',color:'#a3e635',icon:'♥',description:'Changes Tactician health, player damage or rewards tied to player health.',description_zh:'影響棋手生命、玩家受傷風險，或以棋手生命為條件提供效果。'}
];
export const AUGMENT_EQUIPMENT_TYPES=[['component','Components','散件'],['completed','Completed items','成裝'],['artifact','Artifacts','神器'],['support','Support items','輔助裝'],['radiant','Radiant items','光明裝'],['emblem','Emblems','轉職'],['tactician',"Tactician’s items",'人口裝備'],['utility','Equipment tools','裝備工具']].map(([id,en,zh])=>({id,en,zh}));
export const AUGMENT_ECONOMY_TYPES=[['gold','Gold','金錢'],['rerolls','Rerolls','重抽'],['xp','XP','經驗']].map(([id,en,zh])=>({id,en,zh}));
export function augmentTagLabel(tag,language){return language==='zh-Hant'?tag.zh:tag.en;}
export function augmentTagDescription(tag,language){return language==='zh-Hant'?tag.description_zh:tag.description;}
export function augmentName(a,language){return language==='zh-Hant'&&a.name_zh?a.name_zh:a.name;}
export function augmentText(a,language){return language==='zh-Hant'&&a.description_zh?a.description_zh:a.description;}
export function filterAugments(augments,{query='',tier='',round='',type='',tags=[],tagMode='any',equipment=''}={},language='zh-Hant'){
 const words=query.trim().toLowerCase().split(/\s+/).filter(Boolean),tiers={Silver:1,Gold:2,Prismatic:3};
 return augments.filter(a=>{
  if(tier&&a.tier!==tier||type&&a.type!==type)return false;
  if(round&&(round==='unknown'?a.rounds.length>0:!a.rounds.includes(round)))return false;
  if(tags.length&&!(tagMode==='all'?tags.every(id=>a.tags?.includes(id)):tags.some(id=>a.tags?.includes(id))))return false;
  if(equipment&&!a.tag_details?.equipment.includes(equipment))return false;
  const labels=AUGMENT_TAGS.filter(t=>a.tags?.includes(t.id)).flatMap(t=>[t.en,t.zh]);
  const sublabels=[...AUGMENT_EQUIPMENT_TYPES.filter(t=>a.tag_details?.equipment.includes(t.id)),...AUGMENT_ECONOMY_TYPES.filter(t=>a.tag_details?.economy.includes(t.id))].flatMap(t=>[t.en,t.zh]);
  const text=[a.name,a.name_zh,a.description,a.description_zh,...labels,...sublabels,...a.traits.flatMap(t=>[t.name,t.name_zh])].join(' ').toLowerCase();
  return words.every(word=>text.includes(word));
 }).sort((a,b)=>tiers[a.tier]-tiers[b.tier]||augmentName(a,language).localeCompare(augmentName(b,language),language==='zh-Hant'?'zh-TW':'en')||a.id.localeCompare(b.id));
}
