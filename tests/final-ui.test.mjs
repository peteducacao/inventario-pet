import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM,VirtualConsole} from "jsdom";

const scripts=["app.js","identity-ui.js","component-art.js","final.js","admin-stage.js"]
  .map(name=>readFileSync("public/"+name,"utf8")).join("\n;\n");
const one={id:1,categoria_id:1,nome:"Resistor 100Ω",imagem:"",grupo_variacoes:"Resistores",
  quantidade:15,em_uso:0,com_defeito:0,mostrar_quantidade:1,mostrar_em_uso:1,mostrar_defeito:1,
  visivel_visitante:1,arquivado:0,patrimonio:"",identificacao:"",ultima_alteracao:"2026-11-06T10:00:00Z"};
const two={...one,id:2,nome:"Resistor 220Ω",quantidade:9};
const three={...one,id:3,nome:"Arduino Uno",grupo_variacoes:"",quantidade:6};
const extra={...one,id:4,categoria_id:2,nome:"Tablet de uso interno",visivel_visitante:0};
const alkalineNormal={...one,id:5,nome:"Alcalina 1.5V Pilha normal",grupo_variacoes:"Alcalina",quantidade:25};
const alkalinePalito={...one,id:6,nome:"Alcalina 1.5V Pilha Palito",grupo_variacoes:"Alcalina",quantidade:4};
const alkalineNine={...one,id:7,nome:"Alcalina 9V",grupo_variacoes:"Alcalina",quantidade:31};
const categories=[{id:1,nome:"Eletrônica",visivel_visitante:1,arquivada:0,ordem:0},
  {id:2,nome:"Equipamentos",visivel_visitante:0,arquivada:0,ordem:1}];
const colors=[{id:20,cor:"Azul",hexadecimal:"#2A69D6",quantidade:3,visivel_visitante:1},
  {id:21,cor:"Preto",hexadecimal:"#24272C",quantidade:2,visivel_visitante:0}];
const visitorCatalog={categorias:categories.slice(0,1),componentes:[one,two,three,alkalineNormal,alkalinePalito,alkalineNine],demonstracao:false};
const fullAdmin={categorias:categories,componentes:[one,two,three,alkalineNormal,alkalinePalito,alkalineNine,extra],
  filamentos:colors,reservas:[{id:9,componente_id:1,componente_nome:"Resistor 100Ω",
    nome_solicitante:"Teste",quantidade:1,status:"pendente",data_inicio:"2026-12-01",data_devolucao:"2026-12-03"}],
  configuracoes:{modo_demo:"nao",limpeza_reservas:"nunca",limpeza_historico:"nunca"}};
