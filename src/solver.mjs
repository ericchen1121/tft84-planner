/* Exact, weighted-population DFS. Shared by the browser workers and Node tests. */
export const DEFAULTS = Object.freeze({
  population:8,min_four_cost:4,max_five_cost:1,min_trait_score:16,
  min_frontline:5,frontline_max_range:2,min_backline_four_cost:2,
  include_unique_traits:true,include_seven_cost:true,score_mode:'breakpoint',
  backline_role_keywords:['Marksman','Caster','AttackSpecialist_Ammo'],
  exclude_unit_ids:[],extra_traits:{},trait_bonuses:{},required_traits:{},required_trait_mode:'at_least',sona_feature_trait:null,max_seconds:590,threads:4
});
// Emblem availability follows the trait-filter screenshot supplied by the user.
export const EMBLEM_TRAITS=Object.freeze([
  'Heartsteel','Frontman','Classical','Collab','Swiftstriker','Hitmaker','Encore',
  'Juggernaut','Beach Pop','Pentakill','Slayer','Rock','Manager','EDM',
  'Choreographer','Jazz','Arcanist','Bodyguard','Gu Feng','Hyperpop','Illbeats',
  'Ionic Spark','K|DA','Prodigy','R&B','Renegade','Trickshot','True Damage'
]);

export function effectiveTraits(u,c) {
  return [...new Set([...u.traits,...(c.extra_traits?.[u.id]||[]),...(u.name==='Sona'&&c.sona_feature_trait?[c.sona_feature_trait]:[])])];
}

export function solverTraitWeight(name){
  return name==='K|DA'?2:1;
}

export function solverTraitPoints(trait,count,mode){
  if(mode==='all_members')return count;
  const tier=Math.max(0,...trait.breakpoints.filter(point=>point<=count));
  return tier&&mode==='active_members'?count:tier;
}

function traitRequirements(data,c){
  if(!c.required_traits||typeof c.required_traits!=='object'||Array.isArray(c.required_traits))throw Error('Required traits must be a trait-to-breakpoint object.');
  if(!['at_least','exact_tier'].includes(c.required_trait_mode))throw Error('Unknown required trait mode.');
  return Object.entries(c.required_traits).map(([name,min])=>{
    const index=data.traits.findIndex(t=>t.name===name),trait=data.traits[index];
    if(!trait||!Number.isInteger(min)||!trait.breakpoints.includes(min)||min<=0)throw Error('Choose a known trait and one of its activation breakpoints.');
    const next=Math.min(Infinity,...trait.breakpoints.filter(n=>n>min));
    return {name,index,min,weight:solverTraitWeight(name),max:c.required_trait_mode==='exact_tier'?next-1:Infinity};
  });
}

// A requirement can only narrow the complete default preset, so no fresh DFS
// is needed when all other rules still match the verified preset.
export function filterRequiredRecords(data,bytes,settings={}){
  const c={...DEFAULTS,...settings},rules=traitRequirements(data,c);if(!rules.length)return bytes;
  const stride=c.population+1,out=new Uint8Array(bytes.length);let length=0;
  const membership=data.units.map(u=>new Set(effectiveTraits(u,c)));
  for(let offset=0;offset<bytes.length;offset+=stride){
    const ok=rules.every(rule=>{
      let n=c.trait_bonuses[rule.name]||0;
      for(let j=0;j<c.population;j++){const index=bytes[offset+j];if(index!==255&&membership[index].has(rule.name))n+=rule.weight;}
      return n>=rule.min&&n<=rule.max;
    });
    if(ok){out.set(bytes.subarray(offset,offset+stride),length);length+=stride;}
  }
  return out.subarray(0,length);
}

