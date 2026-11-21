// Rank the PBE item/build rows using MetaTFT's unit-detail tier score.
// The score is source behavior, not a claim of causal item strength.
export const unitKey = u => ({"Kai'Sa":'Kaisa19','Akali (K|DA)':'AkaliKDA19','Akali (True Damage)':'Akali_TrueDamage19','Nunu & Willump':'Nunu19'}[u.name] || u.name.replace(/[^a-z0-9]/gi,'')+'19');
const count = a => a.reduce((s,n)=>s+n,0);
const weighted = a => a.reduce((s,n,i)=>s+n*(i+1),0);
function adjustedChange(places,total,average,allCount,excludedCount){
 const avg=weighted(places)/total;
 const variance=places.reduce((s,n,i)=>s+n*(i+1-avg)**2,0)/total;
 const without=(average*allCount-avg*excludedCount)/(allCount-excludedCount);
 return avg+1.282*Math.sqrt(variance/total)-without;
}
export function rankRecommendations(overall,items,allowed){
 const levels=overall.levels.filter(r=>Number(r.lvl_items[0])<=4);
 const total=levels.reduce((s,r)=>s+count(r.places),0);
 const average=levels.reduce((s,r)=>s+weighted(r.places),0)/total;
 const maxCount=Math.max(0,...items.items.map(r=>count(r.places)));
 if(!total||!maxCount)return {popular_items:[],build_items:[],top_items:[],top_builds:[]};
 const score=(row,build=false)=>{
  const n=count(row.places),ids=build?row.buildNames.split('|'):[row.itemName.replace(/-\d+$/,'')];
  if(!n||!ids.every(id=>allowed.has(id)))return null;
  // Do not recommend a second copy as if it were a first equipped item.
  if(!build&&!row.itemName.endsWith('-1'))return null;
  const excluded=!build&&n/total>.85?total*(.85+.1*n/(3*total)):n;
  const change=adjustedChange(row.places,n,average,total,excluded);
  const threshold=build ? 0.01 : 0.08;
  let factor=n/total<threshold?Math.sqrt(n/total/threshold):1;
  if(build){factor*=(ids.length/3)**2;if(ids.some(id=>id.includes('ThiefsGloves')))factor/=30;}
  const tier=-(change-.5)*.7*factor*(n/maxCount)**.1;
  return Number.isFinite(tier)?{items:ids,count:n,score:tier,places:row.places}:null;
 };
 const top_items=items.items.map(r=>score(r)).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,5);
 const top_builds=items.builds.map(r=>score(r,true)).filter(Boolean).sort((a,b)=>b.score-a.score).slice(0,5);
 return {popular_items:top_items.map(r=>r.items[0]),build_items:[...new Set(top_builds.flatMap(r=>r.items))],top_items,top_builds};
}
