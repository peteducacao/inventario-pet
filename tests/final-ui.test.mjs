import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM,VirtualConsole} from "jsdom";

const identitySource=readFileSync("public/identity-ui.js","utf8");
const visualCss=readFileSync("public/final.css","utf8");
const publicUIJS=readFileSync("public/final.js","utf8");
assert.match(publicUIJS,/visitor\?"Devolvido":"Registrar devolução"/,"Visitante deve sinalizar Devolvido, sem chamar solicitação.");
assert.match(publicUIJS,/Devolvido · aguardando conferência/,"O estado de entrega informada precisa da conferência Admin.");
assert.match(identitySource,/visitor\?'Devolvido':'Confirmar devolução'/,"A confirmação visual do visitante precisa mostrar Devolvido.");
assert.match(identitySource,/password-strength-track/,"Cadastro deve renderizar barra da força da senha.");
assert.match(identitySource,/aria-valuenow/,"Barra precisa acompanhar o nível e ser acessível.");
for(const color of ["#d92d20","#e3ad22","#168756"])assert.ok(visualCss.includes(color),"Cor do indicador de senha ausente: "+color);
assert.match(identitySource,/confirmWeakPassword/,"A decisão sobre senha fraca continua livre e consciente.");
const scripts=["photo-editor.js","excel-export.js","app.js","identity-ui.js","component-art.js","final.js","admin-stage.js"]
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
  grupos_variacoes:[{nome:"Resistores"},{nome:"Arduino"},{nome:"Alcalina"}],
  filamentos:colors,reservas:[{id:9,componente_id:1,componente_nome:"Resistor 100Ω",
    nome_solicitante:"Teste",quantidade:1,status:"pendente",data_inicio:"2026-12-01",data_devolucao:"2026-12-03"}],
  configuracoes:{modo_demo:"nao",limpeza_reservas:"nunca",limpeza_historico:"nunca"}};