export function prepare(data, settings={}) {
  const c={...DEFAULTS,...settings};
  for(const k of ['population','min_four_cost','max_five_cost','min_trait_score','min_frontline','frontline_max_range','min_backline_four_cost','max_seconds','threads'])
    if(!Number.isInteger(c[k])||c[k]<0) throw Error(`Invalid ${k.replaceAll('_',' ')}`);
  if(c.population<1||c.population>16||c.max_seconds<1||c.threads<1||c.threads>16)throw Error('Population: 1–16; time limit: at least 1 second; workers: 1–16.');
  if(!['active_members','breakpoint','all_members'].includes(c.score_mode))throw Error('Unknown scoring method.');
  const tids=new Map(data.traits.map((t,i)=>[t.name,i]));
  const requirements=traitRequirements(data,c),requiredIds=new Set(requirements.map(r=>r.index));
  if(!c.trait_bonuses||typeof c.trait_bonuses!=='object'||Array.isArray(c.trait_bonuses))throw Error('Trait bonuses must be a trait-to-count object.');
  for(const [trait,n]of Object.entries(c.trait_bonuses))
    if(!tids.has(trait)||!Number.isInteger(n)||n<0||n>16)throw Error('Choose a known trait and a bonus from 0 to 16.');
  const excluded=new Set(c.exclude_unit_ids);
  const ids=new Set(data.units.map(u=>u.id));
  if([...excluded].some(id=>!ids.has(id))||Object.keys(c.extra_traits).some(id=>!ids.has(id)))throw Error('Unknown champion in settings.');
  const allTraits=data.units.map(u=>effectiveTraits(u,c));
  if(allTraits.some(ts=>ts.some(t=>!tids.has(t))))throw Error('Unknown extra trait.');
  const membership=data.traits.map(t=>allTraits.filter(ts=>ts.includes(t.name)).length);
  const bonuses=new Uint8Array(data.traits.map(t=>c.trait_bonuses[t.name]||0));
  const weights=new Uint8Array(data.traits.map(t=>solverTraitWeight(t.name)));
  const stride=Math.max(c.population,...data.traits.map((_,i)=>c.population*weights[i]+bonuses[i]))+1;
  const points=new Uint16Array(data.traits.length*stride);
  const thresholds=new Uint8Array(data.traits.length);
  data.traits.forEach((t,i)=>{
    const enabled=c.include_unique_traits||membership[i]>1;
    thresholds[i]=enabled?Math.min(...t.breakpoints):0;
    if(enabled)for(let n=0;n<stride;n++)points[i*stride+n]=solverTraitPoints(t,n,c.score_mode);
  });
  const groupIds=new Map();
  const pool=data.units.map((u,index)=>{
    const group=u.exclusive_group||u.id;
    if(!groupIds.has(group))groupIds.set(group,groupIds.size);
    const front=+(u.range<=c.frontline_max_range),four=+(u.cost===4);
    const ts=allTraits[index].map(t=>tids.get(t)).filter(t=>thresholds[t]>0||requiredIds.has(t));
    return {...u,index,group:groupIds.get(group),front,four,five:+(u.cost===5),
      back4:+(u.cost===4&&!front&&c.backline_role_keywords.some(k=>u.role.includes(k))),
      ts,traitMass:ts.reduce((sum,t)=>sum+(thresholds[t]?weights[t]:0),0)};
  }).filter(u=>!excluded.has(u.id)&&(c.include_seven_cost||u.cost!==7))
    .sort((a,b)=>b.back4-a.back4||(b.four*b.front)-(a.four*a.front)||b.front-a.front||b.ts.length-a.ts.length||a.index-b.index);
  const initialScore=data.traits.reduce((s,_,i)=>s+points[i*stride+bonuses[i]],0);
  const initialMass=data.traits.reduce((s,_,i)=>s+(thresholds[i]?bonuses[i]:0),0);
  const N=pool.length,front=new Uint16Array(N+1),four=new Uint16Array(N+1),back=new Uint16Array(N+1),mass=new Uint16Array((N+1)*stride);
  for(let i=N-1;i>=0;i--){
    front[i]=front[i+1]+pool[i].front;four[i]=four[i+1]+pool[i].four;back[i]=back[i+1]+pool[i].back4;
    for(let s=1;s<=c.population;s++)mass[i*stride+s]=Math.max(mass[(i+1)*stride+s],s>=pool[i].slots?pool[i].traitMass+mass[(i+1)*stride+s-pool[i].slots]:0);
  }
  if(initialMass+mass[c.population]>255)throw Error('Combined trait bonuses exceed the supported score range. Reduce bonus counts.');
  const requiredSuffix=requirements.map(r=>{const suffix=new Uint16Array(N+1);for(let i=N-1;i>=0;i--)suffix[i]=suffix[i+1]+Number(pool[i].ts.includes(r.index));return suffix;});
  return {c,pool,points,thresholds,stride,front,four,back,mass,bonuses,weights,initialScore,initialMass,requirements,requiredSuffix};
}

