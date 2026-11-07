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
function adminDashboard(root){
  const c=adminCounts();
  root.innerHTML='<section class="admin-panel"><h2>Visão geral</h2><p>Resumo do acervo, com acesso rápido às ferramentas.</p>'+
    '<div class="admin-overview three" style="margin-top:15px"><div class="admin-stat"><strong>'+c.items+'</strong><span>Itens cadastrados</span></div>'+
    '<div class="admin-stat"><strong>'+c.used+'</strong><span>Em uso</span></div>'+
    '<div class="admin-stat"><strong>'+c.defective+'</strong><span>Com defeito</span></div></div>'+
    '<div class="admin-shortcuts">'+
    '<button class="admin-shortcut" type="button" data-dashboard-go="materiais">'+iconSvg("box",21)+' Materiais e estoque</button>'+
    '<button class="admin-shortcut" type="button" data-dashboard-go="categorias">'+iconSvg("layers",21)+' Categorias e acesso</button>'+
    '<button class="admin-shortcut" type="button" data-dashboard-go="historico">'+iconSvg("back",21)+' Histórico de alterações</button>'+
    '<button class="admin-shortcut" type="button" data-dashboard-go="filamentos">'+iconSvg("grid",21)+' Filamentos</button>'+
    '</div></section>'+
    '<section class="admin-panel"><div class="admin-section-head"><h2>Atividade recente</h2><button class="outline-button small-button" type="button" id="dashboard-log-all">Ver histórico</button></div><div id="dashboard-recent-log" class="admin-log-list">Carregando…</div></section>';
  $$("[data-dashboard-go]",root).forEach(b=>b.onclick=()=>selectAdminTab(b.dataset.dashboardGo));
  $("#dashboard-log-all").onclick=()=>selectAdminTab("historico");
  api("/api/admin/log?pagina=1").then(data=>{
    const el=$("#dashboard-recent-log");if(!el)return;
    el.innerHTML=(data.eventos||[]).slice(0,4).map(adminLogRow).join("")||'<div class="empty-state">Nenhuma alteração registrada ainda.</div>';
  }).catch(error=>{const el=$("#dashboard-recent-log");if(el)el.textContent=error.message;});
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
function adminMaterialRow(x){
  const available=stock(x),isHidden=isArchived(x);
  const status=isHidden?"Arquivado":available?"Disponível":"Sem estoque";
  return '<div class="material-row">'+thumb(x)+
    '<div class="material-name"><strong>'+esc(x.nome)+'</strong><small>'+esc(nameCategory(x.categoria_id))+(x.patrimonio?" · "+esc(x.patrimonio):"")+(Number(x.visivel_visitante)===0?' · Só PETianes':'')+(x.grupo_variacoes?' · Grupo: '+esc(x.grupo_variacoes):'')+'</small>'+
    '<small class="mobile-meta" style="display:none">Total: '+x.quantidade+' · Em uso: '+x.em_uso+' · Defeito: '+x.com_defeito+'</small></div>'+
    quantityCell("Quantidade",Number(x.quantidade))+quantityCell("Em uso",Number(x.em_uso),"used")+quantityCell("Defeito",Number(x.com_defeito),"broken")+
    '<span class="material-status '+(isHidden||!available?"empty":"")+'">'+status+'</span>'+
    '<div class="material-actions"><button class="square-action" type="button" title="Ver detalhes" aria-label="Ver detalhes" data-item-view="'+x.id+'">'+iconSvg("eye")+'</button>'+
    '<button class="square-action" type="button" title="Editar" aria-label="Editar" data-item-edit="'+x.id+'">'+iconSvg("edit")+'</button>'+
    '<button class="square-action '+(isHidden?"":"danger")+'" type="button" title="'+(isHidden?"Restaurar":"Arquivar")+'" data-item-archive="'+x.id+'">'+iconSvg(isHidden?"back":"trash")+'</button></div></div>';
}
function wireMaterialActions(root){
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
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Materiais cadastrados</h2></div>'+
    '<div class="buttons"><button class="outline-button" type="button" id="admin-bulk-visibility">'+iconSvg("eye",15)+' Visibilidade em lote</button><button class="outline-button" type="button" id="admin-group-variations">'+iconSvg("layers",15)+' Variações</button><button class="primary-button" id="admin-item-new" type="button">'+iconSvg("plus",16)+' Novo material</button></div></div>'+
    '<div class="admin-tools"><div class="search-box">'+iconSvg("search")+'<input type="search" id="admin-material-search" placeholder="Buscar materiais..." value="'+attr(UI.adminSearch)+'"></div>'+
    '<select id="admin-material-category" class="admin-filter" aria-label="Categoria">'+categoryOptions+'</select>'+
    '<select id="admin-material-sort" class="admin-sort" aria-label="Ordenação">'+sortOptions(UI.adminSort)+'</select></div>'+
    '<div id="admin-material-list"></div><nav id="admin-material-pages" class="page-controls admin-paginate"></nav></section>';
  $("#admin-item-new").onclick=()=>adminItemEditor();
  $("#admin-bulk-visibility").onclick=()=>openBulkVisibility();
  $("#admin-group-variations").onclick=()=>openVariantLinker();
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
  if(r.status==="retirada"&&r.data_devolucao<localDate())return "atrasadas";
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
  const actions=r.status==="pendente"?'<button class="primary-button" type="button" data-res-do="aprovar" data-id="'+r.id+'">'+iconSvg("check",14)+' Aprovar</button><button type="button" class="danger-button" data-res-do="recusar" data-id="'+r.id+'">Recusar</button>':
    r.status==="aprovada"?'<button type="button" class="primary-button" data-res-do="retirar" data-id="'+r.id+'">Registrar retirada</button><button type="button" class="outline-button" data-res-do="recusar" data-id="'+r.id+'">Cancelar</button>':
    r.status==="retirada"?'<button type="button" class="primary-button" data-res-do="devolver" data-id="'+r.id+'">Registrar devolução</button>':"";
  return '<div class="reservation-row">'+(x?thumb(x,"reservation-thumb"):'<div class="reservation-thumb"></div>')+
    '<div><h3>#'+r.id+' · '+esc(r.componente_nome||x?.nome||"Material")+'</h3><small>'+esc(r.nome_solicitante)+' · '+r.quantidade+' un.'+(r.tipo==="retirada_direta"?" · PETiano":"")+'</small>'+
    (r.contato?'<small style="display:block">'+esc(r.contato)+'</small>':"")+
    (r.observacao?'<small style="display:block" title="'+attr(r.observacao)+'">'+esc(r.observacao.slice(0,120))+'</small>':"")+'</div>'+
    '<div class="reservation-date"><small>Retirada</small><strong>'+esc(formatDay(r.data_inicio))+'</strong></div>'+
    '<div class="reservation-date"><small>Devolução</small><strong>'+esc(formatDay(r.data_devolucao))+'</strong></div>'+
    '<span class="tag '+cls+'">'+tag+'</span><div class="reservation-actions">'+actions+'</div></div>';
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
async function adminReservationAction(id,action){
  const r=state.admin.reservas.find(x=>x.id===id);if(!r)return;
  if(action==="devolver")return returnModal(r);
  const descriptions={aprovar:"Aprovar a reserva de "+r.nome_solicitante+"?",recusar:"Recusar ou cancelar esta reserva?",retirar:"Confirmar que o material foi entregue?"};
  if(!await niceModalConfirm("Confirmar ação",descriptions[action]||"Confirma a operação?","Confirmar",action==="recusar"))return;
  try{
    await api("/api/admin/reservation","POST",{id,acao:action,responsavel:state.actor||"Administração"});
    await adminReload();adminBuild();
    toast("Reserva atualizada.");
  }catch(e){toast(e.message,true);}
}
/* Usuários: tag, redefinição de senha e exclusão segura. */
let adminUserFilter="todos";
let adminUserQuery="";
async function adminUsers(root){
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Usuários</h2></div></div>'+
    '<div class="admin-tools"><div class="search-box">'+iconSvg("search")+'<input type="search" id="admin-users-search" placeholder="Buscar nome, login ou ID..." value="'+attr(adminUserQuery)+'"></div>'+
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
    '<div><strong>'+esc(x.nome)+'</strong><small>'+esc(x.login||"Sem login")+' · '+esc(x.id)+'</small></div>'+
    '<span class="tag '+(member?"picked":"")+'">'+(member?"PETiano":"Visitante")+'</span>'+
    '<div class="user-actions"><button class="outline-button small-button" type="button" data-user-role="'+attr(x.id)+'" title="Alterar tag">'+iconSvg("edit",15)+' Tag</button>'+
    '<button class="outline-button small-button" type="button" data-user-password="'+attr(x.id)+'" title="Redefinir senha">Senha</button>'+
    '<button class="danger-button small-button" type="button" data-user-delete="'+attr(x.id)+'" title="Excluir usuário">'+iconSvg("trash",16)+'</button></div></div>';
}
function paintUsers(){
  const list=$("#admin-users-list");if(!list)return;
  const users=UI.users||[];
  const query=adminUserQuery.toLowerCase().trim();
  const found=users.filter(x=>(adminUserFilter==="todos"||x.tag===adminUserFilter)&&(!query||[x.nome,x.login,x.id].some(v=>String(v||"").toLowerCase().includes(query))));
  const p=paginate(found,UI.usersPage||1);UI.usersPage=p.page;
  list.innerHTML=found.length?p.items.map(userRow).join(""):'<div class="empty-state">Nenhum usuário encontrado.</div>';
  $("#admin-users-pages").innerHTML=pageButtons(p,"users");
  $$("[data-user-role]",list).forEach(b=>b.onclick=()=>adminToggleTag(b.dataset.userRole));
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
  const archived=(state.admin.categorias||[]).filter(x=>x.arquivada);
  const itemCounts=cat=>{
    const items=state.admin.componentes.filter(x=>x.categoria_id===cat.id);
    const active=items.filter(x=>!isArchived(x)).length;
    return active+' ativos'+(items.length-active?' · '+(items.length-active)+' arquivados':'');
  };
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Categorias</h2><p>Organize e defina quem pode acessar cada categoria.</p></div>'+
    '<div class="buttons"><button class="primary-button" id="v2-new-category" type="button">'+iconSvg("plus",16)+' Nova categoria</button></div></div>'+
    '<div class="category-list" id="v2-category-list">'+cats.map((cat,i)=>
    '<div class="category-row" data-category-id="'+cat.id+'" draggable="true"><span class="drag-handle">'+iconSvg("grip")+'</span>'+
    '<strong>'+esc(cat.nome)+'</strong><small>'+itemCounts(cat)+'</small>'+
    '<small class="tag '+(Number(cat.visivel_visitante)===0?'pending':'')+'">'+(Number(cat.visivel_visitante)===0?'Só PETianes':'Todos')+'</small>'+
    '<div class="actions"><button type="button" class="square-action" data-cat-up="'+cat.id+'" '+(i===0?"disabled":"")+' aria-label="Subir">'+iconSvg("up")+'</button>'+
    '<button type="button" class="square-action" data-cat-down="'+cat.id+'" '+(i===cats.length-1?"disabled":"")+' aria-label="Descer">'+iconSvg("down")+'</button>'+
    '<button type="button" class="square-action" data-cat-edit="'+cat.id+'" aria-label="Editar">'+iconSvg("edit")+'</button>'+
    '<button type="button" class="square-action danger" data-cat-delete="'+cat.id+'" aria-label="Excluir categoria e seus materiais">'+iconSvg("trash")+'</button></div></div>').join("")+'</div>'+
    (archived.length?'<details class="editor-advanced"><summary>Categorias excluídas ('+archived.length+')</summary><div class="category-list">'+archived.map(cat=>
      '<div class="category-row archived"><strong>'+esc(cat.nome)+'</strong><small>'+itemCounts(cat)+'</small><button class="outline-button small-button" type="button" data-cat-restore="'+cat.id+'">Restaurar categoria</button></div>').join("")+'</div></details>':'')+
    '</section>';
  $("#v2-new-category").onclick=()=>editCategory();
  $$("[data-cat-up]",root).forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.catUp),-1));
  $$("[data-cat-down]",root).forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.catDown),1));
  $$("[data-cat-edit]",root).forEach(b=>b.onclick=()=>editCategory(Number(b.dataset.catEdit)));
  $$("[data-cat-delete]",root).forEach(b=>b.onclick=()=>adminDeleteCategory(Number(b.dataset.catDelete)));
  $$("[data-cat-restore]",root).forEach(b=>b.onclick=async()=>{
    if(!await niceModalConfirm("Restaurar categoria?","Os materiais anteriormente arquivados continuarão arquivados até serem restaurados individualmente.","Restaurar"))return;
    try{await api("/api/admin/category","POST",{acao:"restaurar",id:Number(b.dataset.catRestore)});await adminReload();adminBuild();toast("Categoria restaurada.");}
    catch(error){toast(error.message,true);}
  });
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
/* Filamentos: só cor e quantidade, sem patrimônio nem empréstimo. */
const FILAMENT_PALETTE=[
  ["Preto","#24272C"],["Branco","#F4F5F1"],["Vermelho","#D83741"],
  ["Azul","#2A69D6"],["Verde","#2EAC6C"],["Amarelo","#F5D442"],
  ["Laranja","#F28C28"],["Rosa","#F18BC0"],["Roxo","#854CBF"],
  ["Cinza","#959CA6"],["Marrom","#895F47"],["Dourado","#CDA84B"]
];
function adminFilaments(root){
  const list=state.admin.filamentos||[];
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Filamentos</h2><p>Organize as cores e quantidades do PET.</p></div>'+
    '<div class="buttons"><button class="primary-button" id="filament-add" type="button">'+iconSvg("plus",16)+' Adicionar cor</button></div></div>'+
    '<div class="filament-admin-grid">'+(list.length?list.map(x=>
    '<div class="filament-admin-card">'+
      '<span class="filament-color-dot" style="background:'+attr(x.hexadecimal)+'" aria-hidden="true"></span>'+
      '<div class="filament-admin-label"><strong>'+esc(x.cor)+'</strong><small>Quantidade: <b>'+Number(x.quantidade)+'</b></small><small>'+(Number(x.visivel_visitante)===0?'Só PETianes':'Todos')+'</small></div>'+
      '<div class="filament-admin-buttons"><button type="button" class="square-action" aria-label="Editar '+attr(x.cor)+'" title="Editar" data-filament-edit="'+x.id+'">'+iconSvg("edit")+'</button>'+
      '<button type="button" class="square-action danger" aria-label="Excluir '+attr(x.cor)+'" title="Excluir" data-filament-delete="'+x.id+'">'+iconSvg("trash")+'</button></div></div>').join(""):
      '<div class="empty-state">Nenhuma cor cadastrada. Adicione a primeira cor de filamento.</div>')+'</div></section>';
  $("#filament-add").onclick=()=>filamentEditor();
  $$("[data-filament-edit]",root).forEach(b=>b.onclick=()=>filamentEditor(Number(b.dataset.filamentEdit)));
  $$("[data-filament-delete]",root).forEach(b=>b.onclick=()=>deleteFilament(Number(b.dataset.filamentDelete)));
}
function filamentEditor(id){
  const color=(state.admin.filamentos||[]).find(x=>x.id===id);
  const selected=color?.hexadecimal||"#2A69D6";
  openModal(color?"Editar filamento":"Adicionar cor de filamento","Apenas cor e quantidade.",
    '<form id="filament-form" class="modal-main">'+
    '<div class="filament-palette">'+FILAMENT_PALETTE.map(([name,hex])=>
      '<button type="button" class="filament-preset" style="--sample:'+hex+'" data-filament-choice="'+attr(name)+'" data-hex="'+hex+'" aria-label="Escolher '+attr(name)+'" title="'+attr(name)+'"><span></span></button>').join("")+'</div>'+
    '<div class="field-grid"><div class="field"><label for="filament-name">Cor</label><input id="filament-name" maxlength="55" required value="'+attr(color?.cor||"")+'" placeholder="Ex.: Azul royal"></div>'+
    '<div class="field"><label for="filament-hex">Escolher tonalidade</label><input type="color" id="filament-hex" value="'+selected+'"></div></div>'+
    '<div class="field"><label for="filament-quantity">Quantidade</label><div class="stepper"><button type="button" class="step" data-target="filament-quantity" data-delta="-1">−</button><input type="number" id="filament-quantity" value="'+Number(color?.quantidade||0)+'" min="0" max="1000000" required><button type="button" class="step" data-target="filament-quantity" data-delta="1">+</button></div></div>'+switchInput("filament-public","Exibir para todos",color?Number(color.visivel_visitante)!==0:true,"Desmarcado: esta cor ficará visível apenas aos PETianes.")+
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
      await api("/api/admin/filaments","POST",{acao:color?"editar":"criar",id:color?.id,cor:$("#filament-name").value,hexadecimal:$("#filament-hex").value,quantidade:Number($("#filament-quantity").value),visivel_visitante:$("#filament-public").checked});
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
function materialPickerRows(items,selected,term="",withPhotos=false){
  const search=term.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const available=items.filter(x=>!search||[x.nome,x.grupo_variacoes,x.identificacao].some(s=>
    String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(search)));
  return {visible:available,html:available.slice(0,160).map(x=>{
    const info='<span><strong>'+esc(x.nome)+'</strong><small>'+esc(nameCategory(x.categoria_id))+
      (x.grupo_variacoes?' · '+esc(x.grupo_variacoes):"")+
      (Number(x.visivel_visitante)===0?' · Só PETianes':'')+'</small></span>';
    if(!withPhotos)return '<label class="admin-bulk-row"><input type="checkbox" data-bulk-id="'+x.id+'" '+(selected.has(x.id)?'checked':'')+'>'+info+'</label>';
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
  openModal("Visibilidade em lote","Selecione materiais e escolha o público. As sugestões não são aplicadas automaticamente.",
    '<div class="modal-main"><div class="field"><label for="bulk-search">Buscar materiais</label><input id="bulk-search" placeholder="Ex.: Resistor, Arduino..." value="'+attr(initial)+'"></div>'+
    '<div class="admin-bulk-actions"><button class="outline-button small-button" id="bulk-similar" type="button">Selecionar semelhantes ('+model.similar.length+')</button>'+
    '<button class="outline-button small-button" type="button" id="bulk-select-all">Selecionar resultados</button>'+
    '<button class="outline-button small-button" type="button" id="bulk-clear">Desmarcar todos</button></div>'+
    '<div class="admin-bulk-list" id="bulk-list"></div>'+
    '<p class="hint" id="bulk-selected-count"></p>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0;display:flex;gap:8px;flex-wrap:wrap">'+
    '<button class="outline-button" id="bulk-show-all" type="button">Exibir para todos</button>'+
    '<button class="primary-button" id="bulk-only-members" type="button">Só PETianes</button></div></div>',{size:"wide"});
  let visible=[];
  const draw=()=>{
    const result=materialPickerRows(model.all,model.selected,$("#bulk-search").value);
    visible=result.visible;$("#bulk-list").innerHTML=result.html;
    $("#bulk-selected-count").textContent=model.selected.size+" material(is) selecionado(s).";
    $$("[data-bulk-id]",$("#bulk-list")).forEach(b=>b.onchange=()=>{
      const id=Number(b.dataset.bulkId);
      if(b.checked)model.selected.add(id);else model.selected.delete(id);
      $("#bulk-selected-count").textContent=model.selected.size+" material(is) selecionado(s).";
    });
  };
  $("#bulk-search").oninput=draw;
  $("#bulk-similar").onclick=()=>{for(const x of model.similar)model.selected.add(x.id);draw();};
  $("#bulk-select-all").onclick=()=>{for(const x of visible)model.selected.add(x.id);draw();};
  $("#bulk-clear").onclick=()=>{model.selected.clear();draw();};
  const save=async show=>{
    if(!model.selected.size){toast("Selecione pelo menos um material.",true);return;}
    const ok=await niceModalConfirm("Aplicar a "+model.selected.size+" materiais?",show?"Todos os visitantes poderão ver os materiais selecionados.":"Só PETianes poderão ver os materiais selecionados.",show?"Exibir para todos":"Só PETianes");
    if(!ok)return;
    try{
      await api("/api/admin/visibility","POST",{ids:[...model.selected],visivel_visitante:show,responsavel:state.actor||"Admin"});
      await adminReload();closeModal();adminBuild();toast("Visibilidade alterada em "+model.selected.size+" materiais.");
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
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Configurações</h2></div></div>'+
    '<form id="admin-settings-form" class="settings-grid">'+
    '<div class="settings-block"><div class="field"><label for="v2-cleanup">Excluir empréstimos devolvidos após</label>'+
    '<select id="v2-cleanup"><option value="nunca">Nunca apagar</option><option value="1min">1 minuto (teste)</option><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="60">60 dias</option><option value="90">90 dias</option><option value="personalizado">Outro prazo</option></select></div>'+
    '<div id="v2-custom-wrap" class="field" hidden><label for="v2-custom-days">Dias</label><input id="v2-custom-days" type="number" min="1" max="3650" value="'+attr(/^\d+$/.test(current)?current:"45")+'"></div>'+
    '<p>Somente reservas devolvidas são apagadas. Reservas pendentes e materiais em uso permanecem.</p></div>'+
    '<div class="settings-block"><strong>Dados do inventário</strong><p>'+esc(adminLastUpdate())+'</p><div class="field"><label><input type="checkbox" id="v2-demo" '+(cfg.modo_demo==="sim"?"checked":"")+'> Exibir modo de demonstração</label></div></div>'+
    '<div style="grid-column:1/-1"><button class="primary-button" type="submit">Salvar configurações</button></div></form></section>'+
    '<section class="admin-panel"><div class="admin-section-head"><h2>Backup</h2></div>'+
    '<div class="buttons" style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="outline-button" id="v2-backup-download">Baixar backup JSON</button>'+
    '<button type="button" class="outline-button" id="v2-backup-import">Importar backup</button><input id="v2-backup-file" type="file" accept=".json,application/json" hidden>'+
    '<button type="button" class="outline-button" id="v2-run-cleanup">Executar limpeza</button></div></section>';
  const select=$("#v2-cleanup");select.value=["nunca","1min","7","15","30","60","90"].includes(current)?current:"personalizado";
  const update=()=>{$("#v2-custom-wrap").hidden=select.value!=="personalizado";};select.onchange=update;update();
  $("#admin-settings-form").onsubmit=async e=>{
    e.preventDefault();const btn=e.target.querySelector('button[type="submit"]'),days=select.value==="personalizado"?String($("#v2-custom-days").value):select.value;
    btn.disabled=true;
    try{
      await api("/api/admin/settings","POST",{limpeza_reservas:days,modo_demo:$("#v2-demo").checked?"sim":"nao"});
      await adminReload();adminBuild();toast("Configurações salvas.");
    }catch(error){toast(error.message,true);btn.disabled=false;}
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
  // A página própria mostra o formulário antes da verificação de sessão:
  // nenhuma falha de rede/autorização deixa o usuário preso no placeholder.
  const standalone=document.body.dataset.adminRoute==="true";
  if(standalone)renderAdminAccess();
  try{
    await adminReload();
    adminModal();
  }catch(error){
    state.admin=null;
    if(standalone){
      // Login já está disponível. Mostramos diagnóstico e a opção de retentar
      // apenas para falhas reais de conexão, sem bloquear a entrada manual.
      if(!/painel|401|autoriz/i.test(error.message)){
        const note=$("#v2-admin-login .admin-access-notice");
        if(note)note.textContent="Não foi possível verificar sua sessão: "+error.message;
      }
    }else renderAdminAccess();
  }
}
setupFinalPublic();
if(document.body.dataset.adminRoute==="true")openAdmin();
