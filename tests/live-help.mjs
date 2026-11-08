import assert from "node:assert/strict";
const base="https://inventario-pet.pet-educacao.workers.dev";
const files=[
  {path:"/ajuda/",markers:['Central de Ajuda do Inventário','id="visao-geral"','id="gmail"','id="cloudflare"','/ajuda/ajuda.js']},
  {path:"/ajuda/ajuda.js",markers:['help-print-button','window.print()']},
  {path:"/ajuda/ajuda.css",markers:["@media print","@page{size:A4",".help-main"]},
  {path:"/",markers:['id="public-sidebar"'],forbidden:['href="/ajuda/" data-public-action="help"']},
  {path:"/admin/",markers:['data-admin-route="true"'],forbidden:['href="/ajuda/" data-public-action="help"']},
  {path:"/admin-stage.js",markers:['["ajuda","box","Ajuda"]','function adminHelp(root)','/ajuda/?embed=1','APAGAR TODAS AS RESERVAS','data-rename-group','function adminRenameVariationGroup(']}
];
for(const {path,markers,forbidden=[]} of files){
  let response=null,body="";
  for(let n=0;n<5;n++){
    response=await fetch(base+path,{headers:{"cache-control":"no-cache"}});
    body=await response.text();
    if(response.ok&&markers.every(x=>body.includes(x))&&forbidden.every(x=>!body.includes(x)))break;
    if(n<4)await new Promise(resolve=>setTimeout(resolve,900));
  }
  assert.ok(response.ok,"Recurso Ajuda não publicado: "+path+" HTTP "+response.status);
  for(const x of markers)assert.ok(body.includes(x),"Recurso "+path+" sem marcador "+x);
  for(const x of forbidden)assert.ok(!body.includes(x),"Recurso "+path+" não pode incluir "+x);
  console.log("AJUDA PUBLICADA OK: "+path);
}
// Segurança verificada nas respostas reais do Worker após o deploy.
for(const route of ["/","/admin/","/ajuda/"]){
  let res,policy="";
  for(let attempt=0;attempt<8;attempt++){
    res=await fetch(base+route,{headers:{"cache-control":"no-cache"}});
    policy=res.headers.get("content-security-policy")||"";
    if(res.ok&&policy.includes("script-src 'self'"))break;
    if(attempt<7)await new Promise(resolve=>setTimeout(resolve,1200));
  }
  assert.ok(res.ok,"Página de segurança indisponível: "+route);
  for(const rule of ["script-src 'self'","script-src-attr 'none'","object-src 'none'","frame-ancestors 'self'","connect-src 'self'","base-uri 'self'"]){
    assert.ok(policy.includes(rule),route+" sem regra CSP: "+rule);
  }
  assert.equal(res.headers.get("x-frame-options"),"SAMEORIGIN",route+" precisa bloquear iframe de site alheio.");
  assert.equal(res.headers.get("x-content-type-options"),"nosniff");
  assert.equal(res.headers.get("referrer-policy"),"no-referrer");
  console.log("SEGURANÇA PUBLICADA OK: "+route);
}
const exposed=await fetch(base+"/api/catalog",{headers:{"cache-control":"no-cache"}});
assert.ok(exposed.ok);
assert.equal(exposed.headers.get("cache-control"),"no-store");
assert.ok(!exposed.headers.has("access-control-allow-origin"),"API não deve liberar CORS irrestrito.");
const body=JSON.stringify(await exposed.json());
assert.doesNotMatch(body,/"password_hash"\s*:|"password_salt"\s*:|"recovery_hash"\s*:|"token_reserva"\s*:|"usuario_sessoes"\s*:/);
for(const route of ["/api/admin/state","/api/admin/backup","/api/admin/users","/api/admin/export"]){
  const guarded=await fetch(base+route,{headers:{"cache-control":"no-cache"}});
  assert.equal(guarded.status,401,"Sem cookie não pode consultar "+route);
  assert.equal(guarded.headers.get("cache-control"),"no-store");
  assert.ok(!guarded.headers.has("access-control-allow-origin"),"Rotas privadas nunca liberam CORS.");
}
console.log("API PUBLICADA OK: campos públicos filtrados, login exigido e dados privados inacessíveis sem sessão.");
console.log("CENTRAL DE AJUDA: publicada e pronta para consulta ou impressão/PDF.");