visitorCatalog.grupos_variacoes=fullAdmin.grupos_variacoes;
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
  let profile={...identity};
  const pendingNotices=[],adminReservationRequests=[],templateSaves=[],mailEventSaves=[],variationRenameRequests=[],filamentWrites=[],groupImageWrites=[];
  const eventOptions=Object.fromEntries(["antes","hoje","atraso2","atraso7","manual"].map(event=>[event,true]));
  let noticeRequestCount=0,backupReadCount=0;
  const deletedMaterials=[];
  
  w.fetch=async(uri,init={})=>{
    const path=new URL(uri,w.location.href).pathname;
    let status=200,body={ok:true};
    if(path==="/api/catalog")body=visitorCatalog;
    else if(path==="/api/filaments")body={ok:true,filamentos:[colors[0]]};
    else if(path==="/api/identity/me")body={ok:true,usuario:identityLoggedIn?profile:null};
    else if(path==="/api/identity/login"){identityLoggedIn=true;body={ok:true,usuario:profile};}
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
    else if(path==="/api/admin/variation-groups"){
      const payload=JSON.parse(init.body||"{}");
      if(payload.acao==="criar")fullAdmin.grupos_variacoes.push({nome:payload.nome,imagem:"",imagem_componente_id:null});
      if(payload.acao==="imagem"){
        groupImageWrites.push(payload);
        const entry=fullAdmin.grupos_variacoes.find(x=>x.nome===payload.nome);
        if(entry){
          entry.imagem=payload.modo==="propria"?payload.imagem:"";
          entry.imagem_componente_id=payload.modo==="integrante"?payload.componente_id:null;
        }
      }
      if(payload.acao==="renomear"){
        variationRenameRequests.push(payload);
        for(const item of fullAdmin.componentes)if(item.grupo_variacoes===payload.nome)item.grupo_variacoes=payload.novo_nome;
        const entry=fullAdmin.grupos_variacoes.find(g=>g.nome===payload.nome);if(entry)entry.nome=payload.novo_nome;
      }
      if(payload.acao==="excluir"){
        fullAdmin.grupos_variacoes=fullAdmin.grupos_variacoes.filter(g=>g.nome!==payload.nome);
        for(const item of fullAdmin.componentes)if(item.grupo_variacoes===payload.nome)item.grupo_variacoes="";
      }
      body={ok:true};
    }
    else if(path==="/api/admin/filaments"){
      if(init.method==="POST")filamentWrites.push(JSON.parse(init.body||"{}"));
      body={ok:true};
    }
    else if(path==="/api/admin/export")body=fullAdmin;
    else if(path==="/api/admin/backup"){
      backupReadCount++;
      body={version:2,categorias:fullAdmin.categorias,componentes:fullAdmin.componentes};
    }
    else if(path==="/api/admin/item"&&init.method==="DELETE"){
      const id=Number(new URL(uri,w.location.href).searchParams.get("id"));
      deletedMaterials.push(id);
      const index=fullAdmin.componentes.findIndex(x=>x.id===id);
      if(index>=0)fullAdmin.componentes.splice(index,1);
      body={ok:true};
    }
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
    else if(path==="/api/admin/variations"){
      const payload=JSON.parse(init.body||"{}");
      for(const id of payload.ids||[]){
        const item=fullAdmin.componentes.find(x=>x.id===id);
        if(item)item.grupo_variacoes=payload.grupo;
      }
      body={ok:true,vinculados:(payload.ids||[]).length};
    }
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
  return {dom,w,d,errors,click,addNotice:x=>pendingNotices.unshift(x),noticeRequestCount:()=>noticeRequestCount,backupReadCount:()=>backupReadCount,deletedMaterials,adminReservationRequests,templateSaves,mailEventSaves,variationRenameRequests,filamentWrites,groupImageWrites,setRole:role=>{profile={...profile,tag:role};}};
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

// Regressão real: família "Pilha Alcalina" possui materiais chamados "Alcalina...",
// mas deve aparecer DEPOIS do card "Arduino", porque o título visível começa em P.
const alkalineForSort=w.__adminTestState.data.componentes.filter(x=>x.grupo_variacoes==="Alcalina");
assert.equal(alkalineForSort.length,3);
for(const item of alkalineForSort)item.grupo_variacoes="Pilha Alcalina";
w.__publicTestUI.category="1"; // Apenas Robótica/Eletrônica, como na tela enviada.
w.__publicTestUI.sort="az";
w.__finalRender();
const catalogTitles=()=>Array.from(d.querySelectorAll("#category-sections .catalog-card h3"),x=>x.textContent.trim());
const azTitles=catalogTitles();
assert.deepEqual(azTitles,[...azTitles].sort((a,b)=>a.localeCompare(b,"pt-BR",{sensitivity:"base",numeric:true})),
  "A–Z deve ordenar pelo TÍTULO dos cards exibidos, não pelos nomes dos modelos.");
assert.ok(azTitles.indexOf("Arduino")<azTitles.indexOf("Pilha Alcalina"),
  "Arduino precisa vir antes de Pilha Alcalina mesmo com modelo chamado Alcalina.");
assert.match(d.querySelector(".catalog-photo[data-open-variants='pilha alcalina']")?.closest(".catalog-card")?.textContent||"",/60/,
  "Ordenar não pode perder as três variações e seu estoque somado.");
w.__publicTestUI.sort="za";
w.__finalRender();
const zaTitles=catalogTitles();
assert.deepEqual(zaTitles,[...azTitles].reverse(),"Z–A deve inverter a ordem dos títulos mostrados.");
for(const item of alkalineForSort)item.grupo_variacoes="Alcalina";
w.__publicTestUI.category="all";
w.__publicTestUI.sort="az";
w.__finalRender();

// Nomes técnicos devem ser localizados com ou sem espaços, hífens ou separadores.
const espPublic=w.__adminTestState.data.componentes.find(x=>x.id===3);
const espPreviousName=espPublic.nome;
espPublic.nome="Placa ESP 32 DevKit";
for(const term of ["esp32","ESP 32","ESP-32","esp_32"]){
  w.__adminTestState.query=term;
  w.__finalRender();
  assert.equal(d.querySelectorAll(".catalog-card").length,1,
    "Buscar "+term+" deve localizar o mesmo ESP 32 no catálogo público.");
  assert.equal(d.querySelector(".catalog-card h3")?.textContent,"Arduino",
    "Encontrar um modelo não deve desmontar o card de sua família.");
  assert.match(d.querySelector(".catalog-card").textContent,/Ver variações/);
}
espPublic.nome=espPreviousName;
w.__adminTestState.query="";
w.__finalRender();

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
assert.equal(d.querySelectorAll(".grouped-card").length,3,"Card agrupado aparece mesmo para uma variação.");
const arduinoSingle=Array.from(d.querySelectorAll(".catalog-card")).find(x=>x.querySelector("h3")?.textContent==="Arduino");
assert.ok(arduinoSingle,"Mesmo com um único vínculo, o catálogo deve exibir o nome salvo do grupo Arduino.");
assert.ok(arduinoSingle.querySelector('[data-open-variants="arduino"]'),"Grupo único abre Ver variações.");
assert.equal(arduinoSingle.querySelector(".catalog-photo img"),null,"Grupo Arduino não pode herdar foto do Uno sem capa definida.");
assert.ok(arduinoSingle.querySelector(".group-no-photo"),"Grupo sem capa deve ficar vazio com texto explicativo.");
await click('.catalog-photo[data-open-variants="arduino"]');
assert.equal(d.querySelectorAll(".variant-picker-option").length,1);
await click("#modal-root [data-close]");
w.__adminTestState.query="Resistor 100";w.__finalRender();
assert.equal(d.querySelector('[data-open-variants="resistores"]')?.closest(".grouped-card")?.querySelector(".catalog-numbers strong")?.textContent,"24",
  "Buscar por um modelo deve manter o grupo completo no card, somando seus estoques.");
w.__adminTestState.query="Arduino";w.__finalRender();
assert.equal(d.querySelector(".catalog-card h3")?.textContent,"Arduino","A busca pelo grupo deve usar seu nome, não o do primeiro item.");
w.__adminTestState.query="";w.__finalRender();
assert.equal(d.querySelectorAll(".catalog-card").length,4,"Estoque agrupado não deveria gerar cards repetidos.");
assert.equal(d.querySelectorAll(".filament-public-card").length,1,"Filamentos devem continuar na grade do catálogo.");
const spoolCard=d.querySelector(".filament-public-card");
const ordinaryCard=d.querySelector(".catalog-card:not(.filament-public-card)");
assert.ok(spoolCard?.querySelector(".status-dot"),"Filamento precisa ter o mesmo selo de disponibilidade dos materiais.");
assert.equal(spoolCard.querySelectorAll(".catalog-numbers>div").length,3,"Filamento deve mostrar Quantidade, Em uso e Disponível na mesma linha.");
assert.deepEqual(Array.from(spoolCard.querySelectorAll(".catalog-numbers span"),span=>span.textContent),["Quantidade","Em uso","Disponível"]);
assert.deepEqual(Array.from(ordinaryCard.querySelectorAll(".catalog-numbers span"),span=>span.textContent),["Quantidade","Em uso","Disponível"]);
assert.equal(spoolCard.querySelectorAll(".filament-quantity").length,0,"Não renderizar os dois blocos cinza antigos.");
assert.equal(spoolCard.querySelector(".catalog-body")?.firstElementChild?.tagName,"H3","Filamentos devem começar pelo nome, como demais materiais.");
assert.ok(spoolCard.querySelector(".filament-reel"),"Ilustração colorida da bobina deve continuar.");
assert.match(visualCss,/\.inventory-section \.card-grid\s*\{[^}]*align-items:start/s,"Cards precisam ter altura própria, sem esticar junto a vizinhos maiores.");
assert.match(visualCss,/\.inventory-section \.catalog-card\s*\{[^}]*height:auto/s,"Sem forçar altura de card completo para a maior linha.");
assert.match(visualCss,/\.inventory-section \.catalog-body \.primary-button\s*\{[^}]*margin-top:11px/s,"Botões não podem flutuar após um espaço branco gigante.");
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
assert.ok(Array.from(d.querySelectorAll(".catalog-photo img")).every(img=>!img.getAttribute("src").includes("commons.wikimedia")),"Nenhuma foto deve usar Wikimedia; grupos sem capa não possuem tag img.");
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
// Regressão: procurar Arduino mostra grupo vinculado e Nano avulso, sem duplicar Uno.
w.__adminTestState.data.componentes.push({...three,id:899,nome:"Arduino Nano",grupo_variacoes:"",quantidade:2});
w.__adminTestState.query="Arduino";
w.__finalRender();
assert.deepEqual(Array.from(d.querySelectorAll(".catalog-card h3"),n=>n.textContent),["Arduino","Arduino Nano"]);
w.__adminTestState.query="";
w.__finalRender();
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

// Login deve fechar o modal, e o cargo é atualizado automaticamente ao voltar à guia.
const realLogin=build(false,false,false);
await wait(230);
const {w:lw,d:ld}=realLogin;
lw.identityLoginModal(true);
ld.querySelector("#identity-login").value="teste01";
ld.querySelector("#identity-login-password").value="senha";
ld.querySelector("#identity-login-form").dispatchEvent(new lw.Event("submit",{bubbles:true,cancelable:true}));
await wait(110);
assert.equal(ld.querySelector("#modal-root .modal"),null,"Login normal deve voltar diretamente ao catálogo.");
assert.equal(ld.querySelector("#profile-name").textContent,identity.nome,"Cabeçalho precisa mostrar a pessoa autenticada.");
await realLogin.click("#profile-button");
await realLogin.click('[data-user-act="account"]');
assert.equal(ld.querySelector("#v2-refresh-role"),null,"Atualizar cargo não deve aparecer na Minha conta.");
assert.match(ld.querySelector("#modal-root").textContent,/Visitante/);
realLogin.setRole("petiano");
lw.dispatchEvent(new lw.Event("focus"));
await wait(140);
assert.match(ld.querySelector("#modal-root").textContent,/PETiano/,"O cargo deve ser sincronizado ao retornar à guia.");
assert.equal(ld.querySelector("#v2-refresh-role"),null);
assert.deepEqual(realLogin.errors,[],"Erros no login e sincronização do cargo.");
realLogin.dom.window.close();

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
const countPanels=Array.from(ad.querySelectorAll(".admin-overview.three .admin-stat"));
const allRegistered=fullAdmin.componentes.filter(x=>!x.arquivado);
const sumQuantity=allRegistered.reduce((total,x)=>total+Number(x.quantidade||0),0);
assert.equal(Number(countPanels[0].querySelector("strong").textContent),sumQuantity,"Primeiro KPI deve contar unidades totais, não tipos de materiais.");
assert.match(countPanels[0].textContent,new RegExp(allRegistered.length+" tipos de materiais"));
assert.equal(Number(countPanels[1].querySelector("strong").textContent)+Number(countPanels[2].querySelector("strong").textContent),sumQuantity,
  "Quantidade = Em uso + Disponíveis: as três caixas precisam fechar a conta.");
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
assert.equal(ad.querySelector("#v2-mail-test-send"),null,"Retirar botão de teste Gmail após validação.");
assert.equal(ad.querySelector("#v2-mail-test-email"),null,"Retirar campo de endereço do teste Gmail.");
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
assert.equal(ad.querySelector('[data-loan-audience="filament"][data-loan-id="20"]').value,"petianos");
await adminClick('[data-filament-edit="21"]');
assert.equal(ad.querySelector("#filament-public"),null,"Filamentos não devem exigir controle duplicado de exibição.");
const filAudience=ad.querySelector('[data-loan-audience="filament-form"]');
assert.equal(filAudience.value,"petianos","Cor restrita deve iniciar com PETianes.");
filAudience.value="visitantes";
ad.querySelector("#filament-form").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(120);
assert.equal(adminUI.filamentWrites.at(-1).acao,"editar");
assert.equal(adminUI.filamentWrites.at(-1).permitir_visitantes,true,"Visitantes devem habilitar a exibição junto com o empréstimo.");
assert.equal("visivel_visitante" in adminUI.filamentWrites.at(-1),false,"O formulário não deve enviar duas decisões contraditórias.");
await adminClick("#filament-add");
assert.equal(ad.querySelector("#filament-public"),null,"Novo filamento também não deve mostrar checkbox redundante.");
assert.equal(ad.querySelector('[data-loan-audience="filament-form"]').value,"visitantes","Nova cor deve iniciar liberada para visitantes.");
await adminClick("#filament-cancel");
await adminClick('[data-admin-tab="categorias"]');
assert.match(ad.querySelector("#admin-content").textContent,/Só PETianes/);
assert.equal(ad.querySelectorAll('[data-loan-audience="cat"]').length,3,"Cada categoria deve ter apenas um seletor de público.");
assert.equal(ad.querySelector('[data-loan-audience="cat"][data-loan-id="3"]').value,"petianos");
assert.deepEqual(Array.from(ad.querySelector('[data-loan-audience="cat"]').options).map(x=>x.textContent),["PETianes","Visitantes"]);
assert.doesNotMatch(ad.querySelector("#admin-content").textContent,/Categorias excluídas/,"Lista de categorias excluídas não deve aparecer.");
assert.ok(ad.querySelector("#v2-category-backup"),"Botão para localizar a restauração do JSON deve aparecer nas categorias.");
await adminClick('[data-cat-edit="2"]');
assert.equal(ad.querySelector("#cat-public").checked,false,"Categoria reservada deveria estar restrita.");
await adminClick("#cat-cancel");
await adminClick('[data-admin-tab="materiais"]');
assert.ok(ad.querySelector("#admin-links-hub"),"Botão Vínculos deve aparecer.");
assert.doesNotMatch(ad.querySelector("#admin-content").textContent,/Com defeito/);

assert.ok(ad.querySelector("#admin-download-excel"),"Exportação Excel deve aparecer.");
assert.equal(ad.querySelector("#admin-group-new"),null,"Sem ações redundantes.");
assert.equal(ad.querySelector("[data-rename-group]"),null,"Renomear apenas na central.");
const clearMaterialsSearch=ad.querySelector("#admin-material-search");
clearMaterialsSearch.value="";
clearMaterialsSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));
await wait(20);
assert.equal(ad.querySelector("[data-admin-group]"),null,"Materiais nunca exibem grupos ou botão Ver variações.");
assert.equal(ad.querySelector(".admin-family-models"),null,"Ver variações é exclusivo do catálogo.");
assert.equal(ad.querySelectorAll("#admin-material-list .material-row").length,6,
  "A primeira página deve listar os componentes individuais, sem agrupamento.");
