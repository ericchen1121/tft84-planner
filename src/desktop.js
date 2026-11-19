function renderDesktopLayout(){
 const form=$('criteria-form'),button=$('desktop-toggle-criteria');if(!button)return;
 button.textContent=t(form.hidden?'Show criteria':'Hide criteria');button.setAttribute('aria-expanded',String(!form.hidden));
 const required=Object.keys(state.required).length,bonuses=Object.values(state.bonuses).reduce((sum,n)=>sum+n,0);
 $('desktop-trait-count').textContent=t('{required} required · +{bonuses} bonuses',{required,bonuses});
}
function bindDesktopLayout(){
 $('desktop-toggle-criteria').addEventListener('click',()=>{
  const form=$('criteria-form');form.hidden=!form.hidden;$('desktop-criteria').classList.toggle('is-collapsed',form.hidden);renderDesktopLayout();
 });
 renderDesktopLayout();
}
