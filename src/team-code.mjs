// PBE v2: ten three-hex-digit champion identifiers, zero-padded empty slots.
export function teamCodeStatus(ids,lookup){
 if(!Array.isArray(ids)||!ids.length)return {ok:false,reason:'empty',missing:[]};
 if(ids.length>lookup.slots)return {ok:false,reason:'too-many',missing:[]};
 if(new Set(ids).size!==ids.length)return {ok:false,reason:'duplicates',missing:[]};
 const missing=ids.filter(id=>!lookup.units[id]||!/^[0-9a-f]{3}$/i.test(lookup.units[id].code)||lookup.units[id].code==='000');
 return {ok:!missing.length,reason:missing.length?'unavailable':null,missing};
}
export function encodeTeamCode(ids,lookup){
 const status=teamCodeStatus(ids,lookup);if(!status.ok)throw new Error('Cannot export team: '+status.reason);
 return lookup.version+ids.map(id=>lookup.units[id].code.toLowerCase()).join('')+'000'.repeat(lookup.slots-ids.length)+lookup.suffix;
}
