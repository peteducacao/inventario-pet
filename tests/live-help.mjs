import assert from "node:assert/strict";
const base="https://inventario-pet.pet-educacao.workers.dev";
const files=[
  {path:"/ajuda/",markers:['Central de Ajuda do Inventário','id="visao-geral"','id="gmail"','id="cloudflare"','window.print()']},
  {path:"/ajuda/ajuda.css",markers:["@media print","@page{size:A4",".help-main"]},
  {path:"/",markers:['href="/ajuda/" data-public-action="help"']},
  {path:"/admin/",markers:['href="/ajuda/" data-public-action="help"']},
  {path:"/admin-stage.js",markers:['["ajuda","box","Ajuda"]','function adminHelp(root)','/ajuda/?embed=1','APAGAR TODAS AS RESERVAS']}
];
for(const {path,markers} of files){
  let response=null,body="";
  for(let n=0;n<5;n++){
    response=await fetch(base+path,{headers:{"cache-control":"no-cache"}});
    body=await response.text();
    if(response.ok&&markers.every(x=>body.includes(x)))break;
    if(n<4)await new Promise(resolve=>setTimeout(resolve,900));
  }
  assert.ok(response.ok,"Recurso Ajuda não publicado: "+path+" HTTP "+response.status);
  for(const x of markers)assert.ok(body.includes(x),"Recurso "+path+" sem marcador "+x);
  console.log("AJUDA PUBLICADA OK: "+path);
}
console.log("CENTRAL DE AJUDA: publicada e pronta para consulta ou impressão/PDF.");