assert.match(ad.querySelector("#admin-individual-count").textContent,/7 materiais encontrados/,
  "Sete componentes aparecem na contagem total, inclusive os vinculados.");
assert.ok(ad.querySelector('#admin-material-pages [data-page="2"]'),
  "O sétimo material deve estar acessível pela paginação.");
assert.ok(ad.querySelector('#admin-material-list [data-item-edit="3"]'),
  "Arduino Uno vinculado deve ter edição própria na lista.");
const adminSearch=ad.querySelector("#admin-material-search"),espAdmin=fullAdmin.componentes.find(x=>x.id===3),previous=espAdmin.nome;
espAdmin.nome="ESP 32 DevKit";
for(const term of ["esp32","ESP 32","esp-32"]){
  adminSearch.value=term;adminSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));
  await wait(25);
  assert.equal(ad.querySelectorAll("#admin-material-list .material-row").length,1,
    "Busca no Admin exibe apenas o componente correspondente para "+term);
  assert.ok(ad.querySelector('#admin-material-list [data-item-edit="3"]'),
    "Busca deve deixar o componente pronto para editar: "+term);
  assert.equal(ad.querySelector("[data-admin-group]"),null,"Busca não pode exibir grupo.");
}
espAdmin.nome=previous;
adminSearch.value="Arduino";adminSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));
await wait(20);
assert.ok(ad.querySelector('#admin-material-list [data-item-edit="3"]'),
  "Pesquisar Arduino mostra Arduino Uno mesmo estando vinculado.");
