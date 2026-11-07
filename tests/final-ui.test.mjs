import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM,VirtualConsole} from "jsdom";

// Execute the exact four scripts included by index.html. Never contact the
// Cloudflare Worker or the production D1 database.
const html=readFileSync("public/index.html","utf8");
const sources=["app.js","identity-ui.js","component-art.js","final.js","admin-stage.js"]
  .map(name=>readFileSync("public/"+name,"utf8"));
const errors=[];
const vc=new VirtualConsole();
vc.on("jsdomError",e=>errors.push(String(e)));
const dom=new JSDOM(html,{url:"https://inventario-pet.pet-educacao.workers.dev/",runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;
w.addEventListener("error",e=>errors.push(String(e.error||e.message)));
w.addEventListener("unhandledrejection",e=>errors.push(String(e.reason)));
w.confirm=()=>true;
// jsdom não implementa rolagem; navegadores reais implementam.
w.HTMLElement.prototype.scrollIntoView=function(){};
let adminAuthenticated=false;
const material={
  id:1,categoria_id:1,nome:"ESP32 de teste",imagem:"",patrimonio:"PET-001",
  identificacao:"",quantidade:5,em_uso:1,com_defeito:0,
  mostrar_quantidade:1,mostrar_em_uso:1,mostrar_defeito:1,
  ultima_alteracao:"2026-11-06T12:00:00Z",arquivado:0
};
const catalog={categorias:[{id:1,nome:"Eletrônica",ordem:1}],componentes:[material],demonstracao:false};
const pending={id:9,componente_id:1,componente_nome:"ESP32 de teste",nome_solicitante:"Visitante",
  quantidade:1,status:"pendente",data_inicio:"2026-11-08",data_devolucao:"2026-11-10"};
const adminState={...catalog,reservas:[pending],configuracoes:{limpeza_reservas:"nunca",modo_demo:"nao"}};
const user={id:"PET-TESTE",nome:"Usuário teste",login:"usuario-teste",tag:"visitante",
  ativo:true,trocar_senha:false,precisa_criar_login:false};
w.fetch=async(uri,init={})=>{
  const path=new URL(uri,w.location.href).pathname;
  let status=200,body={ok:true};
  if(path==="/api/catalog")body=catalog;
  else if(path==="/api/filaments")body={filamentos:[{id:20,cor:"Azul",hexadecimal:"#2A69D6",quantidade:3,atualizado_em:"2026-11-06T12:00:00Z"}]};
  else if(path==="/api/identity/me")body={ok:true,usuario:user};
  else if(path==="/api/notifications")body={notificacoes:[],nao_lidas:0};
  else if(path==="/api/admin/state"){
    if(adminAuthenticated)body=adminState;
    else {status=401;body={error:"Entre no painel administrativo."};}
  }
  else if(path==="/api/login"){adminAuthenticated=true;body={ok:true};}
  else if(path==="/api/admin/users")body={usuarios:[]};
  else if(path==="/api/my/loans")body={emprestimos:[]};
  else {status=404;body={error:"Rota inexistente no teste: "+path};}
  return {ok:status<400,status,json:async()=>body};
};
const pause=(ms=90)=>new Promise(resolve=>setTimeout(resolve,ms));
const click=async(selector)=>{
  const node=d.querySelector(selector);
  assert.ok(node,"Elemento não encontrado: "+selector);
  node.click();
  await pause();
};
w.eval(sources.join("\n;\n")+"\n;window.__pagination_test={state,UI,finalRender};");
await pause(180);
assert.ok(d.querySelector(".catalog-card"),"O novo catálogo não foi montado.");
assert.ok(d.querySelector(".catalog-photo img"),"A ilustração do material não foi montada.");
assert.equal(d.querySelector(".catalog-photo img").getAttribute("src"),"/img/reference-board.svg","O desenho vetorial local não foi restaurado.");
assert.ok(d.querySelector("#public-sidebar [data-public-action='loans']"),"Menu lateral não tem minhas retiradas.");
assert.ok(d.querySelector("#public-sidebar [data-public-action='admin']"),"Menu lateral não tem administração.");
await click("#public-menu-toggle");
assert.ok(w.document.body.classList.contains("public-nav-open"),"Menu móvel não abriu.");
assert.equal(d.querySelector("#public-nav-overlay").hidden,false,"Fundo do menu não apareceu.");
await click("#public-nav-overlay");
assert.equal(d.querySelector("#public-nav-overlay").hidden,true,"Menu móvel não fechou.");
const mobileSearch=d.querySelector("#search-mobile");
mobileSearch.value="Azul";mobileSearch.dispatchEvent(new w.Event("input",{bubbles:true}));
await pause();
assert.equal(d.querySelector("#search").value,"Azul","Buscas do desktop e celular não sincronizadas.");
assert.equal(d.querySelectorAll(".filament-public-card").length,1);
mobileSearch.value="";mobileSearch.dispatchEvent(new w.Event("input",{bubbles:true}));
await pause();
const art=w.componentArt("Adaptador de bateria");
assert.match(art,/^data:image\/svg\+xml/);
assert.notEqual(art,w.componentArt("Adaptador de cartão"),"Ilustrações de componentes diferentes não podem ser idênticas.");
assert.ok(!art.includes("commons.wikimedia"),"Fotografia externa indevida.");
await click('[data-photo="1"]');
assert.ok(d.querySelector(".photo-lightbox"),"Ampliar desenho não funcionou.");
await click("#modal-root [data-close]");
assert.ok(d.querySelector(".filament-public-card"),"O card de filamento não apareceu.");
assert.match(d.querySelector("#category-filters").textContent,/Filamentos/);
assert.equal(d.querySelector("#stat-items").textContent,"2");
await click("#admin-button");
assert.ok(d.querySelector("#v2-admin-password"),"A tela nova de login administrativo não abriu.");
const field=d.querySelector("#v2-admin-password");
field.value="senha-falsa-no-teste";
await click("#v2-admin-show-password");
assert.equal(field.type,"text");
await click("#v2-admin-show-password");
assert.equal(field.type,"password");
d.querySelector("#v2-admin-login").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
await pause(180);
assert.ok(d.querySelector(".admin-layout"),"Novo painel administrativo não foi exibido.");
assert.equal(d.querySelector("#admin-stage").hidden,false);
assert.match(d.querySelector("#admin-content").textContent,/Materiais/);
await click('[data-admin-tab="filamentos"]');
assert.match(d.querySelector("#admin-content").textContent,/Azul/);
assert.ok(d.querySelector("#filament-add"),"O cadastro de filamentos está indisponível.");
await click('[data-admin-tab="reservas"]');
assert.match(d.querySelector("#admin-content").textContent,/Visitante/);
await click('[data-admin-tab="materiais"]');
assert.match(d.querySelector("#admin-content").textContent,/ESP32 de teste/);
// Catálogo com 216 entradas de exemplo: 18 páginas de 12, como na captura.
const t=w.__pagination_test;
t.state.data.componentes=Array.from({length:215},(_,i)=>({...t.state.data.componentes[0],id:i+1,nome:"Material "+String(i+1).padStart(3,"0")}));
t.UI.category="all";t.UI.page=7;t.state.query="";t.finalRender();
const pagination=d.querySelector("#catalog-pagination");
assert.match(pagination.textContent,/18 páginas/,"Mostrar total de páginas em vez de quantidade de itens.");
assert.doesNotMatch(pagination.textContent,/216 itens/,"Não mostrar contador de itens.");
assert.ok(pagination.querySelector('button[data-page="18"][title="Ir para a última página"]'),"Botão da última página sempre visível.");
assert.equal(pagination.querySelector('[aria-current="page"]').dataset.page,"7");
await click('#catalog-pagination button[data-page="18"]');
assert.equal(d.querySelector('#catalog-pagination [aria-current="page"]').dataset.page,"18","Clique deve ir direto à última página.");
assert.match(d.querySelector("#catalog-pagination").textContent,/18 páginas/);
assert.equal(d.querySelectorAll("#category-sections .catalog-card").length,12);
t.state.data.componentes=[];t.UI.page=1;t.UI.category="filaments";t.finalRender();
assert.match(d.querySelector("#catalog-pagination").textContent,/1 página/,"Uma única página deve ser identificada.");
assert.ok(!d.querySelector("#catalog-pagination button"),"Não há navegação desnecessária em uma página.");
assert.deepEqual(errors,[],"Erros na nova interface.");
console.log("NOVA UI OK: catálogo, cards, filamentos, login, painel, reservas e materiais.");
w.close();