export function solve(data,settings={},options={}) {
  const p=prepare(data,settings),{c,pool:U,points,stride,front:SF,four:S4,back:SB,mass:M,bonuses,weights,initialScore,initialMass,requirements,requiredSuffix}=p;
  const counts=new Uint8Array(bonuses),chosen=new Uint8Array(c.population),groups=new Uint8Array(data.units.length);
  const recordSize=c.population+1,chunkRows=4096;
  let output=new Uint8Array(recordSize*chunkRows),pos=0,matches=0,nodes=0,finished=0,stopped=false;
  const started=Date.now(),deadline=options.deadline||started+c.max_seconds*1000;
  let lastReport=started;
  const histogram=new Array(256).fill(0);
  const partitions=options.firstIndices||U.map((_,i)=>i);
  function flush(){if(pos){options.onChunk?.(output.slice(0,pos));output=new Uint8Array(recordSize*chunkRows);pos=0;}}
  function add(u){let delta=0;for(let j=0;j<u.ts.length;j++){const t=u.ts[j],n=counts[t],next=n+weights[t];counts[t]=next;delta+=points[t*stride+next]-points[t*stride+n];}return delta;}
  function remove(u){for(let j=0;j<u.ts.length;j++){const t=u.ts[j];counts[t]-=weights[t];}}
  function save(depth,score){
    matches++;histogram[score]++;
    if(options.countOnly)return;
    if(pos+recordSize>output.length)flush();
    for(let k=0;k<c.population;k++)output[pos++]=k<depth?chosen[k]:255;
    output[pos++]=score;
  }
  function visit(start,left,depth,four,five,front,back,score,mass){
    nodes++;
    if((nodes&262143)===0){
      const now=Date.now();
      if(now>=deadline){stopped=true;return;}
      if(now-lastReport>400){options.onProgress?.({nodes,matches,finished,total:partitions.length,elapsed:(now-started)/1000});lastReport=now;}
    }
    if(stopped)return;
    for(let k=0;k<requirements.length;k++){
      const r=requirements[k],n=counts[r.index];
      if(n>r.max||n+Math.min(left,requiredSuffix[k][start])*r.weight<r.min)return;
    }
    if(left===0){if(four>=c.min_four_cost&&front>=c.min_frontline&&back>=c.min_backline_four_cost&&score>=c.min_trait_score)save(depth,score);return;}
    const nf=Math.max(0,c.min_four_cost-four),nt=Math.max(0,c.min_frontline-front),nb=Math.max(0,c.min_backline_four_cost-back);
    if(left<Math.max(nf,nt+nb)||nf>S4[start]||nt>SF[start]||nb>SB[start]||U.length-start<Math.max(nf,nt+nb)||mass+M[start*stride+left]<c.min_trait_score)return;
    for(let i=start;i<U.length;i++){
      const u=U[i];
      if(u.slots>left||five+u.five>c.max_five_cost||groups[u.group])continue;
      if(nf>S4[i]||nt>SF[i]||nb>SB[i])break;
      chosen[depth]=u.index;groups[u.group]=1;
      const delta=add(u);
      visit(i+1,left-u.slots,depth+1,four+u.four,five+u.five,front+u.front,back+u.back4,score+delta,mass+u.traitMass);
      remove(u);groups[u.group]=0;
      if(stopped)return;
    }
  }
  for(const first of partitions){
    if(Date.now()>=deadline){stopped=true;break;}
    const u=U[first];
    if(u&&u.slots<=c.population&&u.five<=c.max_five_cost){
      chosen[0]=u.index;groups[u.group]=1;const score=initialScore+add(u);
      visit(first+1,c.population-u.slots,1,u.four,u.five,u.front,u.back4,score,initialMass+u.traitMass);
      remove(u);groups[u.group]=0;
    }
    if(stopped)break;finished++;
    options.onProgress?.({nodes,matches,finished,total:partitions.length,elapsed:(Date.now()-started)/1000});
  }
  flush();
  return {status:stopped?'INCOMPLETE':'COMPLETE',matches,nodes,finished,total:partitions.length,histogram,elapsed:(Date.now()-started)/1000};
}