assert.equal(ad.querySelectorAll("#admin-material-list .material-row").length,1);
assert.equal(ad.querySelector(".admin-family-models"),null);
adminSearch.value="";adminSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));
await wait(30);
await adminClick("#admin-bulk-visibility");
assert.ok(ad.querySelector("#bulk-category"),"Filtro de categoria obrigatório.");
assert.equal(ad.querySelector("#bulk-select-category"),null,"Sem seleção de categoria duplicada.");
assert.equal(ad.querySelector("#bulk-only-members").disabled,true);
assert.ok(ad.querySelector(".bulk-visibility-badge.public"));
ad.querySelector('[data-bulk-id="1"]').click();await wait(20);
assert.match(ad.querySelector("#bulk-selected-count").textContent,/1 material selecionado/);
assert.equal(ad.querySelector("#bulk-selected-top").textContent,"1 material selecionado");
await adminClick("#bulk-similar");
assert.equal(ad.querySelector("#bulk-selected-top").textContent,"2 materiais selecionados");
assert.deepEqual(Array.from(ad.querySelectorAll("#bulk-list input:checked")).map(x=>Number(x.dataset.bulkId)),[1,2],
  "Selecionar semelhantes deve subir os dois resistores para o início da lista.");
const bulkFilter=ad.querySelector("#bulk-search");
bulkFilter.value="nome inexistente";
bulkFilter.dispatchEvent(new aw.Event("input",{bubbles:true}));await wait(15);
assert.equal(ad.querySelectorAll("#bulk-list input:checked").length,2,
  "Itens selecionados precisam continuar visíveis mesmo com busca que não corresponde.");
