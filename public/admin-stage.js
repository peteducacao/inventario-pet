/* Administração Inventário PET: painel próprio e responsivo. */
const ADMIN_TABS=[["painel","grid","Painel"],["materiais","box","Materiais"],["filamentos","layers","Filamentos"],["reservas","calendar","Reservas"],["usuarios","users","Usuários"],["categorias","layers","Categorias"],["configuracoes","settings","Configurações"]];
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
  const sorted=[...items.map(x=>x.ultima_alteracao),...(UI.filaments||[]).map(x=>x.atualizado_em)].filter(Boolean).sort();
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
    '<button type="button" id="admin-back">'+iconSvg("back",16)+' Voltar ao inventário</button>'+
    '<button type="button" id="admin-logout" style="background:#f36e6e22">'+iconSvg("logout",16)+' Sair da administração</button></div></aside>'+
    '<div class="admin-main"><header class="admin-top"><div style="display:flex;align-items:center;gap:11px">'+
    '<button type="button" class="admin-menu-toggle" id="admin-menu-toggle" aria-label="Abrir menu">'+iconSvg("menu")+'</button>'+
    '<div><h1>'+esc(current[2])+'</h1><small>Inventário do PET Educação</small></div></div>'+
    '<div class="admin-right"><button id="admin-notifications" type="button" class="nav-icon admin-bell" aria-label="Solicitações pendentes">'+iconSvg("bell")+
    (counts.pending?'<span class="notification-count">'+counts.pending+'</span>':"")+'</button>'+
    '<button id="admin-account" type="button" class="admin-person"><span class="avatar">'+esc((state.actor||"A")[0].toUpperCase())+'</span><span>'+esc(state.actor||"Administrador")+'</span>'+iconSvg("down",15)+'</button></div></header>'+
    '<div id="admin-content"></div><footer class="admin-status-foot">'+esc(adminLastUpdate())+'</footer></div></div>';
  $$("[data-admin-tab]",stage).forEach(b=>b.onclick=()=>selectAdminTab(b.dataset.adminTab));
  $("#admin-back").onclick=leaveAdminWithoutLogout;
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
  return adminSettings(content);
}
function adminDashboard(root){
  const c=adminCounts();
  root.innerHTML='<div class="admin-section-head"><div><h2>Visão geral</h2></div><div class="buttons"><button class="outline-button small-button" type="button" id="admin-stats-toggle">'+(UI.adminSummaryMinimized?"Mostrar resumo":"Minimizar resumo")+' '+iconSvg(UI.adminSummaryMinimized?"down":"up",14)+'</button></div></div>'+
    '<div class="admin-overview '+(UI.adminSummaryMinimized?"collapsed":"")+'"><div class="admin-stat"><strong>'+c.items+'</strong><span>Itens cadastrados</span></div><div class="admin-stat"><strong>'+c.used+'</strong><span>Em uso</span></div><div class="admin-stat"><strong>'+c.defective+'</strong><span>Com defeito</span></div><div class="admin-stat"><strong>'+c.pending+'</strong><span>Reservas pendentes</span></div></div>'+
    '<section class="admin-panel"><div class="admin-section-head"><div><h2>Materiais</h2><p>Acesse e atualize seu inventário.</p></div><div class="buttons"><button type="button" class="outline-button small-button" id="v2-dashboard-all">Ver todos</button><button type="button" class="primary-button small-button" id="v2-dashboard-add">'+iconSvg("plus",15)+' Novo material</button></div></div>'+
    '<div id="dashboard-materials"></div></section>'+
    (c.pending?'<section class="admin-panel"><div class="admin-section-head"><h2>Reservas aguardando aprovação</h2><button class="outline-button small-button" id="dashboard-reservations">Analisar</button></div><p>'+c.pending+' solicitação(ões) para conferir.</p></section>':"");
  $("#admin-stats-toggle").onclick=()=>{UI.adminSummaryMinimized=!UI.adminSummaryMinimized;stored("pet_admin_summary_closed",UI.adminSummaryMinimized?"1":"0");adminDashboard(root)};
  $("#v2-dashboard-all").onclick=()=>selectAdminTab("materiais");
  $("#v2-dashboard-add").onclick=()=>adminItemEditor();
  if(c.pending)$("#dashboard-reservations").onclick=()=>selectAdminTab("reservas");
  const small=ordered(state.admin.componentes.filter(x=>!isArchived(x)),UI.adminSort).slice(0,6);
  $("#dashboard-materials").innerHTML='<div class="material-list">'+small.map(adminMaterialRow).join("")+'</div>';
  wireMaterialActions($("#dashboard-materials"));
}
function quantityCell(name,num,clazz=""){
  return '<div class="admin-quantity '+clazz+'"><small>'+name+'</small><strong>'+num+'</strong></div>';
}
function adminMaterialRow(x){
  const available=stock(x),isHidden=isArchived(x);
  const status=isHidden?"Arquivado":available?"Disponível":"Sem estoque";
  return '<div class="material-row">'+thumb(x)+
    '<div class="material-name"><strong>'+esc(x.nome)+'</strong><small>'+esc(nameCategory(x.categoria_id))+(x.patrimonio?" · "+esc(x.patrimonio):"")+'</small>'+
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
    '<div class="buttons"><button class="primary-button" id="admin-item-new" type="button">'+iconSvg("plus",16)+' Novo material</button></div></div>'+
    '<div class="admin-tools"><div class="search-box">'+iconSvg("search")+'<input type="search" id="admin-material-search" placeholder="Buscar materiais..." value="'+attr(UI.adminSearch)+'"></div>'+
    '<select id="admin-material-category" class="admin-filter" aria-label="Categoria">'+categoryOptions+'</select>'+
    '<select id="admin-material-sort" class="admin-sort" aria-label="Ordenação">'+sortOptions(UI.adminSort)+'</select></div>'+
    '<div id="admin-material-list"></div><nav id="admin-material-pages" class="page-controls admin-paginate"></nav></section>';
  $("#admin-item-new").onclick=()=>adminItemEditor();
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
  const cats=state.admin.categorias;
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Categorias</h2><p>Arraste para ordenar ou use as setas.</p></div>'+
    '<div class="buttons"><button class="primary-button" id="v2-new-category" type="button">'+iconSvg("plus",16)+' Nova categoria</button></div></div>'+
    '<div class="category-list" id="v2-category-list">'+cats.map((c,i)=>
    '<div class="category-row" data-category-id="'+c.id+'" draggable="true"><span class="drag-handle">'+iconSvg("grip")+'</span>'+
    '<strong>'+esc(c.nome)+'</strong><small>'+state.admin.componentes.filter(x=>x.categoria_id===c.id&&!isArchived(x)).length+' itens</small>'+
    '<div class="actions"><button type="button" class="square-action" data-cat-up="'+c.id+'" '+(i===0?"disabled":"")+' aria-label="Subir">'+iconSvg("up")+'</button>'+
    '<button type="button" class="square-action" data-cat-down="'+c.id+'" '+(i===cats.length-1?"disabled":"")+' aria-label="Descer">'+iconSvg("down")+'</button>'+
    '<button type="button" class="square-action" data-cat-edit="'+c.id+'" aria-label="Editar">'+iconSvg("edit")+'</button>'+
    '<button type="button" class="square-action danger" data-cat-delete="'+c.id+'" aria-label="Excluir">'+iconSvg("trash")+'</button></div></div>').join("")+'</div></section>';
  $("#v2-new-category").onclick=()=>editCategory();
  $$("[data-cat-up]").forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.catUp),-1));
  $$("[data-cat-down]").forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.catDown),1));
  $$("[data-cat-edit]").forEach(b=>b.onclick=()=>editCategory(Number(b.dataset.catEdit)));
  $$("[data-cat-delete]").forEach(b=>b.onclick=()=>adminDeleteCategory(Number(b.dataset.catDelete)));
  let dragged=null;
  $$(".category-row").forEach(el=>{
    el.ondragstart=e=>{dragged=Number(el.dataset.categoryId);el.classList.add("dragging");e.dataTransfer.effectAllowed="move";};
    el.ondragend=()=>{el.classList.remove("dragging");dragged=null;};
    el.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect="move";};
    el.ondrop=async e=>{
      e.preventDefault();const target=Number(el.dataset.categoryId);if(!dragged||target===dragged)return;
      const ids=state.admin.categorias.map(c=>c.id),a=ids.indexOf(dragged),b=ids.indexOf(target);
      if(a<0||b<0)return;ids.splice(b,0,...ids.splice(a,1));
      await commitCategoryOrder(ids);
    };
  });
}
async function commitCategoryOrder(ids){
  try{await api("/api/admin/category","POST",{acao:"ordenar",ordem:ids});await adminReload();adminBuild();toast("Ordem salva.");}
  catch(e){toast(e.message,true);}
}
async function adminDeleteCategory(id){
  const c=state.admin.categorias.find(x=>x.id===id);if(!c)return;
  if(!await niceModalConfirm("Excluir categoria?",c.nome+" deve estar vazia para ser excluída.","Excluir",true))return;
  try{await api("/api/admin/category","POST",{acao:"excluir",id});await adminReload();adminBuild();toast("Categoria excluída.");}
  catch(e){toast(e.message,true);}
}


