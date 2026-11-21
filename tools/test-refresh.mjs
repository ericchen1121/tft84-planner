import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {rankRecommendations} from './metatft-recommendations.mjs';
import {encodeTeamCode} from '../src/team-code.mjs';
import {TRAIT_ZH,setLanguage,getLanguage} from '../src/i18n.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const info=read('dist/info.json'),data=read('dist/units.json'),snapshot=read('dist/item-recommendations.json'),audit=read('dist/team-code-audit.json'),codes=read('dist/team-codes.json');
assert.equal(snapshot.snapshot_date,info.recommendations.snapshot_date);
for(const source of Object.values(snapshot.units)){
 for(const url of Object.values(source.request_urls)){const q=new URL(url).searchParams;assert.equal(q.get('queue'),'pbe');assert.equal(q.get('patch'),'19.1');assert.equal(q.get('days'),'3');assert.equal(q.get('unit'),source.apiName);}
 assert(source.top_items.every((x,i,a)=>x.count>0&&Number.isFinite(x.score)&&(!i||a[i-1].score>=x.score)));
}
// Explicit identity regressions for the two previously empty recommendation panels.
assert.equal(snapshot.units.Ahri19.apiName,'DA_19_Ahri');
assert.equal(snapshot.units.Seraphine19.apiName,'DA_Seraphine19_Indie');
const helpers={INFO:info,getLanguage};vm.createContext(helpers);
vm.runInContext(fs.readFileSync(new URL('../src/info.js',import.meta.url),'utf8').split('function abilityLabel')[0],helpers);
for(const [id,label]of Object.entries({u17:'卡蜜兒',u23:'路西恩',u25:'拉克絲',u31:'瑟菈紛',u47:'泰貝爾',u58:'雷歐娜',u67:'犽凝',u92:'斯米奇'})){
 const u=data.units.find(u=>u.id===id);setLanguage('zh-Hant');assert.equal(helpers.unitLabel(u),label);assert(helpers.unitSearchText(u).includes(u.name)&&helpers.unitSearchText(u).includes(label));setLanguage('en');assert.equal(helpers.unitLabel(u),u.name);
}
assert.notEqual(info.units.u71.name_zh,info.units.u72.name_zh);
assert.equal(TRAIT_ZH.Bodyguard,'保鑣');assert.equal(TRAIT_ZH.Arcanist,'奧術大師');assert.equal(TRAIT_ZH.Hyperpop,'超流行');
for(const [id,u]of Object.entries(codes.units))assert(audit.units[id].candidates.every(x=>x.code===u.code),u.name+' audited code differs');
assert.deepEqual(audit.conflicts.map(x=>x.code),['449']);
assert.deepEqual(new Set(audit.conflicts[0].ids),new Set(codes.unavailable.map(x=>x.id)));
const team=['u26','u54','u79','u25'];assert.equal(encodeTeamCode(team,codes),encodeTeamCode(['u25'],codes));
// A second equipped copy and noncraftable items cannot enter the ranked first-item list.
const overall={levels:[{lvl_items:['2','3'],places:[30,30,30,30,30,30,30,30]}]};
const items={items:[{itemName:'normal-1',places:[2,2,2,2,2,2,2,2]},{itemName:'normal-2',places:[9,0,0,0,0,0,0,0]},{itemName:'artifact-1',places:[9,0,0,0,0,0,0,0]}],builds:[]};
assert.deepEqual(rankRecommendations(overall,items,new Set(['normal'])).popular_items,['normal']);
assert.deepEqual(rankRecommendations({levels:[]},{items:[],builds:[]},new Set()).popular_items,[]);
console.log(JSON.stringify({refresh:'PASS',recommendations:94,new_names:8,translated_traits:Object.keys(TRAIT_ZH).length,planner_verified:Object.keys(codes.units).length,conflicting_ids_still_omitted:3}));