bulkFilter.value="";bulkFilter.dispatchEvent(new aw.Event("input",{bubbles:true}));await wait(15);
await adminClick("#bulk-clear");
assert.match(ad.querySelector("#bulk-selected-count").textContent,/0 materiais selecionados/);
await adminClick("#modal-root [data-close]");
await adminClick("#admin-links-hub");
assert.ok(ad.querySelector('[data-link-open="Alcalina"]'));
assert.ok(ad.querySelector('[data-link-photo="Arduino"]'),"Vínculo deve oferecer editor próprio de imagem.");
const arduinoPhotoBefore=three.imagem;
await adminClick('[data-link-photo="Arduino"]');
assert.equal(ad.querySelector("#group-photo-source").value,"nenhuma","Grupo começa sem imagem.");
assert.ok(Array.from(ad.querySelector("#group-photo-source").options).some(x=>x.textContent==="Usar foto de Arduino Uno"),"Seletor deve oferecer a foto do integrante.");
ad.querySelector("#group-photo-source").value="integrante:3";
ad.querySelector("#group-photo-form").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(120);
assert.equal(adminUI.groupImageWrites.at(-1).componente_id,3);
assert.equal(three.imagem,arduinoPhotoBefore,"A foto individual não pode ser modificada pela edição do grupo.");
await adminClick('[data-link-photo="Arduino"]');
assert.equal(ad.querySelector("#group-photo-source").value,"integrante:3","A escolha do integrante deve persistir.");
ad.querySelector("#group-photo-source").value="nenhuma";
ad.querySelector("#group-photo-form").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(110);
assert.equal(adminUI.groupImageWrites.at(-1).modo,"nenhuma","Poder limpar capa sem apagar o vínculo.");
assert.equal(three.imagem,arduinoPhotoBefore);

