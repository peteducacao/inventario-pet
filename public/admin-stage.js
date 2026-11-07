/* Administração Inventário PET: painel próprio e responsivo. */
const ADMIN_TABS=[["painel","grid","Painel"],["materiais","box","Materiais"],["filamentos","layers","Filamentos"],["reservas","calendar","Reservas"],["usuarios","users","Usuários"],["categorias","layers","Categorias"],["historico","back","Histórico"],["configuracoes","settings","Configurações"]];
function adminCounts(){
  const items=state.admin?.componentes?.filter(x=>!isArchived(x))||[];
  const reservations=state.admin?.reservas||[];
  return {items:items.length,used:items.reduce((n,x)=>n+(Number(x.em_uso)||0),0),
    defective:items.reduce((n,x)=>n+(Number(x.com_defeito)||0),0),
    available:items.reduce((n,x)=>n+stock(x),0),
    pending:reservations.filter(x=>x.status==="pendente").length};
}
function adminLastUpdate(){
  const items=state.admin?.componentes||[];
  const sorted=[...items.map(x=>x.ultima_alteracao),...(state.admin?.filamentos||[]).map(x=>x.atualizado_em)].filter(Boolean).sort();
  const last=sorted.at(-1),source=state.admin?.configuracoes?.inventario_fonte_atualizacao;
  return "Atualizado: "+(last?niceDate(last):source||"—")+(source?" · Planilha-base: "+source:"");
}
async function enterAdmin(silent=false){
  try{
    if(!state.admin)await adminReload();
    else await adminReload();
    adminModal();
  }catch(error){
    state.admin=null;
    if(silent){stored("pet_admin_open","0");$("#admin-stage").hidden=true;document.body.classList.remove("admin-mode");return;}
    if(error.message.includes("Entre no painel")||error.message.includes("401"))return openAdmin();
    toast(error.message,true);
  }
}
function adminModal(){
  if(!state.admin)return enterAdmin();
  closeModal();
  $("#admin-stage").hidden=false;
  $("#admin-stage").classList.remove("admin-loading");
  document.body.classList.add("admin-mode");
  stored("pet_admin_open","1");
  // Não transformar acesso ao Admin em sessão pessoal.
  if(document.body.dataset.adminRoute==="true")sessionStorage.setItem("pet_check_identity_after_admin","1");
  state.tab=UI.adminTab;
  adminBuild();
}
function adminBuild(){
  if(!state.admin)return;
  const stage=$("#admin-stage"),counts=adminCounts();
  const current=ADMIN_TABS.find(t=>t[0]===UI.adminTab)||ADMIN_TABS[0];
  stage.innerHTML='<div class="admin-layout"><aside class="admin-sidebar" id="admin-sidebar">'+
    '<div class="admin-brand"><span class="brand-mark">'+iconSvg("box",28)+'</span><span>Inventário PET</span></div>'+
    '<nav class="admin-nav">'+ADMIN_TABS.map(([key,ico,label])=>'<button type="button" data-admin-tab="'+key+'" class="'+(UI.adminTab===key?"active":"")+'">'+iconSvg(ico)+' <span>'+label+'</span>'+(key==="reservas"&&counts.pending?'<span class="nav-badge">'+counts.pending+'</span>':"")+'</button>').join("")+'</nav>'+
    '<div class="admin-side-bottom"><span class="admin-updated">'+esc(adminLastUpdate())+'</span>'+
    '<a href="/" id="admin-back" class="admin-sidebar-link">'+iconSvg("back",16)+' Voltar ao inventário</a>'+
    '<button type="button" id="admin-logout" style="background:#f36e6e22">'+iconSvg("logout",16)+' Sair da administração</button></div></aside>'+
    '<div class="admin-main"><header class="admin-top"><div style="display:flex;align-items:center;gap:11px">'+
    '<button type="button" class="admin-menu-toggle" id="admin-menu-toggle" aria-label="Abrir menu">'+iconSvg("menu")+'</button>'+
    '<div><h1>'+esc(current[2])+'</h1><small>Inventário do PET Educação</small></div></div>'+
    '<div class="admin-right"><button id="admin-notifications" type="button" class="nav-icon admin-bell" aria-label="Solicitações pendentes">'+iconSvg("bell")+
    (counts.pending?'<span class="notification-count">'+counts.pending+'</span>':"")+'</button>'+
    '<button id="admin-account" type="button" class="admin-person"><span class="avatar">'+esc((state.actor||"A")[0].toUpperCase())+'</span><span>'+esc(state.actor||"Administrador")+'</span>'+iconSvg("down",15)+'</button></div></header>'+
    '<div id="admin-content"></div><footer class="admin-status-foot">'+esc(adminLastUpdate())+'</footer></div></div>';
  $$("[data-admin-tab]",stage).forEach(b=>b.onclick=()=>selectAdminTab(b.dataset.adminTab));
  // O link href="/" permite abrir em nova guia.
  $("#admin-logout").onclick=logoutAdmin;
  $("#admin-menu-toggle").onclick=()=>$("#admin-sidebar").classList.toggle("is-open");
  $("#admin-notifications").onclick=()=>selectAdminTab("reservas");
  $("#admin-account").onclick=async()=>{
    const yes=await niceModalConfirm("Sair da administração?","Sua sessão administrativa será encerrada.","Sair",true);
    if(yes)await performAdminLogout();
  };
  adminContent();
}
function leaveAdminWithoutLogout(){
  if(document.body.dataset.adminRoute==="true"){location.href="/";return;}
  stored("pet_admin_open","0");
  $("#admin-stage").hidden=true;document.body.classList.remove("admin-mode");
  closeModal();finalRender();
}
async function logoutAdmin(){
  if(await niceModalConfirm("Sair da administração?","Você voltará ao inventário. Para administrar novamente, será necessário entrar com a senha.","Deslogar",true))await performAdminLogout();
}
async function performAdminLogout(){
  try{await api("/api/logout","POST",{});}
  catch(error){toast("Falha ao encerrar a sessão: "+error.message,true);return;}
  state.admin=null;
  stored("pet_admin_open","0");
  closeModal();
  if(document.body.dataset.adminRoute==="true"){
    // Redirecionar apenas depois de invalidar a sessão; nunca reconstruir
    // um modal sobre a página que está navegando para fora do Admin.
    window.location.replace("/");
    return;
  }
  leaveAdminWithoutLogout();
  flashPopup("Até logo!","Você saiu da administração.");
}
function selectAdminTab(tab){
  if(!ADMIN_TABS.some(x=>x[0]===tab))tab="painel";
  UI.adminTab=tab;state.tab=tab;stored("pet_admin_tab",tab);
  if(tab==="reservas")UI.reservationPage=1;
  adminBuild();
  document.querySelector(".admin-main")?.scrollIntoView({block:"start"});
}
function adminContent(){
  const content=$("#admin-content");if(!content)return;
  if(UI.adminTab==="painel")return adminDashboard(content);
  if(UI.adminTab==="materiais")return adminMaterials(content);
  if(UI.adminTab==="filamentos")return adminFilaments(content);
  if(UI.adminTab==="reservas")return adminReservations(content);
  if(UI.adminTab==="usuarios")return adminUsers(content);
  if(UI.adminTab==="categorias")return adminCategories(content);
  if(UI.adminTab==="historico")return adminHistory(content);
  return adminSettings(content);
}
function dashboardRecentEvent(log){
  const kind=String(log.tipo||"sistema").toLowerCase();
  const config={
    material:{emoji:"📦",label:"Material",tab:"materiais"},
    categoria:{emoji:"🗂️",label:"Categoria",tab:"categorias"},
    filamento:{emoji:"🧵",label:"Filamento",tab:"filamentos"},
    reserva:{emoji:"📋",label:"Reserva",tab:"reservas"},
    usuario:{emoji:"👤",label:"Usuário",tab:"usuarios"},
    sistema:{emoji:"⚙️",label:"Sistema",tab:"historico"}
  }[kind]||{emoji:"📝",label:"Alteração",tab:"historico"};
  return '<button type="button" class="dashboard-change" data-dashboard-log-id="'+attr(log.id)+'" aria-label="'+attr(config.label+': '+log.acao+'. '+(log.descricao||"")+'. Abrir '+config.tab)+'">'+
    '<span class="dashboard-change-emoji" aria-hidden="true">'+config.emoji+'</span>'+
    '<span class="dashboard-change-content"><span class="dashboard-change-title">'+esc(log.acao||"Alteração")+' · '+esc(config.label)+'</span>'+
    '<span class="dashboard-change-description">'+esc(log.descricao||"Sem detalhes adicionais")+'</span>'+
    '<span class="dashboard-change-date">'+esc(niceDate(log.criado_em))+' · '+esc(log.responsavel||"Admin")+'</span></span>'+
    '<span class="dashboard-change-chevron" aria-hidden="true">'+iconSvg("chevron",19)+'</span>'+
    '</button>';
}
function dashboardOpenEvent(log){
  const destinations={material:"materiais",categoria:"categorias",filamento:"filamentos",reserva:"reservas",usuario:"usuarios",sistema:"historico"};
  const tab=destinations[log.tipo]||"historico";
  if(tab==="materiais"){
    const item=log.registro_id!=null?state.admin?.componentes?.find(x=>String(x.id)===String(log.registro_id)):null;
    // Um material arquivado deve ser encontrado na aba Arquivados, não na lista comum.
    UI.adminCategory=item&&isArchived(item)?"archived":"all";
    UI.adminSearch=item?.nome||"";
    UI.adminPage=1;
    stored("pet_admin_category",UI.adminCategory);
    stored("pet_admin_search",UI.adminSearch);
    stored("pet_admin_page",1);
  }
  if(tab==="reservas"){
    UI.reservationFilter="todas";UI.reservationPage=1;
    stored("pet_admin_reservas","todas");
  }
  if(tab==="historico"){
    UI.logType="all";UI.logPage=1;
  }
  selectAdminTab(tab);
}
function adminDashboard(root){
  const c=adminCounts();
  root.innerHTML='<section class="admin-panel"><h2>Visão geral</h2><p>Resumo do acervo e últimas movimentações.</p>'+
    '<div class="admin-overview three" style="margin-top:15px"><div class="admin-stat"><strong>'+c.items+'</strong><span>Itens cadastrados</span></div>'+
    '<div class="admin-stat"><strong>'+c.used+'</strong><span>Em uso</span></div>'+
    '<div class="admin-stat"><strong>'+c.defective+'</strong><span>Com defeito</span></div></div>'+
    '<div class="dashboard-changes-head"><h3>Últimas alterações</h3><button type="button" class="outline-button small-button" id="dashboard-log-all">Ver histórico</button></div>'+
    '<div id="dashboard-recent-log" class="dashboard-changes-list" aria-live="polite"><p class="dashboard-changes-loading">Carregando alterações…</p></div></section>';
  $("#dashboard-log-all").onclick=()=>selectAdminTab("historico");
  api("/api/admin/log?pagina=1").then(data=>{
    const recent=$("#dashboard-recent-log");
    if(!recent||UI.adminTab!=="painel")return;
    const events=(data.eventos||[]).slice(0,4);
    recent.innerHTML=events.length?events.map(dashboardRecentEvent).join(""):
      '<div class="empty-state">Nenhuma alteração registrada ainda.</div>';
    $$("[data-dashboard-log-id]",recent).forEach((button,index)=>
      button.onclick=()=>dashboardOpenEvent(events[index]));
  }).catch(error=>{
    const recent=$("#dashboard-recent-log");
    if(recent&&UI.adminTab==="painel")recent.innerHTML='<div class="empty-state">Não foi possível carregar as últimas alterações. '+esc(error.message)+'</div>';
  });
}
function adminLogRow(log){
  return '<article class="admin-log-row"><strong>'+esc(log.acao)+' · '+esc(log.tipo)+'</strong>'+
    '<small>'+esc(niceDate(log.criado_em))+' · '+esc(log.responsavel||"Admin")+'</small>'+
    '<p>'+esc(log.descricao||"Sem detalhes adicionais")+'</p></article>';
}
async function adminHistory(root){
  const selected=UI.logType||"all",page=UI.logPage||1;
  root.innerHTML='<section class="admin-panel">'+
    '<div class="admin-section-head"><div><h2>Histórico de alterações</h2><p>Registra cadastros, edições, exclusões, reservas, devoluções e alterações de acesso a partir desta atualização.</p></div></div>'+
    '<div class="admin-log-controls"><label>Tipo de atividade<select id="admin-log-type">'+
    [["all","Todas"],["material","Materiais"],["categoria","Categorias"],["filamento","Filamentos"],["reserva","Reservas"],["usuario","Usuários"],["sistema","Sistema"]].map(([k,name])=>'<option value="'+k+'" '+(k===selected?'selected':'')+'>'+name+'</option>').join("")+
    '</select></label><label>Limpar automaticamente após<select id="admin-log-retention">'+
    [["nunca","Nunca"],["1","24 horas"],["3","3 dias"],["5","5 dias"],["7","7 dias"],["15","15 dias"],["30","1 mês"]].map(([k,name])=>'<option value="'+k+'">'+name+'</option>').join("")+
    '</select></label>'+
    '<button type="button" class="outline-button small-button" id="admin-log-save-period">Salvar prazo</button>'+
    '<button type="button" class="danger-button small-button" id="admin-log-clear">Limpar manualmente</button></div>'+
    '<p id="admin-log-count" style="font-size:11px;color:#6e8394"></p>'+
    '<div id="admin-log-list" class="admin-log-list"><div class="loading-placeholder">Carregando histórico…</div></div>'+
    '<nav id="admin-log-pages" class="page-controls"></nav></section>';
  $("#admin-log-type").onchange=e=>{UI.logType=e.target.value;UI.logPage=1;adminHistory(root);};
  $("#admin-log-save-period").onclick=async()=>{
    const value=$("#admin-log-retention").value;
    try{await api("/api/admin/log","POST",{acao:"configurar",prazo:value,responsavel:state.actor||"Admin"});toast("Prazo do histórico salvo.");await adminHistory(root);}
    catch(error){toast(error.message,true);}
  };
  $("#admin-log-clear").onclick=async()=>{
    const ok=await niceModalConfirm("Limpar todo o histórico?","Esta ação apaga definitivamente os eventos já registrados. Os materiais, categorias, reservas e usuários NÃO serão apagados.","Apagar histórico",true);
    if(!ok)return;
    try{const result=await api("/api/admin/log","POST",{acao:"limpar",confirmar:"LIMPAR HISTÓRICO"});UI.logPage=1;await adminHistory(root);toast(result.removidos+" eventos excluídos.");}
    catch(error){toast(error.message,true);}
  };
  $("#admin-log-pages").onclick=e=>{
    const b=e.target.closest("[data-page]");if(!b)return;
    UI.logPage=Number(b.dataset.page);adminHistory(root);
  };
  try{
    const data=await api("/api/admin/log?pagina="+page+"&tipo="+encodeURIComponent(selected));
    if(!document.contains(root)||UI.adminTab!=="historico")return;
    $("#admin-log-retention").value=data.limpeza_historico||"nunca";
    $("#admin-log-count").textContent=Number(data.total||0)+" evento(s) registrados.";
    $("#admin-log-list").innerHTML=(data.eventos||[]).map(adminLogRow).join("")||'<div class="empty-state">Nenhuma alteração neste filtro.</div>';
    $("#admin-log-pages").innerHTML=pageButtons({page:data.pagina||1,pages:Math.max(1,Math.ceil((data.total||0)/35)),total:data.total||0},"history");
  }catch(error){const el=$("#admin-log-list");if(el)el.textContent=error.message;}
}
function quantityCell(name,num,clazz=""){
  return '<div class="admin-quantity '+clazz+'"><small>'+name+'</small><strong>'+num+'</strong></div>';
}
function roleLoanToggle(kind,id,profile,enabled,parentEnabled=true){
  const isPet=profile==="petianos",name=isPet?"Retirada para PETianes":"Retirada para visitantes";
  const status=enabled?(parentEnabled?"Ativada":"Categoria bloqueada"):"Desativada";
  return '<button type="button" class="role-loan-toggle '+(enabled&&parentEnabled?'is-on':'is-off')+'" data-'+kind+'-role="'+profile+'" data-'+kind+'-loan-id="'+Number(id)+'" aria-pressed="'+(enabled?'true':'false')+'" title="'+attr(name+': '+status)+'">'+
    '<span>'+name+'</span><strong>'+status+'</strong></button>';
}
function adminMaterialRow(x){
  const available=stock(x),isHidden=isArchived(x);
  const status=isHidden?"Arquivado":available?"Disponível":"Sem estoque";
  const cat=(state.admin.categorias||[]).find(c=>Number(c.id)===Number(x.categoria_id));
  return '<div class="material-row">'+thumb(x)+
    '<div class="material-name"><strong>'+esc(x.nome)+'</strong><small>'+esc(nameCategory(x.categoria_id))+(x.patrimonio?" · "+esc(x.patrimonio):"")+(Number(x.visivel_visitante)===0?' · Só PETianes':'')+(x.grupo_variacoes?' · Grupo: '+esc(x.grupo_variacoes):'')+'</small>'+
    '<small class="mobile-meta" style="display:none">Total: '+x.quantidade+' · Em uso: '+x.em_uso+' · Defeito: '+x.com_defeito+'</small>'+
    '<div class="role-loan-controls">'+
      roleLoanToggle("item",x.id,"petianos",Number(x.permitir_petianos)===1,Number(cat?.permitir_petianos)===1)+
      roleLoanToggle("item",x.id,"visitantes",Number(x.permitir_visitantes)===1,Number(cat?.permitir_visitantes)===1)+
    '</div></div>'+
    quantityCell("Quantidade",Number(x.quantidade))+quantityCell("Em uso",Number(x.em_uso),"used")+quantityCell("Defeito",Number(x.com_defeito),"broken")+
    '<span class="material-status '+(isHidden||!available?"empty":"")+'">'+status+'</span>'+
    '<div class="material-actions"><button class="square-action" type="button" title="Ver detalhes" aria-label="Ver detalhes" data-item-view="'+x.id+'">'+iconSvg("eye")+'</button>'+
    '<button class="square-action" type="button" title="Editar" aria-label="Editar" data-item-edit="'+x.id+'">'+iconSvg("edit")+'</button>'+
    '<button class="square-action '+(isHidden?"":"danger")+'" type="button" title="'+(isHidden?"Restaurar":"Arquivar")+'" data-item-archive="'+x.id+'">'+iconSvg(isHidden?"back":"trash")+'</button></div></div>';
}
function wireMaterialActions(root){
  $$("[data-item-role]",root).forEach(b=>b.onclick=async()=>{
    const x=(state.admin.componentes||[]).find(x=>x.id===Number(b.dataset.itemLoanId));
    if(!x)return;
    const profile=b.dataset.itemRole;
    const enabled=Number(x[profile==="petianos"?"permitir_petianos":"permitir_visitantes"])!==1;
    try{
      await api("/api/admin/item/loans","POST",{id:x.id,perfil:profile,permitir:enabled});
      await adminReload();adminBuild();
      toast((profile==="petianos"?"PETianes":"Visitantes")+": retirada "+(enabled?"liberada":"bloqueada")+" neste material.");
    }catch(error){toast(error.message,true);}
  });
  $$("[data-item-view]",root).forEach(b=>b.onclick=()=>adminViewMaterial(Number(b.dataset.itemView)));
  $$("[data-item-edit]",root).forEach(b=>b.onclick=()=>adminItemEditor(Number(b.dataset.itemEdit)));
  $$("[data-item-archive]",root).forEach(b=>b.onclick=()=>adminArchiveItem(Number(b.dataset.itemArchive)));
}
function adminViewMaterial(id){
  const x=state.admin.componentes.find(z=>z.id===id);if(!x)return;
  const image=itemImage(x);
  openModal(x.nome,"",'<div class="modal-main"><div class="photo-editor">'+
    '<div class="photo-editor-preview">'+(image?'<img src="'+attr(image)+'" alt="'+attr(x.nome)+'">':"")+'</div>'+
    '<div><strong>'+esc(nameCategory(x.categoria_id))+'</strong><p>'+(x.patrimonio?'Patrimônio: '+esc(x.patrimonio):'Sem patrimônio')+'</p><p>'+x.quantidade+' total · '+x.em_uso+' em uso · '+x.com_defeito+' com defeito</p></div></div>'+
    (x.observacoes?'<p class="notice">'+esc(x.observacoes)+'</p>':"")+
    (x.descricao_defeito?'<p class="notice warning">'+esc(x.descricao_defeito)+'</p>':"")+
    '<p style="font-size:11px;color:#7e91a2">Última alteração: '+niceDate(x.ultima_alteracao)+'</p>'+
    '<div class="modal-footer" style="border:0;padding:14px 0 0"><button type="button" class="secondary-button" id="v2-view-close">Fechar</button><button type="button" class="primary-button" id="v2-view-edit">Editar</button></div></div>');
  $("#v2-view-close").onclick=closeModal;
  $("#v2-view-edit").onclick=()=>adminItemEditor(id);
}
async function adminArchiveItem(id){
  const x=state.admin.componentes.find(z=>z.id===id);if(!x)return;
  const isHidden=isArchived(x);
  if(!await niceModalConfirm(isHidden?"Restaurar material?":"Arquivar material?",(isHidden?"Restaurar ":"Arquivar ")+x.nome+"? O histórico de empréstimos será preservado.",isHidden?"Restaurar":"Arquivar",!isHidden))return;
  try{
    if(isHidden)await api("/api/admin/item/unarchive","POST",{id});
    else await api("/api/admin/item?id="+id,"DELETE");
    await adminReload();adminBuild();toast(isHidden?"Material restaurado.":"Material arquivado.");
  }catch(e){toast(e.message,true);}
}
function adminMaterials(root){
  const cats=state.admin.categorias;
  const categoryOptions='<option value="all">Todas as categorias</option>'+cats.map(c=>'<option value="'+c.id+'" '+(UI.adminCategory===String(c.id)?"selected":"")+'>'+esc(c.nome)+'</option>').join("")+
    '<option value="archived" '+(UI.adminCategory==="archived"?"selected":"")+'>Arquivados</option>';
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head admin-materials-heading"><div><h2>Materiais cadastrados</h2></div>'+
    '<div class="buttons"><button class="outline-button" type="button" id="admin-bulk-visibility">'+iconSvg("eye",15)+' Visibilidade</button><button class="primary-button" id="admin-item-new" type="button">'+iconSvg("plus",16)+' Novo material</button></div></div>'+
    '<div class="admin-tools"><div class="search-box">'+iconSvg("search")+'<input type="search" id="admin-material-search" placeholder="Buscar materiais..." value="'+attr(UI.adminSearch)+'"></div>'+
    '<select id="admin-material-category" class="admin-filter" aria-label="Categoria">'+categoryOptions+'</select>'+
    '<select id="admin-material-sort" class="admin-sort" aria-label="Ordenação">'+sortOptions(UI.adminSort)+'</select></div>'+
    '<div id="admin-material-list"></div><nav id="admin-material-pages" class="page-controls admin-paginate"></nav></section>';
  $("#admin-item-new").onclick=()=>adminItemEditor();
  $("#admin-bulk-visibility").onclick=()=>openBulkVisibility();
  $("#admin-material-search").oninput=e=>{UI.adminSearch=e.target.value;UI.adminPage=1;stored("pet_admin_search",UI.adminSearch);paintAdminMaterials()};
  $("#admin-material-category").onchange=e=>{UI.adminCategory=e.target.value;UI.adminPage=1;stored("pet_admin_category",UI.adminCategory);paintAdminMaterials()};
  $("#admin-material-sort").onchange=e=>{UI.adminSort=e.target.value;UI.adminPage=1;stored("pet_admin_sort",UI.adminSort);paintAdminMaterials()};
  $("#admin-material-pages").onclick=e=>{
    const b=e.target.closest("[data-page]");if(!b)return;
    UI.adminPage=Number(b.dataset.page);stored("pet_admin_page",UI.adminPage);paintAdminMaterials();
  };
  paintAdminMaterials();
}
function sortOptions(value){
  return [["az","A–Z"],["za","Z–A"],["recent","Última alteração"],["old","Mais antigo"],["available","Mais disponíveis"],["less","Menos disponíveis"]].map(([key,label])=>
    '<option value="'+key+'" '+(value===key?"selected":"")+'>'+label+'</option>').join("");
}
function paintAdminMaterials(){
  const list=$("#admin-material-list");if(!list)return;
  const query=UI.adminSearch.toLowerCase().trim();
  const visible=state.admin.componentes.filter(x=>{
    if(UI.adminCategory==="archived"){if(!isArchived(x))return false;}
    else if(isArchived(x)||(UI.adminCategory!=="all"&&String(x.categoria_id)!==UI.adminCategory))return false;
    return !query||[x.nome,x.patrimonio,x.identificacao].some(v=>String(v||"").toLowerCase().includes(query));
  });
  const p=paginate(ordered(visible,UI.adminSort),UI.adminPage);
  UI.adminPage=p.page;stored("pet_admin_page",p.page);
  list.innerHTML=p.total?'<div class="material-list">'+p.items.map(adminMaterialRow).join("")+'</div>':
    '<div class="empty-state">Nenhum material encontrado.</div>';
  $("#admin-material-pages").innerHTML=pageButtons(p,"admin");
  wireMaterialActions(list);
}


