import fs from 'node:fs';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {solve,prepare,DEFAULTS} from '../src/solver.mjs';
if(!isMainThread){
 const {data,c,i,n}=workerData;
 const pool=prepare(data,c).pool;
 const result=solve(data,c,{firstIndices:pool.map((_,k)=>k).filter(k=>k%n===i),
  onChunk:a=>parentPort.postMessage({chunk:a},[a.buffer]),
  onProgress:p=>{if(p.elapsed>10)parentPort.postMessage({progress:p,i});}});
 parentPort.postMessage({done:result});
}else{
 const data=JSON.parse(fs.readFileSync(new URL('../dist/units.json',import.meta.url)));
 const c={...DEFAULTS},n=4,started=Date.now();let last=0;
 const chunks=[];
 const results=await Promise.all(Array.from({length:n},(_,i)=>new Promise((resolve,reject)=>{
  const w=new Worker(new URL(import.meta.url),{workerData:{data,c,i,n}});
  w.on('message',m=>{if(m.chunk)chunks.push(Buffer.from(m.chunk));if(m.done)resolve(m.done);
   if(m.progress&&Date.now()-last>10000){console.log('progress',((Date.now()-started)/1000).toFixed(1)+'s',JSON.stringify(m.progress));last=Date.now();}});
  w.on('error',reject);
 })));
 const rows=Buffer.concat(chunks),size=c.population+1;
 const keys=b=>{const s=new Set();for(let p=0;p<b.length;p+=size){const row=b.subarray(p,p+size);const key=[...row.subarray(0,c.population)].filter(i=>i!==255).sort((a,b)=>a-b).join(',')+':'+row[c.population];if(s.has(key))throw Error('Duplicate lineup');s.add(key);}return s;};
 const got=keys(rows),want=keys(fs.readFileSync(new URL('../dist/preset.bin',import.meta.url)));
 if(results.some(r=>r.status!=='COMPLETE')||got.size!==want.size||[...got].some(k=>!want.has(k)))throw Error('Full browser solver differs from verified C# result');
 const result={status:'PASS',matches:got.size,elapsed_seconds:(Date.now()-started)/1000,nodes:results.reduce((s,r)=>s+r.nodes,0),checks:'Every JS worker lineup and score exactly equals C# preset; no duplicate or missing lineups',workers:n};
 fs.writeFileSync(new URL('../web-benchmark.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
}
