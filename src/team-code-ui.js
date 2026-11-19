const TEAM_CODES=JSON.parse(document.getElementById('team-code-data').textContent);
function skippedTeamCodeNames(status){return status.skipped.map(id=>{const u=DATA.units.find(u=>u.id===id);return u?unitLabel(u):TEAM_CODES.unavailable.find(u=>u.id===id)?.name||id;}).join(', ');}
function teamCodeButton(team){
 const ids=team.map(u=>u.id),status=teamCodeStatus(ids,TEAM_CODES),button=el('button','board-link copy-team-code'+(status.skipped.length?' has-skipped-units':''),t('Copy team code'));
 button.type='button';button.disabled=!status.ok;
 const warning=status.skipped.length?t('Skipped from team code: {names}',{names:skippedTeamCodeNames(status)}):'';
 button.title=status.ok?[warning,t('Exports champions only; positioning, items and trait bonuses are not included.')].filter(Boolean).join(' · '):status.reason==='too-many'?t('Team codes support at most 10 champions.'):status.reason==='empty'?t('No exportable champions remain after skipping unverified IDs.'):t('Import IDs are not yet verified for: {names}',{names:team.filter(u=>status.missing.includes(u.id)).map(unitLabel).join(', ')});
 // Include the warning in the accessible description without changing the label.
 if(warning){const description=el('span','copy-code-warning',warning);description.id='copy-code-warning-'+(++teamCodeButton.nextId);description.hidden=true;button.setAttribute('aria-describedby',description.id);button.append(description);}
 button.addEventListener('click',()=>copyTeamCode(ids,button));return button;
}
teamCodeButton.nextId=0;
async function copyTeamCode(ids,button){
 let code;const status=teamCodeStatus(ids,TEAM_CODES);try{code=encodeTeamCode(ids,TEAM_CODES);}catch{notify(t('This lineup cannot be exported yet.'));return;}
 const names=skippedTeamCodeNames(status),warning=names?t('Skipped from team code: {names}',{names}):'';
 button.disabled=true;
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
  await navigator.clipboard.writeText(code);notify(names?t('Team code copied. Skipped: {names}',{names}):t('Team code copied. Paste it into the in-game Team Planner.'));
 }catch{
  const dialog=$('team-code-dialog'),field=$('team-code-value');field.value=code;
  let note=$('team-code-skipped');if(!note){note=el('p','field-hint');note.id='team-code-skipped';dialog.append(note);}note.textContent=warning;note.hidden=!warning;
  if(!dialog.open)dialog.showModal();field.focus();field.select();
 }finally{button.disabled=false;}
}
