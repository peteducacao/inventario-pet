import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM,VirtualConsole} from "jsdom";

const scripts=["app.js","identity-ui.js","component-art.js","final.js","admin-stage.js"]
  .map(name=>readFileSync("public/"+name,"utf8")).join("\n;\n");
const invalidSelectors=readFileSync("public/admin-stage.js","utf8").split("\n")
  .filter(line=>/^\s*\$\(/.test(line)&&line.includes(".forEach("));
assert.equal(invalidSelectors.length,0,
  "A função $ seleciona um elemento; laços sobre botões precisam usar $$: "+invalidSelectors.join(" | "));

const one={id:1,categoria_id:1,nome:"Resistor 100Ω",imagem:"",grupo_variacoes:"Resistores",
  quantidade:15,em_uso:0,com_defeito:0,mostrar_quantidade:1,mostrar_em_uso:1,mostrar_defeito:1,
  visivel_visitante:1,permitir_petianos:1,permitir_visitantes:1,arquivado:0,patrimonio:"",identificacao:"",ultima_alteracao:"2026-11-06T10:00:00Z"};
const two={...one,id:2,nome:"Resistor 220Ω",quantidade:9};
const three={...one,id:3,nome:"Arduino Uno",grupo_variacoes:"Arduino",quantidade:6};
const extra={...one,id:4,categoria_id:2,nome:"Tablet de uso interno",visivel_visitante:0};
const alkalineNormal={...one,id:5,nome:"Alcalina 1.5V Pilha normal",grupo_variacoes:"Alcalina",quantidade:25};
const alkalinePalito={...one,id:6,nome:"Alcalina 1.5V Pilha Palito",grupo_variacoes:"Alcalina",quantidade:4};
const alkalineNine={...one,id:7,nome:"Alcalina 9V",grupo_variacoes:"Alcalina",quantidade:31};
const categories=[{id:1,nome:"Eletrônica",visivel_visitante:1,arquivada:0,ordem:0,permitir_emprestimos:1,permitir_petianos:1,permitir_visitantes:1},
  {id:2,nome:"Equipamentos",visivel_visitante:0,arquivada:0,ordem:1,permitir_emprestimos:1,permitir_petianos:1,permitir_visitantes:1},
  {id:3,nome:"Filamentos",visivel_visitante:1,arquivada:0,ordem:2,permitir_emprestimos:0,permitir_petianos:0,permitir_visitantes:0}];
const colors=[{id:20,cor:"Azul",hexadecimal:"#2A69D6",quantidade:3,visivel_visitante:1,permitir_emprestimos:0,permitir_petianos:0,permitir_visitantes:0,componente_id:200,em_uso:0,com_defeito:0,categoria_id:3,categoria_permite:0,categoria_petianos:0,categoria_visitantes:0},
  {id:21,cor:"Preto",hexadecimal:"#24272C",quantidade:2,visivel_visitante:0,permitir_emprestimos:0,permitir_petianos:0,permitir_visitantes:0,componente_id:201,em_uso:0,com_defeito:0,categoria_id:3,categoria_permite:0,categoria_petianos:0,categoria_visitantes:0}];
const visitorCatalog={categorias:[categories[0],categories[2]],componentes:[one,two,three,alkalineNormal,alkalinePalito,alkalineNine],demonstracao:false};
const fullAdmin={categorias:categories,componentes:[one,two,three,alkalineNormal,alkalinePalito,alkalineNine,extra],
  filamentos:colors,reservas:[{id:9,componente_id:1,componente_nome:"Resistor 100Ω",
    nome_solicitante:"Teste",quantidade:1,status:"pendente",data_inicio:"2026-12-01",data_devolucao:"2026-12-03"}],
  configuracoes:{modo_demo:"nao",limpeza_reservas:"nunca",limpeza_historico:"nunca"}};
const identity={id:"PET-AABBCCDDEEFF",nome:"Pessoa teste",email:"pessoa@example.com",tag:"visitante",login:"teste01",
  ativo:true,trocar_senha:false,precisa_criar_login:false};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function build(isAdmin,alreadyAdmin=false,identityLoggedIn=true,returningFromAdmin=false){
  const errors=[];
  const vc=new VirtualConsole();
  vc.on("jsdomError",e=>errors.push(String(e)));
  const documentName=isAdmin?"public/admin/index.html":"public/index.html";
  const url="https://inventario-pet.pet-educacao.workers.dev/"+(isAdmin?"admin/":"");
  const dom=new JSDOM(readFileSync(documentName,"utf8"),{url,runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window,d=w.document;
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.confirm=()=>true;
  w.addEventListener("error",e=>errors.push(String(e.error||e.message)));
  w.addEventListener("unhandledrejection",e=>errors.push(String(e.reason)));
  let adminAuthenticated=alreadyAdmin;
  const pendingNotices=[],adminReservationRequests=[],templateSaves=[],mailEventSaves=[],variationRenameRequests=[];
  const eventOptions=Object.fromEntries(["antes","hoje","atraso2","atraso7","manual"].map(event=>[event,true]));
  let noticeRequestCount=0;
  w.fetch=async(uri,init={})=>{
    const path=new URL(uri,w.location.href).pathname;
    let status=200,body={ok:true};
    if(path==="/api/catalog")body=visitorCatalog;
    else if(path==="/api/filaments")body={ok:true,filamentos:[colors[0]]};
    else if(path==="/api/identity/me")body={ok:true,usuario:identityLoggedIn?identity:null};
    else if(path==="/api/notifications"){noticeRequestCount++;body={notificacoes:pendingNotices,nao_lidas:pendingNotices.filter(x=>!x.lida_em).length};}
    else if(path==="/api/admin/reservation"){adminReservationRequests.push(JSON.parse(init.body||"{}"));body={ok:true,notificacao_registrada:true};}
    else if(path==="/api/admin/state"){
      if(adminAuthenticated)body=fullAdmin;
      else {status=401;body={error:"Entre no painel administrativo."};}
    }else if(path==="/api/login"){adminAuthenticated=true;body={ok:true};}
    else if(path==="/api/logout"){adminAuthenticated=false;body={ok:true};}
    else if(path==="/api/admin/log")body={ok:true,eventos:[
      {id:5,criado_em:"2026-11-06T13:00:00Z",responsavel:"Teste",acao:"Editou",tipo:"material",registro_id:1,descricao:"Quantidade alterada"},
      {id:4,criado_em:"2026-11-06T12:45:00Z",responsavel:"Teste",acao:"Editou",tipo:"categoria",registro_id:2,descricao:"Equipamentos"},
      {id:3,criado_em:"2026-11-06T12:30:00Z",responsavel:"Teste",acao:"Editou",tipo:"filamento",registro_id:21,descricao:"Preto"},
      {id:2,criado_em:"2026-11-06T12:15:00Z",responsavel:"Teste",acao:"Aprovou",tipo:"reserva",registro_id:9,descricao:"Reserva aprovada"},
      {id:1,criado_em:"2026-11-06T12:00:00Z",responsavel:"Teste",acao:"Criou",tipo:"usuario",registro_id:null,descricao:"Usuário novo"}],
      total:5,pagina:1,limpeza_historico:"nunca"};
    else if(path==="/api/admin/users")body={usuarios:[
      {id:"PET-AABBCCDDEEFF",nome:"Pessoa teste",email:"pessoa@example.com",login:"teste01",tag:"visitante",ativo:1,notificar_email:1},
      {id:"PET-ABCDEFAABBCC",nome:"PETiane teste",email:"pet@example.com",login:"pet01",tag:"petiano",ativo:1,notificar_email:0}
    ]};
    else if(path==="/api/admin/mail/events"){
      if(init.method==="POST"){mailEventSaves.push(JSON.parse(init.body||"{}"));body={ok:true,mensagem:"Preferências salvas."};}
      else body={ok:true,profiles:{visitante:{nome:"Visitantes",ativado:true,eventos:{...eventOptions}},petiano:{nome:"PETianes",ativado:false,eventos:{...eventOptions}}}};
    }
    else if(path==="/api/admin/mail/templates"){
      if(init.method==="POST"){templateSaves.push(JSON.parse(init.body||"{}"));body={ok:true};}
      else body={ok:true,templates:[
        {evento:"antes",nome:"Um dia antes",assunto:"Prazo de {material}",mensagem:"Olá {nome}, entregue em {prazo}. Consulte {link}"},
        {evento:"manual",nome:"Cobrança manual",assunto:"Cobrança: {material}",mensagem:"Olá {nome}. Devolva {material} até {prazo}."}
      ]};
    }
    else if(path==="/api/my/loans")body={emprestimos:[]};
    else if(path==="/api/admin/variations/rename"){
      const payload=JSON.parse(init.body||"{}");
      variationRenameRequests.push(payload);
      let changed=0;
      for(const item of fullAdmin.componentes){
        if(String(item.grupo_variacoes||"").toLocaleLowerCase("pt-BR")===String(payload.grupo_atual||"").toLocaleLowerCase("pt-BR")){
          item.grupo_variacoes=payload.novo_nome;changed++;
        }
      }
      body={ok:true,alterados:changed};
    }
    else if(path==="/api/admin/variations")body={ok:true,vinculados:2};
    else if(path==="/api/admin/visibility")body={ok:true,alterados:2};
    else {status=404;body={error:"Rota simulada não encontrada: "+path};}
    return {ok:status<400,status,json:async()=>body};
  };
  if(returningFromAdmin)w.sessionStorage.setItem("pet_check_identity_after_admin","1");
  w.eval(scripts+"\nwindow.__pageButtons=pageButtons;window.__adminTestState=state;window.__publicTestUI=UI;window.__finalRender=finalRender;");
  const click=async(sel)=>{
    const el=d.querySelector(sel);
    assert.ok(el,"Controle ausente: "+sel);
    el.click();await wait(55);
  };
  return {dom,w,d,errors,click,addNotice:x=>pendingNotices.unshift(x),noticeRequestCount:()=>noticeRequestCount,adminReservationRequests,templateSaves,mailEventSaves,variationRenameRequests};
}

const publicUI=build(false);
await wait(280);
const {w,d,click}=publicUI;
const p=w.__pageButtons({page:7,pages:18,total:216},"public");
assert.match(p,/18 páginas/,"Quantidade de páginas deve estar visível.");
assert.match(p,/data-page="18"/,"O último número de página deve aparecer.");
assert.match(p,/title="Ir para a última página"/,"Atalho para última página deve ser explícito.");
assert.doesNotMatch(p,/216 itens/,"Contagem de itens não deve aparecer no catálogo.");
assert.match(w.__pageButtons({page:18,pages:18,total:216},"public"),/aria-current="page"/);
assert.equal(d.body.classList.contains("catalog-loading"),false,"Catálogo ficou preso no carregamento.");
// Filtros persistidos de categorias arquivadas não podem deixar o catálogo vazio.
w.__publicTestUI.category="99999";w.__finalRender();
assert.equal(w.localStorage.getItem("pet_public_category"),"all","Filtro de categoria excluída ou arquivada deve voltar para Todos.");
assert.ok(d.querySelector('[data-category="all"]').classList.contains("active"));
assert.ok(d.querySelectorAll(".catalog-card").length>0,"Ao trocar o filtro antigo, o catálogo deve voltar a exibir materiais.");
assert.ok(publicUI.noticeRequestCount()>=1,"Sino deve consultar notificações logo após restaurar login.");
publicUI.addNotice({id:44,titulo:"Reserva recusada",mensagem:"Sua reserva #31 foi recusada por Ana Maria (PET).",criada_em:"2026-11-07T12:10:00Z",lida_em:null});
await click("#notification-button");
assert.match(d.querySelector("#notification-popover").textContent,/recusada por Ana Maria/,"Sino deve buscar notificação ao abrir.");
assert.equal(d.querySelector("#notification-count").textContent,"1","Sino deve mostrar aviso não lido.");
await click("#notification-button");
assert.equal(d.querySelector("#search").closest(".catalog-toolbar")!==null,true,"Busca não está junto à ordenação.");
assert.equal(d.querySelector("#search-mobile"),null,"Busca duplicada não deveria existir.");
assert.ok(d.querySelector("#public-sidebar").textContent.includes("Meus empréstimos"));
assert.equal(d.querySelectorAll("[data-public-action='reservations']").length,0,"Reservas redundantes ainda aparecem no menu.");
assert.equal(d.querySelectorAll(".grouped-card").length,2,"Resistores e Alcalinas devem ter cards de família.");
const arduinoSingle=Array.from(d.querySelectorAll(".catalog-card")).find(x=>x.querySelector("h3")?.textContent==="Arduino");
assert.ok(arduinoSingle,"Mesmo com um único vínculo, o catálogo deve exibir o nome salvo do grupo Arduino.");
assert.match(arduinoSingle.textContent,/Arduino Uno/,"O material individual não pode desaparecer sob o título do grupo.");
w.__adminTestState.query="Resistor 100";w.__finalRender();
assert.equal(d.querySelector('[data-open-variants="resistores"]')?.closest(".grouped-card")?.querySelector(".catalog-numbers strong")?.textContent,"24",
  "Buscar por um modelo deve manter o grupo completo no card, somando seus estoques.");
w.__adminTestState.query="Arduino";w.__finalRender();
assert.equal(d.querySelector(".catalog-card h3")?.textContent,"Arduino","A busca pelo grupo deve usar seu nome, não o do primeiro item.");
w.__adminTestState.query="";w.__finalRender();
assert.equal(d.querySelectorAll(".catalog-card").length,4,"Estoque agrupado não deveria gerar cards repetidos.");
assert.equal(d.querySelectorAll(".filament-public-card").length,1,"Filamentos devem continuar na grade do catálogo.");
assert.match(d.querySelector(".filament-public-card").textContent,/Reservar/,"Card de visitante deve exibir sempre a ação Reservar, mesmo quando o Admin a desativou.");
assert.equal(d.querySelector(".filament-public-card [data-reserve-item]"),null,"Filamento bloqueado não pode ter reserva ativa.");
assert.match(d.querySelector('[data-open-variants="resistores"]').closest(".grouped-card").textContent,/Resistores/);
assert.equal(d.querySelector('[data-open-variants="resistores"]').closest(".grouped-card").querySelector("h3").textContent,"Resistores","O card deve mostrar só a família.");
assert.ok(d.querySelector('[data-open-variants="resistores"]'),"O grupo deve abrir a seleção.");
assert.equal(d.querySelector('[data-open-variants="resistores"]').closest(".grouped-card").querySelector("[data-reserve-item]"),null,"Não retirar sem escolher o modelo.");
assert.match(d.querySelector('[data-open-variants="resistores"]').closest(".grouped-card").querySelector(".catalog-numbers").textContent,/24/,"O resumo precisa somar os modelos.");
await click('.catalog-photo[data-open-variants="resistores"]');
assert.equal(d.querySelectorAll(".variant-picker-option").length,2,"O toque no card deve mostrar os dois modelos.");
assert.match(d.querySelector("#modal-root").textContent,/Resistor 220Ω/);
await click('[data-pick-variant="2"]');
assert.equal(d.querySelector(".variant-picker-option"),null,"A seleção deve fechar a janela.");
assert.match(d.querySelector('[data-open-variants="resistores"]').closest(".grouped-card").querySelector(".variant-selected").textContent,/220/);
assert.match(d.querySelector('[data-open-variants="resistores"]').closest(".grouped-card").querySelector(".catalog-numbers").textContent,/9/);
assert.equal(d.querySelector('[data-open-variants="resistores"]').closest(".grouped-card").querySelector("[data-reserve-item]").dataset.reserveItem,"2","A retirada deve usar o modelo escolhido.");
assert.ok(d.querySelector('[data-open-variants="alcalina"]'),"Alcalina deve ser uma única família.");
assert.equal(d.querySelectorAll(".catalog-card").length,4);
assert.equal(d.querySelectorAll('[data-open-variants="alcalina"].catalog-photo').length,1,"Não repetir cards das três pilhas.");
assert.equal(d.querySelector('[data-open-variants="alcalina"].catalog-photo').closest(".catalog-card").querySelector("h3").textContent,"Alcalina");
assert.match(d.querySelector('[data-open-variants="alcalina"].catalog-photo').closest(".catalog-card").querySelector(".catalog-numbers").textContent,/60/,"Resumo soma 25 + 4 + 31.");
await click('.catalog-photo[data-open-variants="alcalina"]');
assert.equal(d.querySelectorAll(".variant-picker-option").length,3,"Mostrar os três modelos de Alcalina.");
assert.match(d.querySelector("#modal-root").textContent,/Alcalina 1.5V Pilha normal/);
assert.match(d.querySelector("#modal-root").textContent,/Alcalina 1.5V Pilha Palito/);
assert.match(d.querySelector("#modal-root").textContent,/Alcalina 9V/);
await click('[data-pick-variant="6"]');
const alkalineCard=d.querySelector('.catalog-photo[data-open-variants="alcalina"]').closest(".catalog-card");
assert.match(alkalineCard.querySelector(".variant-selected").textContent,/Pilha Palito/);
assert.equal(alkalineCard.querySelector("[data-reserve-item]").dataset.reserveItem,"6");
assert.match(alkalineCard.querySelector(".catalog-numbers").textContent,/4/);
await click('.variant-open[data-open-variants="alcalina"]');
assert.equal(d.querySelectorAll(".variant-picker-option").length,3,"Trocar modelo deve reabrir a seleção.");
await click("#modal-root [data-close]");
assert.equal(d.querySelector(".catalog-photo img").getAttribute("src").includes("commons.wikimedia"),false);
assert.ok(d.querySelector("#public-sidebar [data-public-action='admin']"),"Entrada Admin não apareceu.");
assert.equal(d.querySelector("#public-sidebar [data-public-action='admin']").tagName,"A","Admin deve ser um link real para abrir em nova guia.");
assert.equal(d.querySelector("#public-sidebar [data-public-action='admin']").getAttribute("href"),"/admin/");
assert.ok(d.querySelector("#public-nav-close"),"O menu deve ter botão próprio de fechar.");
assert.ok(d.querySelector(".public-sidebar-head"),"Menu com cabeçalho PET ausente.");
await click("#public-menu-toggle");
assert.ok(d.body.classList.contains("public-nav-open"));
await click("#public-nav-overlay");
assert.equal(d.body.classList.contains("public-nav-open"),false);
await click("#public-menu-toggle");
await click("#public-nav-close");
assert.equal(d.body.classList.contains("public-nav-open"),false,"Fechar menu pelo X precisa funcionar.");
const search=d.querySelector("#search");
search.value="Arduino";search.dispatchEvent(new w.Event("input",{bubbles:true}));
await wait(70);
assert.equal(d.querySelectorAll(".catalog-card").length,1,"Filtro de busca não funciona.");
search.value="";search.dispatchEvent(new w.Event("input",{bubbles:true}));
await wait(70);
await click('[data-photo]');
assert.ok(d.querySelector(".photo-lightbox"),"Ampliação dos desenhos não funciona.");
await click("#modal-root [data-close]");
assert.deepEqual(publicUI.errors,[],"Erros do catálogo.");
publicUI.dom.window.close();

const adminOnlyUser=build(false,true,false,true);
await wait(240);
assert.equal(adminOnlyUser.d.querySelector("#profile-name").textContent,"Entrar","Admin não deve fingir que alguém entrou como PETiane.");
assert.ok(adminOnlyUser.d.querySelector("#post-admin-personal-login"),"Ao retornar do Admin sem conta deve solicitar o login pessoal.");
assert.match(adminOnlyUser.d.querySelector("#modal-root").textContent,/sessão administrativa/,"Explicar que as duas autenticações são distintas.");
assert.equal(adminOnlyUser.w.sessionStorage.getItem("pet_check_identity_after_admin"),null,"Aviso deve aparecer uma vez só.");
await adminOnlyUser.click("#post-admin-personal-login");
assert.ok(adminOnlyUser.d.querySelector("#identity-login"),"O aviso deve abrir o formulário real da conta pessoal.");
assert.deepEqual(adminOnlyUser.errors,[],"Erros ao retornar do Admin sem conta pessoal.");
adminOnlyUser.dom.window.close();

const userAlreadyLogged=build(false,true,true,true);
await wait(240);
assert.equal(userAlreadyLogged.d.querySelector("#profile-name").textContent,identity.nome,"Conta já autenticada deve ser reconhecida após retorno do Admin.");
assert.equal(userAlreadyLogged.d.querySelector("#post-admin-personal-login"),null,"Não solicitar novo login quando conta já está conectada.");
assert.deepEqual(userAlreadyLogged.errors,[],"Erros com conta pessoal já autenticada.");
userAlreadyLogged.dom.window.close();


const refreshed=build(true,true);
await wait(180);
assert.equal(refreshed.d.querySelector("#v2-admin-password"),null,"Sessão válida não pode exibir login brevemente ao atualizar.");
assert.ok(refreshed.d.querySelector(".admin-layout"),"Sessão válida deve ir diretamente ao painel após verificar.");
assert.deepEqual(refreshed.errors,[],"Erros ao recarregar com sessão administrativa válida.");
refreshed.dom.window.close();

const adminUI=build(true);
await wait(160);
const {d:ad,click:adminClick,w:aw}=adminUI;
assert.equal(ad.body.dataset.adminRoute,"true");
assert.ok(ad.querySelector("#v2-admin-password"),"Entrada independente do Admin não abriu.");
assert.ok(ad.querySelector("#admin-stage .admin-access-card"),"Login do Admin deve aparecer na página, não em popup.");
assert.equal(ad.querySelector("#admin-stage").hidden,false,"Admin deve deixar o carregamento e exibir o login.");
assert.equal(ad.querySelector("#admin-stage").classList.contains("admin-loading"),false,"Admin não pode ficar preso carregando.");
assert.equal(ad.querySelector(".admin-access-links a").getAttribute("href"),"/","Acesso direto deve permitir voltar ao catálogo.");
assert.equal(ad.querySelector("#v2-admin-password").type,"password");
await adminClick("#v2-admin-show-password");
assert.equal(ad.querySelector("#v2-admin-password").type,"text");
await adminClick("#v2-admin-show-password");
ad.querySelector("#v2-admin-password").value="senha-de-teste";
ad.querySelector("#v2-admin-login").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(180);
assert.ok(ad.querySelector(".admin-layout"),"Admin separado não abriu.");
assert.equal(aw.sessionStorage.getItem("pet_check_identity_after_admin"),"1","Ao entrar no Admin marcar checagem de identidade pessoal no retorno.");
assert.equal(ad.querySelector(".admin-overview.three")?.children.length,3,"Painel precisa ter três indicadores.");
await adminClick('[data-admin-tab="reservas"]');
assert.ok(ad.querySelector('[data-res-do="recusar"]'),"A reserva pendente deve permitir recusa.");
assert.match(ad.querySelector('[data-res-do="aprovar"]').textContent,/Aprovar e entregar/);
await adminClick('[data-res-do="recusar"]');
assert.ok(ad.querySelector("#admin-refusal-actor"),"A recusa precisa identificar a pessoa responsável.");
assert.ok(ad.querySelector("#admin-refusal-reason"),"A recusa pode incluir motivo.");
ad.querySelector("#admin-refusal-actor").value="Ana Maria";
ad.querySelector("#admin-refusal-reason").value="Sem disponibilidade";
ad.querySelector("#admin-refusal-form").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(90);
assert.equal(adminUI.adminReservationRequests.at(-1).responsavel,"Ana Maria");
assert.equal(adminUI.adminReservationRequests.at(-1).observacao,"Sem disponibilidade");
await adminClick('[data-admin-tab="painel"]');
assert.ok(ad.querySelector("#dashboard-recent-log"),"Últimas alterações precisam estar dentro da visão geral.");
assert.equal(ad.querySelector(".admin-shortcuts"),null,"Atalhos fixos devem sair da visão geral.");
assert.equal(ad.querySelector("#dashboard-last-change"),null,"O destaque isolado não deve ocupar espaço.");
assert.equal(ad.querySelectorAll("#admin-content > .admin-panel").length,1,"Atividade recente não deve ser repetida abaixo.");
await wait(90);
assert.equal(ad.querySelectorAll(".dashboard-change").length,4,"Mostrar somente quatro últimas alterações.");
assert.equal(ad.querySelectorAll(".dashboard-change-emoji").length,4,"Cada alteração deve ter emoji.");
assert.match(ad.querySelector(".dashboard-change").textContent,/Quantidade alterada/);
assert.doesNotMatch(ad.querySelector("#dashboard-recent-log").textContent,/Usuário novo/,"A quinta alteração não deve aparecer.");
await adminClick('[data-dashboard-log-id="5"]');
assert.ok(ad.querySelector("#admin-material-list"),"Material recente deve abrir Materiais.");
assert.equal(ad.querySelector("#admin-material-search").value,"Resistor 100Ω","Atalho deve localizar o material.");
await adminClick('[data-admin-tab="painel"]');
await wait(80);
await adminClick('[data-dashboard-log-id="4"]');
assert.ok(ad.querySelector("#admin-content").textContent.includes("Categorias"),"Categoria recente deve abrir Categorias.");
await adminClick('[data-admin-tab="painel"]');
await wait(80);
assert.doesNotMatch(ad.querySelector(".admin-overview.three").textContent,/Reservas pendentes/);
assert.ok(ad.querySelector('[data-admin-tab="historico"]'));
await adminClick('[data-admin-tab="historico"]');
await wait(90);
assert.match(ad.querySelector("#admin-log-list").textContent,/Quantidade alterada/);
assert.equal(ad.querySelector("#admin-log-retention option[value='1']").textContent,"24 horas");
await adminClick('[data-admin-tab="usuarios"]');
await wait(80);
assert.equal(ad.querySelectorAll("#admin-users-list [data-user-mail]").length,2,"Todos os botões individuais de avisos precisam existir.");
assert.equal(ad.querySelectorAll("#admin-users-list [data-user-password]").length,2,"Redefinição de senha deve funcionar com vários usuários.");
assert.doesNotMatch(ad.querySelector("#admin-users-list").textContent,/forEach is not a function/,"A lista de usuários não pode quebrar ao renderizar.");
assert.equal(ad.querySelector('[data-users-count="todos"]').textContent,"2","Total geral de contas deve ser contabilizado.");
assert.equal(ad.querySelector('[data-users-count="petiano"]').textContent,"1","PETianes precisam ser contabilizados.");
assert.equal(ad.querySelector('[data-users-count="visitante"]').textContent,"1","Visitantes precisam ser contabilizados.");
assert.equal(ad.querySelectorAll("#admin-users-list .admin-user-group").length,2,"Todos deve separar PETianes e visitantes numa lista única.");
assert.equal(ad.querySelectorAll("#admin-users-list .user-row").length,2,"Lista de todos deve conter os dois perfis.");
await adminClick('[data-users-view="petiano"]');
assert.equal(ad.querySelectorAll("#admin-users-list .user-row").length,1,"Filtro PETianes não separou os perfis.");
assert.match(ad.querySelector("#admin-users-list").textContent,/PETiane teste/);
assert.doesNotMatch(ad.querySelector("#admin-users-list").textContent,/Pessoa teste/);
assert.equal(ad.querySelector('[data-users-view="petiano"]').getAttribute("aria-pressed"),"true");
await adminClick('[data-users-view="visitante"]');
assert.equal(ad.querySelectorAll("#admin-users-list .user-row").length,1,"Filtro Visitantes não separou os perfis.");
assert.match(ad.querySelector("#admin-users-list").textContent,/Pessoa teste/);
assert.doesNotMatch(ad.querySelector("#admin-users-list").textContent,/PETiane teste/);
assert.equal(ad.querySelector('[data-users-count="todos"]').textContent,"2","Filtrar não deve reduzir os totais.");
await adminClick('[data-users-view="todos"]');
assert.equal(ad.querySelectorAll("#admin-users-list .user-row").length,2,"Filtro Todos deve recuperar todas as contas.");
assert.equal(ad.querySelectorAll("#admin-users-list .user-actions").length,2,"Ações devem permanecer em cada conta.");
await adminClick('[data-admin-tab="configuracoes"]');
await wait(100);
assert.equal(ad.querySelectorAll("#admin-settings-form .settings-toggle").length,4,"Checkboxes grandes devem dar lugar a quatro switches compactos.");
assert.equal(ad.querySelectorAll("#admin-settings-form [role=switch]").length,4,"Controles de configuração devem ser acessíveis.");
assert.equal(ad.querySelectorAll("#mail-template-type option").length,2,"Editor de mensagens deve carregar os modelos configurados.");
assert.match(ad.querySelector("#mail-template-preview-body").textContent,/Ana/,"Prévia deve usar dados fictícios.");
const editedSubject=ad.querySelector("#mail-template-subject");
editedSubject.value="Novo aviso do {material}";
editedSubject.dispatchEvent(new aw.Event("input",{bubbles:true}));
assert.match(ad.querySelector("#mail-template-preview-subject").textContent,/Novo aviso do Arduino Uno/);
await adminClick("#mail-template-save");
assert.equal(adminUI.templateSaves.length,1,"Salvar modelo deve atualizar a API do Gmail.");
assert.equal(adminUI.templateSaves[0].assunto,"Novo aviso do {material}");
assert.equal(ad.querySelectorAll("#mail-event-form input[type=checkbox]").length,10,"Duas tags devem ter cinco opções de aviso cada.");
assert.equal(ad.querySelector("#mail-test-submit"),null,"Não criar envio de teste extra.");
assert.equal(ad.querySelector("#mail-check-now"),null,"Não adicionar botão de verificação extra.");
const petBefore=ad.querySelector("#mail-event-petiano-antes");
petBefore.checked=false;
await adminClick("#mail-event-save");
assert.equal(adminUI.mailEventSaves.length,1);
assert.equal(adminUI.mailEventSaves[0].profiles.petiano.antes,false);
assert.equal(adminUI.mailEventSaves[0].profiles.visitante.antes,true);
await adminClick('[data-admin-tab="filamentos"]');
assert.match(ad.querySelector("#admin-content").textContent,/Preto/,"Admin não vê filamento restrito.");
assert.equal(ad.querySelectorAll('[data-loan-audience="filament"]').length,2,"Cada cor deve ter um seletor compacto de público.");
assert.equal(ad.querySelector('[data-loan-audience="filament"][data-loan-id="20"]').value,"ninguem");
await adminClick('[data-filament-edit="21"]');
assert.equal(ad.querySelector("#filament-public").checked,false,"Filamento restrito ficou público.");
await adminClick("#filament-cancel");
await adminClick('[data-admin-tab="categorias"]');
assert.match(ad.querySelector("#admin-content").textContent,/Só PETianes/);
assert.equal(ad.querySelectorAll('[data-loan-audience="cat"]').length,3,"Cada categoria deve ter apenas um seletor de público.");
assert.equal(ad.querySelector('[data-loan-audience="cat"][data-loan-id="3"]').value,"ninguem");
assert.deepEqual(Array.from(ad.querySelector('[data-loan-audience="cat"]').options).map(x=>x.textContent),["Ninguém","PETianes","Visitantes","Todos"]);
assert.doesNotMatch(ad.querySelector("#admin-content").textContent,/Categorias excluídas/,"Lista de categorias excluídas não deve aparecer.");
assert.ok(ad.querySelector("#v2-category-backup"),"Botão para localizar a restauração do JSON deve aparecer nas categorias.");
await adminClick('[data-cat-edit="2"]');
assert.equal(ad.querySelector("#cat-public").checked,false,"Categoria reservada deveria estar restrita.");
await adminClick("#cat-cancel");
await adminClick('[data-admin-tab="materiais"]');
assert.ok(ad.querySelectorAll('[data-admin-group]').length>=1,"Grupos de materiais devem aparecer no topo, sem repetir variações na lista.");
assert.ok(ad.querySelector("#admin-individual-title"),"Materiais avulsos precisam ter uma área separada.");
assert.ok(ad.querySelector("#admin-group-new"),"O painel deve permitir criar uma família sem editar os materiais um a um.");
assert.ok(ad.querySelector("#admin-bulk-visibility"));
assert.equal(ad.querySelector("#admin-group-variations"),null,"Remover atalho redundante; variações continuam disponíveis no editor.");
const groupSearch=ad.querySelector("#admin-material-search");
groupSearch.value="Alcalina";
groupSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));
await wait(30);
assert.equal(ad.querySelectorAll('[data-admin-group="Alcalina"]').length,1,
  "A família Alcalina precisa aparecer uma única vez no topo.");
assert.equal(ad.querySelectorAll('[data-rename-group="Alcalina"]').length,1,
  "O botão Renomear grupo deve ficar só no cartão da família, não repetido nos modelos.");
assert.equal(ad.querySelectorAll('#admin-material-list [data-item-edit]').length,0,
  "Os modelos de uma família não podem repetir a lista de materiais individuais.");
assert.match(ad.querySelector('[data-admin-group="Alcalina"]').textContent,/3 materiais vinculados/);
assert.ok(ad.querySelector('[data-group-links="Alcalina"]'),"A família precisa ter Gerenciar vínculos.");
assert.equal(ad.querySelector('[data-admin-group="Alcalina"] .admin-family-models').open,false,
  "Os modelos individuais precisam começar recolhidos.");
await adminClick('[data-rename-group="Alcalina"]');
assert.ok(ad.querySelector("#rename-group-name"),"Modal de renomear ausente. Erros: "+JSON.stringify(adminUI.errors)+" · Modal: "+String(ad.querySelector("#modal-root")?.innerHTML||"").slice(0,1200));
assert.equal(ad.querySelector("#rename-group-name").value,"Alcalina",
  "Renomear grupo deve abrir com o nome atual preenchido.");
assert.match(ad.querySelector("#rename-group-form").textContent,/3 material/);
assert.match(ad.querySelector("#rename-group-form").textContent,/patrimônios/);
const groupInput=ad.querySelector("#rename-group-name");
groupInput.value="Pilhas";
ad.querySelector("#rename-group-form").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(110);
assert.equal(adminUI.variationRenameRequests.length,1,"Salvar deve chamar a API de renomeação.");
assert.equal(adminUI.variationRenameRequests[0].grupo_atual,"Alcalina");
assert.equal(adminUI.variationRenameRequests[0].novo_nome,"Pilhas");
assert.ok(fullAdmin.componentes.filter(x=>x.grupo_variacoes==="Pilhas").length===3,
  "Todas as três variações devem ser renomeadas sem mudar seu cadastro.");
assert.equal(ad.querySelectorAll('[data-admin-group="Pilhas"]').length,1,
  "O grupo deve continuar numa só linha após renomear.");
assert.equal(ad.querySelectorAll('[data-rename-group="Pilhas"]').length,1);
assert.ok(!ad.querySelector("#rename-group-form"),"Ao concluir o salvamento, o modal deve fechar.");
const freshSearch=ad.querySelector("#admin-material-search");
freshSearch.value="";
freshSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));
await wait(25);
await adminClick("#admin-bulk-visibility");
assert.ok(ad.querySelector("#bulk-only-members"),"Visibilidade em lote não está disponível.");
assert.ok(ad.querySelector("#bulk-category"),"Filtro por categoria ausente.");
assert.equal(ad.querySelector("#bulk-select-category").disabled,true,"Seleção de categoria exige escolha de categoria.");
assert.equal(ad.querySelector("#bulk-similar").hidden,true,"Sem material marcado não pode sugerir semelhantes.");
assert.ok(ad.querySelector(".bulk-visibility-badge.public"),"Visibilidade pública já salva deve aparecer destacada.");
assert.ok(ad.querySelector(".bulk-visibility-badge.category-locked"),"A restrição da categoria deve aparecer destacada.");
assert.equal(ad.querySelector("#bulk-only-members").disabled,true,"Sem seleção não deve permitir alteração.");