/* Filamentos: só cor e quantidade, sem patrimônio nem empréstimo. */
const FILAMENT_PALETTE=[
  ["Preto","#24272C"],["Branco","#F4F5F1"],["Vermelho","#D83741"],
  ["Azul","#2A69D6"],["Verde","#2EAC6C"],["Amarelo","#F5D442"],
  ["Laranja","#F28C28"],["Rosa","#F18BC0"],["Roxo","#854CBF"],
  ["Cinza","#959CA6"],["Marrom","#895F47"],["Dourado","#CDA84B"]
];
function adminFilaments(root){
  const list=UI.filaments||[];
  root.innerHTML='<section class="admin-panel"><div class="admin-section-head"><div><h2>Filamentos</h2><p>Organize as cores e quantidades do PET.</p></div>'+
    '<div class="buttons"><button class="primary-button" id="filament-add" type="button">'+iconSvg("plus",16)+' Adicionar cor</button></div></div>'+
    '<div class="filament-admin-grid">'+(list.length?list.map(x=>
    '<div class="filament-admin-card">'+
      '<span class="filament-color-dot" style="background:'+attr(x.hexadecimal)+'" aria-hidden="true"></span>'+
      '<div class="filament-admin-label"><strong>'+esc(x.cor)+'</strong><small>Quantidade: <b>'+Number(x.quantidade)+'</b></small></div>'+
      '<div class="filament-admin-buttons"><button type="button" class="square-action" aria-label="Editar '+attr(x.cor)+'" title="Editar" data-filament-edit="'+x.id+'">'+iconSvg("edit")+'</button>'+
      '<button type="button" class="square-action danger" aria-label="Excluir '+attr(x.cor)+'" title="Excluir" data-filament-delete="'+x.id+'">'+iconSvg("trash")+'</button></div></div>').join(""):
      '<div class="empty-state">Nenhuma cor cadastrada. Adicione a primeira cor de filamento.</div>')+'</div></section>';
  $("#filament-add").onclick=()=>filamentEditor();
  $$("[data-filament-edit]",root).forEach(b=>b.onclick=()=>filamentEditor(Number(b.dataset.filamentEdit)));
  $$("[data-filament-delete]",root).forEach(b=>b.onclick=()=>deleteFilament(Number(b.dataset.filamentDelete)));
}
function filamentEditor(id){
  const color=(UI.filaments||[]).find(x=>x.id===id);
  const selected=color?.hexadecimal||"#2A69D6";
  openModal(color?"Editar filamento":"Adicionar cor de filamento","Apenas cor e quantidade.",
    '<form id="filament-form" class="modal-main">'+
    '<div class="filament-palette">'+FILAMENT_PALETTE.map(([name,hex])=>
      '<button type="button" class="filament-preset" style="--sample:'+hex+'" data-filament-choice="'+attr(name)+'" data-hex="'+hex+'" aria-label="Escolher '+attr(name)+'" title="'+attr(name)+'"><span></span></button>').join("")+'</div>'+
    '<div class="field-grid"><div class="field"><label for="filament-name">Cor</label><input id="filament-name" maxlength="55" required value="'+attr(color?.cor||"")+'" placeholder="Ex.: Azul royal"></div>'+
    '<div class="field"><label for="filament-hex">Escolher tonalidade</label><input type="color" id="filament-hex" value="'+selected+'"></div></div>'+
    '<div class="field"><label for="filament-quantity">Quantidade</label><div class="stepper"><button type="button" class="step" data-target="filament-quantity" data-delta="-1">−</button><input type="number" id="filament-quantity" value="'+Number(color?.quantidade||0)+'" min="0" max="1000000" required><button type="button" class="step" data-target="filament-quantity" data-delta="1">+</button></div></div>'+
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
      await api("/api/admin/filaments","POST",{acao:color?"editar":"criar",id:color?.id,cor:$("#filament-name").value,hexadecimal:$("#filament-hex").value,quantidade:Number($("#filament-quantity").value)});
      await refreshFilaments();closeModal();adminBuild();toast("Filamento salvo.");
    }catch(e){toast(e.message,true);btn.disabled=false;btn.textContent="Salvar";}
  };
}
async function deleteFilament(id){
  const x=(UI.filaments||[]).find(x=>x.id===id);if(!x)return;
  if(!await niceModalConfirm("Excluir esta cor?","Excluir "+x.cor+" do inventário de filamentos?","Excluir",true))return;
  try{await api("/api/admin/filaments","POST",{acao:"excluir",id});await refreshFilaments();adminBuild();toast("Cor excluída.");}
  catch(e){toast(e.message,true);}
}
