import assert from 'node:assert/strict';
import fs from 'node:fs';
import {numericSegments} from '../src/numeric-values.mjs';
const values=(text,id='')=>numericSegments(text,id).filter(s=>/\d/.test(s.text)&&s.text.match(/^\d/)).map(s=>[s.text,s.types.join('-')]);
assert.deepEqual(values('Deal 100/150/200 magic damage for 4 seconds.'),[['100/150/200','ap'],['4','']]);
assert.deepEqual(values('Heal 100/150/200 and deal 50 physical damage.'),[['100/150/200','hp'],['50','ad']]);
assert.deepEqual(values('Gain 20% AP and AD.'),[['20%','ad-ap']]);
assert.deepEqual(values('Gain 20% AP and max Health.'),[['20%','ap-hp']]);
assert.deepEqual(values('Gain 20% AD and HP.'),[['20%','ad-hp']]);
assert.deepEqual(values('Deal (100% AD + 40% AP) physical damage.'),[['100%','ad'],['40%','ap']]);
assert.deepEqual(values('回復18.5/22.5/31.5生命。造成120/180/270魔法傷害，持續5秒。'),[['18.5/22.5/31.5','hp'],['120/180/270','ap'],['5','']]);
assert.deepEqual(values('回復10魔力。獲得300護盾、20物防、25魔防、15%續戰力、30%全能吸血及50%攻速。'),[['10',''],['300',''],['20',''],['25',''],['15%',''],['30%',''],['50%','']]);
assert.deepEqual(values('造成80/120/180魔法傷害、1%燃燒和重創，持續4秒。'),[['80/120/180','ap'],['1%',''],['4','']]);
assert.deepEqual(values('At 70% Health, gain 300 max Health and 150% Attack Speed.'),[['70%','hp'],['300','hp'],['150%','']]);
assert.deepEqual(values('生命降至30%時，獲得300最大生命和100%物攻。'),[['30%','hp'],['300','hp'],['100%','ad']]);
assert.deepEqual(values('獲得1玩家生命。'),[['1','hp']]);
assert.deepEqual(values('普攻造成55/82/123物理傷害。','u67'),[['55/82/123','ad-ap']]);
const info=JSON.parse(fs.readFileSync(new URL('../dist/info.json',import.meta.url),'utf8'));
const counts={};
for(const [id,u]of Object.entries(info.units)){
 const segments=numericSegments(u.full_description,id);
 assert.equal(segments.map(s=>s.text).join(''),u.full_description,'Exact text preserved: '+id);
 for(const s of segments)if(s.types.length)counts[s.types.join('-')]=(counts[s.types.join('-')]||0)+1;
}
assert.ok(counts.ap>60&&counts.ad>30&&counts.hp>20);assert.ok(counts['ad-ap']>0);
console.log(JSON.stringify({numeric_colors:'PASS',champions:Object.keys(info.units).length,counts,text_preserved:true,neutral_values_unchanged:true}));