const identity={id:"PET-AABBCCDDEEFF",nome:"Pessoa teste",tag:"visitante",login:"teste01",
  ativo:true,trocar_senha:false,precisa_criar_login:false};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function build(isAdmin){
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
  let adminAuthenticated=false;
  w.fetch=async(uri,init={})=>{
    const path=new URL(uri,w.location.href).pathname;
    let status=200,body={ok:true};
    if(path==="/api/catalog")body=visitorCatalog;
    else if(path==="/api/filaments")body={ok:true,filamentos:[colors[0]]};
    else if(path==="/api/identity/me")body={ok:true,usuario:identity};
    else if(path==="/api/notifications")body={notificacoes:[],nao_lidas:0};
    else if(path==="/api/admin/state"){
      if(adminAuthenticated)body=fullAdmin;
      else {status=401;body={error:"Entre no painel administrativo."};}
    }else if(path==="/api/login"){adminAuthenticated=true;body={ok:true};}
    else if(path==="/api/logout"){adminAuthenticated=false;body={ok:true};}
    else if(path==="/api/admin/log")body={ok:true,eventos:[{id:1,criado_em:"2026-11-06T12:00:00Z",
      responsavel:"Teste",acao:"Editou",tipo:"material",descricao:"Quantidade alterada"}],
      total:1,pagina:1,limpeza_historico:"nunca"};
    else if(path==="/api/admin/users")body={usuarios:[]};
    else if(path==="/api/my/loans")body={emprestimos:[]};
    else if(path==="/api/admin/variations")body={ok:true,vinculados:2};
    else if(path==="/api/admin/visibility")body={ok:true,alterados:2};
    else {status=404;body={error:"Rota simulada não encontrada: "+path};}
    return {ok:status<400,status,json:async()=>body};
  };
  w.eval(scripts+"\nwindow.__pageButtons=pageButtons;");
  const click=async(sel)=>{
    const el=d.querySelector(sel);
    assert.ok(el,"Controle ausente: "+sel);
    el.click();await wait(55);
  };
  return {dom,w,d,errors,click};
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
assert.equal(d.querySelector("#search").closest(".catalog-toolbar")!==null,true,"Busca não está junto à ordenação.");
assert.equal(d.querySelector("#search-mobile"),null,"Busca duplicada não deveria existir.");
assert.ok(d.querySelector("#public-sidebar").textContent.includes("Meus empréstimos"));
assert.equal(d.querySelectorAll("[data-public-action='reservations']").length,0,"Reservas redundantes ainda aparecem no menu.");
assert.equal(d.querySelectorAll(".grouped-card").length,2,"Resistores e Alcalinas devem ter cards de família.");
assert.equal(d.querySelectorAll(".catalog-card").length,4,"Estoque agrupado não deveria gerar cards repetidos.");
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
assert.equal(ad.querySelector(".admin-overview.three")?.children.length,3,"Painel precisa ter três indicadores.");
assert.doesNotMatch(ad.querySelector(".admin-overview.three").textContent,/Reservas pendentes/);
assert.ok(ad.querySelector('[data-admin-tab="historico"]'));
await adminClick('[data-admin-tab="historico"]');
await wait(90);
assert.match(ad.querySelector("#admin-log-list").textContent,/Quantidade alterada/);
assert.equal(ad.querySelector("#admin-log-retention option[value='1']").textContent,"24 horas");
await adminClick('[data-admin-tab="filamentos"]');
assert.match(ad.querySelector("#admin-content").textContent,/Preto/,"Admin não vê filamento restrito.");
await adminClick('[data-filament-edit="21"]');
assert.equal(ad.querySelector("#filament-public").checked,false,"Filamento restrito ficou público.");
await adminClick("#filament-cancel");
await adminClick('[data-admin-tab="categorias"]');
assert.match(ad.querySelector("#admin-content").textContent,/Só PETianes/);
await adminClick('[data-cat-edit="2"]');
assert.equal(ad.querySelector("#cat-public").checked,false,"Categoria reservada deveria estar restrita.");
await adminClick("#cat-cancel");
await adminClick('[data-admin-tab="materiais"]');
assert.ok(ad.querySelector("#admin-bulk-visibility"));
assert.ok(ad.querySelector("#admin-group-variations"));
await adminClick("#admin-group-variations");
assert.ok(ad.querySelector("#variant-group-name"),"Vincular variações não está disponível.");
assert.ok(ad.querySelector('[data-variant-photo="1"]'),"Cada variação deve permitir enviar foto.");
assert.ok(ad.querySelector('[data-variant-file="1"][type="file"]'),"Campo de foto independente ausente.");
assert.ok(ad.querySelector(".variant-photo-thumb"),"Variações precisam mostrar a própria imagem.");
await adminClick("#modal-root [data-close]");
await adminClick("#admin-bulk-visibility");
assert.ok(ad.querySelector("#bulk-only-members"),"Visibilidade em lote não está disponível.");
await adminClick("#modal-root [data-close]");
await adminClick('[data-item-edit="1"]');
assert.ok(ad.querySelector("#i-public"),"Visibilidade individual não está disponível.");
assert.ok(ad.querySelector("#i-variation-family"),"Campo de grupo de variações não está disponível.");
assert.equal(ad.querySelector("#i-unit").tagName,"SELECT","Unidade precisa ter seletor.");
assert.ok([...ad.querySelectorAll("#i-unit option")].some(x=>x.value==="pacotes"),"Unidades como pacotes precisam ser preservadas.");
assert.ok(ad.querySelector('#i-unit option[value="__outro__"]'),"Unidade personalizada deve existir.");
assert.equal(ad.querySelector("#i-available"),null,"Aviso redundante de disponíveis não foi removido.");
await adminClick("#i-link-variations");
assert.ok(ad.querySelector("#variant-similar"));
assert.deepEqual(adminUI.errors,[],"Erros da página Admin.");
await adminClick("#modal-root [data-close]");
assert.equal(ad.querySelector("#admin-back").tagName,"A","Voltar ao catálogo deve ser link real.");
assert.equal(ad.querySelector("#admin-back").getAttribute("href"),"/");
await adminClick("#admin-logout");
assert.ok(ad.querySelector("#v2-confirm"),"Sair do Admin exige confirmação.");
await adminClick("#v2-confirm");
await wait(100);
assert.equal(aw.localStorage.getItem("pet_admin_open"),"0","Logout deve limpar sessão local.");
assert.equal(aw.eval("state.admin===null"),true,"Logout deve limpar estado administrativo.");
assert.ok(!ad.querySelector("#admin-stage").classList.contains("admin-loading"),"Logout não pode deixar tela carregando.");
assert.deepEqual(adminUI.errors.filter(x=>!x.includes("Not implemented: navigation (except hash changes)")),[],"Erros de logout além da navegação indisponível no jsdom.");
adminUI.dom.window.close();
console.log("NOVA UI OK: catálogo, variações, busca, painel próprio, histórico, visibilidade e filamentos.");