/* Reservas: grupos mutuamente exclusivos. */
function reservationGroup(r){
  if(r.status==="pendente")return "pendente";
  if(r.status==="retirada"&&!Number(r.sem_prazo)&&r.data_devolucao<localDate())return "atrasadas";
  if(r.status==="aprovada"||r.status==="retirada")return "ativas";
  return "concluidas";
}
function adminReservations(root){
  const all=state.admin.reservas||[];
  const filter=UI.reservationFilter;
  const filters=[["pendente","Pendentes"],["ativas","Ativas"],["atrasadas","Atrasadas"],["concluidas","Concluídas"],["todas","Todas"]];
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Reservas e devoluções</h2></div></div>'+
    '<div class="admin-tools" style="gap:8px">'+filters.map(([key,label])=>
      '<button type="button" class="chip '+(filter===key?"active":"")+'" data-admin-res-filter="'+key+'">'+label+' <small>'+all.filter(r=>key==="todas"||reservationGroup(r)===key).length+'</small></button>').join("")+'</div>'+
    '<div class="admin-tools"><div class="search-box">'+iconSvg("search")+'<input type="search" id="admin-res-search" placeholder="Buscar material ou solicitante..."></div></div>'+
    '<div class="reservation-list" id="admin-res-list"></div><nav id="admin-res-pages" class="page-controls"></nav></section>';
  $$("[data-admin-res-filter]",root).forEach(b=>b.onclick=()=>{
    UI.reservationFilter=b.dataset.adminResFilter;
    UI.reservationPage=1;stored("pet_admin_reservas",UI.reservationFilter);adminReservations(root);
  });
  $("#admin-res-search").oninput=()=>{UI.reservationPage=1;paintReservations();};
  $("#admin-res-pages").onclick=e=>{const b=e.target.closest("[data-page]");if(!b)return;UI.reservationPage=Number(b.dataset.page);paintReservations();};
  paintReservations();
}
function reservationRow(r){
  const x=state.admin.componentes.find(z=>z.id===r.componente_id);
  const group=reservationGroup(r),tag={pendente:"Pendente",ativas:r.status==="aprovada"?"Aprovada":"Retirado",atrasadas:"Atrasada",concluidas:r.status==="devolvida"?"Devolvido":"Encerrada"}[group];
  const cls=group==="pendente"?"pending":group==="ativas"?(r.status==="retirada"?"picked":"approved"):group==="atrasadas"?"late":"";
  const actions=r.status==="pendente"?'<button class="primary-button" type="button" data-res-do="aprovar" data-id="'+r.id+'">'+iconSvg("check",14)+' Aprovar e entregar</button><button type="button" class="danger-button" data-res-do="recusar" data-id="'+r.id+'">Recusar</button>':
    r.status==="aprovada"?'<button type="button" class="outline-button" data-res-do="retirar" data-id="'+r.id+'">Regularizar aprovação antiga</button><button type="button" class="outline-button" data-res-do="recusar" data-id="'+r.id+'">Cancelar</button>':
    r.status==="retirada"?'<button type="button" class="primary-button" data-res-do="devolver" data-id="'+r.id+'">Registrar devolução</button>':"";
  const mailAction=r.status==="retirada"&&(r.email_conta||r.email)?'<button type="button" class="outline-button" data-res-do="cobrar" data-id="'+r.id+'">✉ Cobrar por e-mail</button>':"";
  return '<div class="reservation-row">'+(x?thumb(x,"reservation-thumb"):'<div class="reservation-thumb"></div>')+
    '<div><h3>#'+r.id+' · '+esc(r.componente_nome||x?.nome||"Material")+'</h3><small>'+esc(r.nome_solicitante)+' · '+r.quantidade+' un.'+(r.tipo==="retirada_direta"?" · PETiano":"")+'</small>'+
    (r.contato?'<small style="display:block">'+esc(r.contato)+'</small>':"")+
    (r.observacao?'<small style="display:block" title="'+attr(r.observacao)+'">'+esc(r.observacao.slice(0,120))+'</small>':"")+'</div>'+
    '<div class="reservation-date"><small>Retirada</small><strong>'+esc(formatDay(r.data_inicio))+'</strong></div>'+
    '<div class="reservation-date"><small>Devolução</small><strong>'+(r.sem_prazo?'Sem prazo':esc(formatDay(r.data_devolucao)))+'</strong></div>'+
    '<span class="tag '+cls+'">'+tag+'</span><div class="reservation-actions">'+actions+mailAction+'</div></div>';
}
function paintReservations(){
  const list=$("#admin-res-list");if(!list)return;
  const q=$("#admin-res-search")?.value?.toLowerCase().trim()||"";
  const found=state.admin.reservas.filter(r=>
    (UI.reservationFilter==="todas"||reservationGroup(r)===UI.reservationFilter)&&
    (!q||[r.componente_nome,r.nome_solicitante,r.contato,String(r.id)].some(v=>String(v||"").toLowerCase().includes(q))));
  const p=paginate(found,UI.reservationPage);
  UI.reservationPage=p.page;
  list.innerHTML=p.total?p.items.map(reservationRow).join(""):'<div class="empty-state">Nenhuma reserva neste filtro.</div>';
  $("#admin-res-pages").innerHTML=pageButtons(p,"reservas");
  $$("[data-res-do]",list).forEach(b=>b.onclick=()=>adminReservationAction(Number(b.dataset.id),b.dataset.resDo));
}
function confirmReservationRefusal(reservation){
  return new Promise(resolve=>{
    const userName=state.identity?.nome||"";
    const body='<form class="modal-main" id="admin-refusal-form">'+
      '<p class="notice">A pessoa receberá uma notificação informando a recusa e quem tomou a decisão, se a solicitação estiver vinculada à conta dela.</p>'+
      '<div class="field"><label for="admin-refusal-actor">Nome de quem recusou *</label><input id="admin-refusal-actor" required maxlength="80" autocomplete="name" placeholder="Nome do(a) responsável" value="'+attr(userName)+'"></div>'+
      '<div class="field"><label for="admin-refusal-reason">Motivo da recusa (opcional)</label><textarea id="admin-refusal-reason" maxlength="500" rows="3" placeholder="Ex.: material indisponível para o período"></textarea></div>'+
      '<div class="modal-footer" style="border:0;padding:14px 0 0;display:flex;gap:8px;flex-wrap:wrap">'+
      '<button type="button" class="outline-button" id="admin-refusal-cancel">Cancelar</button>'+
      '<button type="submit" class="danger-button" id="admin-refusal-confirm">Confirmar recusa</button></div></form>';
    openModal("Recusar solicitação #"+reservation.id,"Material: "+(reservation.componente_nome||"Material"),body);
    const finish=value=>{closeModal();resolve(value);};
    $("#admin-refusal-cancel").onclick=()=>finish(null);
    const x=$("#modal-root [data-close]");if(x)x.onclick=()=>finish(null);
    $("#admin-refusal-form").onsubmit=e=>{
      e.preventDefault();
      const actor=$("#admin-refusal-actor").value.trim();
      if(actor.length<2){$("#admin-refusal-actor").setCustomValidity("Informe o nome de quem tomou a decisão.");$("#admin-refusal-actor").reportValidity();return;}
      finish({responsavel:actor,observacao:$("#admin-refusal-reason").value.trim()});
    };
    $("#admin-refusal-actor").oninput=e=>e.target.setCustomValidity("");
  });
}
async function adminReservationAction(id,action){
  const r=state.admin.reservas.find(x=>x.id===id);if(!r)return;
  if(action==="devolver")return returnModal(r);
  if(action==="cobrar"){
    try{
      const draft=await api("/api/admin/mail/preview?id="+id);
      openModal("Cobrança por e-mail #"+id,"Confira o destinatário e edite a mensagem antes de enviá-la.",
        '<form id="admin-manual-mail-form" class="modal-main">'+
        '<p class="notice"><strong>Para:</strong> '+esc(draft.destinatario)+'</p>'+
        '<div class="field"><label for="admin-mail-subject">Assunto</label><input id="admin-mail-subject" required maxlength="180" value="'+attr(draft.assunto)+'"></div>'+
        '<div class="field"><label for="admin-mail-body">Mensagem</label><textarea id="admin-mail-body" required rows="11" maxlength="5000">'+esc(draft.mensagem)+'</textarea></div>'+
        '<p class="hint">O envio respeita a tag e o prazo. Você pode alterar o texto desta cobrança sem mudar o modelo padrão.</p>'+
        '<div class="modal-footer"><button type="button" class="secondary-button" id="admin-mail-cancel">Cancelar</button>'+
        '<button type="submit" class="primary-button" id="admin-mail-send">Colocar na fila de envio</button></div></form>');
      $("#admin-mail-cancel").onclick=closeModal;
      $("#admin-manual-mail-form").onsubmit=async e=>{
        e.preventDefault();
        const send=$("#admin-mail-send");send.disabled=true;send.textContent="Registrando…";
        try{
          const result=await api("/api/admin/mail/queue","POST",{id,assunto:$("#admin-mail-subject").value,mensagem:$("#admin-mail-body").value});
          closeModal();toast(result.mensagem||"Cobrança colocada na fila do Gmail.");
        }catch(error){toast(error.message,true);send.disabled=false;send.textContent="Colocar na fila de envio";}
      };
    }catch(e){toast(e.message,true);}
    return;
  }
  let decision=null;
  if(action==="recusar"){
    decision=await confirmReservationRefusal(r);
    if(!decision)return;
  }else{
    const descriptions={aprovar:"Aprovar e confirmar que "+r.nome_solicitante+" recebeu o material? A retirada será registrada automaticamente, e a pessoa poderá registrar a devolução pela própria conta.",retirar:"Regularizar uma aprovação antiga e registrar a retirada?"};
    if(!await niceModalConfirm("Confirmar ação",descriptions[action]||"Confirma a operação?","Confirmar"))return;
  }
  try{
    const response=await api("/api/admin/reservation","POST",{id,acao:action,responsavel:decision?.responsavel||"Administração",...(decision?{observacao:decision.observacao}:{})});
    await adminReload();adminBuild();
    if(action==="recusar"&&response.notificacao_registrada===false){
      toast("Reserva recusada, mas esta solicitação não está vinculada a uma conta: notificação não enviada.",true);
    }else{
      toast(action==="recusar"?"Recusa registrada e notificação salva.":action==="aprovar"?"Reserva aprovada e retirada registrada!":"Reserva atualizada.");
    }
  }catch(e){toast(e.message,true);}
}
/* Usuários: tag, redefinição de senha e exclusão segura. */
let adminUserFilter="todos";
let adminUserQuery="";
async function adminUsers(root){
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Usuários</h2></div></div>'+
    '<div class="admin-tools"><div class="search-box">'+iconSvg("search")+'<input type="search" id="admin-users-search" placeholder="Buscar nome, login, e-mail ou ID..." value="'+attr(adminUserQuery)+'"></div>'+
    '<select id="admin-users-filter" aria-label="Filtro de usuários" class="admin-filter"><option value="todos">Todos</option><option value="petiano">PETianos</option><option value="visitante">Visitantes</option></select></div>'+
    '<div id="admin-users-list" class="user-list">Carregando…</div><nav id="admin-users-pages" class="page-controls"></nav></section>';
  $("#admin-users-filter").value=adminUserFilter;
  $("#admin-users-filter").onchange=e=>{adminUserFilter=e.target.value;UI.usersPage=1;paintUsers();};
  $("#admin-users-search").oninput=e=>{adminUserQuery=e.target.value;UI.usersPage=1;paintUsers();};
  $("#admin-users-pages").onclick=e=>{const b=e.target.closest("[data-page]");if(!b)return;UI.usersPage=Number(b.dataset.page);paintUsers();};
  try{
    const res=await api("/api/admin/users");
    if(!document.contains(root)||UI.adminTab!=="usuarios")return;
    UI.users=res.usuarios||[];paintUsers();
  }catch(e){if(document.contains(root))$("#admin-users-list").innerHTML='<div class="empty-state">'+esc(e.message)+'</div>';}
}
function userRow(x){
  const member=x.tag==="petiano";
  return '<div class="user-row"><span class="user-icon">'+esc((x.nome||"P")[0].toUpperCase())+'</span>'+
    '<div><strong>'+esc(x.nome)+'</strong><small>'+esc(x.login||"Sem login")+' · '+esc(x.id)+(x.email?' · '+esc(x.email):' · E-mail pendente')+'</small></div>'+
    '<span class="tag '+(member?"picked":"")+'">'+(member?"PETiano":"Visitante")+'</span>'+
    '<div class="user-actions"><button class="outline-button small-button" type="button" data-user-role="'+attr(x.id)+'" title="Alterar tag">'+iconSvg("tag",15)+' Tag</button>'+
    '<button class="outline-button small-button" type="button" data-user-mail="'+attr(x.id)+'" title="Autorizar ou desativar avisos desta pessoa">'+(Number(x.notificar_email)===0?"🔕 Avisos desligados":"✉ Avisos permitidos")+'</button>'+
    '<button class="outline-button small-button" type="button" data-user-password="'+attr(x.id)+'" title="Redefinir senha">'+iconSvg("key",15)+' Senha</button>'+
    '<button class="danger-button small-button" type="button" data-user-delete="'+attr(x.id)+'" title="Excluir usuário">'+iconSvg("trash",15)+' Excluir</button></div></div>';
}
function paintUsers(){
  const list=$("#admin-users-list");if(!list)return;
  const users=UI.users||[];
  const query=adminUserQuery.toLowerCase().trim();
  const found=users.filter(x=>(adminUserFilter==="todos"||x.tag===adminUserFilter)&&(!query||[x.nome,x.login,x.email,x.id].some(v=>String(v||"").toLowerCase().includes(query))));
  const p=paginate(found,UI.usersPage||1);UI.usersPage=p.page;
  list.innerHTML=found.length?p.items.map(userRow).join(""):'<div class="empty-state">Nenhum usuário encontrado.</div>';
  $("#admin-users-pages").innerHTML=pageButtons(p,"users");
  $$("[data-user-role]",list).forEach(b=>b.onclick=()=>adminToggleTag(b.dataset.userRole));
  $$("[data-user-mail]",list).forEach(b=>b.onclick=async()=>{
    const u=users.find(x=>x.id===b.dataset.userMail);if(!u)return;
    const enabled=Number(u.notificar_email)===0;
    if(!await niceModalConfirm("Avisos deste usuário?",u.nome+": "+(enabled?"permitir":"desativar")+" notificações por e-mail. A configuração geral da tag também será respeitada.","Confirmar"))return;
    try{await api("/api/admin/users","POST",{id:u.id,tag:u.tag,ativo:Number(u.ativo)===1,notificar_email:enabled});await adminUsers($("#admin-content"));toast("Preferência individual atualizada.");}
    catch(e){toast(e.message,true);}
  });
  $$("[data-user-password]",list).forEach(b=>b.onclick=()=>{
    const u=users.find(x=>x.id===b.dataset.userPassword);if(u)adminResetPasswordModal(u);
  });
  $$("[data-user-delete]",list).forEach(b=>b.onclick=()=>{
    const u=users.find(x=>x.id===b.dataset.userDelete);if(u)adminDeleteUserModal(u);
  });
}
async function adminToggleTag(id){
  const user=(UI.users||[]).find(u=>u.id===id);if(!user)return;
  const next=user.tag==="petiano"?"visitante":"petiano";
  if(!await niceModalConfirm("Alterar tag de usuário?",user.nome+" passará a ser "+(next==="petiano"?"PETiano":"Visitante")+".","Confirmar"))return;
  try{await api("/api/admin/users","POST",{id,tag:next});await adminUsers($("#admin-content"));toast("Tag atualizada.");}
  catch(e){toast(e.message,true);}
}
/* Categorias: arraste no desktop, use setas no celular. */
function adminCategories(root){
  const cats=(state.admin.categorias||[]).filter(x=>!x.arquivada);
  const itemCounts=cat=>{
    if(cat.nome==="Filamentos")return (state.admin.filamentos||[]).length+" cores cadastradas";
    const items=state.admin.componentes.filter(x=>x.categoria_id===cat.id);
    const active=items.filter(x=>!isArchived(x)).length;
    return active+' ativos'+(items.length-active?' · '+(items.length-active)+' arquivados':'');
  };
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Categorias</h2><p>Organize e defina quem pode acessar cada categoria.</p></div>'+
    '<div class="buttons"><button class="outline-button" type="button" id="v2-category-backup" title="Localizar a importação de backup JSON">Restaurar backup JSON</button><button class="primary-button" id="v2-new-category" type="button">'+iconSvg("plus",16)+' Nova categoria</button></div></div>'+
    '<div class="category-list" id="v2-category-list">'+cats.map((cat,i)=>
    '<div class="category-row" data-category-id="'+cat.id+'" draggable="true"><span class="drag-handle">'+iconSvg("grip")+'</span>'+
    '<strong>'+esc(cat.nome)+'</strong><small>'+itemCounts(cat)+'</small>'+
    '<small class="tag '+(Number(cat.visivel_visitante)===0?'pending':'')+'">'+(Number(cat.visivel_visitante)===0?'Só PETianes':'Todos')+'</small>'+
    '<div class="role-loan-controls category-role-controls">'+
      roleLoanToggle("cat",cat.id,"petianos",Number(cat.permitir_petianos)===1)+
      roleLoanToggle("cat",cat.id,"visitantes",Number(cat.permitir_visitantes)===1)+
    '</div>'+
    '<div class="actions"><button type="button" class="square-action" data-cat-up="'+cat.id+'" '+(i===0?"disabled":"")+' aria-label="Subir">'+iconSvg("up")+'</button>'+
    '<button type="button" class="square-action" data-cat-down="'+cat.id+'" '+(i===cats.length-1?"disabled":"")+' aria-label="Descer">'+iconSvg("down")+'</button>'+
    '<button type="button" class="square-action" data-cat-edit="'+cat.id+'" aria-label="Editar">'+iconSvg("edit")+'</button>'+
    '<button type="button" class="square-action danger" data-cat-delete="'+cat.id+'" aria-label="Excluir categoria e seus materiais">'+iconSvg("trash")+'</button></div></div>').join("")+'</div>'+
    '</section>';
  $("#v2-new-category").onclick=()=>editCategory();
  $("#v2-category-backup").onclick=()=>{
    selectAdminTab("configuracoes");
    const button=$("#v2-backup-import");if(button){button.scrollIntoView({behavior:"smooth",block:"center"});button.focus();}
  };
  $$("[data-cat-role]",root).forEach(b=>b.onclick=async()=>{
    const cat=(state.admin.categorias||[]).find(c=>Number(c.id)===Number(b.dataset.catLoanId));
    if(!cat)return;
    const profile=b.dataset.catRole,pet=profile==="petianos",label=pet?"PETianes":"visitantes";
    const enabled=Number(cat[pet?"permitir_petianos":"permitir_visitantes"])!==1;
    if(!await niceModalConfirm((enabled?"Liberar":"Bloquear")+" retirada para "+label+"?",(enabled?"Liberar":"Bloquear")+" as retiradas para "+label+" em todos os materiais de "+cat.nome+"? A permissão do outro perfil continuará igual. As solicitações em andamento serão preservadas.",enabled?"Liberar todos":"Bloquear todos",!enabled))return;
    try{
      await api("/api/admin/category","POST",{acao:"emprestimos",id:cat.id,perfil:profile,permitir:enabled});
      await adminReload();adminBuild();
      toast("Retirada para "+label+" "+(enabled?"liberada":"bloqueada")+" em toda a categoria.");
    }catch(error){toast(error.message,true);}
  });
  $$("[data-cat-up]",root).forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.catUp),-1));
  $$("[data-cat-down]",root).forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.catDown),1));
  $$("[data-cat-edit]",root).forEach(b=>b.onclick=()=>editCategory(Number(b.dataset.catEdit)));
  $$("[data-cat-delete]",root).forEach(b=>b.onclick=()=>adminDeleteCategory(Number(b.dataset.catDelete)));
  let dragged=null;
  $$("[data-category-id]",root).forEach(el=>{
    el.ondragstart=e=>{dragged=Number(el.dataset.categoryId);el.classList.add("dragging");e.dataTransfer.effectAllowed="move";};
    el.ondragend=()=>{el.classList.remove("dragging");dragged=null;};
    el.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect="move";};
    el.ondrop=async e=>{
      e.preventDefault();const target=Number(el.dataset.categoryId);if(!dragged||target===dragged)return;
      const ids=cats.map(cat=>cat.id),a=ids.indexOf(dragged),b=ids.indexOf(target);
      if(a<0||b<0)return;ids.splice(b,0,...ids.splice(a,1));
      await commitCategoryOrder(ids);
    };
  });
}
async function commitCategoryOrder(ids){
  try{await api("/api/admin/category","POST",{acao:"ordenar",ordem:ids});await adminReload();adminBuild();toast("Ordem salva.");}
  catch(error){toast(error.message,true);}
}
function adminDeleteCategory(id){
  const cat=state.admin.categorias.find(x=>x.id===id);if(!cat)return;
  const linked=state.admin.componentes.filter(x=>x.categoria_id===id);
  const active=linked.filter(x=>!isArchived(x)).length;
  openModal("Excluir categoria e materiais","Confirmação de segurança",
    '<form id="delete-category-confirm" class="modal-main">'+
    '<p>Esta ação retirará <strong>'+esc(cat.nome)+'</strong> e '+linked.length+' material(is) do inventário, inclusive arquivados. Empréstimos já concluídos vinculados também serão excluídos.</p>'+
    '<p class="notice warning">Exclusão definitiva. Um backup será baixado antes. Reservas ou retiradas em aberto impedem esta operação.</p>'+
    '<label for="cat-delete-name">Digite exatamente <strong>'+esc(cat.nome)+'</strong> para confirmar:</label>'+
    '<input id="cat-delete-name" required autocomplete="off" placeholder="'+attr(cat.nome)+'">'+
    '<div class="confirm-actions"><button class="secondary-button" type="button" id="cat-delete-cancel">Cancelar</button>'+
    '<button class="danger-button" type="submit" id="cat-delete-submit">Excluir categoria e materiais</button></div></form>');
  $("#cat-delete-cancel").onclick=closeModal;
  $("#delete-category-confirm").onsubmit=async e=>{
    e.preventDefault();const name=$("#cat-delete-name").value;
    if(name!==cat.nome){toast("O nome não corresponde à categoria.",true);return;}
    const button=$("#cat-delete-submit");button.disabled=true;
    try{
      const backup=await api("/api/admin/backup");
       saveDownload("backup-antes-de-excluir-"+localDate()+".json",JSON.stringify(backup,null,2));
       await api("/api/admin/category","POST",{acao:"excluir",id,confirmacao:name});
      await adminReload();closeModal();adminBuild();toast("Categoria e materiais excluídos. Backup gerado.");
    }catch(error){toast(error.message,true);button.disabled=false;}
  };
}
/* Filamentos: cores e estoque próprios, com reservas via componente vinculado. */
const FILAMENT_PALETTE=[
  ["Preto","#24272C"],["Branco","#F4F5F1"],["Vermelho","#D83741"],
  ["Azul","#2A69D6"],["Verde","#2EAC6C"],["Amarelo","#F5D442"],
  ["Laranja","#F28C28"],["Rosa","#F18BC0"],["Roxo","#854CBF"],
  ["Cinza","#959CA6"],["Marrom","#895F47"],["Dourado","#CDA84B"]
];
function adminFilaments(root){
  const list=state.admin.filamentos||[];
  const category=(state.admin.categorias||[]).find(x=>x.nome==="Filamentos");
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Filamentos</h2><p>Organize cores, quantidades e autorizações. A liberação da categoria inteira fica na aba Categorias.</p></div>'+
    '<div class="buttons"><button class="primary-button" id="filament-add" type="button">'+iconSvg("plus",16)+' Adicionar cor</button></div></div>'+
    '<div class="filament-admin-grid">'+(list.length?list.map(x=>
    '<div class="filament-admin-card">'+
      '<span class="filament-color-dot" style="background:'+attr(x.hexadecimal)+'" aria-hidden="true"></span>'+
      '<div class="filament-admin-label"><strong>'+esc(x.cor)+'</strong><small>Estoque: <b>'+Number(x.quantidade)+'</b> · Em uso: '+Number(x.em_uso||0)+' · Disponíveis: '+Math.max(0,Number(x.quantidade)-Number(x.em_uso||0)-Number(x.com_defeito||0))+'</small><small>'+(Number(x.visivel_visitante)===0?'Só PETianes':'Todos')+'</small>'+
      '<div class="role-loan-controls">'+roleLoanToggle("filament",x.id,"petianos",Number(x.permitir_petianos)===1,Number(category?.permitir_petianos)===1)+roleLoanToggle("filament",x.id,"visitantes",Number(x.permitir_visitantes)===1,Number(category?.permitir_visitantes)===1)+'</div></div>'+
      '<div class="filament-admin-buttons"><button type="button" class="square-action" aria-label="Editar '+attr(x.cor)+'" title="Editar" data-filament-edit="'+x.id+'">'+iconSvg("edit")+'</button>'+
      '<button type="button" class="square-action danger" aria-label="Excluir '+attr(x.cor)+'" title="Excluir" data-filament-delete="'+x.id+'">'+iconSvg("trash")+'</button></div></div>').join(""):
      '<div class="empty-state">Nenhuma cor cadastrada. Adicione a primeira cor de filamento.</div>')+'</div></section>';
  $("#filament-add").onclick=()=>filamentEditor();
  $$("[data-filament-role]",root).forEach(b=>b.onclick=async()=>{
    const x=list.find(x=>x.id===Number(b.dataset.filamentLoanId));if(!x)return;
    const profile=b.dataset.filamentRole,label=profile==="petianos"?"PETianes":"visitantes";
    const enabled=Number(x[profile==="petianos"?"permitir_petianos":"permitir_visitantes"])!==1;
    try{
      await api("/api/admin/filaments","POST",{acao:"emprestimos",id:x.id,perfil:profile,permitir:enabled});
      await adminReload();adminBuild();
      toast("Retirada para "+label+" "+(enabled?"liberada":"bloqueada")+" nesta cor. Verifique também a permissão da categoria Filamentos.");
    }catch(error){toast(error.message,true);}
  });
  $$("[data-filament-edit]",root).forEach(b=>b.onclick=()=>filamentEditor(Number(b.dataset.filamentEdit)));
  $$("[data-filament-delete]",root).forEach(b=>b.onclick=()=>deleteFilament(Number(b.dataset.filamentDelete)));
}
function filamentEditor(id){
  const color=(state.admin.filamentos||[]).find(x=>x.id===id);
  const selected=color?.hexadecimal||"#2A69D6";
  openModal(color?"Editar filamento":"Adicionar cor de filamento","Cor, estoque e permissões por perfil.",
    '<form id="filament-form" class="modal-main">'+
    '<div class="filament-palette">'+FILAMENT_PALETTE.map(([name,hex])=>
      '<button type="button" class="filament-preset" style="--sample:'+hex+'" data-filament-choice="'+attr(name)+'" data-hex="'+hex+'" aria-label="Escolher '+attr(name)+'" title="'+attr(name)+'"><span></span></button>').join("")+'</div>'+
    '<div class="field-grid"><div class="field"><label for="filament-name">Cor</label><input id="filament-name" maxlength="55" required value="'+attr(color?.cor||"")+'" placeholder="Ex.: Azul royal"></div>'+
    '<div class="field"><label for="filament-hex">Escolher tonalidade</label><input type="color" id="filament-hex" value="'+selected+'"></div></div>'+
    '<div class="field"><label for="filament-quantity">Quantidade de rolos</label><div class="stepper"><button type="button" class="step" data-target="filament-quantity" data-delta="-1">−</button><input type="number" id="filament-quantity" value="'+Number(color?.quantidade||0)+'" min="0" max="1000000" required><button type="button" class="step" data-target="filament-quantity" data-delta="1">+</button></div></div>'+switchInput("filament-loans-pet","Retirada para PETianes",color?Number(color.permitir_petianos)===1:false,"PETianes podem registrar retirada diretamente, se a categoria permitir.")+switchInput("filament-loans-visitor","Retirada para visitantes",color?Number(color.permitir_visitantes)===1:false,"Visitantes solicitam retirada para aprovação, se a categoria permitir.")+switchInput("filament-public","Exibir para todos",color?Number(color.visivel_visitante)!==0:true,"Desmarcado: esta cor ficará visível apenas aos PETianes.")+
    '<div class="modal-footer" style="border:0;padding:16px 0 0"><button class="secondary-button" id="filament-cancel" type="button">Cancelar</button><button class="primary-button" type="submit" id="filament-save">Salvar</button></div></form>');
  $$("[data-filament-choice]").forEach(b=>b.onclick=()=>{
    $("#filament-name").value=b.dataset.filamentChoice;$("#filament-hex").value=b.dataset.hex;
  });
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta)));
  $("#filament-cancel").onclick=()=>{closeModal();adminBuild();};
  $("#filament-form").onsubmit=async e=>{
    e.preventDefault();
    const btn=$("#filament-save");btn.disabled=true;btn.textContent="Salvando…";
    try{
      await api("/api/admin/filaments","POST",{acao:color?"editar":"criar",id:color?.id,cor:$("#filament-name").value,hexadecimal:$("#filament-hex").value,quantidade:Number($("#filament-quantity").value),visivel_visitante:$("#filament-public").checked,permitir_petianos:$("#filament-loans-pet").checked,permitir_visitantes:$("#filament-loans-visitor").checked});
      await adminReload();closeModal();adminBuild();toast("Filamento salvo.");
    }catch(e){toast(e.message,true);btn.disabled=false;btn.textContent="Salvar";}
  };
}
async function deleteFilament(id){
  const x=(state.admin.filamentos||[]).find(x=>x.id===id);if(!x)return;
  if(!await niceModalConfirm("Excluir esta cor?","Excluir "+x.cor+" do inventário de filamentos?","Excluir",true))return;
  try{await api("/api/admin/filaments","POST",{acao:"excluir",id});await adminReload();adminBuild();toast("Cor excluída.");}
  catch(e){toast(e.message,true);}
}


