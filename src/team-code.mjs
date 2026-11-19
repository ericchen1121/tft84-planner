// PBE v2: ten three-hex-digit champion identifiers, zero-padded empty slots.
export function teamCodeStatus(ids,lookup){
 const result={ok:false,reason:null,missing:[],skipped:[],exportIds:[]};
 if(!Array.isArray(ids)||!ids.length)return {...result,reason:'empty'};
 if(new Set(ids).size!==ids.length)return {...result,reason:'duplicates'};
 // Only the explicitly documented conflicting IDs may be omitted.
 // Unexpected missing/invalid IDs still fail instead of silently losing a unit.
 const omit=new Set((lookup.unavailable||[]).filter(u=>u.reason==='conflicting-source-code').map(u=>u.id));
 result.skipped=ids.filter(id=>omit.has(id));result.exportIds=ids.filter(id=>!omit.has(id));
 if(!result.exportIds.length)return {...result,reason:'empty'};
 if(result.exportIds.length>lookup.slots)return {...result,reason:'too-many'};
 result.missing=result.exportIds.filter(id=>!lookup.units[id]||!/^[0-9a-f]{3}$/i.test(lookup.units[id].code)||lookup.units[id].code==='000');
 return {...result,ok:!result.missing.length,reason:result.missing.length?'unavailable':null};
}
export function encodeTeamCode(ids,lookup){
 const status=teamCodeStatus(ids,lookup);if(!status.ok)throw new Error('Cannot export team: '+status.reason);
 return lookup.version+status.exportIds.map(id=>lookup.units[id].code.toLowerCase()).join('')+'000'.repeat(lookup.slots-status.exportIds.length)+lookup.suffix;
}