await adminClick('[data-link-rename="Alcalina"]');
assert.equal(ad.querySelector("#rename-group-name").value,"Alcalina");
ad.querySelector("#rename-group-name").value="Pilhas";
ad.querySelector("#rename-group-form").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(120);
assert.equal(adminUI.variationRenameRequests.at(-1).novo_nome,"Pilhas");
assert.equal(fullAdmin.componentes.filter(x=>x.grupo_variacoes==="Pilhas").length,3);
assert.ok(ad.querySelector('[data-link-open="Pilhas"]'));
await adminClick('[data-link-open="Resistores"]');
assert.equal(ad.querySelector("#variant-linked-count").textContent,"3");
assert.equal(ad.querySelector("#variant-create"),null,"Não cadastrar material pela central.");
assert.equal(ad.querySelector("[data-variant-photo]"),null,"Não editar fotos pela central.");
const variantFilter=ad.querySelector("#variant-search");
variantFilter.value="Arduino";variantFilter.dispatchEvent(new aw.Event("input",{bubbles:true}));
await wait(25);
assert.ok(ad.querySelector('[data-variant-select="3"]'));
ad.querySelector('[data-variant-select="3"]').click();await wait(15);
await adminClick("#variant-link-selected");await wait(115);
assert.equal(fullAdmin.componentes.find(x=>x.id===3).grupo_variacoes,"Resistores");
assert.equal(ad.querySelector("#variant-linked-count").textContent,"4");
await adminClick('[data-variant-remove="3"]');await wait(115);
assert.equal(fullAdmin.componentes.find(x=>x.id===3).grupo_variacoes,"");
assert.equal(ad.querySelector("#variant-linked-count").textContent,"3");
await adminClick("#variant-back");
await adminClick("#links-hub-create");
ad.querySelector("#links-hub-new-name").value="Vínculo Vazio";
ad.querySelector("#links-hub-new-form").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(140);
assert.ok(fullAdmin.grupos_variacoes.some(x=>x.nome==="Vínculo Vazio"));
assert.equal(ad.querySelector("#variant-linked-count").textContent,"0");
await adminClick("#variant-back");
assert.ok(ad.querySelector('[data-link-open="Vínculo Vazio"]'));
await adminClick('[data-link-delete="Vínculo Vazio"]');
assert.ok(ad.querySelector("#v2-confirm"),"Exclusão do grupo exige confirmação.");
await adminClick("#v2-confirm");
await wait(90);
assert.equal(fullAdmin.grupos_variacoes.some(x=>x.nome==="Vínculo Vazio"),false,"Apagar grupo vazio não apaga materiais.");
await adminClick("#modal-root [data-close]");
await adminClick('[data-admin-tab="materiais"]');
assert.equal(ad.querySelector("[data-admin-group]"),null);
assert.ok(ad.querySelector('#admin-material-list [data-item-edit="1"]'));
assert.ok(ad.querySelector('#admin-material-list [data-item-edit="2"]'));
await adminClick('#admin-material-list [data-item-edit="1"]');
assert.ok(ad.querySelector("#i-name"));
assert.ok(ad.querySelector("#i-quantity"));
assert.equal(ad.querySelector("#i-id"),null,"Modelo/referência foi retirado do editor.");
assert.equal(ad.querySelector("#i-note"),null,"Observações redundantes foram retiradas.");
assert.match(ad.querySelector("#item-editor-identification").textContent,/Patrimônio e unidade/);
assert.ok(ad.querySelector("#i-available"),"Disponível precisa aparecer calculado no editor.");
assert.equal(ad.querySelector("#i-broken"),null,"Não mostrar mais campo de defeitos.");
assert.equal(ad.querySelectorAll("#i-loan-audience option").length,2,"Apenas PETianes e Visitantes.");
assert.equal(ad.querySelector("#i-loan-audience").value,"visitantes");
assert.equal(ad.querySelector("#i-available").value,"15");
assert.ok(ad.querySelector("#i-photo"));
assert.equal(ad.querySelector("#i-variation-family"),null);
assert.equal(ad.querySelector("#i-has-link").textContent,"Sim");
await adminClick("#modal-root [data-close]");
// Regressão: selecionar semelhantes em Vínculos deve subir os candidatos e contar
// todos os escolhidos, ainda que a pesquisa continue filtrada.
fullAdmin.componentes.push(
  {...three,id:109,nome:"Arduino Nano",grupo_variacoes:"",quantidade:2},
  {...three,id:110,nome:"Arduino Mega",grupo_variacoes:"",quantidade:3}
);
await adminClick("#admin-links-hub");
await adminClick('[data-link-open="Arduino"]');
assert.equal(ad.querySelector("#variant-selected-count").textContent,"0 materiais selecionados");
await adminClick("#variant-similar");
assert.equal(ad.querySelector("#variant-selected-count").textContent,"3 materiais selecionados");
assert.match(ad.querySelector("#variant-link-selected").textContent,/\(3\)/);
assert.deepEqual(Array.from(ad.querySelectorAll("#variant-available-list input:checked")).map(x=>Number(x.dataset.variantSelect)),[110,109,3],
  "Semelhantes selecionados devem subir e ficar ordenados por nome.");