/* Editor de materiais e configurações do painel renovado. */
/* Busca inteligente por tipo: sugere, mas nunca aplica mudanças sem confirmação. */
function materialFamilyHint(name){
  const n=String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  if(/^alcalina\b/.test(n))return "Alcalina";
  if(/^recarreg/.test(n))return "Recarregáveis";
  if(/^bateria\b/.test(n))return "Baterias";
  if(/^resistor\b/.test(n))return "Resistores";
  if(/^capacit/.test(n))return "Capacitores";
  if(/^led\b/.test(n))return "LEDs";
  if(/^interruptor\b/.test(n))return "Interruptores";
  if(/^placas? protoboard/.test(n))return "Protoboards";
  if(/^kit jumper/.test(n))return "Kit jumper";
  if(/^suporte para bateria|^suporte para 6 pilhas/.test(n))return "Suportes para baterias";
  if(/motor/.test(n))return "Motores";
  if(/^roda\b/.test(n))return "Rodas";
  if(/^sensor\b|^modulo sensor/.test(n))return "Sensores";
  if(/^fonte\b/.test(n))return "Fontes";
  if(/^carregador/.test(n))return "Carregadores";
  if(/^joysti/.test(n))return "Joysticks";
  if(/^modulo de alimenta/.test(n))return "Módulos de alimentação";
  if(/^arduino\b/.test(n))return "Arduino";
  if(/^esp\s*32\b|^esp32\b/.test(n))return "ESP32";
  if(/^ponte h\b/.test(n))return "Pontes H";
  if(/^toalha\b/.test(n))return "Toalhas";
  if(/^cola\b/.test(n))return "Colas";
  // Dispositivos com patrimônio individual não são agrupados automaticamente.
  if(/^tablet\b/.test(n))return "Tablets";
  if(/^notebook\b/.test(n))return "Notebooks";
  const first=n.match(/^[a-z]{4,}/)?.[0]||"";
  return first?first[0].toUpperCase()+first.slice(1):"Outros";
}
function bulkVisibilityState(item){
  const category=state.admin?.categorias?.find(c=>String(c.id)===String(item.categoria_id));
  const categoryRestricted=Boolean(category&&Number(category.visivel_visitante)===0);
  const itemRestricted=Number(item.visivel_visitante)===0;
  return {categoryRestricted,itemRestricted,restricted:categoryRestricted||itemRestricted};
}
function materialPickerRows(items,selected,term="",withPhotos=false,showVisibility=false){
  const search=term.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const available=items.filter(x=>!search||[x.nome,x.grupo_variacoes,x.identificacao].some(s=>
    String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(search)));
  return {visible:available,html:available.slice(0,160).map(x=>{
    const status=showVisibility?bulkVisibilityState(x):null;
    const label=status?(status.categoryRestricted?
      '<span class="bulk-visibility-badge restricted category-locked">🔒 Só PETianes · categoria restrita</span>':
      status.itemRestricted?
      '<span class="bulk-visibility-badge restricted">✓ Só PETianes</span>':
      '<span class="bulk-visibility-badge public">🌐 Visível para todos</span>'):"";
    const info='<span class="bulk-row-details"><strong>'+esc(x.nome)+'</strong><small>'+esc(nameCategory(x.categoria_id))+
      (x.grupo_variacoes?' · '+esc(x.grupo_variacoes):"")+
      (!showVisibility&&Number(x.visivel_visitante)===0?' · Só PETianes':'')+'</small>'+label+'</span>';
    if(!withPhotos)return '<label class="admin-bulk-row '+(showVisibility?'bulk-visibility-row ':'')+(selected.has(x.id)?'is-selected':'')+'">'+
      '<input type="checkbox" aria-label="Selecionar '+attr(x.nome)+' para alterar" data-bulk-id="'+x.id+'" '+(selected.has(x.id)?'checked':'')+'>'+info+'</label>';
    const hasCustomPhoto=/^data:image\//i.test(String(x.imagem||""));
    return '<div class="admin-bulk-row variant-photo-row">'+
      '<label class="variant-photo-select"><input type="checkbox" data-bulk-id="'+x.id+'" '+(selected.has(x.id)?'checked':'')+'>'+
      '<img class="variant-photo-thumb" src="'+attr(itemImage(x))+'" alt="Imagem de '+attr(x.nome)+'">'+info+'</label>'+
      '<button type="button" class="variant-photo-upload" data-variant-photo="'+x.id+'" aria-label="Enviar foto para '+attr(x.nome)+'">'+
      (hasCustomPhoto?'Trocar foto':'Enviar foto')+'</button>'+
      '<input type="file" accept="image/png,image/jpeg,image/webp" data-variant-file="'+x.id+'" hidden>'+
      '</div>';
  }).join("")||'<div class="empty-state">Nenhum material encontrado.</div>'};
}
function adminMaterialPickerConfig(mode,currentId){
  const all=state.admin.componentes.filter(x=>!isArchived(x) && !(state.admin.categorias.find(cat=>cat.id===x.categoria_id)?.arquivada));
  const selected=new Set(),current=all.find(x=>x.id===currentId);
  if(current)selected.add(current.id);
  const similar=current?all.filter(x=>x.id!==current.id&&materialFamilyHint(x.nome)===materialFamilyHint(current.nome)):[];
  const group=current?.grupo_variacoes||materialFamilyHint(current?.nome||"");
  return {all,selected,current,similar,group,mode};
}
function openBulkVisibility(currentId){
  const model=adminMaterialPickerConfig("visibility",currentId);
  const initial=model.current?.nome.split(/\s+/)[0]||"";
  const categories=state.admin.categorias.filter(c=>!c.arquivada &&
    model.all.some(x=>String(x.categoria_id)===String(c.id)))
    .sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  const options=categories.map(c=>{
    const count=model.all.filter(x=>String(x.categoria_id)===String(c.id)).length;
    return '<option value="'+attr(c.id)+'">'+esc(c.nome)+' ('+count+')</option>';
  }).join("");
  openModal("Visibilidade dos materiais","Confira a visibilidade já salva e selecione apenas os itens que deseja alterar.",
    '<div class="modal-main">'+
    '<div class="field"><label for="bulk-search">Buscar materiais</label><input id="bulk-search" placeholder="Ex.: Resistor, Arduino..." value="'+attr(initial)+'"></div>'+
    '<div class="bulk-category-picker"><div class="field"><label for="bulk-category">Categoria</label>'+
    '<select id="bulk-category"><option value="all">Todas as categorias</option>'+options+'</select></div>'+
    '<button class="outline-button small-button" type="button" id="bulk-select-category" disabled>Selecionar categoria</button></div>'+
    '<div id="bulk-category-status" class="bulk-category-status" role="status"></div>'+
    '<div class="admin-bulk-actions">'+
    '<button class="outline-button small-button" id="bulk-similar" type="button" hidden title="Seleciona outros materiais da mesma família dos itens marcados.">Selecionar semelhantes</button>'+
    '<button class="outline-button small-button" type="button" id="bulk-select-all">Selecionar resultados</button>'+
    '<button class="outline-button small-button" type="button" id="bulk-clear">Desmarcar todos</button></div>'+
    '<div class="admin-bulk-list" id="bulk-list"></div>'+
    '<div class="bulk-selection-footer"><p class="hint" id="bulk-selected-count" role="status" aria-live="polite"></p>'+
    '<small id="bulk-selection-state"></small></div>'+
    '<p id="bulk-category-warning" class="bulk-category-warning" hidden></p>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0;display:flex;gap:8px;flex-wrap:wrap">'+
    '<button class="outline-button" id="bulk-show-all" type="button">Exibir para todos</button>'+
    '<button class="primary-button" id="bulk-only-members" type="button">Só PETianes</button></div></div>',{size:"wide bulk-visibility-modal"});
  let visible=[];
  const chosen=()=>model.all.filter(x=>model.selected.has(x.id));
  const similarItems=()=>{
    const marked=chosen();
    if(!marked.length)return [];
    const groups=new Set(marked.map(x=>String(x.categoria_id)+"|"+materialFamilyHint(x.nome)));
    return model.all.filter(x=>!model.selected.has(x.id)&&
      groups.has(String(x.categoria_id)+"|"+materialFamilyHint(x.nome)));
  };
  const countSelected=()=>{
    const selectedItems=chosen();
    const restricted=selectedItems.filter(x=>bulkVisibilityState(x).restricted).length;
    $("#bulk-selected-count").textContent=model.selected.size+
      (model.selected.size===1?" material selecionado.":" materiais selecionados.");
    $("#bulk-selection-state").textContent=selectedItems.length?
      restricted+" já visíveis só para PETianes · "+(selectedItems.length-restricted)+" visíveis para todos.":
      "✓ no quadrado = selecionar para alterar; a etiqueta mostra a visibilidade já salva.";
    const locked=selectedItems.filter(x=>bulkVisibilityState(x).categoryRestricted);
    const warning=$("#bulk-category-warning");
    warning.hidden=!locked.length;
    warning.textContent=locked.length?
      "⚠️ "+locked.length+" material(is) pertence(m) a categoria(s) restrita(s). Para exibi-los a visitantes, libere também a categoria na aba Categorias.":"";
    const suggestions=similarItems(),similar=$("#bulk-similar");
    similar.hidden=!suggestions.length;
    similar.textContent="Selecionar semelhantes ("+suggestions.length+")";
    $("#bulk-show-all").disabled=!selectedItems.length;
    $("#bulk-only-members").disabled=!selectedItems.length;
  };
  const draw=()=>{
    const category=$("#bulk-category").value;
    const byCategory=model.all.filter(x=>category==="all"||String(x.categoria_id)===category);
    const restricted=byCategory.filter(x=>bulkVisibilityState(x).restricted).length;
    const categoryRecord=categories.find(c=>String(c.id)===category);
    const categoryLocked=Boolean(categoryRecord&&Number(categoryRecord.visivel_visitante)===0);
    const categoryLabel=categoryRecord?categoryRecord.nome:"Todos os materiais";
    const summary=$("#bulk-category-status");
    summary.innerHTML='<strong>'+(categoryLocked?'🔒 ':'')+esc(categoryLabel)+': '+restricted+'/'+byCategory.length+' só PETianes</strong>'+
      '<small>'+((byCategory.length-restricted)===0?'Todos os itens já estão restritos.':(byCategory.length-restricted)+' visíveis para todos.')+
      (categoryLocked?' A categoria inteira está restrita.':'')+'</small>';
    summary.classList.toggle("fully-restricted",byCategory.length>0&&restricted===byCategory.length);
    const result=materialPickerRows(byCategory,model.selected,$("#bulk-search").value,false,true);
    visible=result.visible;
    $("#bulk-list").innerHTML=result.html;
    $$("[data-bulk-id]",$("#bulk-list")).forEach(b=>b.onchange=()=>{
      const id=Number(b.dataset.bulkId);
      if(b.checked)model.selected.add(id);
      else model.selected.delete(id);
      b.closest(".bulk-visibility-row")?.classList.toggle("is-selected",b.checked);
      countSelected();
    });
    countSelected();
  };
  $("#bulk-search").oninput=draw;
  $("#bulk-category").onchange=()=>{
    $("#bulk-select-category").disabled=$("#bulk-category").value==="all";
    draw();
  };
  $("#bulk-select-category").onclick=()=>{
    const category=$("#bulk-category").value;
    if(category==="all")return;
    for(const x of model.all)if(String(x.categoria_id)===category)model.selected.add(x.id);
    draw();
  };
  $("#bulk-similar").onclick=()=>{for(const x of similarItems())model.selected.add(x.id);draw();};
  $("#bulk-select-all").onclick=()=>{for(const x of visible)model.selected.add(x.id);draw();};
  $("#bulk-clear").onclick=()=>{model.selected.clear();draw();};
  const save=async show=>{
    const selected=chosen();
    if(!selected.length){toast("Selecione pelo menos um material.",true);return;}
    if(show&&selected.some(x=>bulkVisibilityState(x).categoryRestricted)){
      toast("Há categorias restritas. Libere-as na aba Categorias antes de exibir esses materiais para todos.",true);
      return;
    }
    const changed=selected.filter(x=>Number(x.visivel_visitante)!==(show?1:0));
    if(!changed.length){
      toast("Esses materiais já estão com a visibilidade escolhida. Nenhuma alteração foi feita.");
      return;
    }
    const unchanged=selected.length-changed.length;
    const description=changed.length+" material(is) terão a visibilidade alterada."+
      (unchanged?" "+unchanged+" já possuem essa configuração e não serão modificados.":"")+
      (show?" Visitantes também poderão ver esses materiais.":" Apenas PETianes poderão vê-los.");
    const ok=await niceModalConfirm("Alterar visibilidade de "+changed.length+" materiais?",description,show?"Exibir para todos":"Só PETianes");
    if(!ok)return;
    try{
      const response=await api("/api/admin/visibility","POST",{ids:changed.map(x=>x.id),visivel_visitante:show,responsavel:state.actor||"Admin"});
      await adminReload();closeModal();adminBuild();
      toast((response.alterados??changed.length)+" material(is) atualizado(s).");
    }catch(error){toast(error.message,true);}
  };
  $("#bulk-show-all").onclick=()=>save(true);
  $("#bulk-only-members").onclick=()=>save(false);
  draw();
}
function openVariantLinker(currentId){
  const model=adminMaterialPickerConfig("variations",currentId);
  const existing=[...new Set(model.all.map(x=>x.grupo_variacoes).filter(Boolean))];
  openModal("Organizar variações","Vincule modelos sem juntar seus estoques. Selecione os materiais que devem compartilhar um card.",
    '<div class="modal-main"><div class="field"><label for="variant-group-name">Nome da família</label>'+
    '<input id="variant-group-name" maxlength="80" list="variant-existing-groups" value="'+attr(model.current?.grupo_variacoes||model.group||"")+'" placeholder="Ex.: Resistores"><datalist id="variant-existing-groups">'+existing.map(x=>'<option value="'+attr(x)+'"></option>').join("")+'</datalist></div>'+
    '<div class="field"><label for="variant-search">Buscar outros modelos</label><input id="variant-search" placeholder="Buscar material..." value="'+attr(model.current?.nome.split(/\s+/)[0]||"")+'"></div>'+
    '<div class="admin-bulk-actions"><button class="outline-button small-button" type="button" id="variant-similar">Sugerir semelhantes ('+model.similar.length+')</button>'+
    '<button class="outline-button small-button" type="button" id="variant-check-all">Selecionar resultados</button>'+
    '<button class="outline-button small-button" type="button" id="variant-check-none">Limpar seleção</button></div>'+
    '<div class="admin-bulk-list" id="variant-list"></div><p class="hint" id="variant-selected"></p>'+
    '<div class="modal-footer" style="border:0;padding:14px 0 0;display:flex;gap:8px;flex-wrap:wrap">'+
    '<button type="button" class="outline-button" id="variant-create">Cadastrar nova variação</button>'+
    '<button type="button" class="outline-button" id="variant-unlink">Desvincular selecionados</button>'+
    '<button type="button" class="primary-button" id="variant-save">Vincular selecionados</button></div></div>',{size:"wide"});
  let visible=[];
  const draw=()=>{
    const r=materialPickerRows(model.all,model.selected,$("#variant-search").value,true);
    visible=r.visible;$("#variant-list").innerHTML=r.html;
    $("#variant-selected").textContent=model.selected.size+" material(is) selecionado(s).";
    $$("[data-bulk-id]",$("#variant-list")).forEach(b=>b.onchange=()=>{
      const id=Number(b.dataset.bulkId);if(b.checked)model.selected.add(id);else model.selected.delete(id);
      $("#variant-selected").textContent=model.selected.size+" material(is) selecionado(s).";
    });
    $$("[data-variant-photo]",$("#variant-list")).forEach(button=>button.onclick=()=>{
      $("#variant-list [data-variant-file='"+button.dataset.variantPhoto+"']")?.click();
    });
    $$("[data-variant-file]",$("#variant-list")).forEach(input=>input.onchange=async event=>{
      const file=event.target.files?.[0];if(!file)return;
      const id=Number(input.dataset.variantFile);
      const original=model.all.find(x=>x.id===id);
      if(!original)return;
      const button=$("#variant-list [data-variant-photo='"+id+"']");
      if(button){button.disabled=true;button.textContent="Salvando…";}
      try{
        if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw Error("Escolha uma foto PNG, JPG ou WEBP.");
        const image=await shrinkImage(file);
        await api("/api/admin/item/photo","POST",{id,imagem:image,responsavel:state.actor||"Admin"});
        // Manter os nomes, quantidades e a seleção em andamento.
        original.imagem=image;
        const adminEntry=state.admin.componentes.find(x=>x.id===id);
        if(adminEntry)adminEntry.imagem=image;
        const catalogEntry=state.data.componentes.find(x=>x.id===id);
        if(catalogEntry)catalogEntry.imagem=image;
        toast("Foto de "+original.nome+" salva.");
        draw();
      }catch(error){
        toast(error.message,true);
        if(button){button.disabled=false;button.textContent="Enviar foto";}
      }
    });
  };
  $("#variant-search").oninput=draw;
  $("#variant-similar").onclick=()=>{for(const x of model.similar)model.selected.add(x.id);draw();};
  $("#variant-check-all").onclick=()=>{for(const x of visible)model.selected.add(x.id);draw();};
  $("#variant-check-none").onclick=()=>{model.selected.clear();draw();};
  $("#variant-create").onclick=()=>{
    window.__newVariantGroup=$("#variant-group-name").value.trim();
    adminItemEditor();
  };
  const save=async unlink=>{
    const group=unlink?"":$("#variant-group-name").value.trim();
    if(!model.selected.size){toast("Selecione pelo menos um material.",true);return;}
    if(!unlink&&group.length<2){toast("Informe um nome de grupo com pelo menos 2 caracteres.",true);return;}
    const ok=await niceModalConfirm(unlink?"Desvincular variações?":"Vincular variações?",model.selected.size+" materiais serão "+(unlink?"separados em cards individuais.":"ligados ao grupo "+group+"."),unlink?"Desvincular":"Vincular");
    if(!ok)return;
    try{
      await api("/api/admin/variations","POST",{ids:[...model.selected],grupo:group,responsavel:state.actor||"Admin"});
      await adminReload();closeModal();adminBuild();toast(unlink?"Variações desvinculadas.":"Materiais vinculados no mesmo card.");
    }catch(error){toast(error.message,true);}
  };
  $("#variant-save").onclick=()=>save(false);
  $("#variant-unlink").onclick=()=>save(true);
  draw();
}
function adminItemEditor(id){
  itemEditor(id);
  const form=$("#item-form");
  if(!form)return;
  if(id){
    const publicControl=$("#i-public");
    if(publicControl){
      const apply=document.createElement("button");
      apply.type="button";apply.className="outline-button small-button";apply.textContent="Aplicar aos semelhantes";
      publicControl.closest(".switch-row")?.insertAdjacentElement("afterend",apply);
      apply.onclick=()=>openBulkVisibility(id);
    }
  }
  let edited=false,saved=false;
  const markDirty=()=>{edited=true};
  form.addEventListener("input",markDirty);
  form.addEventListener("change",markDirty);
  const askDiscard=async()=>{
    if(edited&&!saved&&!await confirmOverEditor())return;
    closeModal();
  };
  const baseCancel=$("#i-cancel");
  if(baseCancel)baseCancel.onclick=askDiscard;
  form.addEventListener("pet:item-saved",()=>{saved=true});
  const root=$("#modal-root");
  if(root){const close=root.querySelector("[data-close]");if(close)close.onclick=askDiscard;}
  function confirmOverEditor(){
    return new Promise(resolve=>{
      const layer=document.createElement("div");
      layer.className="modal-overlay editor-confirm-layer";
      layer.innerHTML='<section class="modal" role="alertdialog" aria-modal="true" aria-label="Descartar alterações"><header class="modal-header"><h2>Descartar alterações?</h2></header>'+
        '<div class="confirm-body"><p>As mudanças deste material ainda não foram salvas.</p>'+
        '<div class="confirm-actions"><button class="secondary-button" id="keep-editing" type="button">Continuar editando</button>'+
        '<button class="danger-button" id="discard-edits" type="button">Descartar</button></div></div></section>';
      root.appendChild(layer);
      const end=value=>{layer.remove();resolve(value);};
      layer.querySelector("#keep-editing").onclick=()=>end(false);
      layer.querySelector("#discard-edits").onclick=()=>end(true);
      layer.onclick=e=>{if(e.target===layer)end(false);};
    });
  }
}
function adminSettings(root){
  const cfg=state.admin.configuracoes||{};
  const current=String(cfg.limpeza_reservas||"nunca");
  const settingsToggle=(id,label,explanation,enabled)=>
    '<label class="settings-toggle" for="'+id+'"><span class="settings-toggle-label"><strong>'+esc(label)+'</strong>'+
    (explanation?'<small>'+esc(explanation)+'</small>':'')+'</span>'+
    '<input id="'+id+'" type="checkbox" role="switch" '+(enabled?"checked":"")+'><span class="settings-switch" aria-hidden="true"></span></label>';
  const emailEditor='<section class="admin-panel mail-template-panel">'+
    '<div class="admin-section-head"><div><h2>Textos dos e-mails</h2><p>Personalize assuntos e mensagens. Os dados do empréstimo serão preenchidos automaticamente.</p></div></div>'+
    '<div class="field"><label for="mail-template-type">Tipo de cobrança ou lembrete</label><select id="mail-template-type"><option value="">Carregando modelos…</option></select></div>'+
    '<div class="field"><label for="mail-template-subject">Assunto do e-mail</label><input type="text" maxlength="180" id="mail-template-subject" placeholder="Assunto"></div>'+
    '<div class="field"><label for="mail-template-body">Texto da mensagem</label><textarea id="mail-template-body" maxlength="5000" rows="9" placeholder="Mensagem"></textarea></div>'+
    '<p class="mail-template-help">Use <code>{nome}</code>, <code>{material}</code>, <code>{quantidade}</code>, <code>{prazo}</code>, <code>{registro}</code> e <code>{link}</code> nos textos.</p>'+
    '<div class="mail-template-preview"><strong>Prévia com dados fictícios</strong><p id="mail-template-preview-subject"></p><pre id="mail-template-preview-body"></pre></div>'+
    '<div class="mail-template-actions"><button type="button" class="primary-button" id="mail-template-save">Salvar texto deste modelo</button></div></section>';
  const mailEvents=[["antes","1 dia antes da devolução"],["hoje","No dia da devolução"],["atraso2","2 dias de atraso"],["atraso7","7 dias de atraso"],["manual","Cobrança manual"]];
  const scheduleEditor='<section class="admin-panel mail-schedule-panel"><div class="admin-section-head"><div><h2>Quando enviar e-mails?</h2>'+
    '<p>Escolha os tipos de mensagem de cada tag. PETianes e Visitantes têm controles separados. A opção geral da tag, acima, também precisa estar ativada.</p></div></div>'+
    '<form id="mail-event-form"><div class="mail-schedule-grid">'+
    [["visitante","Visitantes","Solicitam reserva, que precisa ser aprovada e registrada como retirada."],["petiano","PETianes","Retiradas diretas; a tag fica sem e-mails por padrão."]].map(([tag,label,description])=>
      '<div class="mail-schedule-card"><h3>'+label+'</h3><p>'+description+'</p>'+
      mailEvents.map(([key,label])=>settingsToggle("mail-event-"+tag+"-"+key,label,"",true)).join("")+
      '</div>').join("")+'</div>'+
    '<p class="hint">Avisos automáticos só são gerados após a retirada real e na data correspondente. A cobrança manual depende de uma retirada ativa com prazo.</p>'+
    '<div class="mail-template-actions"><button type="submit" class="primary-button" id="mail-event-save" disabled>Salvar regras por tag</button></div></form></section>';
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Configurações</h2></div></div>'+
    '<form id="admin-settings-form" class="settings-grid">'+
    '<div class="settings-block"><div class="field"><label for="v2-cleanup">Excluir empréstimos devolvidos após</label>'+
    '<select id="v2-cleanup"><option value="nunca">Nunca apagar</option><option value="1min">1 minuto (teste)</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option><option value="personalizado">Outro prazo</option></select></div>'+
    '<div id="v2-custom-wrap" class="field" hidden><label for="v2-custom-days">Dias</label><input id="v2-custom-days" type="number" min="1" max="3650" value="'+attr(/^\d+$/.test(current)?current:"45")+'"></div>'+
    '<p>Somente reservas devolvidas são apagadas. Reservas pendentes e materiais em uso permanecem.</p></div>'+
    '<div class="settings-block"><strong>Dados do inventário</strong><p>'+esc(adminLastUpdate())+'</p>'+settingsToggle("v2-demo","Exibir modo de demonstração","Ativa os exemplos visuais do catálogo.",cfg.modo_demo==="sim")+'</div>'+
    '<div class="settings-block settings-gmail-block"><strong>Notificações por Gmail</strong><p>Controle quem recebe cobranças. Os PETianes ficam desativados por padrão.</p>'+
    '<div class="settings-toggle-grid">'+settingsToggle("v2-mail-auto","Lembretes automáticos","Envia conforme os vencimentos registrados.",cfg.avisos_email==="sim")+
    settingsToggle("v2-mail-pet","Notificar PETianes","Somente com prazo e permissão habilitada.",cfg.notificacoes_petianos==="sim")+
    settingsToggle("v2-mail-visitor","Notificar visitantes","Avisos para empréstimos com prazo.",cfg.notificacoes_visitantes!=="nao")+'</div>'+
    '<button class="outline-button" type="button" id="v2-mail-history">Histórico de e-mails</button></div>'+
    '<div style="grid-column:1/-1"><button class="primary-button" type="submit">Salvar configurações</button></div></form></section>'+
    scheduleEditor+emailEditor+'<section class="admin-panel" id="admin-backup-section"><div class="admin-section-head"><div><h2>Backup e restauração</h2><p>Para recuperar uma cópia JSON, selecione Restaurar arquivo JSON. Atenção: a restauração substitui os dados atuais do inventário, então faça um backup primeiro.</p></div></div>'+
    '<div class="buttons" style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="outline-button" id="v2-backup-download">Baixar backup JSON</button>'+
    '<button type="button" class="outline-button" id="v2-backup-import">Restaurar arquivo JSON</button><input id="v2-backup-file" type="file" accept=".json,application/json" hidden>'+
    '<button type="button" class="outline-button" id="v2-run-cleanup">Executar limpeza</button></div></section>';
  const select=$("#v2-cleanup");select.value=["nunca","1min","7","15","30","60","90"].includes(current)?current:"personalizado";
  const update=()=>{$("#v2-custom-wrap").hidden=select.value!=="personalizado";};select.onchange=update;update();
  $("#admin-settings-form").onsubmit=async e=>{
    e.preventDefault();const btn=e.target.querySelector('button[type="submit"]'),days=select.value==="personalizado"?String($("#v2-custom-days").value):select.value;
    btn.disabled=true;
    try{
      await api("/api/admin/settings","POST",{limpeza_reservas:days,modo_demo:$("#v2-demo").checked?"sim":"nao"});
      await api("/api/admin/mail/settings","POST",{avisos_email:$("#v2-mail-auto").checked?"sim":"nao",notificacoes_petianos:$("#v2-mail-pet").checked?"sim":"nao",notificacoes_visitantes:$("#v2-mail-visitor").checked?"sim":"nao"});
      await adminReload();adminBuild();toast("Configurações salvas.");
    }catch(error){toast(error.message,true);btn.disabled=false;}
  };


  // Permissões por tipo e por tag: nenhum envio de e-mail ocorre ao salvar as opções.
  const eventSave=$("#mail-event-save");
  $("#mail-event-form").onsubmit=async event=>{
    event.preventDefault();eventSave.disabled=true;eventSave.textContent="Salvando…";
    const profiles={};
    for(const tag of ["visitante","petiano"]){
      profiles[tag]={};
      for(const [key] of mailEvents)profiles[tag][key]=$("#mail-event-"+tag+"-"+key).checked;
    }
    try{const result=await api("/api/admin/mail/events","POST",{profiles});toast(result.mensagem||"Regras de e-mail atualizadas.");}
    catch(error){toast(error.message,true);}
    finally{eventSave.disabled=false;eventSave.textContent="Salvar regras por tag";}
  };
  api("/api/admin/mail/events").then(result=>{
    if(!document.contains(root)||UI.adminTab!=="configuracoes")return;
    for(const [tag,settings] of Object.entries(result.profiles||{})){
      for(const [key,value] of Object.entries(settings.eventos||{})){
        const input=$("#mail-event-"+tag+"-"+key);if(input)input.checked=!!value;
      }
    }
    eventSave.disabled=false;
  }).catch(error=>{toast("Não foi possível carregar as regras de e-mail: "+error.message,true);});
  // Editor de modelos: salvar um tipo por vez, mantendo a configuração dos destinatários.
  let mailTemplates=[],templateSelected="",templateChanged=false;
  const typeSelect=$("#mail-template-type"),subjectField=$("#mail-template-subject"),bodyField=$("#mail-template-body");
  const example={nome:"Ana",material:"Arduino Uno",quantidade:"1",prazo:"15/11/2026",registro:"123",link:"https://inventario-pet.pet-educacao.workers.dev"};
  const sampleText=value=>Object.entries(example).reduce((out,[key,content])=>out.split("{"+key+"}").join(content),String(value||""));
  const updateSample=()=>{
    $("#mail-template-preview-subject").textContent=sampleText(subjectField.value);
    $("#mail-template-preview-body").textContent=sampleText(bodyField.value);
  };
  const loadTemplate=event=>{
    const model=mailTemplates.find(item=>item.evento===event);if(!model)return;
    templateSelected=event;typeSelect.value=event;subjectField.value=model.assunto;bodyField.value=model.mensagem;
    templateChanged=false;updateSample();
  };
  [subjectField,bodyField].forEach(field=>field.addEventListener("input",()=>{templateChanged=true;updateSample();}));
  typeSelect.onchange=()=>{
    const requested=typeSelect.value;
    if(templateChanged&&!window.confirm("As alterações deste modelo não foram salvas. Deseja descartá-las?")){
      typeSelect.value=templateSelected;return;
    }
    loadTemplate(requested);
  };
  $("#mail-template-save").onclick=async()=>{
    const button=$("#mail-template-save");button.disabled=true;button.textContent="Salvando modelo…";
    try{
      await api("/api/admin/mail/templates","POST",{evento:templateSelected,assunto:subjectField.value,mensagem:bodyField.value});
      const model=mailTemplates.find(x=>x.evento===templateSelected);
      if(model){model.assunto=subjectField.value.trim();model.mensagem=bodyField.value.trim();}
      templateChanged=false;toast("Modelo de e-mail salvo.");
    }catch(error){toast(error.message,true);}
    finally{button.disabled=false;button.textContent="Salvar texto deste modelo";}
  };
  api("/api/admin/mail/templates").then(result=>{
    if(!document.contains(root)||UI.adminTab!=="configuracoes")return;
    mailTemplates=result.templates||[];
    typeSelect.innerHTML=mailTemplates.map(x=>'<option value="'+attr(x.evento)+'">'+esc(x.nome)+'</option>').join("");
    if(mailTemplates.length)loadTemplate(mailTemplates[0].evento);
  }).catch(error=>{if(document.contains(root))typeSelect.innerHTML='<option value="">'+esc(error.message)+'</option>';toast("Não foi possível carregar os modelos de e-mail.",true);});
  $("#v2-mail-history").onclick=async()=>{
    try{
      const result=await api("/api/admin/mail/log");
      const items=result.items||[];
      const body='<div class="modal-main"><p class="notice">Conexão com o Gmail: '+(result.configurado?"Chave configurada no Worker":"Chave ainda não configurada")+'</p><div class="admin-list">'+(items.length?items.map(x=>'<div class="admin-list-row"><div class="main-info"><strong>#'+x.id+' · '+esc(x.assunto)+'</strong><small>'+esc(x.destinatario)+' · '+esc(x.situacao)+' · '+esc(fmt(x.criado_em))+(x.ultimo_erro?" · "+esc(x.ultimo_erro):"")+'</small></div></div>').join(""):'<div class="empty-state">Nenhum e-mail registrado.</div>')+'</div></div>';
      openModal("Histórico de notificações","Envios e cobranças do Inventário PET.",body);
    }catch(e){toast(e.message,true);}
  };
  $("#v2-backup-download").onclick=async()=>{try{const result=await api("/api/admin/backup");saveDownload("backup-inventario-pet-"+localDate()+".json",JSON.stringify(result,null,2));toast("Backup preparado.");}catch(e){toast(e.message,true);}};
  $("#v2-backup-import").onclick=()=>$("#v2-backup-file").click();
  $("#v2-backup-file").onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(file.size>30000000){toast("Backup acima do limite de 30 MB.",true);return;}
    if(!await niceModalConfirm("Restaurar backup?","Esta operação substituirá dados e pode afetar reservas e usuários. Faça um backup antes de continuar.","Restaurar",true))return;
    try{
      const result=JSON.parse(await file.text());
      await api("/api/admin/restore","POST",result);await adminReload();await refreshFilaments();adminBuild();toast("Backup restaurado.");
    }catch(error){toast(error.message,true);}
  };
  $("#v2-run-cleanup").onclick=async()=>{
    if(!await niceModalConfirm("Executar limpeza?","Excluir apenas os registros devolvidos cujo prazo de retenção terminou?","Executar",true))return;
    try{const result=await api("/api/admin/cleanup","POST",{});await adminReload();adminBuild();toast(result.removidas+" registro(s) removido(s).");}catch(error){toast(error.message,true);}
  };
}

