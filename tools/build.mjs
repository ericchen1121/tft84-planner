import fs from 'node:fs';
import zlib from 'node:zlib';
import {solverDefaults} from '../src/solver.mjs';
import {applyAugmentTags} from './augment-tagging.mjs';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const data=JSON.parse(read('dist/units.json'));
const rawArt=JSON.parse(read('dist/artwork.json'));
const artwork={source:rawArt.source,snapshot_date:rawArt.snapshot_date,units:Object.fromEntries(Object.entries(rawArt.units).map(([id,a])=>[id,{url:a.url}])),traits:Object.fromEntries(Object.entries(rawArt.traits).map(([id,a])=>[id,{url:a.url}]))};
let html=read('src/index.html');
const solver=read('src/solver.mjs');
const presetPayloads={};
for(const cost of [4,3,2,1]){
 const suffix=cost===4?'':'_'+cost;
 const path=cost===4?'dist/preset.bin':'dist/preset-'+cost+'.bin';
 const preset=fs.readFileSync(new URL(path,root)),recordSize=solverDefaults(cost).population+1;
 if(preset.length%recordSize)throw Error('Invalid preset record length for '+path);
 html=html.replace('/*__PRESET_RECORDS'+suffix+'__*/',String(preset.length/recordSize));
 presetPayloads['PRESET'+suffix]=zlib.gzipSync(preset).toString('base64');
}
const i18n=read('src/i18n.mjs').replace(/^export /gm,'')+'\n'+read('src/numeric-values.mjs').replace(/^export /gm,'');
const payloads={STYLES:read('src/styles.css'),DATA:JSON.stringify(data),INFO:JSON.stringify(JSON.parse(read('dist/info.json'))),ART:JSON.stringify(artwork),...presetPayloads,SOLVER:solver,APP:solver.replace(/^export /gm,'')+'\n'+i18n+'\n'+read('src/info.js')+'\n'+read('src/app.js')};
payloads.COLLAB=JSON.stringify({groups:JSON.parse(read('dist/collab-groups.json')),portraits:JSON.parse(read('dist/collab-portraits.json'))});
payloads.ITEMS=JSON.stringify(JSON.parse(read('dist/items.json')));
payloads.STYLES+='\n'+read('src/layout.css')+'\n'+read('src/desktop.css');
payloads.APP=solver.replace(/^export /gm,'')+'\n'+i18n+'\n'+read('src/info.js')+'\n'+read('src/collab.js')+'\n'+read('src/requirements.js')+'\n'+read('src/desktop.js')+'\n'+read('src/app.js');
payloads.TEAMCODE=JSON.stringify(JSON.parse(read('dist/team-codes.json')));
payloads.APP=read('src/team-code.mjs').replace(/^export /gm,'')+'\n'+read('src/team-code-ui.js')+'\n'+payloads.APP;
payloads.AUGMENTS=JSON.stringify((()=>{const a=applyAugmentTags(JSON.parse(read('dist/augments.json')),JSON.parse(read('dist/augment-tags.json')));return {...a,augments:a.augments.map(({source_data,...visible})=>visible)};})());
payloads.STYLES+='\n'+read('src/augments.css');
payloads.APP=read('src/augment-model.mjs').replace(/^export /gm,'')+'\n'+read('src/augments.js')+'\n'+payloads.APP;
payloads.EQUIPMENT=JSON.stringify((()=>{const a=JSON.parse(read('dist/equipment.json'));return {...a,items:a.items.map(({source_data,...visible})=>visible)};})());
 payloads.STYLES+='\n'+read('src/equipment.css');
 payloads.APP=read('src/equipment-model.mjs').replace(/^export /gm,'')+'\n'+read('src/equipment.js')+'\n'+payloads.APP;
payloads.SIMRULES=JSON.stringify(JSON.parse(read('dist/simulator-rules.json')));
payloads.STYLES+='\n'+read('src/simulator.css');
payloads.APP=read('src/simulator-model.mjs').replace(/^export /gm,'')+'\n'+read('src/simulator.js')+'\n'+payloads.APP;
 for(const [name,content]of Object.entries(payloads))html=html.replace(`/*__${name}__*/`,()=>content.replace(/<\/script/gi,'<\\/script'));
if(/\/\*__[A-Z]+__\*\//.test(html))throw Error('Unresolved template token');
fs.writeFileSync(new URL('dist/index.html',root),html);
// Branch-based GitHub Pages supports only / or /docs. Keep a root entry point
// identical to dist so the user's existing main / (root) setting works.
fs.writeFileSync(new URL('index.html',root),html);
fs.writeFileSync(new URL('.nojekyll',root),'');
console.log('Built standalone index.html and dist/index.html:',Buffer.byteLength(html),'bytes each');