ad.querySelector('[data-bulk-id="1"]').click();
await wait(20);
assert.equal(ad.querySelector("#bulk-similar").hidden,false,"Marcar resistor deve sugerir outro modelo da mesma família.");
assert.match(ad.querySelector("#bulk-similar").textContent,/\(1\)/);
await adminClick("#bulk-similar");
assert.equal(ad.querySelector("#bulk-selected-count").textContent,"2 materiais selecionados.");
ad.querySelector("#bulk-category").value="2";
ad.querySelector("#bulk-category").dispatchEvent(new aw.Event("change",{bubbles:true}));
await wait(20);
assert.equal(ad.querySelector("#bulk-select-category").disabled,false);
assert.equal(ad.querySelectorAll("#bulk-list [data-bulk-id]").length,1,"Filtro deve mostrar apenas equipamentos.");
await adminClick("#bulk-select-category");
assert.equal(ad.querySelector("#bulk-selected-count").textContent,"3 materiais selecionados.","Selecionar categoria deve incluir todos os seus itens sem perder a seleção anterior.");
assert.match(ad.querySelector("#bulk-category-status").textContent,/1\/1 só PETianes/,"Resumo deve mostrar o estado salvo da categoria.");
assert.equal(ad.querySelectorAll("#bulk-list .bulk-visibility-badge.category-locked").length,1,"Item da categoria restrita deve ter sinal claro.");
assert.match(ad.querySelector("#bulk-selection-state").textContent,/já visíveis só para PETianes/);
assert.equal(ad.querySelector("#bulk-category-warning").hidden,false,"Avisar que liberar só o item não libera a categoria.");
await adminClick("#bulk-show-all");
assert.ok(ad.querySelector("#bulk-list"),"Liberação de categoria restrita deve ser bloqueada sem descartar a seleção.");

