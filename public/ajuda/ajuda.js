// Ajuda do Inventário PET: nenhum script inline na página pública.
(function(){
  const button=document.getElementById("help-print-button");
  if(button)button.addEventListener("click",()=>window.print());
  const options=new URLSearchParams(window.location.search);
  if(options.has("embed"))document.body.classList.add("help-embed");
  if(options.has("print"))window.addEventListener("load",()=>window.setTimeout(()=>window.print(),300));
})();