const linkingSearch=ad.querySelector("#variant-search");
linkingSearch.value="Resistor";linkingSearch.dispatchEvent(new aw.Event("input",{bubbles:true}));await wait(15);
assert.deepEqual(Array.from(ad.querySelectorAll("#variant-available-list input:checked")).map(x=>Number(x.dataset.variantSelect)),[110,109,3],
  "Busca não pode ocultar candidatos já selecionados.");
ad.querySelector('[data-variant-select="110"]').click();await wait(15);
assert.equal(ad.querySelector("#variant-selected-count").textContent,"2 materiais selecionados");
assert.deepEqual(Array.from(ad.querySelectorAll("#variant-available-list input:checked")).map(x=>Number(x.dataset.variantSelect)),[109,3]);
await adminClick("#variant-clear");
assert.equal(ad.querySelector("#variant-selected-count").textContent,"0 materiais selecionados");
assert.equal(ad.querySelector("#variant-link-selected").disabled,true);
await adminClick("#variant-back");
await adminClick("#modal-root [data-close]");
await adminClick('[data-admin-tab="materiais"]');
// Nenhuma exclusão deve baixar arquivos sem o administrador escolher.
await adminClick('[data-item-delete="110"]');
assert.equal(ad.querySelector("#delete-item-backup").checked,false);
assert.match(ad.querySelector("#delete-item-confirm").textContent,/Deseja baixar um backup/);
const backupsBefore=adminUI.backupReadCount();
ad.querySelector("#delete-item-confirm").dispatchEvent(new aw.Event("submit",{bubbles:true,cancelable:true}));
await wait(120);
assert.ok(adminUI.deletedMaterials.includes(110),"Material deve poder ser excluído sem backup.");
assert.equal(adminUI.backupReadCount(),backupsBefore,"Não consultar o endpoint de backup se não foi escolhido.");
// Ao abrir exclusão da categoria, a escolha também deve começar desmarcada.
await adminClick('[data-admin-tab="categorias"]');
await adminClick('[data-cat-delete="3"]');
assert.equal(ad.querySelector("#cat-delete-backup").checked,false);
await adminClick("#cat-delete-cancel");
await adminClick('[data-admin-tab="configuracoes"]');
await adminClick("#v2-reset-reservations");
assert.equal(ad.querySelector("#reset-reservations-backup").checked,false);
assert.equal(ad.querySelector("#reset-reservations-confirm"),null,"Não exigir digitar frase para excluir reservas.");
assert.ok(ad.querySelector("#reset-reservations-submit"),"Botão de exclusão direta deve existir.");
await adminClick("#reset-reservations-cancel");
assert.deepEqual(adminUI.errors,[],"Erros da página Admin.");
assert.equal(ad.querySelector("#admin-back").tagName,"A","Voltar ao catálogo deve ser link real.");
assert.equal(ad.querySelector("#admin-back").getAttribute("href"),"/");
// O Admin decide só se recebeu ou não: sem campos de descartes e observações.
const pendingReturn={id:987,componente_id:1,componente_nome:"Resistor 100Ω",
  nome_solicitante:"Visitante exemplo",quantidade:2,status:"retirada",
  data_inicio:"2026-11-07",data_devolucao:"2026-11-07",devolucao_solicitada_em:"2026-11-07T21:00:00Z"};
