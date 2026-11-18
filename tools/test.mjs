import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {prepare,solve,DEFAULTS,effectiveTraits} from '../src/solver.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../dist/units.json',import.meta.url)));
const root=new URL('../',import.meta.url);
const get=p=>fs.readFileSync(new URL(p,root),'utf8');
function brute(data,c){
 const pool=data.units.filter(u=>!c.exclude_unit_ids.includes(u.id)&&(c.include_seven_cost||u.cost!==7));
 const members=new Map(data.traits.map(t=>[t.name,data.units.filter(u=>effectiveTraits(u,c).includes(t.name)).length]));
 const found=new Map();
 function check(team){
  if(team.reduce((s,u)=>s+u.slots,0)!==c.population)return;
  if(new Set(team.map(u=>u.exclusive_group||u.id)).size!==team.length)return;
  if(team.filter(u=>u.cost===4).length<c.min_four_cost||team.filter(u=>u.cost===5).length>c.max_five_cost)return;
  if(team.filter(u=>u.range<=c.frontline_max_range).length<c.min_frontline)return;
  if(team.filter(u=>u.cost===4&&u.range>c.frontline_max_range&&c.backline_role_keywords.some(k=>u.role.includes(k))).length<c.min_backline_four_cost)return;
  let score=0;
  for(const t of data.traits){if(!c.include_unique_traits&&members.get(t.name)<=1)continue;
   const n=team.filter(u=>effectiveTraits(u,c).includes(t.name)).length;
   if(c.score_mode==='all_members')score+=n;
   else if(n>=Math.min(...t.breakpoints))score+=c.score_mode==='active_members'?n:Math.max(...t.breakpoints.filter(p=>p<=n));
  }
  if(score>=c.min_trait_score)found.set(team.map(u=>u.id).sort().join(','),score);
 }
 // Enumerate bit masks instead of using the optimized solver's recursion or pruning.
 for(let mask=1;mask<2**pool.length;mask++)check(pool.filter((_,i)=>(mask&(2**i))!==0));
 return found;
}
let cases=0;
function compare(d,c){
 const expected=brute(d,c),got=new Map();
 const result=solve(d,c,{onChunk:b=>{for(let p=0;p<b.length;p+=c.population+1){const ids=[...b.subarray(p,p+c.population)].filter(x=>x!==255).map(x=>d.units[x].id).sort().join(',');assert(!got.has(ids));got.set(ids,b[p+c.population]);}}});
 assert.equal(result.status,'COMPLETE');assert.equal(result.matches,expected.size);assert.deepEqual(got,expected);cases++;
}
const sample=structuredClone(data);sample.units=data.units.filter(u=>['u0','u7','u8','u15','u23','u38','u49','u51','u55','u58','u67','u74','u90','u92','u93'].includes(u.id));
for(const mode of ['active_members','breakpoint','all_members'])for(const unique of [true,false])compare(sample,{...DEFAULTS,min_trait_score:10,score_mode:mode,include_unique_traits:unique});
for(let i=0;i<18;i++){
 const d={source:'test',set:'test',traits:[{name:'A',breakpoints:[2,4]},{name:'B',breakpoints:[3,5]},{name:'C',breakpoints:[1,2]},{name:'Unique',breakpoints:[1]},{name:'Collab',breakpoints:[3,5]}],units:[]};
 for(let j=0;j<12;j++)d.units.push({id:'x'+j,name:j===11?'Sona':'X'+j,cost:[4,4,4,5,5,1,2,3,7,4,4,7][j],range:[4,4,1,1,2,1,4,0,1,5,1,0][j],role:'DA_Role_MagicCaster',slots:j===8?2:1,traits:j===11?['Collab']:j===0?['Unique','A']:j%3===0?['A','B']:j%3===1?['B','C']:['A','C'],exclusive_group:j===3||j===4?'mutual':'x'+j});
 const c={...DEFAULTS,population:4+i%4,min_four_cost:1+i%3,max_five_cost:2,min_frontline:1+i%3,min_backline_four_cost:1,min_trait_score:i%10,score_mode:['active_members','breakpoint','all_members'][i%3],include_unique_traits:i%2===0,include_seven_cost:i%3!==1,extra_traits:i%2?{x1:['Collab'],x5:['Collab']}:{},sona_feature_trait:i%2?'A':null,exclude_unit_ids:i%2?['x9']:[]};compare(d,c);
}
compare(sample,{...DEFAULTS,population:4,min_frontline:4,min_backline_four_cost:2,min_trait_score:0});
assert.throws(()=>prepare(data,{population:0}));assert.throws(()=>prepare(data,{extra_traits:{notAUnit:['A']}}));assert.throws(()=>prepare(data,{sona_feature_trait:'Fake'}));
const timed=solve(data,{...DEFAULTS},{deadline:Date.now()-1});assert.equal(timed.status,'INCOMPLETE');
const html=get('dist/index.html');
assert.equal((html.match(/id="app-data"/g)||[]).length,1);
const capture=id=>html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)<\\/script>'))?.[1];
const embedded=JSON.parse(capture('app-data'));assert.equal(embedded.units.length,94);assert.equal(embedded.traits.length,47);
const embeddedArt=JSON.parse(capture('art-data'));assert.equal(Object.keys(embeddedArt.units).length,94);assert.equal(Object.values(embeddedArt.units).filter(a=>a.url).length,91);
const compressed=Buffer.from(capture('preset-data'),'base64');const preset=zlib.gunzipSync(compressed);assert.equal(preset.length,68766*9);
assert.deepEqual(preset,fs.readFileSync(new URL('dist/preset.bin',root)));
const seen=new Set(),hist={};
for(let p=0;p<preset.length;p+=9){const row=preset.subarray(p,p+9);assert(row[8]>=16);const ids=[...row.subarray(0,8)].filter(i=>i!==255).sort((a,b)=>a-b);const key=ids.join(',');assert(!seen.has(key));seen.add(key);const team=ids.map(i=>data.units[i]);assert.equal(team.reduce((s,u)=>s+u.slots,0),8);assert(team.filter(u=>u.cost===4).length>=3);assert(team.filter(u=>u.cost===5).length<=1);assert(team.filter(u=>u.range<=2).length>=5);assert(team.filter(u=>u.cost===4&&u.range>2&&DEFAULTS.backline_role_keywords.some(k=>u.role.includes(k))).length>=2);const counts=new Map();for(const u of team)for(const t of u.traits)counts.set(t,(counts.get(t)||0)+1);const score=data.traits.reduce((s,t)=>s+((counts.get(t.name)||0)>=Math.min(...t.breakpoints)?counts.get(t.name):0),0);assert.equal(score,row[8]);hist[score]=(hist[score]||0)+1;}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate DOM ids');
const app=get('src/app.js');for(const m of app.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(m[1]),'Missing element: '+m[1]);
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);new vm.Script(scripts.at(-1));
new vm.Script(capture('solver-source').replace(/^export /gm,'')+'\nself.onmessage=e=>{const {data,c}=e.data;const r=solve(data,c);self.postMessage(r)}');
assert(!html.includes('/*__'));assert(!html.includes('localhost'));
console.log(JSON.stringify({status:'PASS',reference_cases:cases,preset_rows:seen.size,histogram:hist,artwork_urls:91,checks:'Independent brute-force sets and scores; unique traits on/off; weighted slots; extras; mutual exclusion; timed-out state; every preset record; embedded data; all DOM selectors; main and worker script syntax'},null,2));