await adminClick("#bulk-clear");
assert.equal(ad.querySelector("#bulk-selected-count").textContent,"0 materiais selecionados.");
assert.equal(ad.querySelector("#bulk-only-members").disabled,true,"Nenhuma alteração sem itens selecionados.");
await adminClick("#bulk-select-category");
assert.equal(ad.querySelector("#bulk-selected-count").textContent,"1 material selecionado.");
await adminClick("#bulk-only-members");
assert.ok(ad.querySelector("#bulk-list"),"Material que já é Só PETianes não deve ser regravado.");
assert.match(ad.querySelector("#toast").textContent,/Nenhuma alteração foi feita/,"Informar que a configuração já estava salva.");
await adminClick("#modal-root [data-close]");
await adminClick("#admin-bulk-visibility");
assert.equal(ad.querySelectorAll("#bulk-list input:checked").length,0,"A caixa indica seleção para editar, não visibilidade salva.");
assert.equal(ad.querySelectorAll(".bulk-visibility-badge.category-locked").length,1,"A visibilidade salva deve continuar marcada ao reabrir.");

await adminClick("#modal-root [data-close]");
const resistorGroup=ad.querySelector('[data-admin-group="Resistores"]');
assert.ok(resistorGroup,"Grupo Resistores deve aparecer no topo.");
const models=resistorGroup.querySelector(".admin-family-models");
models.open=true;
assert.equal(resistorGroup.querySelectorAll('[data-group-model]').length,3,
  "A família deve conter seus três modelos, inclusive os de outras categorias.");
