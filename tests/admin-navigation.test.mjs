import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM, VirtualConsole} from "jsdom";

const html=readFileSync("public/index.html","utf8");
const app=readFileSync("public/app.js","utf8");
const errors=[];
const virtualConsole=new VirtualConsole();
virtualConsole.on("jsdomError",e=>errors.push(String(e)));
const dom=new JSDOM(html,{url:"https://inventario-pet.pet-educacao.workers.dev/",runScripts:"dangerously",pretendToBeVisual:true,virtualConsole});
const w=dom.window, d=w.document;
w.addEventListener("error",e=>errors.push(String(e.error||e.message)));
w.addEventListener("unhandledrejection",e=>errors.push(String(e.reason)));
w.localStorage.setItem("pet_inventario_nome","Tester");
w.confirm=()=>true;
let authenticated=false;
const component={id:1,categoria_id:1,nome:"ESP32 de teste",imagem:"",patrimonio:"DEMO",identificacao:"",quantidade:5,em_uso:0,com_defeito:0,mostrar_quantidade:1,mostrar_em_uso:1,mostrar_defeito:1,ultima_alteracao:null};
const data={categorias:[{id:1,nome:"Eletrônica",ordem:1}],componentes:[component]};
const pending={id:5,componente_id:1,componente_nome:"ESP32 de teste",nome_solicitante:"Visitante",contato:"",quantidade:1,data_inicio:"2026-12-01",data_devolucao:"2026-12-02",status:"pendente",solicitado_em:"2026-11-06T12:00:00Z"};
const adminData={...data,reservas:[pending],configuracoes:{limpeza_reservas:"nunca",modo_demo:"sim"}};
w.fetch=async (uri,init={})=>{
  const url=new URL(uri,w.location.href), path=url.pathname;
  let status=200,value={};
  if(path==="/api/catalog")value={...data,demonstracao:true};
  else if(path==="/api/admin/state")authenticated?value=adminData:(status=401,value={error:"Entre no painel administrativo."});
  else if(path==="/api/login"){authenticated=true;value={ok:true}}
  else if(path==="/api/availability")value={disponiveis:5};
  else {status=404;value={error:"Rota não encontrada"};}
  return {ok:status<400,status,json:async()=>value};
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const tab=name=>d.querySelector('[data-tab="'+name+'"]');
const panel=()=>d.querySelector("#admin-tab-body");
const click=async el=>{assert.ok(el,"Controle não encontrado");el.click();await tick();await tick();};
w.eval(app);
await tick();
assert.ok(d.querySelector(".item-card"),"Catálogo não abriu");
await click(d.querySelector("#admin-button"));
const password=d.querySelector("#admin-password");
assert.ok(password,"Login do administrador não abriu");
assert.equal(password.type,"password");
await click(d.querySelector("#password-toggle"));
assert.equal(password.type,"text","Botão Mostrar não funciona");
await click(d.querySelector("#password-toggle"));
assert.equal(password.type,"password","Botão Ocultar não funciona");
password.value="senha-de-teste";
d.querySelector("#login-form").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
await tick();await tick();await tick();
assert.equal(tab("reservas")?.classList.contains("active"),true,"Painel deveria mostrar reservas pendentes após entrar");
assert.match(panel()?.textContent||"",/Visitante/,"A reserva pendente não aparece");
assert.ok(panel()?.querySelector('[data-action-reserve="aprovar"]'),"Botão Aprovar indisponível");
for (const [key,title] of [["materiais","Materiais cadastrados"],["reservas","Solicitações e devoluções"],["categorias","Categorias do inventário"],["configuracoes","Configurações gerais"]]) {
  await click(tab(key));
  assert.equal(tab(key)?.classList.contains("active"),true,"Aba "+key+" não ativou");
  assert.match(panel()?.textContent||"",new RegExp(title),"Conteúdo de "+key+" não abriu");
  if(key==="configuracoes") {
    const selector=d.querySelector("#setting-cleanup");
    assert.ok(selector?.querySelector('option[value="1min"]'),"A opção 1 minuto (teste) não apareceu");
    selector.value="1min";
    assert.equal(selector.value,"1min","O prazo de teste não pode ser selecionado");
    assert.equal(d.querySelector("#custom-days")?.hidden,true,"A opção de 1 minuto não deve pedir quantidade de dias");
  }
}
await click(tab("materiais"));
await click(d.querySelector("#add-item"));
assert.ok(d.querySelector("#item-form"),"Formulário de cadastro de materiais não abriu");
assert.deepEqual(errors,[],"Erros de JavaScript no painel");
console.log("UI OK: login, Mostrar/Ocultar, reserva pendente, quatro abas e cadastro.");
w.close();
