import fs from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {solve,prepare,solverDefaults} from '../src/solver.mjs';
if(!isMainThread){
 const {data,c,i,n}=workerData;
 const pool=prepare(data,c).pool;
 const result=solve(data,c,{firstIndices:pool.map((_,k)=>k).filter(k=>k%n===i),
  onChunk:a=>parentPort.postMessage({chunk:a},[a.buffer]),
  onProgress:p=>{if(p.elapsed>10)parentPort.postMessage({progress:p,i});}});
 parentPort.postMessage({done:result});
}else{
 const data=JSON.parse(fs.readFileSync(new URL('../dist/units.json',import.meta.url)));
 const boosted=process.argv.includes('--emblem');
 const costArgument=process.argv.find(arg=>arg.startsWith('--cost='));
 const cost=costArgument?Number(costArgument.slice(7)):4;
 const generate=process.argv.includes('--write-preset');
 if(![1,2,3,4].includes(cost)||(boosted&&(generate||cost!==4)))throw Error('Choose --cost=1, 2, 3 or 4. Emblem checks require the 4-cost solver and do not write a preset.');
 const c={...solverDefaults(cost),trait_bonuses:boosted?{Frontman:1}:{}},n=4,started=Date.now();let last=0;
 const presetPath=new URL(cost===4?'../dist/preset.bin':`../dist/preset-${cost}.bin`,import.meta.url);
 const chunks=[];
 const results=await Promise.all(Array.from({length:n},(_,i)=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL(import.meta.url),{workerData:{data,c,i,n}});
  w.on('message',m=>{if(m.chunk)chunks.push(Buffer.from(m.chunk));if(m.done)resolve(m.done);
   if(m.progress&&Date.now()-last>10000){console.log('progress',((Date.now()-started)/1000).toFixed(1)+'s',JSON.stringify(m.progress));last=Date.now();}});
  w.on('error',reject);
 })));
 const rows=Buffer.concat(chunks),size=c.population+1;
 const keys=b=>{const s=new Set();for(let p=0;p<b.length;p+=size){const row=b.subarray(p,p+size);const key=[...row.subarray(0,c.population)].filter(i=>i!==255).sort((a,b)=>a-b).join(',')+':'+row[c.population];if(s.has(key))throw Error('Duplicate lineup');s.add(key);}return s;};
 const got=keys(rows);
 if(results.some(r=>r.status!=='COMPLETE'))throw Error('Full search did not complete');
 if(generate){
  const rowsByLineup=[];
  for(let offset=0;offset<rows.length;offset+=size)rowsByLineup.push(rows.subarray(offset,offset+size));
  rowsByLineup.sort(Buffer.compare);
  fs.writeFileSync(presetPath,Buffer.concat(rowsByLineup));
 }else if(!boosted){
  const want=keys(fs.readFileSync(presetPath));
  if(got.size!==want.size||[...got].some(k=>!want.has(k)))throw Error('Full browser solver differs from the embedded preset');
 }else{
  for(let p=0;p<rows.length;p+=size){
   const row=rows.subarray(p,p+size),team=[...row.subarray(0,c.population)].filter(i=>i!==255).map(i=>data.units[i]);
   const counts=new Map(Object.entries(c.trait_bonuses));for(const u of team)for(const t of u.traits)counts.set(t,(counts.get(t)||0)+(t==='K|DA'?2:1));
   const kdaScores={3:2,5:3,7:4,10:5,13:6,15:7};
   const score=data.traits.reduce((sum,trait)=>{
    const count=counts.get(trait.name)||0;
    const tier=Math.max(0,...trait.breakpoints.filter(point=>point<=count));
    return sum+(trait.name==='K|DA'?(kdaScores[Math.min(tier,15)]||0):tier);
   },0);
   if(score!==row[c.population]||score<c.min_trait_score||team.reduce((s,u)=>s+u.slots,0)!==c.population||team.filter(u=>u.cost===4).length<c.min_four_cost||team.filter(u=>u.cost===5).length>1||team.filter(u=>u.range<=2).length<5||team.filter(u=>u.cost===4&&u.range>2&&c.backline_role_keywords.some(k=>u.role.includes(k))).length<2)throw Error('Emblem search failed independent record validation');
  }
 }
 const checks=generate?'Complete worker search; no duplicate lineups':boosted?'Every emitted emblem lineup independently validated; no duplicates':'Every JS worker lineup and score matches the embedded preset; no duplicate or missing lineups';
 const result={status:'PASS',matches:got.size,elapsed_seconds:(Date.now()-started)/1000,nodes:results.reduce((s,r)=>s+r.nodes,0),trait_bonuses:c.trait_bonuses,checks,workers:n};
 if(cost===4)fs.writeFileSync(new URL(boosted?'../emblem-benchmark.json':'../web-benchmark.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
}