await adminClick('[data-admin-group="Resistores"] [data-item-edit="1"]');
assert.ok(ad.querySelector(".item-edit-modal"),"Editor compacto deve usar modal próprio.");
assert.ok(ad.querySelector(".item-editor-intro"),"A edição rápida precisa ter instruções curtas.");
assert.ok(ad.querySelector("#i-name")?.closest("details")===null,"Nome deve ficar visível sem expandir seções.");
assert.ok(ad.querySelector("#i-quantity")?.closest("details")===null,"Estoque deve ficar visível sem expandir seções.");
assert.equal(ad.querySelector("#item-editor-identification").open,false,"Identificação deve começar recolhida.");
assert.equal(ad.querySelector("#item-editor-media").open,false,"Fotos, vínculos e exibição devem começar recolhidos.");
assert.ok(ad.querySelector("#i-save")?.closest(".item-editor-savebar"),"Salvar deve ficar na barra fixa inferior.");
assert.match(ad.querySelector("#i-save").textContent,/Salvar alterações/);
assert.ok(ad.querySelector("#i-public"),"Visibilidade individual não está disponível.");
assert.equal(ad.querySelector("#i-variation-family")?.value,"Resistores","O grupo salvo deve ser preservado ao editar o material.");
assert.equal(ad.querySelector("#i-variation-family")?.type,"hidden","Nome e vínculos não devem ser alterados no editor individual.");
assert.equal(ad.querySelector("#i-unit").tagName,"SELECT","Unidade precisa ter seletor.");
assert.ok([...ad.querySelectorAll("#i-unit option")].some(x=>x.value==="pacotes"),"Unidades como pacotes precisam ser preservadas.");
assert.ok(ad.querySelector('#i-unit option[value="__outro__"]'),"Unidade personalizada deve existir.");
assert.equal(ad.querySelector("#i-available"),null,"Aviso redundante de disponíveis não foi removido.");
assert.equal(ad.querySelector("#i-link-variations"),null,
  "Vínculos não devem ser alterados a partir do editor individual.");
