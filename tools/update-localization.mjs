import fs from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const source=JSON.parse(read('dist/localization-source.json')),info=JSON.parse(read('dist/info.json')),data=JSON.parse(read('dist/units.json'));
const lang=read('src/i18n.mjs'),start=lang.indexOf('export const TRAIT_ZH=Object.freeze('),end=lang.indexOf('export const UI_ZH');
const {TRAIT_ZH}=await import('../src/i18n.mjs');const traits={...TRAIT_ZH};
for(const [name,a]of Object.entries(source.traits))if(/[\u3400-\u9fff]/.test(a.name_zh||''))traits[name]=a.name_zh;
for(const u of data.units){const name=source.units[u.id]?.name_zh;if(!/[\u3400-\u9fff]/.test(name||''))continue;
 // Both Akalis share a translated base name, but remain distinct selectable units.
 const variant=u.name.match(/ \(.*\)$/)?.[0]||'';info.units[u.id].name_zh=name+variant;
}
info.localization={source:source.source,snapshot_date:source.snapshot_date};
fs.writeFileSync(new URL('src/i18n.mjs',root),lang.slice(0,start)+'export const TRAIT_ZH=Object.freeze('+JSON.stringify(traits,null,2)+');\n'+lang.slice(end));
fs.writeFileSync(new URL('dist/info.json',root),JSON.stringify(info,null,2)+'\n');
console.log('Localized',Object.values(info.units).filter(u=>u.name_zh).length,'champions and',Object.keys(traits).length,'traits');