fullAdmin.reservas.push(pendingReturn);
await adminClick('[data-admin-tab="reservas"]');
await adminClick('[data-admin-res-filter="devolucoes"]');
assert.ok(ad.querySelector('[data-res-do="devolver"][data-id="987"]'),"Admin deve poder confirmar recebimento.");
assert.ok(ad.querySelector('[data-res-do="cancelar_solicitacao_devolucao"][data-id="987"]'),"Admin deve poder marcar não recebido.");
await adminClick('[data-res-do="devolver"][data-id="987"]');
assert.match(ad.querySelector("#modal-root").textContent,/Material recebido/);
assert.equal(ad.querySelector("#return-discard"),null,"A confirmação não pode pedir descartes.");
assert.equal(ad.querySelector("#return-note"),null,"A confirmação não pode pedir observações.");
await adminClick("#v2-confirm");
assert.equal(adminUI.adminReservationRequests.at(-1).acao,"devolver");
assert.equal(adminUI.adminReservationRequests.at(-1).id,987);
assert.equal("descartados" in adminUI.adminReservationRequests.at(-1),false,"Não enviar descarte no recebimento.");
assert.equal("observacao" in adminUI.adminReservationRequests.at(-1),false,"Não enviar observações no recebimento.");
await adminClick('[data-res-do="cancelar_solicitacao_devolucao"][data-id="987"]');
assert.match(ad.querySelector("#modal-root").textContent,/não recebido/);
await adminClick("#v2-confirm");
assert.equal(adminUI.adminReservationRequests.at(-1).acao,"cancelar_solicitacao_devolucao");
assert.equal("descartados" in adminUI.adminReservationRequests.at(-1),false);
fullAdmin.reservas.pop();
await adminClick('[data-admin-tab="painel"]');
await adminClick("#admin-logout");
assert.ok(ad.querySelector("#v2-confirm"),"Sair do Admin exige confirmação.");
await adminClick("#v2-confirm");
await wait(100);
assert.equal(aw.localStorage.getItem("pet_admin_open"),"0","Logout deve limpar sessão local.");
assert.equal(aw.__adminTestState.admin===null,true,"Logout deve limpar estado administrativo.");
assert.ok(!ad.querySelector("#admin-stage").classList.contains("admin-loading"),"Logout não pode deixar tela carregando.");
assert.deepEqual(adminUI.errors.filter(x=>!x.includes("Not implemented: navigation (except hash changes)")),[],"Erros de logout além da navegação indisponível no jsdom.");
adminUI.dom.window.close();
// XSS armazenado: nem nomes de materiais/categorias, conta pessoal, observações
// ou notificações podem virar script/event handler executável no DOM.
const payload='"><img src=x onerror="window.__xssExecuted=true"><svg onload="window.__xssExecuted=true">';
const originalOneName=one.nome,originalCatName=categories[0].nome,originalPersonName=identity.nome;
one.nome=payload;
categories[0].nome=payload;
identity.nome=payload;
const hostileReservation={id:994,componente_id:1,componente_nome:payload,
  nome_solicitante:payload,observacao:payload,contato:payload,quantidade:1,
  status:"pendente",data_inicio:"2026-12-01",data_devolucao:"2026-12-03"};
fullAdmin.reservas.push(hostileReservation);
const checkNoHtmlInjection=(doc,label)=>{
  assert.equal(doc.querySelectorAll("img[onerror],svg[onload],*[onclick],script:not([src])").length,0,
    label+": nenhum conteúdo injetado pode criar handlers HTML ou scripts inline.");
  assert.ok(!doc.defaultView.__xssExecuted,label+": JavaScript não pode ser executado.");
};
const xssPublic=build(false,false,true);
await wait(300);
xssPublic.w.__xssExecuted=false;
checkNoHtmlInjection(xssPublic.d,"Catálogo com dados maliciosos");
assert.match(xssPublic.d.querySelector("#category-sections").textContent,/onerror=/,
  "O nome malicioso deve ser exibido como texto literal.");
xssPublic.addNotice({id:996,titulo:payload,mensagem:payload,
  criada_em:"2026-11-07T12:10:00Z",lida_em:null});
await xssPublic.click("#notification-button");
checkNoHtmlInjection(xssPublic.d,"Notificações com dados maliciosos");
xssPublic.dom.window.close();

const xssAdmin=build(true,true,true);
await wait(280);
xssAdmin.w.__xssExecuted=false;
await xssAdmin.click('[data-admin-tab="usuarios"]');
await wait(85);
checkNoHtmlInjection(xssAdmin.d,"Usuários do Admin");
await xssAdmin.click('[data-admin-tab="materiais"]');
await xssAdmin.click('#admin-material-list [data-item-edit="1"]');
assert.equal(xssAdmin.d.querySelector("#i-name")?.value,payload,
  "Editor deve conservar a entrada como valor textual, sem interpretá-la.");
checkNoHtmlInjection(xssAdmin.d,"Editor do Admin com dados maliciosos");
await xssAdmin.click("#modal-root [data-close]");
await xssAdmin.click('[data-admin-tab="reservas"]');
await wait(65);
checkNoHtmlInjection(xssAdmin.d,"Reservas do Admin com dados maliciosos");
assert.match(xssAdmin.d.querySelector("#admin-content").textContent,/onerror=/,
  "Observações maliciosas precisam ser exibidas como texto.");
assert.deepEqual(xssAdmin.errors,[],"Nenhum erro de execução causado pelos dados maliciosos.");
xssAdmin.dom.window.close();
fullAdmin.reservas.pop();
one.nome=originalOneName;
categories[0].nome=originalCatName;
identity.nome=originalPersonName;
console.log("XSS OK: entradas maliciosas em catálogo, editor, usuários, notificações e reservas viram apenas texto.");
console.log("NOVA UI OK: catálogo, variações, busca, painel próprio, histórico, visibilidade e filamentos.");