await adminClick("#modal-root [data-close]");
await adminClick('[data-group-links="Resistores"]');
assert.ok(ad.querySelector("#variant-similar"));
assert.ok(ad.querySelector("#variant-group-name"),"Vínculos devem ser organizados a partir do cartão do grupo.");
assert.equal(ad.querySelector("#variant-group-name").readOnly,true,"Renomear deve ser uma ação separada de vincular.");
assert.equal(ad.querySelector("#variant-group-name").value,"Resistores","O nome salvo da família deve aparecer no organizador.");
assert.equal(ad.querySelector('[data-bulk-id="1"]')?.checked,true,"O modelo atual já vinculado deve aparecer marcado.");
assert.equal(ad.querySelector('[data-bulk-id="2"]')?.checked,true,"O outro modelo já vinculado deve aparecer marcado também.");
const variantSearch=ad.querySelector("#variant-search");
variantSearch.value="";
variantSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));
await wait(20);
assert.equal(ad.querySelector('[data-bulk-id="3"]')?.checked,false,"Material de outra família não deve aparecer marcado ao limpar a busca.");
assert.ok(ad.querySelectorAll(".variant-photo-row.is-selected").length>=2,"Itens já vinculados devem ter destaque visual.");
assert.match(ad.querySelector("#variant-list").textContent,/Já vinculado/);
assert.match(ad.querySelector("#variant-selected").textContent,/3 já vinculados/,"Todos os vínculos existentes devem ser contabilizados, inclusive de outra categoria.");
assert.equal(ad.querySelector('[data-bulk-id="4"]')?.checked,true,"Material que já estava vinculado, mesmo em outra categoria, precisa ficar marcado.");
ad.querySelector('[data-bulk-id="2"]').click();await wait(20);
assert.equal(ad.querySelector('[data-bulk-id="2"]').checked,false,"É necessário poder desmarcar um vínculo manualmente.");
ad.querySelector('[data-bulk-id="2"]').click();await wait(20);
assert.equal(ad.querySelector('[data-bulk-id="2"]').checked,true,"A marcação deve acompanhar a ação imediatamente.");
assert.ok(ad.querySelector('[data-variant-photo="1"]'),"Foto individual deve continuar disponível.");
assert.ok(ad.querySelector('[data-variant-file="1"][type="file"]'),"Upload por variação deve continuar disponível.");
assert.deepEqual(adminUI.errors,[],"Erros da página Admin.");
await adminClick("#modal-root [data-close]");
assert.equal(ad.querySelector("#admin-back").tagName,"A","Voltar ao catálogo deve ser link real.");
assert.equal(ad.querySelector("#admin-back").getAttribute("href"),"/");
await adminClick("#admin-logout");
assert.ok(ad.querySelector("#v2-confirm"),"Sair do Admin exige confirmação.");
await adminClick("#v2-confirm");
await wait(100);
assert.equal(aw.localStorage.getItem("pet_admin_open"),"0","Logout deve limpar sessão local.");
assert.equal(aw.__adminTestState.admin===null,true,"Logout deve limpar estado administrativo.");
assert.ok(!ad.querySelector("#admin-stage").classList.contains("admin-loading"),"Logout não pode deixar tela carregando.");
assert.deepEqual(adminUI.errors.filter(x=>!x.includes("Not implemented: navigation (except hash changes)")),[],"Erros de logout além da navegação indisponível no jsdom.");
adminUI.dom.window.close();
console.log("NOVA UI OK: catálogo, variações, busca, painel próprio, histórico, visibilidade e filamentos.");
