import fs from 'node:fs';
import zlib from 'node:zlib';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const data=JSON.parse(read('dist/units.json'));
const rawArt=JSON.parse(read('dist/artwork.json'));
const artwork={source:rawArt.source,snapshot_date:rawArt.snapshot_date,units:Object.fromEntries(Object.entries(rawArt.units).map(([id,a])=>[id,{url:a.url}])),traits:Object.fromEntries(Object.entries(rawArt.traits).map(([id,a])=>[id,{url:a.url}]))};
let html=read('src/index.html');
const solver=read('src/solver.mjs');
const i18n=read('src/i18n.mjs').replace(/^export /gm,'')+'\n'+read('src/numeric-values.mjs').replace(/^export /gm,'');
const payloads={STYLES:read('src/styles.css'),DATA:JSON.stringify(data),INFO:JSON.stringify(JSON.parse(read('dist/info.json'))),ART:JSON.stringify(artwork),PRESET:zlib.gzipSync(fs.readFileSync(new URL('dist/preset.bin',root))).toString('base64'),SOLVER:solver,APP:solver.replace(/^export /gm,'')+'\n'+i18n+'\n'+read('src/info.js')+'\n'+read('src/app.js')};
payloads.ITEMS=JSON.stringify(JSON.parse(read('dist/items.json')));
payloads.STYLES+='\n'+read('src/layout.css')+'\n'+read('src/desktop.css');
payloads.APP=solver.replace(/^export /gm,'')+'\n'+i18n+'\n'+read('src/info.js')+'\n'+read('src/requirements.js')+'\n'+read('src/desktop.js')+'\n'+read('src/app.js');
for(const [name,content]of Object.entries(payloads))html=html.replace(`/*__${name}__*/`,()=>content.replace(/<\/script/gi,'<\\/script'));
if(/\/\*__[A-Z]+__\*\//.test(html))throw Error('Unresolved template token');
fs.writeFileSync(new URL('dist/index.html',root),html);
// Branch-based GitHub Pages supports only / or /docs. Keep a root entry point
// identical to dist so the user's existing main / (root) setting works.
fs.writeFileSync(new URL('index.html',root),html);
fs.writeFileSync(new URL('.nojekyll',root),'');
console.log('Built standalone index.html and dist/index.html:',Buffer.byteLength(html),'bytes each');
