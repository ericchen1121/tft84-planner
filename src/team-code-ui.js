const TEAM_CODES=JSON.parse(document.getElementById('team-code-data').textContent);
function teamCodeButton(team){
 const ids=team.map(u=>u.id),status=teamCodeStatus(ids,TEAM_CODES),button=el('button','board-link copy-team-code',t('Copy team code'));
 button.type='button';button.disabled=!status.ok;
 button.title=status.ok?t('Exports champions only; positioning, items and trait bonuses are not included.'):status.reason==='too-many'?t('Team codes support at most 10 champions.'):t('Import IDs are not yet verified for: {names}',{names:team.filter(u=>status.missing.includes(u.id)).map(unitLabel).join(', ')});
 button.addEventListener('click',()=>copyTeamCode(ids,button));return button;
}
async function copyTeamCode(ids,button){
 let code;try{code=encodeTeamCode(ids,TEAM_CODES);}catch{notify(t('This lineup cannot be exported yet.'));return;}
 button.disabled=true;
 try{
  if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
  await navigator.clipboard.writeText(code);notify(t('Team code copied. Paste it into the in-game Team Planner.'));
 }catch{
  const dialog=$('team-code-dialog'),field=$('team-code-value');field.value=code;
  if(!dialog.open)dialog.showModal();field.focus();field.select();
 }finally{button.disabled=false;}
}
