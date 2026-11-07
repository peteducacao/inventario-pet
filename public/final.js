/* Inventário PET — experiência final leve e responsiva, sem frameworks. */
const UI = {
  page:Math.max(1,Number(localStorage.getItem("pet_public_page")||1)),
  filaments:[],
  variantChoice:{},
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
    "tag":'<path d="M20 13 12 21 3 12V3h9l8 8a2 2 0 0 1 0 2Z"/><circle cx="7.5" cy="7.5" r="1"/>',
    "key":'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9 2 2-3 3 2 2-3 3-2-2-3 3"/>',
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
const stock=x=>Math.max(0,(Number(x.quantidade)||0)-(Number(x.em_uso)||0));
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
  // Apenas o catálogo público: informar total de páginas e manter a última
  // sempre clicável. O painel Admin conserva sua paginação independente.
  if(which==="public"){
    const pages=Math.max(1,Number(info.pages)||1);
    const current=Math.max(1,Math.min(pages,Number(info.page)||1));
    if(pages===1)return '<span class="page-info page-total">1 página</span>';
    const visible=new Set([1,pages]);
    for(let n=Math.max(1,current-1);n<=Math.min(pages,current+1);n++)visible.add(n);
    const ordered=[...visible].sort((a,b)=>a-b);
    let html='<button type="button" data-page="'+(current-1)+'" '+(current===1?"disabled":"")+' aria-label="Página anterior">‹</button>';
    let previous=0;
    for(const n of ordered){
      if(n-previous===2){
        html+='<button type="button" data-page="'+(n-1)+'" aria-label="Página '+(n-1)+'">'+(n-1)+'</button>';
      }else if(n-previous>2 && previous!==0){
        html+='<span class="page-gap" aria-hidden="true">…</span>';
      }
      const last=n===pages;
      html+='<button type="button" data-page="'+n+'" class="'+(current===n?"active":"")+'" aria-label="'+(last?"Última página, "+n:"Página "+n)+'" '+(last?'title="Ir para a última página" ':'')+(current===n?'aria-current="page"':"")+'>'+n+'</button>';
      previous=n;
    }
    html+='<button type="button" data-page="'+(current+1)+'" '+(current===pages?"disabled":"")+' aria-label="Próxima página">›</button>';
    html+='<span class="page-info page-total">'+pages+' páginas</span>';
    return html;
  }
  if(info.pages<=1)return "";
  const count=Math.min(info.pages,5),start=Math.min(Math.max(1,info.page-2),Math.max(1,info.pages-4));
  let html='<button type="button" data-page="'+Math.max(1,info.page-1)+'" '+(info.page===1?"disabled":"")+' aria-label="Página anterior">‹</button>';
  for(let n=start;n<start+count;n++)html+='<button type="button" data-page="'+n+'" class="'+(info.page===n?"active":"")+'" aria-label="Página '+n+'" '+(info.page===n?'aria-current="page"':"")+'>'+n+'</button>';
  html+='<button type="button" data-page="'+Math.min(info.pages,info.page+1)+'" '+(info.page===info.pages?"disabled":"")+' aria-label="Próxima página">›</button><span class="page-info">'+info.total+' itens</span>';
  return html;
}
// Ilustrações locais restauradas; sem URLs de fotos genéricas de terceiros.
function defaultImage(name){return componentArt(name);}
function itemImage(x){return imageForPETItem(x);}
function thumb(x,clazz="material-thumb"){
  const img=itemImage(x);
  return '<div class="'+clazz+'">'+(img?'<img src="'+attr(img)+'" alt="" loading="lazy" onerror="this.onerror=null;this.src=&quot;/img/reference-board.svg&quot;">':"")+'</div>';
}
function groupPublicMaterials(items){
  const list=[],byGroup=new Map();
  for(const item of items){
    const group=String(item.grupo_variacoes||"").trim().toLocaleLowerCase("pt-BR");
    if(item._filament||!group){list.push([item]);continue;}
    if(byGroup.has(group))byGroup.get(group).push(item);
    else{const arr=[item];list.push(arr);byGroup.set(group,arr);}
  }
  return list;
}
// A ordenação alfabética deve considerar o título visível de CADA CARD,
// e não o nome do primeiro componente usado para formar uma família.
// Os outros modos preservam sua ordenação original por material.
// Busca flexível: ESP32, ESP 32 e ESP-32 representam o mesmo nome.
function normalizedCatalogSearch(value){
  return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
}
function matchesCatalogSearch(value,query){
  const needle=normalizedCatalogSearch(query),haystack=normalizedCatalogSearch(value);
  if(!needle||haystack.includes(needle))return true;
  const compactNeedle=needle.replace(/[^a-z0-9]/g,"");
  return compactNeedle.length>=2&&haystack.replace(/[^a-z0-9]/g,"").includes(compactNeedle);
}
function orderedCatalogGroups(groups,sort){
  if(sort!=="az"&&sort!=="za")return groups;
  const title=group=>{
    const item=group[0]||{};
    return String(item._filament?item.cor:(item.grupo_variacoes||item.nome)||"").trim();
  };
  const compare=(a,b)=>title(a).localeCompare(title(b),"pt-BR",{sensitivity:"base",numeric:true});
  return [...groups].sort((a,b)=>{
    const order=compare(a,b);
    if(order)return sort==="za"?-order:order;
    return String(a[0]?.nome||"").localeCompare(String(b[0]?.nome||""),"pt-BR",{sensitivity:"base",numeric:true});
  });
}
function finalCard(original,siblings=[]){
  const familyName=String(original.grupo_variacoes||"").trim();
  const groupKey=familyName.toLocaleLowerCase("pt-BR");
  const selection=siblings.find(a=>a.id===UI.variantChoice[groupKey]);
  const grouped=Boolean(familyName)&&siblings.length>0;
  const x=selection||original;
  if(x._filament){
    const free=Math.max(0,Number(x.quantidade)-Number(x.em_uso||0));
    const member=identityIsMember();
    const enabled=Number(x.componente_id)>0&&Number(member?x.permitir_petianos:x.permitir_visitantes)===1&&Number(member?x.categoria_petianos:x.categoria_visitantes)===1;
    return '<article class="catalog-card filament-public-card" aria-label="Filamento '+attr(x.cor)+'">'+
      '<div class="filament-art" style="--filament-color:'+attr(x.hexadecimal)+'"><div class="filament-reel" aria-hidden="true"><div class="filament-reel-core"></div></div></div>'+
      '<div class="catalog-body"><span class="catalog-category">Filamentos</span><h3>'+esc(x.cor)+'</h3>'+
      '<div class="filament-quantity"><span>Quantidade <strong>'+Number(x.quantidade)+'</strong></span><span>Em uso <strong>'+Number(x.em_uso||0)+'</strong></span></div>'+
      '<div class="filament-quantity"><span>Disponíveis</span><strong>'+free+'</strong></div>'+
      '<button type="button" class="primary-button '+(member?"withdraw-button":"reserve-card-button")+'"'+(enabled&&free?' data-reserve-item="'+Number(x.componente_id)+'"':' disabled')+'>'+
      (member?"Retirar":"Reservar")+'</button></div></article>';
  }
  const showGroupTotals=grouped&&!selection;
  // Antes de escolher o modelo, mostrar a soma da família sem confundir
  // com o estoque de uma variação específica.
  const total=showGroupTotals?siblings.reduce((n,v)=>n+(Number(v.quantidade)||0),0):Number(x.quantidade)||0;
  const used=showGroupTotals?siblings.reduce((n,v)=>n+(Number(v.em_uso)||0),0):Number(x.em_uso)||0;
  const free=showGroupTotals?siblings.reduce((n,v)=>n+stock(v),0):stock(x);
  const status=free===0?"Sem estoque":used>free?"Em uso":"Disponível";
  const type=free===0?"empty":used>free?"busy":"";
  const img=itemImage(x),canWithdraw=identityIsMember(),loanOK=typeof borrowableItem==="function"?borrowableItem(x):true;
  const category=nameCategory(x.categoria_id);
  const asset=x.patrimonio?'Patrimônio: '+esc(x.patrimonio):x.identificacao?esc(x.identificacao):"";
  const statusIcon=type==="empty"?"×":type==="busy"?"◉":"✓";
  const groupedAction=grouped&&!selection;
  const openModel=grouped?'<button type="button" class="variant-open" data-open-variants="'+attr(groupKey)+'">'+
    (selection?'Trocar modelo':'Ver variações')+' <span aria-hidden="true">›</span></button>':"";
  const imageAction=grouped?'data-open-variants="'+attr(groupKey)+'"':'data-photo="'+x.id+'"';
  const photoLabel=grouped?'Escolher variação de '+original.grupo_variacoes:'Ampliar ilustração de '+x.nome;
  const action=groupedAction?
    '<button type="button" class="primary-button variant-main-button" data-open-variants="'+attr(groupKey)+'">'+iconSvg("box",16)+' Escolher modelo</button>':
    '<button type="button" class="primary-button '+(canWithdraw?"withdraw-button":"reserve-card-button")+'" data-reserve-item="'+x.id+'" '+(free===0||!loanOK?"disabled":"")+'>'+
    iconSvg(canWithdraw?"logout":"calendar",16)+' '+(canWithdraw?"Retirar":"Reservar")+'</button>';
  return '<article class="catalog-card'+(grouped?" grouped-card":"")+'"><button type="button" class="catalog-photo" '+imageAction+' aria-label="'+attr(photoLabel)+'">'+
    '<img src="'+attr(img)+'" alt="Ilustração de '+attr(x.nome)+'" loading="lazy" onerror="this.onerror=null;this.src=&quot;/img/reference-board.svg&quot;">'+
    '<span class="status-dot '+type+'"><span aria-hidden="true">'+statusIcon+'</span> '+status+'</span></button>'+
    '<div class="catalog-body"><h3>'+esc(familyName||x.nome)+'</h3><span class="catalog-category">'+iconSvg("box",13)+' '+esc(category)+'</span>'+
    (grouped?(selection?'<span class="variant-selected">Modelo escolhido: '+esc(selection.nome)+'</span>':"")+openModel:
      (familyName?'<span class="variant-selected">Modelo: '+esc(x.nome)+'</span>':""))+
    (asset&&!showGroupTotals?'<span class="catalog-asset" title="'+attr(asset)+'">'+asset+'</span>':"")+
    '<div class="catalog-numbers"><div><span>Quantidade</span><strong>'+total+'</strong></div><div><span>Em uso</span><strong>'+used+'</strong></div><div><span>Disponível</span><strong>'+free+'</strong></div></div>'+
    action+'</div></article>';
}
function openVariantChoices(groupKey){
  const group=String(groupKey||"").trim().toLocaleLowerCase("pt-BR");
  const variants=(state.data.componentes||[]).filter(item=>!isArchived(item)&&
    String(item.grupo_variacoes||"").trim().toLocaleLowerCase("pt-BR")===group);
  if(!variants.length)return;
  const title=variants[0].grupo_variacoes;
  const rows=variants.map(v=>{
    const quantity=Number(v.quantidade)||0,free=stock(v),used=Number(v.em_uso)||0;
    return '<button type="button" class="variant-picker-option" data-pick-variant="'+v.id+'" data-pick-group="'+attr(group)+'">'+
      '<span class="variant-picker-photo"><img src="'+attr(itemImage(v))+'" alt="" loading="lazy"></span>'+
      '<span class="variant-picker-details"><strong>'+esc(v.nome)+'</strong>'+
      '<small>'+free+' '+(free===1?"disponível":"disponíveis")+' · '+quantity+' no total · '+used+' em uso</small></span>'+
      '<span class="variant-picker-arrow" aria-hidden="true">›</span></button>';
  }).join("");
  openModal(title,"Escolha a variação. Cada modelo mantém seu próprio estoque e empréstimos.",
    '<div class="modal-main"><div class="variant-picker">'+rows+'</div></div>',{size:"wide"});
  $$("[data-pick-variant]",$("#modal-root")).forEach(button=>button.onclick=()=>{
    UI.variantChoice[group]=Number(button.dataset.pickVariant);
    closeModal();
    finalRender();
    document.querySelector('.grouped-card .variant-open')?.focus();
  });
}
function finalRender(){
  if(!$("#category-sections"))return;
  // Converter o antigo filtro local "filaments" para a categoria persistida no banco.
  if(UI.category==="filaments"){
    const category=(state.data.categorias||[]).find(c=>c.nome==="Filamentos");
    UI.category=category?String(category.id):"all";stored("pet_public_category",UI.category);
  }
  $("#demo-notice").hidden=!state.data.demonstracao;
  const ordinary=(state.data.componentes||[]).filter(x=>!isArchived(x)&&!/^FILAMENTO-\d+$/.test(String(x.import_key||"")));
  const colorItems=(UI.filaments||[]).map(x=>({...x,_filament:true,nome:"Filamento - "+x.cor,mostrar_quantidade:1}));
  const items=[...ordinary,...colorItems];
  // Uma categoria antiga pode ter sido arquivada após reorganização do acervo.
  // Não deixar usuários presos num filtro salvo que ficou sem itens.
  const validCategories=(state.data.categorias||[]).filter(c=>items.some(x=>Number(x.categoria_id)===Number(c.id)));
  if(UI.category!=="all"&&!validCategories.some(c=>String(c.id)===String(UI.category))){
    UI.category="all";UI.page=1;stored("pet_public_category",UI.category);
  }
  state.filter=UI.category;
  $("#stat-items").textContent=moneyless(items.length);
  $("#stat-stock").textContent=moneyless(ordinary.reduce((s,x)=>s+stock(x),0)+colorItems.reduce((s,x)=>s+Math.max(0,Number(x.quantidade)-Number(x.em_uso||0)-Number(x.com_defeito||0)),0));
  $("#stat-used").textContent=moneyless(ordinary.reduce((s,x)=>s+Number(x.em_uso||0),0)+colorItems.reduce((s,x)=>s+Number(x.em_uso||0),0));
  $("#category-filters").innerHTML=[{id:"all",nome:"Todos"},...(state.data.categorias||[]).filter(c=>ordinary.some(x=>x.categoria_id===c.id)||colorItems.some(x=>Number(x.categoria_id)===Number(c.id)))].map(c=>
    '<button type="button" class="chip '+(String(UI.category)===String(c.id)?"active":"")+'" data-category="'+attr(c.id)+'">'+esc(c.nome)+'</button>').join("");
  const q=String(state.query||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
  const inCategory=items.filter(x=>UI.category==="all"||String(x.categoria_id)===String(UI.category));
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const matches=x=>[x.nome,x.identificacao,x.patrimonio,x.grupo_variacoes].some(v=>matchesCatalogSearch(v,q));
  // Buscar pelo grupo ou por qualquer modelo deve manter todos os modelos
  // vinculados no mesmo card (não transformar um grupo num item solto).
  const matchingGroups=new Set(inCategory.filter(x=>q&&matches(x)&&x.grupo_variacoes)
    .map(x=>normalize(x.grupo_variacoes)));
  const filtered=inCategory.filter(x=>!q||matches(x)||
    (x.grupo_variacoes&&matchingGroups.has(normalize(x.grupo_variacoes))));
  // Ordenar depois do agrupamento: A–Z/Z–A precisam usar os nomes vistos pelo visitante.
  const p=paginate(orderedCatalogGroups(groupPublicMaterials(ordered(filtered,UI.sort)),UI.sort),UI.page,12);
  UI.page=p.page;stored("pet_public_page",p.page);
  $("#category-sections").innerHTML=p.total?'<div class="card-grid">'+p.items.map(group=>finalCard(group[0],group)).join("")+'</div>':
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
function showReturnFromAdminIdentityNotice(){
  if(state.identity)return;
  // O Admin tem senha própria; nunca atribuir uma identidade pessoal automaticamente.
  openModal("Verificar sua conta pessoal",
    "Sua sessão administrativa está ativa, mas você não entrou como PETiane ou visitante.",
    '<div class="modal-main"><p class="notice" style="margin:0 0 16px">Você pode consultar o catálogo sem conta. Para reservar ou acompanhar seus empréstimos, entre com seu login pessoal.</p>'+
    '<div class="modal-footer" style="border:0;padding:0;display:flex;flex-wrap:wrap;gap:10px">'+
    '<button type="button" id="post-admin-personal-login" class="primary-button">Entrar na minha conta</button>'+
    '<button type="button" id="post-admin-browse-catalog" class="outline-button">Consultar catálogo</button></div></div>');
  $("#post-admin-personal-login").onclick=()=>identityLoginModal(true);
  $("#post-admin-browse-catalog").onclick=closeModal;
}
function closeUserMenu(){document.querySelector(".pop-menu")?.remove();}
function openUserMenu(){
  closeUserMenu();
  const div=document.createElement("div");div.className="pop-menu";
  const u=state.identity;
  div.innerHTML=u?'<a href="/emprestimos/" data-user-act="loans">'+iconSvg("box")+' Meus empréstimos</a><button type="button" data-user-act="account">'+iconSvg("users")+' Minha conta</button><hr><button type="button" class="danger-text" data-user-act="signout">'+iconSvg("logout")+' Sair</button>':
    '<button type="button" data-user-act="login">'+iconSvg("users")+' Entrar</button><button type="button" data-user-act="register">'+iconSvg("plus")+' Criar conta</button>';
  document.body.appendChild(div);
  div.onclick=async e=>{
    const b=e.target.closest("[data-user-act]");if(!b)return;
    closeUserMenu();
    if(b.dataset.userAct==="login")identityLoginModal(true);
    if(b.dataset.userAct==="register")identityRegisterModal(true);
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
    '<div class="field" style="margin-top:12px"><label>Meu e-mail</label><input readonly value="'+attr(u.email||"")+'"></div>'+ 
    '<div class="identity-actions"><button type="button" class="secondary-button" id="v2-change-name">Alterar nome</button><button type="button" class="outline-button" id="v2-change-email">Alterar e-mail</button><button type="button" class="outline-button" id="v2-change-password">Alterar senha</button><button type="button" class="outline-button" id="v2-refresh-role">Atualizar cargo</button></div>'+
    '</div>');
  $("#v2-account-login").readOnly=true;$("#v2-account-name").readOnly=true;
  $("#v2-change-name").onclick=identityRenameModal;
  $("#v2-change-email").onclick=()=>identityEmailModal(false);
  $("#v2-change-password").onclick=()=>identityChangePasswordModal(false);
  $("#v2-refresh-role").onclick=async()=>{
    try{const r=await api("/api/identity/me");if(r.usuario){setIdentity(r.usuario);finalAccount();toast("Conta atualizada!");}else{setIdentity(null);identityLoginModal();}}catch(e){toast(e.message,true);}
  };
}
async function openMyLoans(){
  // Uma página independente, acessível também por nova guia.
  if(document.body.dataset.loansRoute!=="true"){window.location.assign("/emprestimos/");return;}
  const target=$("#loans-page-list");
  if(!target)return;
  if(!state.identity){
    target.innerHTML='<div class="loans-login-needed"><p>Entre na sua conta para consultar seus empréstimos e devoluções.</p><button type="button" class="primary-button" id="loans-page-login">Entrar na minha conta</button></div>';
    $("#loans-page-login").onclick=()=>identityLoginModal(true);
    return;
  }
  target.innerHTML='<div class="loans-page-loading">Carregando seus empréstimos…</div>';
  try{
    const response=await api("/api/my/loans");
    const loans=response.emprestimos||[];
    if(!document.contains(target))return;
    target.innerHTML=loans.length?'<div class="reservation-list loans-page-list">'+loans.map(r=>{
      const title=esc(r.componente_nome||"Material"),active=r.status==="retirada",pending=r.status==="pendente";
      const label={pendente:"Aguardando aprovação",aprovada:"Aprovada (registro antigo)",retirada:"Em uso",devolvida:"Devolvido",recusada:"Recusada",cancelada:"Cancelada"}[r.status]||r.status;
      const owner=(r.status==="recusada"?"Recusada":r.status==="aprovada"?"Aprovada anteriormente":null);
      const by=owner&&r.responsavel_admin?'<small class="loan-decision-by">'+owner+' por '+esc(r.responsavel_admin)+'</small>':"";
      return '<div class="admin-list-row"><div class="main-info"><strong>'+title+' · '+r.quantidade+' un.</strong><small>'+esc(formatDay(r.data_inicio))+' — '+esc(formatDay(r.data_devolucao))+'</small><span class="tag '+(pending?"pending":active?"picked":"")+'">'+esc(label)+'</span>'+by+'</div>'+
        (active?'<button type="button" class="primary-button small-button" data-my-return="'+r.id+'">Registrar devolução</button>':'')+'</div>';
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
  const identityId=state.identity?.id;
  if(!identityId){
    UI.notifications=[];
    const b=$("#notification-count");if(b){b.hidden=true;b.textContent="0";}
    return false;
  }
  try{
    const r=await api("/api/notifications");
    // Evitar dados do usuário anterior quando a conta muda durante a requisição.
    if(state.identity?.id!==identityId)return false;
    UI.notifications=r.notificacoes||[];
    const b=$("#notification-count");
    if(b){b.hidden=!r.nao_lidas;b.textContent=String(Math.min(99,r.nao_lidas||0));}
    return true;
  }catch(error){console.warn("Falha em notificações:",error.message);return false;}
}
function setupFinalPublic(){
  render=finalRender;
  if(document.body.dataset.adminRoute==="true")return;
  identityProfileModal=finalAccount;
  memberHistoryModal=openMyLoans;
  for(const field of [$("#search"),$("#search-mobile")].filter(Boolean)){
    field.value=state.query||"";
    field.oninput=e=>{
      state.query=e.target.value;UI.page=1;
      for(const other of [$("#search"),$("#search-mobile")].filter(Boolean))if(other!==field)other.value=state.query;
      finalRender();
    };
  }
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
  $("#notification-button").onclick=async()=>{
    if(!state.identity){identityLoginModal();return;}
    if(!$("#notification-popover").hidden){openMyNotificationPopover();return;}
    await refreshNotifications();
    openMyNotificationPopover();
  };
  // app.js carrega um handler legado; links reais devem usar navegação nativa.
  if($("#admin-button")?.tagName==="A")$("#admin-button").onclick=null;
  const menuButton=$("#public-menu-toggle");
  const drawer=$("#public-sidebar");
  const veil=$("#public-nav-overlay");
  function togglePublicMenu(open){
    document.body.classList.toggle("public-nav-open",Boolean(open));
    if(veil)veil.hidden=!open;
    if(menuButton)menuButton.setAttribute("aria-expanded",String(Boolean(open)));
  }
  if(menuButton)menuButton.onclick=()=>togglePublicMenu(!document.body.classList.contains("public-nav-open"));
  if($("#public-nav-close"))$("#public-nav-close").onclick=()=>togglePublicMenu(false);
  if(veil)veil.onclick=()=>togglePublicMenu(false);
  if(drawer){
    // Links reais preservam o menu de contexto e a abertura em nova guia.
    drawer.querySelectorAll("[data-public-action]").forEach(link=>
      link.addEventListener("click",()=>togglePublicMenu(false)));
  }
  $("#reserve-button").onclick=()=>{
    if(!state.identity){identityLoginModal();return;}
    if(identityIsMember())memberWithdrawModal();else reserveModal(null);
  };
  $("#category-sections").addEventListener("click",event=>{
    const choice=event.target.closest("[data-variant-id]");
    if(choice){UI.variantChoice[choice.dataset.variantGroup]=Number(choice.dataset.variantId);finalRender();return;}
    const b=event.target.closest("[data-reserve-item]");
    if(b&&!state.identity){event.stopImmediatePropagation();identityLoginModal();}
  },true);
  document.addEventListener("click",event=>{
    if(!event.target.closest("#profile-button,.pop-menu"))closeUserMenu();
    if(!event.target.closest("#notification-button,#notification-popover"))$("#notification-popover").hidden=true;
  });
  // O carregamento inicial ocorre em app.js; atualizar também ao voltar ao navegador.
  window.addEventListener("focus",()=>{if(state.identity)refreshNotifications();});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.identity)refreshNotifications();});
  setInterval(()=>{if(state.identity)refreshNotifications()},90000);
  // Admin possui endereço independente.
}

async function refreshFilaments(){const data=await api("/api/filaments");UI.filaments=data.filamentos||[];finalRender();}
