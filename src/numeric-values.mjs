// Display annotations only. Text, values and solver data are never changed.
const VALUE_NUMBER=String.raw`\d+(?:\.\d+)?%?(?:\s*\/\s*\d+(?:\.\d+)?%?)*`;
const VALUE_STAT=/(magic(?:al)? damage|ability power|\bAP\b|魔法傷害|魔法攻擊|魔攻|法術強度|physical damage|attack damage|\bAD\b|物理傷害|物理攻擊|物攻|攻擊力|health|\bHP\b|生命(?:值)?|血量|healing)/gi;
const VALUE_BOUNDARY=/[。！？!?;；\n,，、]|\.(?!\d)/;
const VALUE_PREFIX=/^(?:\s|[+×*()（）]|(?:bonus|more|max(?:imum)?|missing|current|base|additional|total|of|the|target['’]s|caster['’]s|their|his|her|your|own|as|equal to|based on)\b|額外|最大|上限|當前|目前|已損失|目標|自身|玩家|的|倍|點|相當於|基於|等同於)*$/i;
const VALUE_NEUTRAL=/^\s*(?:seconds?\b|secs?\b|hex(?:es)?\b|tiles?\b|attacks?\b|times\b|allies\b|enemies\b|shots?\b|arrows?\b|missiles?\b|mana\b|gold\b|shield\b|attack speed\b|armor\b|magic resist\b|durability\b|omnivamp\b|slow\b|weakening\b|wound\b|burn\b|\d*(?:rd|st|nd|th)\b|秒|格|次|支|枚|顆|根|名|個|層|位|回合|攻速|攻擊速度|魔力|金錢|護盾|雙防|物防|魔防|魔法防禦|續戰力|全能吸血|削抗|易傷|虛弱|燃燒|重創|緩速|連招)/i;
function valueKind(label){
 if(/health|\bHP\b|生命|血量|healing/i.test(label))return 'hp';
 return /magic|ability|\bAP\b|魔法|魔攻|法術/i.test(label)?'ap':'ad';
}
function valueMentions(text){return [...text.matchAll(new RegExp(VALUE_STAT.source,'gi'))].map(m=>({start:m.index,end:m.index+m[0].length,type:valueKind(m[0])}));}
function directValueKinds(before,after){
 if(VALUE_NEUTRAL.test(after))return [];
 const right=after.split(VALUE_BOUNDARY)[0],mentions=valueMentions(right);
 if(mentions.length&&VALUE_PREFIX.test(right.slice(0,mentions[0].start))){
  const types=[mentions[0].type];
  for(let i=1;i<mentions.length;i++){
   const join=right.slice(mentions[i-1].end,mentions[i].start);
   if(!/^\s*(?:and|or|\/|\+|&|與|及|和|或)\s*(?:max(?:imum)?|missing|current|最大|已損失)?\s*$/i.test(join))break;
   types.push(mentions[i].type);
  }
  return [...new Set(types)].sort();
 }
 const left=before.split(VALUE_BOUNDARY).at(-1);
 if(/(?:\bheal(?:s|ing)?|回復|恢復|治療)\s*$/i.test(left))return ['hp'];
 const previous=valueMentions(left).at(-1);
 if(previous&&/^(?:\s|[:：=+()]|by\b|below\b|to\b|equal to\b|increased by\b|最多提升|增加|提升|降至|低於|的)*$/i.test(left.slice(previous.end)))return [previous.type];
 return [];
}
// Explicit continuations/formulas in the fixed source snapshot. Bare "damage"
// alone does not establish an AP/AD type; only these confirmed continuations do.
const VALUE_CONTINUATIONS={
 u11:{'130/195/295':['ad']},u32:{'280/420/630':['ad']},u44:{'247.5/367.5/600':['ad']},
 u57:{'180/270/2000':['ap']},u63:{'175/265/2000':['ad']},
 u67:{'55/82/123':['ad','ap'],'38/57/350':['ad','ap'],'185/280/1500':['ad','ap']},
 u75:{'830/1300/8000':['ap']},u79:{'70/105/1500':['ap']},u83:{'156/234/39000':['ap']},
 u84:{'160/240/2000':['ap']},u87:{'35/55/400':['ad']},u92:{'12/18/350':['ad']}
};
export function numericSegments(text,unitId=''){
 const matches=[...text.matchAll(new RegExp(VALUE_NUMBER,'g'))],segments=[];let cursor=0;
 for(let i=0;i<matches.length;i++){
  const m=matches[i],start=m.index,end=start+m[0].length;
  if(start>cursor)segments.push({text:text.slice(cursor,start),types:[],scaled:false});
  const before=text.slice(i?matches[i-1].index+matches[i-1][0].length:0,start);
  const after=text.slice(end,i+1<matches.length?matches[i+1].index:text.length);
  const override=VALUE_CONTINUATIONS[unitId]?.[m[0]];
  segments.push({text:m[0],types:override||directValueKinds(before,after),scaled:m[0].includes('/')});
  cursor=end;
 }
 if(cursor<text.length)segments.push({text:text.slice(cursor),types:[],scaled:false});
 return segments;
}
