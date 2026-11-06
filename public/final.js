/* Inventário PET — experiência final leve e responsiva, sem frameworks. */
const UI = {
  page:Math.max(1,Number(localStorage.getItem("pet_public_page")||1)),
  filaments:[],
  category:localStorage.getItem("pet_public_category")||"all",
  sort:localStorage.getItem("pet_public_sort")||"az",
  adminTab:localStorage.getItem("pet_admin_tab")||"painel",
  adminPage:Math.max(1,Number(localStorage.getItem("pet_admin_page")||1)),
  adminSort:localStorage.getItem("pet_admin_sort")||"az",
  adminCategory:localStorage.getItem("pet_admin_category")||"all",
  adminSearch:localStorage.getItem("pet_admin_search")||"",
  reservationFilter:localStorage.getItem("pet_admin_reservas")||"pendente",
  reservationPage:1,
  userSearch:"",
  notifications:[],
  summaryMinimized:localStorage.getItem("pet_public_summary_closed")==="1",
  adminSummaryMinimized:localStorage.getItem("pet_admin_summary_closed")==="1"
};
const stored=(key,val)=>{try{localStorage.setItem(key,String(val))}catch{}};
const iconSvg=(name,size=19)=>{
  const shapes={
    "grid":'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    "box":'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>',
    "calendar":'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/>',
    "users":'<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M17 4a4 4 0 0 1 0 8M17 16a5 5 0 0 1 5 5"/>',
    "layers":'<rect x="3" y="4" width="7" height="7" rx="1.5"/><rect x="14" y="4" width="7" height="7" rx="1.5"/><rect x="3" y="15" width="7" height="7" rx="1.5"/><rect x="14" y="15" width="7" height="7" rx="1.5"/>',
    "settings":'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    "search":'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    "edit":'<path d="m4 17-.7 4 4-.7L20 7.5 16.5 4 4 17ZM14 6.5l3.5 3.5"/>',
    "trash":'<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v7M14 11v7"/>',
    "eye":'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    "check":'<path d="m4 12 5 5L20 6"/>',
    "logout":'<path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10"/>',
    "menu":'<path d="M3 6h18M3 12h18M3 18h18"/>',
    "close":'<path d="M5 5l14 14M19 5 5 19"/>',
    "bell":'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    "plus":'<path d="M12 4v16M4 12h16"/>',
    "sort":'<path d="M4 8h13M4 12h9M4 16h5M18 16l3 3 3-3" />',
    "back":'<path d="m15 5-7 7 7 7M8 12h14"/>',
    "chevron":'<path d="m8 4 8 8-8 8"/>',
    "up":'<path d="m6 15 6-6 6 6"/>',
    "down":'<path d="m6 9 6 6 6-6"/>',
    "grip":'<circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/>'
  };
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[name]||shapes.box)+'</svg>';
};
const identityIsMember=()=>state.identity?.tag==="petiano"&&!state.identity?.trocar_senha&&!state.identity?.precisa_criar_login;
const isArchived=x=>Number(x.arquivado)===1;
const stock=x=>Number(x.mostrar_quantidade)===1?Math.max(0,(Number(x.quantidade)||0)-(Number(x.em_uso)||0)-(Number(x.com_defeito)||0)):0;
const niceDate=x=>x?fmt(x):"—";
const ordered=(array,sort)=>{
  const arr=[...array];const cmp=(a,b)=>a.nome.localeCompare(b.nome,"pt-BR",{sensitivity:"base"});
  if(sort==="za")arr.sort((a,b)=>-cmp(a,b));
  else if(sort==="recent")arr.sort((a,b)=>Date.parse(String(b.ultima_alteracao).replace(" ","T"))-Date.parse(String(a.ultima_alteracao).replace(" ","T"))||cmp(a,b));
  else if(sort==="old")arr.sort((a,b)=>Date.parse(String(a.ultima_alteracao).replace(" ","T"))-Date.parse(String(b.ultima_alteracao).replace(" ","T"))||cmp(a,b));
  else if(sort==="available")arr.sort((a,b)=>stock(b)-stock(a)||cmp(a,b));
  else if(sort==="less")arr.sort((a,b)=>stock(a)-stock(b)||cmp(a,b));
  else arr.sort(cmp);
  return arr;
};
function paginate(array,page,limit=6){const pages=Math.max(1,Math.ceil(array.length/limit));const current=Math.max(1,Math.min(pages,Number(page)||1));return {items:array.slice((current-1)*limit,current*limit),page:current,pages,total:array.length};}
function pageButtons(info,which){
  if(info.pages<=1)return "";
  const count=Math.min(info.pages,5),start=Math.min(Math.max(1,info.page-2),Math.max(1,info.pages-4));
  let html='<button type="button" data-page="'+Math.max(1,info.page-1)+'" '+(info.page===1?"disabled":"")+' aria-label="Página anterior">‹</button>';
  for(let n=start;n<start+count;n++)html+='<button type="button" data-page="'+n+'" class="'+(info.page===n?"active":"")+'" aria-label="Página '+n+'" '+(info.page===n?'aria-current="page"':"")+'>'+n+'</button>';
  html+='<button type="button" data-page="'+Math.min(info.pages,info.page+1)+'" '+(info.page===info.pages?"disabled":"")+' aria-label="Próxima página">›</button><span class="page-info">'+info.total+' itens</span>';
  return html;
}
// Fotos reais de referência (Wikimedia Commons), em resolução ajustada pelo CDN.
// Referências ilustrativas não indicam necessariamente marca ou modelo exatos do acervo.
const realPhoto=(name)=>{
 const file=encodeURIComponent(name).replace(/%2F/g,"/");
 return "https://commons.wikimedia.org/wiki/Special:FilePath/"+file+"?width=800";
};
const PET_PHOTOS={
  generic:realPhoto("Electronic_components.jpg"),
  esp32:realPhoto("ESP32_Dev_Board.jpg"),
  arduino:realPhoto("Arduino_Uno_board.jpg"),
  tablet:realPhoto("Samsung_galaxy_tab_a7_2020.jpg"),
  notebook:realPhoto("Laptop_image.jpg"),
  motor:realPhoto("Dc_motors.jpg"),
  pen:realPhoto("BALL_PEN.jpg")
};
function defaultImage(name){
  const n=String(name||"").toLowerCase();
  if(/esp\s*32/.test(n))return PET_PHOTOS.esp32;
  if(/arduino|protoboard/.test(n))return PET_PHOTOS.arduino;
  if(/tablet/.test(n))return PET_PHOTOS.tablet;
  if(/notebook|laptop/.test(n))return PET_PHOTOS.notebook;
  if(/motor dc|mini motor|motor de passo|motor de posso/.test(n))return PET_PHOTOS.motor;
  if(/caneta|esferográfica/.test(n))return PET_PHOTOS.pen;
  return PET_PHOTOS.generic;
}
function itemImage(x){
  const img=String(x.imagem||"").trim();
  return img && !/^\/img\/reference-(?:board|electronics|motor|tablet|notebook)\.svg$/i.test(img)?img:defaultImage(x.nome);
}
function thumb(x,clazz="material-thumb"){
  const img=itemImage(x);
  return '<div class="'+clazz+'">'+(img?'<img src="'+attr(img)+'" alt="" loading="lazy" onerror="this.onerror=null;this.src='/img/reference-board.svg'">':"")+'</div>';
}
function finalCard(x){
  if(x._filament){
    return '<article class="catalog-card filament-public-card" aria-label="Filamento '+attr(x.cor)+'">'+
      '<div class="filament-art" style="--filament-color:'+attr(x.hexadecimal)+'"><div class="filament-reel" aria-hidden="true"><div class="filament-reel-core"></div></div></div>'+
      '<div class="catalog-body"><span class="catalog-category">Filamentos</span><h3>'+esc(x.cor)+'</h3>'+
      '<div class="filament-quantity">Quantidade <strong>'+Number(x.quantidade)+'</strong></div></div></article>';
  }
  const free=stock(x),status=free>0?"Disponível":"Sem estoque",type=free===0?"empty":Number(x.em_uso)>0?"busy":"";
  const img=itemImage(x);
  const canWithdraw=identityIsMember();
  const label=canWithdraw?"Retirar":"Reservar";
  const category=nameCategory(x.categoria_id);
  const asset=x.patrimonio?'Patrimônio: '+esc(x.patrimonio):x.identificacao?esc(x.identificacao):"";
  return '<article class="catalog-card"><button type="button" class="catalog-photo" '+(img?'data-photo="'+x.id+'"':'disabled')+' aria-label="Ampliar foto de '+attr(x.nome)+'">'+
    (img?'<img src="'+attr(img)+'" alt="'+attr(x.nome)+'" loading="lazy" onerror="this.onerror=null;this.src='/img/reference-board.svg'">':'<span class="no-photo"></span>')+
    '<span class="status-dot '+type+'">'+status+'</span></button>'+
    '<div class="catalog-body"><h3>'+esc(x.nome)+'</h3><span class="catalog-category">'+esc(category)+'</span><span class="catalog-asset" title="'+attr(asset)+'">'+(asset||' ')+'</span>'+
    '<div class="catalog-numbers"><div><span>Qtd.</span><strong>'+Number(x.quantidade)+'</strong></div><div><span>Em uso</span><strong>'+Number(x.em_uso)+'</strong></div><div><span>Defeito</span><strong class="'+(Number(x.com_defeito)?"stock-defect":"")+'">'+Number(x.com_defeito)+'</strong></div></div>'+
    '<button type="button" class="primary-button" data-reserve-item="'+x.id+'" '+(free===0?"disabled":"")+'>'+label+'</button></div></article>';
}
function finalRender(){
  if(!$("#category-sections"))return;
  state.filter=UI.category;
  $("#demo-notice").hidden=!state.data.demonstracao;
  const ordinary=(state.data.componentes||[]).filter(x=>!isArchived(x));
  const colorItems=(UI.filaments||[]).map(x=>({...x,_filament:true,nome:x.cor,categoria_id:"filaments",em_uso:0,com_defeito:0,mostrar_quantidade:1}));
  const items=[...ordinary,...colorItems];
  $("#stat-items").textContent=moneyless(items.length);
  $("#stat-stock").textContent=moneyless(ordinary.reduce((s,x)=>s+stock(x),0)+colorItems.reduce((s,x)=>s+Number(x.quantidade),0));
  $("#stat-used").textContent=moneyless(ordinary.reduce((s,x)=>s+Number(x.em_uso||0),0));
  $("#stat-broken").textContent=moneyless(ordinary.reduce((s,x)=>s+Number(x.com_defeito||0),0));
  $("#category-filters").innerHTML=[{id:"all",nome:"Todos"},...(state.data.categorias||[]).filter(c=>ordinary.some(x=>x.categoria_id===c.id)),{id:"filaments",nome:"Filamentos"}].map(c=>
    '<button type="button" class="chip '+(String(UI.category)===String(c.id)?"active":"")+'" data-category="'+attr(c.id)+'">'+esc(c.nome)+'</button>').join("");
  const q=(state.query||"").toLocaleLowerCase("pt-BR").trim();
  const filtered=items.filter(x=>(UI.category==="all"||String(x.categoria_id)===String(UI.category))&&
    (!q||[x.nome,x.identificacao,x.patrimonio].some(v=>String(v||"").toLocaleLowerCase("pt-BR").includes(q))));
  const p=paginate(ordered(filtered,UI.sort),UI.page);
  UI.page=p.page;stored("pet_public_page",p.page);
  $("#category-sections").innerHTML=p.total?'<div class="card-grid">'+p.items.map(finalCard).join("")+'</div>':
    '<div class="empty-state"><strong>Nenhum material encontrado.</strong><p>Experimente outro filtro.</p></div>';
  $("#catalog-pagination").innerHTML=pageButtons(p,"public");
  $("#profile-name").textContent=state.identity?.nome||"Entrar";
  $("#header-avatar").textContent=(state.identity?.nome||"P").charAt(0).toUpperCase();
  $("#admin-button-text").textContent="Admin";
  const member=identityIsMember();
  $("#reserve-button").textContent=member?"Registrar retirada":"Solicitar reserva";
  $("#summary").classList.toggle("collapsed",UI.summaryMinimized);
  $("#stats-toggle").setAttribute("aria-expanded",String(!UI.summaryMinimized));
  $("#stats-toggle-text").textContent=UI.summaryMinimized?"Mostrar":"Minimizar";
  const updated=[...ordinary.map(x=>x.ultima_alteracao),...colorItems.map(x=>x.atualizado_em)].filter(Boolean).sort().at(-1);
  $("#last-updated").textContent=updated?"Última atualização: "+niceDate(updated):"";
}
function niceModalConfirm(title,message,confirmText="Confirmar",danger=false){
  return new Promise(resolve=>{
    openModal(title,"",'<div class="confirm-body"><p>'+esc(message)+'</p><div class="confirm-actions"><button type="button" class="secondary-button" id="v2-cancel">Cancelar</button><button type="button" class="'+(danger?"danger-button":"primary-button")+'" id="v2-confirm">'+esc(confirmText)+'</button></div></div>');
    $("#v2-cancel").onclick=()=>{closeModal();resolve(false);};
    $("#v2-confirm").onclick=()=>{closeModal();resolve(true);};
    const close=$("#modal-root [data-close]");if(close)close.onclick=()=>{closeModal();resolve(false);};
  });
}
function flashPopup(title,text){
  openModal(title,"",'<div class="confirm-body"><p>'+esc(text||"")+'</p><div class="confirm-actions"><button class="primary-button" type="button" id="v2-done">Entendi</button></div></div>');
  $("#v2-done").onclick=closeModal;
}
function closeUserMenu(){document.querySelector(".pop-menu")?.remove();}
function openUserMenu(){
  closeUserMenu();
  const div=document.createElement("div");div.className="pop-menu";
  const u=state.identity;
  div.innerHTML=u?'<button type="button" data-user-act="loans">'+iconSvg("box")+' Meus empréstimos</button><button type="button" data-user-act="account">'+iconSvg("users")+' Minha conta</button><hr><button type="button" class="danger-text" data-user-act="signout">'+iconSvg("logout")+' Sair</button>':
    '<button type="button" data-user-act="login">'+iconSvg("users")+' Entrar</button><button type="button" data-user-act="register">'+iconSvg("plus")+' Criar conta</button>';
  document.body.appendChild(div);
  div.onclick=async e=>{
    const b=e.target.closest("[data-user-act]");if(!b)return;
    closeUserMenu();
    if(b.dataset.userAct==="login")identityLoginModal(true);
    if(b.dataset.userAct==="register")identityRegisterModal(true);
    if(b.dataset.userAct==="loans")openMyLoans();
    if(b.dataset.userAct==="account")identityProfileModal();
    if(b.dataset.userAct==="signout"){
      if(await niceModalConfirm("Sair da conta?","Você poderá entrar novamente com seu login e senha.","Sair",true)){
        await api("/api/identity/logout","POST",{});setIdentity(null);flashPopup("Até logo!","Você saiu da sua conta.");
      }
    }
  };
}
function finalAccount(){
  const u=state.identity;if(!u)return identityLoginModal();
  if(u.precisa_criar_login)return identityUpgradeModal();
  if(u.trocar_senha)return identityChangePasswordModal(true);
  const cls=u.tag==="petiano"?"picked":"";
  openModal("Minha conta","",'<div class="modal-main">'+
    '<div class="identity-profile-head"><span class="identity-avatar">'+esc(u.nome[0].toUpperCase())+'</span><div><strong>'+esc(u.nome)+'</strong><span class="tag '+cls+'">'+(u.tag==="petiano"?"PETiano":"Visitante")+'</span></div></div>'+
    '<div class="field-grid">'+inputField("v2-account-name","Nome",u.nome,{max:80})+inputField("v2-account-login","Login",u.login,{max:24})+'</div>'+
    '<div class="identity-actions"><button type="button" class="secondary-button" id="v2-change-name">Alterar nome</button><button type="button" class="outline-button" id="v2-change-password">Alterar senha</button><button type="button" class="outline-button" id="v2-refresh-role">Atualizar tag</button></div>'+
    '</div>');
  $("#v2-account-login").readOnly=true;$("#v2-account-name").readOnly=true;
  $("#v2-change-name").onclick=identityRenameModal;
  $("#v2-change-password").onclick=()=>identityChangePasswordModal(false);
  $("#v2-refresh-role").onclick=async()=>{
    try{const r=await api("/api/identity/me");if(r.usuario){setIdentity(r.usuario);finalAccount();toast("Conta atualizada!");}else{setIdentity(null);identityLoginModal();}}catch(e){toast(e.message,true);}
  };
}
async function openMyLoans(){
  if(!state.identity){identityLoginModal();return;}
  openModal("Meus empréstimos","",'<div class="modal-main" id="v2-my-loans">Carregando…</div>',{size:"wide"});
  const target=$("#v2-my-loans");
  try{
    const response=await api("/api/my/loans");
    const loans=response.emprestimos||[];
    if(!document.contains(target))return;
    target.innerHTML=loans.length?'<div class="reservation-list">'+loans.map(r=>{
      const title=esc(r.componente_nome||"Material"),active=r.status==="retirada",pending=r.status==="pendente";
      const label={pendente:"Pendente",aprovada:"Aprovada",retirada:"Em uso",devolvida:"Devolvido",recusada:"Recusada",cancelada:"Cancelada"}[r.status]||r.status;
      return '<div class="admin-list-row"><div class="main-info"><strong>'+title+' · '+r.quantidade+' un.</strong><small>'+esc(formatDay(r.data_inicio))+' — '+esc(formatDay(r.data_devolucao))+'</small><span class="tag '+(pending?"pending":active?"picked":"")+'">'+esc(label)+'</span></div>'+
        (active&&r.tipo==="retirada_direta"&&identityIsMember()?'<button type="button" class="primary-button small-button" data-my-return="'+r.id+'">Devolver</button>':'')+'</div>';
    }).join("")+'</div>':'<div class="empty-state">Você ainda não possui empréstimos.</div>';
    $$("[data-my-return]",target).forEach(button=>button.onclick=()=>memberReturnModal(loans.find(r=>r.id===Number(button.dataset.myReturn))));
  }catch(error){if(document.contains(target))target.textContent=error.message;}
}
function openMyNotificationPopover(){
  closeUserMenu();
  const host=$("#notification-popover");if(!host)return;
  if(!host.hidden){host.hidden=true;return;}
  host.hidden=false;const notices=UI.notifications||[];
  host.innerHTML='<div class="notice-head"><strong>Notificações</strong><button type="button" id="v2-mark-all">Marcar como lidas</button></div>'+
    '<div class="notice-list">'+(notices.length?notices.map(n=>
      '<div class="notice-item '+(n.lida_em?"":"unread")+'"><strong>'+esc(n.titulo)+'</strong><p>'+esc(n.mensagem)+'</p><small>'+esc(niceDate(n.criada_em))+'</small></div>').join(""):'<div class="empty-state">Nenhuma notificação por enquanto.</div>')+'</div>';
  $("#v2-mark-all").onclick=async()=>{try{await api("/api/notifications/read","POST",{todos:true});await refreshNotifications();openMyNotificationPopover();openMyNotificationPopover();}catch(e){toast(e.message,true)}};
}
async function refreshNotifications(){
  try{
    const r=await api("/api/notifications");UI.notifications=r.notificacoes||[];
    const b=$("#notification-count");b.hidden=!r.nao_lidas;b.textContent=String(Math.min(99,r.nao_lidas||0));
  }catch(error){console.warn("Falha em notificações:",error.message);}
}
function setupFinalPublic(){
  render=finalRender;
  identityProfileModal=finalAccount;
  memberHistoryModal=openMyLoans;
  $("#search").value=state.query||"";
  $("#search").oninput=e=>{state.query=e.target.value;UI.page=1;finalRender();};
  $("#catalog-sort").value=UI.sort;
  $("#catalog-sort").onchange=e=>{UI.sort=e.target.value;UI.page=1;stored("pet_public_sort",UI.sort);finalRender();};
  $("#category-filters").addEventListener("click",event=>{
    const b=event.target.closest("[data-category]");if(!b)return;
    UI.category=b.dataset.category;UI.page=1;stored("pet_public_category",UI.category);finalRender();
  });
  $("#catalog-pagination").onclick=e=>{
    const b=e.target.closest("[data-page]");if(!b)return;
    UI.page=Number(b.dataset.page);stored("pet_public_page",UI.page);finalRender();
    $("#category-sections").scrollIntoView({behavior:"smooth",block:"start"});
  };
  $("#stats-toggle").onclick=()=>{UI.summaryMinimized=!UI.summaryMinimized;stored("pet_public_summary_closed",UI.summaryMinimized?"1":"0");finalRender();};
  $("#profile-button").onclick=openUserMenu;
  $("#notification-button").onclick=()=>{if(!state.identity){identityLoginModal();return;}openMyNotificationPopover();};
  $("#admin-button").onclick=enterAdmin;
  $("#reserve-button").onclick=()=>{
    if(!state.identity){identityLoginModal();return;}
    if(identityIsMember())memberWithdrawModal();else reserveModal(null);
  };
  $("#category-sections").addEventListener("click",event=>{
    const b=event.target.closest("[data-reserve-item]");
    if(b&&!state.identity){event.stopImmediatePropagation();identityLoginModal();}
  },true);
  document.addEventListener("click",event=>{
    if(!event.target.closest("#profile-button,.pop-menu"))closeUserMenu();
    if(!event.target.closest("#notification-button,#notification-popover"))$("#notification-popover").hidden=true;
  });
  try{finalRender()}catch(e){console.warn("Aguardando catálogo",e.message);}
  refreshFilaments().catch(error=>console.warn("Filamentos:",error.message));
  api("/api/identity/me").then(r=>{
    if(r.usuario&&!state.identity){setIdentity(r.usuario);refreshNotifications();}
  }).catch(()=>{});
  if(state.identity)refreshNotifications();
  setInterval(()=>{if(state.identity)refreshNotifications()},90000);
  if(localStorage.getItem("pet_admin_open")==="1")setTimeout(()=>enterAdmin(true),200);
}

async function refreshFilaments(){const data=await api("/api/filaments");UI.filaments=data.filamentos||[];finalRender();}
