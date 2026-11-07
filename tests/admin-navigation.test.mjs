import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM, VirtualConsole} from "jsdom";

const html=readFileSync("public/index.html","utf8");
const app=readFileSync("public/app.js","utf8");
const identityUi=readFileSync("public/identity-ui.js","utf8");
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
let userTag="visitante";
let userDeleted=false;
let identityAuthenticated=true;
let mustChange=false;
const component={id:1,categoria_id:1,nome:"ESP32 de teste",imagem:"",patrimonio:"DEMO",identificacao:"",quantidade:5,em_uso:0,com_defeito:0,mostrar_quantidade:1,mostrar_em_uso:1,mostrar_defeito:1,ultima_alteracao:null};
const data={categorias:[{id:1,nome:"Eletrônica",ordem:1}],componentes:[component]};
const pending={id:5,componente_id:1,componente_nome:"ESP32 de teste",nome_solicitante:"Visitante",contato:"",quantidade:1,data_inicio:"2026-12-01",data_devolucao:"2026-12-02",status:"pendente",solicitado_em:"2026-11-06T12:00:00Z"};
const approved={...pending,id:6,nome_solicitante:"Reserva aprovada",status:"aprovada"};
const picked={...pending,id:7,nome_solicitante:"Reserva em uso",status:"retirada"};
const late={...pending,id:8,nome_solicitante:"Reserva atrasada",status:"retirada",data_devolucao:"2026-10-01"};
const finished={...pending,id:9,nome_solicitante:"Reserva concluida",status:"devolvida"};
const adminData={...data,reservas:[pending,approved,picked,late,finished],configuracoes:{limpeza_reservas:"nunca",modo_demo:"sim"}};
w.fetch=async (uri,init={})=>{
  const url=new URL(uri,w.location.href), path=url.pathname;
  let status=200,value={};
  if(path==="/api/catalog")value={...data,demonstracao:true};
   else if(path==="/api/filaments")value={ok:true,filamentos:[]};
  else if(path==="/api/admin/state")authenticated?value=adminData:(status=401,value={error:"Entre no painel administrativo."});
  else if(path==="/api/login"){authenticated=true;value={ok:true}}
  else if(path==="/api/identity/me")value={ok:true,usuario:identityAuthenticated?{id:"PET-123456789ABC",nome:"Tester",login:"tester01",email:"tester@example.com",tag:userTag,ativo:true,trocar_senha:mustChange,precisa_criar_login:false,criado_em:"2026-11-06T10:00:00Z"}:null};
  else if(path==="/api/identity/logout"){identityAuthenticated=false;value={ok:true};}
  else if(path==="/api/identity/login"){identityAuthenticated=true;value={ok:true,usuario:{id:"PET-123456789ABC",nome:"Tester",login:"tester01",email:"tester@example.com",tag:userTag,ativo:true,trocar_senha:mustChange,precisa_criar_login:false,criado_em:"2026-11-06T10:00:00Z"}};}
  else if(path==="/api/identity/register"){identityAuthenticated=true;value={ok:true,usuario:{id:"PET-23456789ABCD",nome:"Nova conta",login:"novaconta",email:"nova@example.com",tag:"visitante",ativo:true,trocar_senha:false,precisa_criar_login:false,criado_em:"2026-11-06T10:00:00Z"}};}
  else if(path==="/api/identity/password"){mustChange=false;value={ok:true,usuario:{id:"PET-123456789ABC",nome:"Tester",login:"tester01",email:"tester@example.com",tag:userTag,ativo:true,trocar_senha:false,precisa_criar_login:false,criado_em:"2026-11-06T10:00:00Z"}};}
  else if(path==="/api/admin/users"){if(init.method==="POST"){userTag=JSON.parse(init.body).tag;value={ok:true}}else value={ok:true,usuarios:userDeleted?[]:[{id:"PET-123456789ABC",nome:"Tester",login:"tester01",email:"tester@example.com",tag:userTag,ativo:1,retiradas_ativas:0,criado_em:"2026-11-06T10:00:00Z"}]};}
  else if(path==="/api/admin/users/password"){identityAuthenticated=false;mustChange=true;value={ok:true,id:"PET-123456789ABC",nome:"Tester",login:"tester01",senha_temporaria:"PET-"+"A".repeat(24)};}
  else if(path==="/api/admin/users/delete"){userDeleted=true;value={ok:true};}
  else if(path==="/api/availability")value={disponiveis:5};
  else {status=404;value={error:"Rota não encontrada"};}
  return {ok:status<400,status,json:async()=>value};
};
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
const tab=name=>d.querySelector('[data-tab="'+name+'"]');
const panel=()=>d.querySelector("#admin-tab-body");
const click=async el=>{assert.ok(el,"Controle não encontrado");el.click();await tick();await tick();};
// No navegador os scripts classicos compartilham escopo global; no jsdom eval,
// compilamos ambos no mesmo contexto para reproduzir esse comportamento.
// O teste do painel legado usa substitutos de imagens sem acessar a rede.
// A interface real, com os helpers reais, é verificada em final-ui.test.mjs.
w.eval("const UI={filaments:[]};\n"+app+"\n"+identityUi+"\nfunction itemImage(x){return x.imagem||'/img/reference-board.svg';} function defaultImage(){return '/img/reference-board.svg';}\nwindow.__identity_test_state=state;");
// Teste legado carrega apenas app.js: impedir navegação real no jsdom,
// pois o fluxo da página nova e o link direto são cobertos em final-ui.test.mjs.
d.querySelector("#admin-button").addEventListener("click",e=>e.preventDefault());
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
for (const [key,title] of [["materiais","Materiais cadastrados"],["reservas","Solicitações e devoluções"],["usuarios","Usuários cadastrados"],["categorias","Categorias do inventário"],["configuracoes","Configurações gerais"]]) {
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
// Grupos de reservas sem sobreposicao: pendente nao e ativo.
await click(tab("reservas"));
const shown=()=>Array.from(panel().querySelectorAll(".admin-list .admin-list-row")).map(x=>x.textContent).join(" ");
const choose=async key=>click(panel().querySelector('[data-r-filter="'+key+'"]'));
await choose("pendente");
assert.match(shown(),/Visitante/);
assert.doesNotMatch(shown(),/Reserva aprovada|Reserva em uso|Reserva atrasada|Reserva concluida/);
await choose("ativas");
assert.match(shown(),/Reserva aprovada/);
assert.match(shown(),/Reserva em uso/);
assert.doesNotMatch(shown(),/Visitante|Reserva atrasada|Reserva concluida/);
await choose("atrasadas");
assert.match(shown(),/Reserva atrasada/);
assert.doesNotMatch(shown(),/Visitante|Reserva aprovada|Reserva em uso/);
await choose("concluidas");
assert.match(shown(),/Reserva concluida/);
assert.doesNotMatch(shown(),/Visitante|Reserva aprovada|Reserva em uso|Reserva atrasada/);
await choose("todas");
assert.equal(panel().querySelectorAll(".admin-list .admin-list-row").length,5);
await click(tab("materiais"));
await click(d.querySelector("#add-item"));
assert.ok(d.querySelector("#item-form"),"Formulário de cadastro de materiais não abriu");
await click(d.querySelector("#i-cancel"));
await click(tab("usuarios"));
await click(d.querySelector('[data-user-tag="petiano"]'));
assert.equal(userTag,"petiano","O administrador não conseguiu dar a tag PETiano");
assert.equal(w.__identity_test_state.identity?.login,"tester01","Mock de perfil autenticado deve estar carregado");
await click(d.querySelector("#profile-button"));
assert.ok(d.querySelector("#identity-refresh-tag"),"Perfil carregado incorreto: "+(d.querySelector("#modal-root")?.textContent||"sem modal").slice(0,350));
await click(d.querySelector("#identity-refresh-tag"));
assert.match(d.querySelector("#reserve-button").textContent,/Registrar retirada/,"PETiano deve receber o acesso direto");
await click(d.querySelector("#reserve-button"));
assert.ok(d.querySelector("#member-withdraw-form"),"Formulário de retirada direta não abriu");
await click(d.querySelector("#admin-button"));
await click(tab("usuarios"));
await click(d.querySelector("[data-user-password]"));
assert.ok(d.querySelector("#admin-reset-password-form"),"Faltou redefinicao de senha pelo administrador");
assert.equal(d.querySelector("#admin-reset-login").value,"tester01");
d.querySelector("#admin-reset-password-form").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
await tick();await tick();
assert.equal(d.querySelector("#admin-temp-password").value,"PET-"+"A".repeat(24));
assert.equal(d.querySelector("#admin-temp-login").value,"tester01");
await click(d.querySelector("#admin-reset-done"));
await click(d.querySelector("[data-user-delete]"));
assert.ok(d.querySelector("#admin-delete-confirm"),"Faltou opcao de exclusao");
await click(d.querySelector("#admin-delete-confirm"));
await tick();
assert.equal(userDeleted,true,"Usuario nao foi excluido pelo painel");

// A tela de autenticação não deve continuar pedindo o ID ou código antigo.
await click(d.querySelector("#profile-button"));
await click(d.querySelector("#identity-logout"));
assert.ok(d.querySelector("#identity-login-form"),"Formulário de login não apareceu");
assert.ok(d.querySelector("#identity-login"),"Campo de nome de usuário ausente");
assert.ok(d.querySelector("#identity-login-password"),"Campo de senha ausente");
assert.equal(d.querySelector("#identity-recovery-code"),null,"Código antigo não deve aparecer");
await click(d.querySelector("#identity-forgot"));
assert.ok(d.querySelector("#identity-forgot-back"),"A tela de senha esquecida não abriu");
await click(d.querySelector("#identity-forgot-back"));
assert.ok(d.querySelector("#identity-login-form"),"Voltar ao login não funcionou");
d.querySelector("#identity-login").value="tester01";
d.querySelector("#identity-login-password").value="PET-"+"A".repeat(24);
d.querySelector("#identity-login-form").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
await tick();await tick();
assert.ok(d.querySelector("#identity-change-form"),"Senha temporária deve exigir troca");
d.querySelector("#identity-new-password").value="SenhaDefinitiva123!";
d.querySelector("#identity-new-confirm").value="SenhaDefinitiva123!";
d.querySelector("#identity-change-form").dispatchEvent(new w.Event("submit",{bubbles:true,cancelable:true}));
await tick();await tick();
assert.ok(d.querySelector("#identity-profile-head")||d.querySelector("#identity-change-password"),"Perfil não abriu depois da troca");
assert.deepEqual(errors,[],"Erros de JavaScript no painel");
console.log("UI OK: administração, filtros, tags, redefinição temporária, login e troca obrigatória de senha.");
w.close();