/* Entrada administrativa sempre recuperável, sem carregamento infinito. */
function renderAdminAccess(message=""){
  const standalone=document.body.dataset.adminRoute==="true";
  const form='<form class="modal-main" id="v2-admin-login">'+
    '<div class="field"><label for="v2-admin-password">Senha</label>'+
    '<div class="password-input-wrap"><input type="password" id="v2-admin-password" autocomplete="current-password" required placeholder="Digite a senha">'+
    '<button type="button" id="v2-admin-show-password" class="show-password" aria-pressed="false">Mostrar</button></div></div>'+
    (message?'<p class="admin-access-notice" role="status">'+esc(message)+'</p>':"")+
    '<button type="submit" class="primary-button" style="width:100%;min-height:49px" id="v2-admin-submit">Entrar no Admin</button>'+
    (standalone?'<div class="admin-access-links"><a href="/">Voltar ao inventário</a>'+
      '<button type="button" id="v2-admin-retry">Tentar novamente</button></div>':"")+'</form>';
  if(standalone){
    const stage=$("#admin-stage");
    stage.classList.remove("admin-loading");
    stage.hidden=false;
    document.body.classList.add("admin-mode");
    stage.innerHTML='<main class="admin-access-shell"><section class="admin-access-card">'+
      '<div class="admin-access-symbol">'+iconSvg("box",30)+'</div>'+
      '<h1>Admin</h1><p>Acesso ao inventário do PET Educação</p>'+
      form+'</section></main>';
  }else{
    openModal("Admin","Entre com a senha para acessar o inventário.",form);
  }
  const pwd=$("#v2-admin-password"),toggle=$("#v2-admin-show-password");
  toggle.onclick=()=>{
    const show=pwd.type==="password";
    pwd.type=show?"text":"password";toggle.textContent=show?"Ocultar":"Mostrar";
    toggle.setAttribute("aria-pressed",String(show));
  };
  if(standalone)$("#v2-admin-retry").onclick=()=>openAdmin();
  $("#v2-admin-login").onsubmit=async e=>{
    e.preventDefault();
    const button=$("#v2-admin-submit");
    button.disabled=true;button.textContent="Entrando…";
    try{
      await api("/api/login","POST",{senha:pwd.value});
      await adminReload();
      adminModal();
      toast("Acesso administrativo autorizado.");
    }catch(error){
      const notice=$("#v2-admin-login .admin-access-notice");
      if(notice){notice.textContent=error.message;}
      else{
        const p=document.createElement("p");p.className="admin-access-notice";
        p.setAttribute("role","alert");p.textContent=error.message;
        button.before(p);
      }
      button.disabled=false;button.textContent="Entrar no Admin";
    }
  };
}
async function openAdmin(){
  // Não exibir login até confirmar se a sessão administrativa continua válida.
  const standalone=document.body.dataset.adminRoute==="true";
  if(standalone){
    const stage=$("#admin-stage");
    stage.hidden=false;
    stage.classList.add("admin-loading");
    document.body.classList.add("admin-mode");
    stage.innerHTML='<div class="admin-entry-message" role="status"><strong>Carregando Admin…</strong><span>Verificando sua sessão.</span></div>';
  }
  try{
    await adminReload();
    adminModal();
  }catch(error){
    state.admin=null;
    const unauthorized=/painel|401|autoriz/i.test(error.message);
    renderAdminAccess(unauthorized?"":"Não foi possível verificar sua sessão: "+error.message);
  }
}
setupFinalPublic();
if(document.body.dataset.adminRoute==="true")openAdmin();
