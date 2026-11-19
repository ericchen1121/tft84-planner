import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {encodeTeamCode,teamCodeStatus} from '../src/team-code.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const lookup=read('dist/team-codes.json'),roster=read('dist/units.json').units;
const byName=new Map(roster.map(u=>[u.name,u.id]));
// A real PBE client export supplied by the user, with screenshot-confirmed order.
const sample=['Vladimir','Thresh','Locke','Kayle','Yorick','Mel','Swain','Olaf'].map(n=>byName.get(n));
assert.equal(encodeTeamCode(sample,lookup),'0243a43241440d43f41942d447000000None');
assert.deepEqual(encodeTeamCode(sample,lookup).slice(2,32).match(/.{3}/g),['43a','432','414','40d','43f','419','42d','447','000','000']);
assert.equal(new Set(Object.values(lookup.units).map(u=>u.code)).size,Object.keys(lookup.units).length);
assert.equal(Object.keys(lookup.units).length,91);
assert.deepEqual(lookup.unavailable.map(u=>u.name).sort(),['Graves','Mordekaiser','Nasus']);
for(const u of roster){const status=teamCodeStatus([u.id],lookup);if(lookup.units[u.id]){assert(status.ok);const code=encodeTeamCode([u.id],lookup);assert.equal(code.length,36);assert.equal(code.slice(5,32),'000'.repeat(9));}else{assert.equal(status.reason,'empty');assert.deepEqual(status.skipped,[u.id]);assert.throws(()=>encodeTeamCode([u.id],lookup));}}
assert.equal(teamCodeStatus([],lookup).reason,'empty');
assert.equal(teamCodeStatus([sample[0],sample[0]],lookup).reason,'duplicates');
assert.equal(teamCodeStatus(['unknown'],lookup).reason,'unavailable');
const ten=Object.keys(lookup.units).slice(0,10);assert.equal(encodeTeamCode(ten,lookup).slice(2,32).match(/.{3}/g).length,10);
assert.equal(teamCodeStatus([...ten,Object.keys(lookup.units)[10]],lookup).reason,'too-many');
// Baron is one champion in the planner despite occupying two population slots.
assert.equal(encodeTeamCode([byName.get('Baron Nashor')],lookup).slice(5,32),'000'.repeat(9));
assert.notEqual(lookup.units[byName.get('Akali (K|DA)')].code,lookup.units[byName.get('Akali (True Damage)')].code);
const reverse=new Map(Object.entries(lookup.units).map(([id,u])=>[u.code,id]));

// Validate representative full-sized teams independently of the encoder.
for(let i=0;i<91;i+=7){const ids=Object.keys(lookup.units).slice(i,i+8);if(!ids.length)continue;const code=encodeTeamCode(ids,lookup);const decoded=code.slice(2,32).match(/.{3}/g).filter(s=>s!=='000').map(s=>reverse.get(s));assert.deepEqual(decoded,ids);}
console.log(JSON.stringify({team_codes:'PASS',sample_exact:true,mapped:91,conflicting_ids_withheld:3,ten_slots:true,no_truncation:true,variants_distinct:true}));

// Exercise browser clipboard acknowledgement and the manual-copy failure path.
const skipped=lookup.unavailable.map(u=>u.id),mixed=[sample[0],...skipped,sample[1]],original=[...mixed];
assert.equal(encodeTeamCode(mixed,lookup),encodeTeamCode([sample[0],sample[1]],lookup));
assert.deepEqual(mixed,original,'Export must not mutate the solver lineup');
assert.deepEqual(teamCodeStatus(mixed,lookup).skipped,skipped);
assert.equal(teamCodeStatus([...ten,...skipped],lookup).ok,true,'Limit applies to exported champions');
assert.equal(teamCodeStatus([...sample,skipped[0],'unknown'],lookup).reason,'unavailable');
const source=fs.readFileSync(new URL('../src/team-code-ui.js',import.meta.url),'utf8');
const notices=[],writes=[],field={value:'',focus(){this.focused=true;},select(){this.selected=true;}},dialog={open:false,showModal(){this.open=true;}};
let reject=false;
const note={textContent:'',hidden:true};
const element=(tag,cls,text)=>({tagName:tag,className:cls,textContent:text,children:[],append(x){this.children.push(x);},setAttribute(k,v){this[k]=v;},addEventListener(){}});
const context={DATA:{units:roster},unitLabel:u=>u.name,el:element,document:{getElementById:()=>({textContent:JSON.stringify(lookup)})},encodeTeamCode,teamCodeStatus,t:(x,params={})=>x.replace(/\{(\w+)\}/g,(_,key)=>params[key]??key),notify:x=>notices.push(x),navigator:{clipboard:{writeText:async value=>{if(reject)throw Error('Denied');writes.push(value);}}},$:id=>id==='team-code-dialog'?dialog:id==='team-code-skipped'?note:field};
vm.createContext(context);vm.runInContext(source,context);
const button={disabled:false};await context.copyTeamCode(sample,button);
assert.equal(writes[0],'0243a43241440d43f41942d447000000None');assert.equal(notices.length,1);assert.equal(button.disabled,false);assert.equal(dialog.open,false);
reject=true;await context.copyTeamCode(sample,button);
assert.equal(notices.length,1,'Failed copy must not claim success');assert(dialog.open&&field.focused&&field.selected);assert.equal(field.value,writes[0]);assert.equal(button.disabled,false);
console.log(JSON.stringify({clipboard_flow:'PASS',success_acknowledged:true,denied_copy_selects_manual_code:true}));

reject=false;await context.copyTeamCode(mixed,button);
assert.equal(writes.at(-1),encodeTeamCode([sample[0],sample[1]],lookup));
assert(notices.at(-1).includes('Graves')&&notices.at(-1).includes('Nasus')&&notices.at(-1).includes('Mordekaiser'));
const mixedButton=context.teamCodeButton(mixed.map(id=>roster.find(u=>u.id===id)));
assert.equal(mixedButton.disabled,false);assert(mixedButton.className.includes('has-skipped-units'));assert(mixedButton.title.includes('Skipped'));
const normalButton=context.teamCodeButton(sample.map(id=>roster.find(u=>u.id===id)));assert(!normalButton.className.includes('has-skipped-units'));
const emptyButton=context.teamCodeButton(skipped.map(id=>roster.find(u=>u.id===id)));assert.equal(emptyButton.disabled,true);
reject=true;await context.copyTeamCode(mixed,button);assert.equal(field.value,writes.at(-1));assert(note.textContent.includes('Graves'));assert.equal(note.hidden,false);
console.log(JSON.stringify({partial_export:'PASS',omitted_units:3,solver_lineup_unchanged:true,red_warning_label:true,normal_copy_enabled:true,all_omitted_disabled:true,manual_copy_warns:true}));
