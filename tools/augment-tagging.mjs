import crypto from 'node:crypto';
import {AUGMENT_TAGS,AUGMENT_EQUIPMENT_TYPES,AUGMENT_ECONOMY_TYPES} from '../src/augment-model.mjs';
export function applyAugmentTags(snapshot,catalog){
 if(snapshot.set!==catalog.set)throw Error('Augment tag set mismatch');
 const valid=new Set(AUGMENT_TAGS.map(t=>t.id)),equipment=new Set(AUGMENT_EQUIPMENT_TYPES.map(t=>t.id)),economy=new Set(AUGMENT_ECONOMY_TYPES.map(t=>t.id));
 const augments=snapshot.augments.map(a=>{
  const entry=catalog.entries[a.id];
  if(!entry||entry.description_hash!==crypto.createHash('sha256').update(a.description).digest('hex'))throw Error('Augment tags need review: '+a.name+' ('+a.id+')');
  if(!entry.tags.length||new Set(entry.tags).size!==entry.tags.length||entry.tags.some(id=>!valid.has(id)))throw Error('Invalid augment tags: '+a.name);
  if(entry.details.equipment.some(id=>!equipment.has(id))||entry.details.economy.some(id=>!economy.has(id)))throw Error('Invalid augment tag details: '+a.name);
  if(entry.details.equipment.length&&!entry.tags.includes('equipment'))throw Error('Equipment category missing: '+a.name);
  return {...a,tags:entry.tags,tag_details:entry.details};
 });
 return {...snapshot,tag_metadata:{source:catalog.source,reviewed_at:catalog.reviewed_at,classification:'Editorial classification based on augment effects; not official Riot tags.'},augments};
}
