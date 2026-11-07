/* Inventário PET Educação — interface leve, sem frameworks. */
"use strict";
const state = { data:{categorias:[],componentes:[],demonstracao:false}, admin:null, tab:"materiais", filter:"all", query:"", actor:localStorage.getItem("pet_inventario_nome")||"", identity:null, busy:false, modal:null };
const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => Array.from(root.querySelectorAll(s));
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const attr = esc;
const fmt = iso => {if(!iso)return "Sem registro";const d = new Date(iso);return Number.isNaN(d.getTime())?String(iso):new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)};
const formatDay = d => d ? d.split("-").reverse().join("/") : "—";
const localDate = (d=new Date()) => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
const iconFor = name => {const n=(name||"").toLowerCase();return n.includes("eletr")?"⚡":n.includes("papel")?"📎":n.includes("ferr")?"🛠️":n.includes("equip")?"💻":n.includes("mec")?"⚙️":n.includes("impress")?"🖨️":"📦"};
const flag = x => Number(x)===1;
const byId = id => state.data.componentes.find(x=>x.id===Number(id));
const nameCategory = id => state.data.categorias.find(x=>x.id===id)?.nome||"Sem categoria";
const moneyless = n => new Intl.NumberFormat("pt-BR").format(Number(n)||0);
const available = x => flag(x.mostrar_quantidade)?Math.max(0,x.quantidade-x.em_uso-x.com_defeito):0;
let toastTimer;
function toast(message,error=false) {
  const el=$("#toast"); el.textContent=message;el.classList.toggle("error",error);el.classList.add("visible");
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("visible"),3600);
}
async function api(path, method="GET", body) {
  const init={method,credentials:"same-origin",headers:{}};
  if(body!==undefined){init.headers["content-type"]="application/json";init.body=JSON.stringify(body);}
  let result;
  try { result=await fetch(path,init); } catch { throw Error("Falha de conexão com o servidor."); }
  let data;
  try {data=await result.json()}catch{throw Error("O servidor não respondeu corretamente.");}
  if(!result.ok)throw Error(data.error||"Não foi possível concluir.");
  return data;
}
async function publicReload(){
  const data=await api("/api/catalog");
  state.data=data;
  $("#offline-alert").hidden=true;
  render();
}
async function adminReload(){
  state.admin=await api("/api/admin/state");
  await publicReload();
}
function render(){
  $("#demo-notice").hidden=!state.data.demonstracao;
  const all=state.data.componentes;
  $("#stat-items").textContent=moneyless(all.length);
  $("#stat-stock").textContent=moneyless(all.reduce((a,x)=>a+available(x),0));
  $("#stat-used").textContent=moneyless(all.reduce((a,x)=>a+(flag(x.mostrar_em_uso)?x.em_uso:0),0));
  $("#stat-broken").textContent=moneyless(all.reduce((a,x)=>a+(flag(x.mostrar_defeito)?x.com_defeito:0),0));
  const cats=state.data.categorias;
  $("#category-filters").innerHTML=[{id:"all",nome:"Todos"},...cats].map(c=>'<button type="button" class="chip '+(String(state.filter)===String(c.id)?"active":"")+'" data-category="'+esc(c.id)+'">'+esc(c.nome)+'</button>').join("");
  const query=state.query.toLocaleLowerCase("pt-BR").trim();
  const sections=cats.filter(c=>state.filter==="all"||state.filter===String(c.id)).map(c=>{
    const items=all.filter(x=>x.categoria_id===c.id&&(!query||[x.nome,x.patrimonio,x.identificacao].some(v=>String(v??"").toLocaleLowerCase("pt-BR").includes(query))));
    if(!items.length)return "";
    return '<section><div class="category-heading"><h3>'+esc(c.nome)+'</h3><span>'+items.length+' '+(items.length===1?"material":"materiais")+'</span></div><div class="card-grid">'+items.map(x=>card(x,c.nome)).join("")+'</div></section>';
  }).join("");
  $("#category-sections").innerHTML=sections||'<div class="empty-state"><strong>Nenhum material encontrado.</strong><p>Tente outro nome ou categoria.</p></div>';
  $("#profile-name").textContent=state.actor||"PETiane";
  $("#header-avatar").textContent=(state.actor||"P").slice(0,1).toUpperCase();
  $("#admin-button-text").textContent=state.admin?"Painel":"Administração";
  const isMember=state.identity?.tag==="petiano" && !state.identity?.precisa_criar_login && !state.identity?.trocar_senha;
  $("#reserve-button").innerHTML=isMember?'✓ Registrar retirada':'◷ Solicitar reserva';
  $("#profile-button").title=state.identity?state.identity.nome+" · "+(isMember?"PETiano":"Visitante")+" · "+state.identity.id:"Criar meu perfil";
}
function card(x, category){
  const img=x.imagem?'<img loading="lazy" src="'+attr(x.imagem)+'" alt="Fotografia de '+attr(x.nome)+'" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="fallback-icon" hidden>'+iconFor(category)+'</span>':'<span class="fallback-icon">'+iconFor(category)+'</span>';
  const status=!flag(x.mostrar_quantidade)?'<span class="stock-none">Sem estoque</span>':'<div class="count-row">'+
    '<div class="count-pill good"><span>Disponível</span><strong>'+moneyless(available(x))+'</strong></div>'+
    '<div class="count-pill"><span>Quantidade</span><strong>'+moneyless(x.quantidade)+'</strong></div>'+
    (flag(x.mostrar_em_uso)?'<div class="count-pill"><span>Em uso</span><strong>'+moneyless(x.em_uso)+'</strong></div>':"")+
    (flag(x.mostrar_defeito)?'<div class="count-pill '+(x.com_defeito?"bad":"")+'"><span>Com defeito</span><strong>'+moneyless(x.com_defeito)+'</strong></div>':"")+'</div>';
  return '<article class="item-card"><button class="item-photo" type="button" data-photo="'+x.id+'" aria-label="Ampliar fotografia de '+attr(x.nome)+'">'+img+(state.data.demonstracao?'<span class="test-tag">EXEMPLO</span>':"")+'</button><div class="item-body"><div class="item-name">'+esc(x.nome)+'</div><div class="item-meta">'+(x.identificacao?esc(x.identificacao)+' · ':"")+(x.patrimonio?'Patrimônio: '+esc(x.patrimonio):'Sem número de patrimônio cadastrado')+'</div>'+status+
    (flag(x.mostrar_defeito)&&x.com_defeito&&x.descricao_defeito?'<button class="link-button" style="text-align:left;margin-top:11px" data-defect="'+x.id+'">ⓘ Ver informações do defeito</button><div class="expand-defect" id="defect-'+x.id+'" hidden>'+esc(x.descricao_defeito)+'</div>':"")+
    '<div class="item-footer"><span class="date-small">Atualizado: '+esc(fmt(x.ultima_alteracao))+'</span><button class="link-button" data-reserve-item="'+x.id+'" type="button">'+(state.identity?.tag==='petiano' && !state.identity?.precisa_criar_login && !state.identity?.trocar_senha?'Retirar ›':'Reservar ›')+'</button></div></div></article>';
}
function openModal(title,subtitle,body,opts={}) {
  closeModal();
  const root=$("#modal-root");
  root.innerHTML='<div class="modal-overlay" id="overlay"><section class="modal '+(opts.size||"")+'" role="dialog" aria-modal="true" aria-label="'+attr(title)+'"><header class="modal-header"><div><h2>'+esc(title)+'</h2>'+(subtitle?'<p>'+esc(subtitle)+'</p>':"")+'</div><button class="icon-button" type="button" data-close aria-label="Fechar">×</button></header>'+body+'</section></div>';
  root.querySelector("[data-close]").onclick=closeModal;
  root.querySelector("#overlay").addEventListener("click",ev=>{if(ev.target.id==="overlay")closeModal()});
  document.body.style.overflow="hidden";
  state.modal=title;
}
function closeModal(){$("#modal-root").innerHTML="";document.body.style.overflow="";state.modal=null;}
document.addEventListener("keydown",ev=>{if(ev.key==="Escape"&&state.modal)closeModal();if(ev.key==="/"&&!state.modal&&document.activeElement?.tagName!=="INPUT"){ev.preventDefault();$("#search").focus()}});
function profileModal(first=false){if(state.identity)return identityProfileModal();return identityLoginModal(first);}
function dateInput(name,label,value,min=""){return '<div class="field"><label for="'+name+'">'+label+'</label><input type="date" id="'+name+'" value="'+attr(value||"")+'" '+(min?'min="'+attr(min)+'"':"")+' required></div>'}
function inputField(name,label,value="",opts={}){return '<div class="field"><label for="'+name+'">'+esc(label)+'</label><input id="'+name+'" name="'+name+'" type="'+(opts.type||"text")+'" '+(opts.required?"required":"")+' maxlength="'+(opts.max||140)+'" placeholder="'+attr(opts.placeholder||"")+'" value="'+attr(value)+'"></div>'}
function selectField(id,label,options,selected,first=false){return '<div class="field"><label for="'+id+'">'+esc(label)+'</label><select id="'+id+'">'+(first?'<option value="">Selecione</option>':"")+options.map(x=>'<option value="'+attr(x.value)+'" '+(String(selected)===String(x.value)?"selected":"")+'>'+esc(x.label)+'</option>').join("")+'</select></div>'}
async function reserveModal(itemId){
  const cats=state.data.categorias;
  if(!state.data.componentes.length){toast("Ainda não há materiais cadastrados.",true);return;}
  const item=byId(itemId)||state.data.componentes[0];
  const date=localDate();
  const catopts=cats.filter(c=>state.data.componentes.some(x=>x.categoria_id===c.id)).map(c=>({value:c.id,label:c.nome}));
  const body='<form id="reservation-form" class="modal-main"><div class="field-grid">'+selectField("r-category","Categoria",catopts,item.categoria_id)+
    '<div class="field"><label for="r-item">Material</label><select id="r-item" required></select></div></div>'+
    '<div class="field-grid"><div class="field"><label for="r-qty">Quantidade</label><div class="stepper"><button type="button" class="step" data-target="r-qty" data-delta="-1">−</button><input id="r-qty" type="number" min="1" max="1000" value="1" required><button type="button" class="step" data-target="r-qty" data-delta="1">+</button></div></div><div class="field"></div></div>'+
    '<div class="field-grid">'+dateInput("r-start","Data de retirada",date,date)+dateInput("r-end","Previsão de devolução",date,date)+'</div>'+
    '<div id="r-availability" class="reservation-availability">Consultando disponibilidade…</div>'+
    inputField("r-name","Nome do solicitante *",state.actor,{required:true,max:100,placeholder:"Nome completo"})+
    inputField("r-contact","Contato (opcional)","",{max:140,placeholder:"Telefone"})+
    '<div class="field"><label for="r-note">Observação (opcional)</label><textarea id="r-note" maxlength="500" placeholder="Detalhes da solicitação"></textarea></div>'+
    '<p class="notice">A reserva só será confirmada após aprovação da equipe do PET. O contato informado fica restrito ao painel administrativo.</p>'+
    '<div class="modal-footer" style="padding:18px 0 0;border:0"><button type="button" class="secondary-button" data-close2>Cancelar</button><button type="submit" class="primary-button" id="r-submit">Enviar solicitação</button></div></form>';
  openModal("Solicitar reserva","Escolha seu material e o período desejado.",body);
  $("#r-category").onchange=()=>fillItems(null);
  $("#r-item").onchange=checkAvailability;
  for(const id of ["r-qty","r-start","r-end"])$("#"+id).addEventListener("change",checkAvailability);
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta),checkAvailability));
  $("[data-close2]").onclick=closeModal;
  let watch=0;
  function fillItems(selected){
    const options=state.data.componentes.filter(x=>x.categoria_id===Number($("#r-category").value));
    $("#r-item").innerHTML=options.map(x=>'<option value="'+x.id+'">'+esc(x.nome)+'</option>').join("");
    if(selected)$("#r-item").value=String(selected);
    checkAvailability();
  }
  async function checkAvailability(){
    const index=++watch;
    const id=$("#r-item").value, a=$("#r-start").value,b=$("#r-end").value, qty=Number($("#r-qty").value);
    const label=$("#r-availability"), submit=$("#r-submit");
    submit.disabled=true;
    label.className="reservation-availability";
    if(!id||!a||!b||b<a){label.textContent="Selecione um material e um período válido.";return;}
    label.textContent="Verificando disponibilidade…";
    try{
      const data=await api("/api/availability?id="+encodeURIComponent(id)+"&inicio="+encodeURIComponent(a)+"&fim="+encodeURIComponent(b));
      if(index!==watch||!document.contains(label))return;
      const enough=data.disponiveis>=qty&&qty>=1&&Number.isInteger(qty);
      label.className="reservation-availability "+(enough?"available":"unavailable");
      label.textContent=data.disponiveis+" unidade(s) disponíveis para o período"+(enough?"":" — ajuste a quantidade ou datas");
      submit.disabled=!enough;
    }catch(error){if(index!==watch||!document.contains(label))return;label.textContent=error.message;}
  }
  $("#reservation-form").onsubmit=async e=>{
    e.preventDefault();const submit=$("#r-submit");submit.disabled=true;submit.textContent="Enviando…";
    try{
      await api("/api/reservations","POST",{componente_id:Number($("#r-item").value),quantidade:Number($("#r-qty").value),data_inicio:$("#r-start").value,data_devolucao:$("#r-end").value,nome_solicitante:$("#r-name").value.trim(),contato:$("#r-contact").value.trim(),observacao:$("#r-note").value.trim()});
      closeModal();toast("Solicitação enviada! Aguarde a aprovação do PET.");
    }catch(error){toast(error.message,true);submit.disabled=false;submit.textContent="Enviar solicitação";}
  };
  fillItems(item.id);
}
function stepNumber(id,delta,onChange){
 const el=$("#"+id);if(!el)return;
 const min=Number(el.min||0),max=Number(el.max||1000000),v=Number(el.value)||0;
 el.value=String(Math.max(min,Math.min(max,v+delta)));el.dispatchEvent(new Event("change",{bubbles:true}));if(onChange)onChange();
}
async function openAdmin(){
  if(state.admin){
    try{await adminReload();adminModal();return;}
    catch(error){state.admin=null; if(!error.message.includes("Entre no painel"))toast(error.message,true);}
  }
  try{
    state.admin=await api("/api/admin/state");
    state.tab=state.admin.reservas.some(r=>r.status==="pendente")?"reservas":"materiais";
    adminModal();return;
  }catch(error){if(!error.message.includes("Entre no painel")){toast(error.message,true);return;}}
  openModal("Painel administrativo","Acesso restrito aos integrantes responsáveis pelo inventário.",'<form class="modal-main" id="login-form"><div class="field"><label for="admin-password">Senha administrativa</label><div class="password-input-wrap"><input type="password" id="admin-password" required autocomplete="current-password" placeholder="Informe a senha compartilhada"><button type="button" class="show-password" id="password-toggle" aria-label="Mostrar senha" aria-pressed="false">Mostrar</button></div></div><p class="notice">O nome do PETiane é usado apenas para identificar as alterações. Não substitui a senha administrativa.</p><div class="modal-footer" style="padding:18px 0 0;border:0"><button class="primary-button" type="submit">Entrar no painel</button></div></form>');
  $("#password-toggle").onclick=()=>{
    const input=$("#admin-password"), btn=$("#password-toggle");
    const show=input.type==="password";
    input.type=show?"text":"password";
    btn.textContent=show?"Ocultar":"Mostrar";
    btn.setAttribute("aria-label",show?"Ocultar senha":"Mostrar senha");
    btn.setAttribute("aria-pressed",String(show));
  };
  $("#login-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#login-form button[type=submit]");btn.disabled=true;btn.textContent="Entrando…";
    try{await api("/api/login","POST",{senha:$("#admin-password").value});await adminReload();state.tab=state.admin.reservas.some(r=>r.status==="pendente")?"reservas":"materiais";adminModal();toast("Acesso autorizado!");}
    catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Entrar no painel";}
  };
}
function adminModal(){
  if(!state.admin)return openAdmin();
  const tabs=[["materiais","▦","Materiais"],["reservas","◷","Reservas"],["usuarios","♙","Usuários"],["categorias","⊞","Categorias"],["configuracoes","⚙","Configurações"]];
  const count=state.admin.reservas.filter(r=>r.status==="pendente").length;
  const content='<nav class="tabs" aria-label="Áreas do painel">'+tabs.map(([key,symbol,label])=>'<button type="button" class="tab '+(state.tab===key?"active":"")+'" data-tab="'+key+'"><span aria-hidden="true">'+symbol+'</span> '+label+(key==="reservas"&&count?' <span class="tab-count">'+count+'</span>':"")+'</button>').join("")+'</nav><div id="admin-tab-body"></div>';
  openModal("Gerenciar inventário","Administração do PET Educação · "+(state.actor||"PETiane"),content,{size:"full"});
  $$(".tab").forEach(b=>b.onclick=async()=>{
    state.tab=b.dataset.tab;
    if(state.tab==="reservas"){
      try{await adminReload();}
      catch(error){toast("Não foi possível atualizar as reservas: "+error.message,true);}
    }
    adminModal();
  });
  renderTab();
}
function renderTab(){
  const target=$("#admin-tab-body");
  if(!target||!state.admin)return;
  if(state.tab==="materiais")return renderAdminMaterials(target);
  if(state.tab==="reservas")return renderAdminReservations(target);
  if(state.tab==="categorias")return renderAdminCategories(target);
  if(state.tab==="usuarios")return renderAdminUsers(target);
  return renderSettings(target);
}
function renderAdminMaterials(target){
  const pending=state.admin.reservas.filter(r=>r.status==="pendente").length;
  target.innerHTML='<section class="panel-section"><div class="admin-reservations-shortcut"><div><strong>Solicitações e devoluções</strong><small>'+pending+' reserva(s) aguardando análise. As solicitações feitas pelo site aparecem aqui no painel.</small></div><button type="button" class="primary-button small-button" id="go-reservations">Abrir reservas'+(pending?' ('+pending+')':'')+'</button></div><div class="panel-head"><div><h3>Materiais cadastrados</h3><p>Alterações só são gravadas quando você clicar em salvar.</p></div><button class="primary-button small-button" id="add-item">+ Novo material</button></div><div class="admin-list">'+state.admin.componentes.map(x=>'<div class="admin-list-row"><div class="main-info"><strong>'+esc(x.nome)+'</strong><small>'+esc(nameCategory(x.categoria_id))+' · Total: '+moneyless(x.quantidade)+' · Disponível: '+moneyless(available(x))+'</small></div><div class="actions"><button type="button" class="outline-button small-button" data-edit-item="'+x.id+'">Editar</button><button type="button" class="danger-button small-button" data-remove-item="'+x.id+'">Excluir</button></div></div>').join("")+'</div></section>';
  $("#go-reservations").onclick=()=>{state.tab="reservas";adminModal()};
  $("#add-item").onclick=()=>itemEditor();
  $$("[data-edit-item]").forEach(b=>b.onclick=()=>itemEditor(Number(b.dataset.editItem)));
  $$("[data-remove-item]").forEach(b=>b.onclick=()=>removeItem(Number(b.dataset.removeItem)));
}
async function removeItem(id){
  const x=state.admin.componentes.find(i=>i.id===id);
  if(!confirm('Excluir definitivamente "'+x?.nome+'"? Essa ação não pode ser desfeita.'))return;
  try{await api("/api/admin/item?id="+id,"DELETE");await adminReload();adminModal();toast("Material excluído.");}catch(error){toast(error.message,true);}
}
function switchInput(id,label,checked,help=""){
  return '<label class="switch-row"><span><strong>'+esc(label)+'</strong>'+(help?'<small>'+esc(help)+'</small>':"")+'</span><input id="'+id+'" type="checkbox" '+(checked?"checked":"")+'></label>';
}
function stepInput(id,label,value){
  return '<div class="field"><label for="'+id+'">'+label+'</label><div class="stepper"><button type="button" class="step" data-target="'+id+'" data-delta="-1">−</button><input type="number" id="'+id+'" min="0" max="1000000" step="1" value="'+Number(value||0)+'" required><button type="button" class="step" data-target="'+id+'" data-delta="1">+</button></div></div>';
}
function itemEditor(id){
  const x=state.admin.componentes.find(i=>i.id===id);
  const categories=state.admin.categorias.filter(c=>!c.arquivada).map(c=>({value:c.id,label:c.nome}));
  if(!categories.length){toast("Cadastre uma categoria primeiro.",true);selectAdminTab("categorias");return;}
  const groups=[...new Set(state.admin.componentes.map(y=>y.grupo_variacoes).filter(Boolean))];
  const family=window.__newVariantGroup||x?.grupo_variacoes||"";
  window.__newVariantGroup="";
  const body='<form id="item-form" class="modal-main">'+
    '<div class="field-grid">'+inputField("i-name","Nome do material *",x?.nome||"",{required:true})+selectField("i-category","Categoria",categories,x?.categoria_id||categories[0].value)+'</div>'+
    '<div class="field-grid">'+inputField("i-id","Modelo / referência (opcional)",x?.identificacao||"",{max:120})+inputField("i-patrimony","Número de patrimônio (opcional)",x?.patrimonio||"",{max:160})+'</div>'+
    '<div class="field"><label for="i-variation-family">Grupo de variações (opcional)</label><input id="i-variation-family" type="text" maxlength="80" list="i-family-options" value="'+attr(family)+'" placeholder="Ex.: Resistores, Arduino, Capacitores"><datalist id="i-family-options">'+groups.map(name=>'<option value="'+attr(name)+'"></option>').join("")+'</datalist><small class="hint">Itens do mesmo grupo aparecem no mesmo card, sem misturar estoques.</small>'+(x?'<button class="outline-button small-button" id="i-link-variations" type="button">Vincular materiais semelhantes</button>':'')+'</div>'+
    switchInput("i-public","Exibir para todos",x?flag(x.visivel_visitante):true,"Desmarque para mostrar somente aos PETianes.")+
    '<div class="field"><label>Imagem do material (opcional)</label><div id="i-photo-preview" class="media-preview"><img alt="Ilustração do material" src="'+attr(x?itemImage(x):defaultImage("material"))+'"></div><input type="file" id="i-photo" accept="image/png,image/jpeg,image/webp" style="margin-top:9px"><small class="hint">Imagem própria ou ilustração automática.</small><label class="switch-row"><span><strong>Remover fundo claro automaticamente</strong><small>Para fotos com fundo uniforme.</small></span><input type="checkbox" id="i-remove-bg" checked></label><button type="button" class="outline-button small-button" id="i-photo-remove">Usar desenho padrão</button></div>'+
    '<div class="field-grid thirds">'+stepInput("i-quantity","Quantidade",x?.quantidade||0)+stepInput("i-used","Em uso",x?.em_uso||0)+stepInput("i-broken","Com defeito",x?.com_defeito||0)+'</div>'+
    '<div class="field"><label for="i-note">Observações (opcional)</label><textarea id="i-note" maxlength="1200">'+esc(x?.observacoes||"")+'</textarea></div>'+
    '<details class="editor-advanced"><summary>Opções avançadas de exibição dos números</summary>'+
      switchInput("i-show-quantity","Exibir quantidade",x?flag(x.mostrar_quantidade):true)+
      switchInput("i-show-used","Exibir em uso",x?flag(x.mostrar_em_uso):true)+
      switchInput("i-show-broken","Exibir com defeito",x?flag(x.mostrar_defeito):false)+
    '</details>'+
    '<div class="field"><label for="i-description">Informações sobre defeitos (opcional)</label><textarea id="i-description" maxlength="1400">'+esc(x?.descricao_defeito||"")+'</textarea></div>'+
    (x?.ultima_alteracao?'<div class="audit"><strong>Última alteração salva</strong><span>'+esc(x.ultimo_responsavel||"PETiane")+' · '+esc(fmt(x.ultima_alteracao))+'</span><p>'+esc(x.detalhes_alteracao||"Registro atualizado")+'</p></div>':"")+
    '<div class="modal-footer" style="padding:18px 0 0;border:0"><button type="button" class="secondary-button" id="i-cancel">Cancelar</button><button type="submit" class="primary-button" id="i-save">Salvar material</button></div></form>';
  openModal(x?"Editar material":"Adicionar material","",body,{size:"wide"});
  let image=x?.imagem||"";
  if(x && $("#i-link-variations"))$("#i-link-variations").onclick=()=>openVariantLinker(x.id);
  $("#i-photo-remove").onclick=()=>{image="";$("#i-photo-preview").innerHTML='<img alt="Desenho padrão" src="'+attr(defaultImage($("#i-name").value))+'">';$("#i-photo").value="";$("#i-photo").dispatchEvent(new Event("input",{bubbles:true}));};
  $("#i-photo").onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(!file.type.startsWith("image/")){toast("Selecione uma imagem.",true);return;}
    try{image=await shrinkImage(file);$("#i-photo-preview").innerHTML='<img src="'+attr(image)+'" alt="Nova imagem">';toast("Imagem pronta para salvar.");}catch(error){toast(error.message,true);}
  };
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta)));
  $("#i-cancel").onclick=()=>adminModal();
  $("#item-form").onsubmit=async e=>{
    e.preventDefault();const submit=$("#i-save");submit.disabled=true;submit.textContent="Salvando…";
    const body={id:x?.id||null,responsavel:state.actor||"PETiane",categoria_id:Number($("#i-category").value),
      nome:$("#i-name").value,identificacao:$("#i-id").value,patrimonio:$("#i-patrimony").value,
      imagem:image,quantidade:Number($("#i-quantity").value),em_uso:Number($("#i-used").value),
      com_defeito:Number($("#i-broken").value),mostrar_quantidade:$("#i-show-quantity").checked,
      mostrar_em_uso:$("#i-show-used").checked,mostrar_defeito:$("#i-show-broken").checked,
      visivel_visitante:$("#i-public").checked,grupo_variacoes:$("#i-variation-family").value,
      descricao_defeito:$("#i-description").value,observacoes:$("#i-note").value,unidade:x?.unidade||"unidades"};
    try{await api("/api/admin/item","POST",body);await adminReload();adminModal();toast("Material salvo!");}
    catch(error){toast(error.message,true);submit.disabled=false;submit.textContent="Salvar material";}
  };
}
async function shrinkImage(file){
  if(file.size>14*1024*1024)throw Error("Foto muito grande. Escolha uma com até 14 MB.");
  const src=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=src;await img.decode();
    const canvas=document.createElement("canvas");let scale=Math.min(1,650/Math.max(img.width,img.height));
    canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
    const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    let encoded=canvas.toDataURL("image/webp",.64);
    if(!encoded.startsWith("data:image/webp"))encoded=canvas.toDataURL("image/jpeg",.64);
    if(encoded.length>95000) {
      canvas.width=Math.round(canvas.width*.65);canvas.height=Math.round(canvas.height*.65);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      encoded=canvas.toDataURL("image/jpeg",.4);
    }
    if(encoded.length>108000)throw Error("Imagem ainda muito grande. Escolha outra foto.");
    return encoded;
  }finally{URL.revokeObjectURL(src);}
}


let reserveStatusFilter="pendente";
const namesStatus={pendente:"Pendente",aprovada:"Aprovada",retirada:"Retirado",devolvida:"Devolvido",recusada:"Recusada",cancelada:"Cancelada"};
function lateReserve(r){return r.status==="retirada"&&r.data_devolucao<localDate();}
function resStatus(r){return lateReserve(r)?["Atrasado","late"]:{pendente:["Pendente","pending"],aprovada:["Aprovada","approved"],retirada:["Retirado","picked"],devolvida:["Devolvido","done"],recusada:["Recusada","done"],cancelada:["Cancelada","done"]}[r.status]||["Desconhecido","done"];}
function renderAdminReservations(target){
  const reservations=state.admin.reservas;
  const active=r=>r.status==="aprovada" || (r.status==="retirada" && !lateReserve(r));
  const finished=r=>["devolvida","recusada","cancelada"].includes(r.status);
  const list=reservations.filter(r=>reserveStatusFilter==="todas" || (reserveStatusFilter==="ativas"?active(r):reserveStatusFilter==="atrasadas"?lateReserve(r):reserveStatusFilter==="concluidas"?finished(r):r.status===reserveStatusFilter));
  target.innerHTML='<section class="panel-section"><div class="panel-head"><div><h3>Solicitações e devoluções</h3><p>As reservas enviadas por visitantes aparecem aqui para você aprovar ou recusar.</p></div><span class="status pending">'+reservations.filter(r=>r.status==="pendente").length+' pendentes</span></div>'+
    '<div class="filter-row reservation-filter-row" style="padding:0 0 18px">'+[["pendente","Pendentes"],["ativas","Ativas"],["atrasadas","Atrasadas"],["concluidas","Concluídas"],["todas","Todas"]].map(([key,label])=>'<button class="chip '+(reserveStatusFilter===key?"active":"")+'" data-r-filter="'+key+'">'+label+'</button>').join("")+'</div>'+
    '<div class="admin-list">'+(list.length?list.map(r=>reservationCard(r)).join(""):'<div class="empty-state">Nenhuma reserva nesta seleção.</div>')+'</div></section>';
  $$("[data-r-filter]").forEach(b=>b.onclick=()=>{reserveStatusFilter=b.dataset.rFilter;renderTab()});
  $$("[data-action-reserve]").forEach(b=>b.onclick=()=>doReserveAction(Number(b.dataset.id),b.dataset.actionReserve));
}
function reservationCard(r){
  const [status,color]=resStatus(r);
  let actions="";
  if(r.status==="pendente")actions='<button class="primary-button small-button" data-action-reserve="aprovar" data-id="'+r.id+'">Aprovar</button><button class="danger-button small-button" data-action-reserve="recusar" data-id="'+r.id+'">Recusar</button>';
  if(r.status==="aprovada")actions='<button class="primary-button small-button" data-action-reserve="retirar" data-id="'+r.id+'">Registrar retirada</button><button class="danger-button small-button" data-action-reserve="recusar" data-id="'+r.id+'">Cancelar</button>';
  if(r.status==="retirada")actions='<button class="primary-button small-button" data-action-reserve="devolver" data-id="'+r.id+'">Registrar devolução</button>';
  return '<div class="admin-list-row" style="align-items:flex-start;display:block"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div class="main-info"><strong>#'+r.id+' · '+esc(r.componente_nome||"Material removido")+'</strong><small>'+(r.tipo==='retirada_direta'?'PETiano retirou · ':'Reserva solicitada por · ')+esc(r.nome_solicitante)+' · '+moneyless(r.quantidade)+' unidade(s)</small></div><span class="status '+color+'">'+status+'</span></div>'+
    '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 12px;margin:13px 0;font-size:12px;color:#687b8e">'+
    '<span>Retirada: <strong>'+formatDay(r.data_inicio)+'</strong></span><span>Devolução: <strong>'+formatDay(r.data_devolucao)+'</strong></span>'+
    (r.contato?'<span>Contato: <strong>'+esc(r.contato)+'</strong></span>':"")+
    (r.email?'<span>E-mail: <strong>'+esc(r.email)+'</strong></span>':"")+
    '<span>Solicitado: '+esc(fmt(r.solicitado_em))+'</span>'+(r.devolvido_em?'<span>Devolvido: '+esc(fmt(r.devolvido_em))+'</span>':"")+'</div>'+
    (r.observacao?'<p class="notice" style="margin:8px 0 11px;word-break:break-word">'+esc(r.observacao)+'</p>':"")+
    (lateReserve(r)?'<p style="font-size:12px;color:#bd4050;margin:8px 0 12px"><strong>⚠ Devolução atrasada!</strong> Entre em contato com o solicitante.</p>':"")+
    '<div class="actions" style="display:flex;gap:7px;flex-wrap:wrap">'+actions+'</div></div>';
}
async function doReserveAction(id,action){
  const r=state.admin.reservas.find(x=>x.id===id);
  if(!r)return;
  if(action==="devolver")return returnModal(r);
  const asks={aprovar:"Aprovar esta solicitação? O material ficará reservado para o período.",recusar:"Recusar ou cancelar esta reserva?",retirar:"Confirmar que o material foi entregue ao solicitante?"};
  if(!confirm(asks[action]||"Confirmar operação?"))return;
  try{await api("/api/admin/reservation","POST",{id,acao:action,responsavel:state.actor||"PETiane"});await adminReload();adminModal();toast("Reserva atualizada com sucesso.");}
  catch(error){toast(error.message,true);}
}
function returnModal(r){
  openModal("Registrar devolução","Reserva #"+r.id+" · "+(r.componente_nome||"Material"),'<form class="modal-main" id="return-form"><p>Confirme a devolução de <strong>'+moneyless(r.quantidade)+' unidade(s)</strong> por <strong>'+esc(r.nome_solicitante)+'</strong>.</p>'+
    stepInput("return-broken","Quantas unidades voltaram com defeito?",0)+
    '<div class="field"><label for="return-note">Observações (opcional)</label><textarea maxlength="500" id="return-note" placeholder="Condição do material ou outras observações"></textarea></div>'+
    '<p class="notice">Ao salvar, as quantidades em uso e com defeito serão atualizadas automaticamente. Essa reserva ficará concluída.</p>'+
    '<div class="modal-footer" style="padding:17px 0 0;border:0"><button type="button" id="return-cancel" class="secondary-button">Cancelar</button><button type="submit" class="primary-button">Confirmar devolução</button></div></form>');
  $("#return-cancel").onclick=adminModal;
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta)));
  $("#return-form").onsubmit=async e=>{e.preventDefault();try{
    await api("/api/admin/reservation","POST",{id:r.id,acao:"devolver",responsavel:state.actor||"PETiane",defeituosos:Number($("#return-broken").value),observacao:$("#return-note").value});
    await adminReload();adminModal();toast("Devolução registrada!");
  }catch(error){toast(error.message,true)}};
}
function renderAdminCategories(target){
  target.innerHTML='<section class="panel-section"><div class="panel-head"><div><h3>Categorias do inventário</h3><p>Crie novas seções, reorganize ou renomeie.</p></div><button class="primary-button small-button" id="new-category">+ Categoria</button></div><div class="admin-list">'+
    state.admin.categorias.map((c,i)=>'<div class="admin-list-row"><div class="main-info"><strong>'+esc(iconFor(c.nome))+' '+esc(c.nome)+'</strong><small>'+state.admin.componentes.filter(x=>x.categoria_id===c.id).length+' materiais</small></div><div class="actions"><button class="outline-button small-button" data-move-cat="'+c.id+'" data-dir="-1" '+(i===0?"disabled":"")+'>↑</button><button class="outline-button small-button" data-move-cat="'+c.id+'" data-dir="1" '+(i===state.admin.categorias.length-1?"disabled":"")+'>↓</button><button class="outline-button small-button" data-rename-cat="'+c.id+'">Renomear</button><button class="danger-button small-button" data-delete-cat="'+c.id+'">Excluir</button></div></div>').join("")+'</div></section>';
  $("#new-category").onclick=()=>editCategory();
  $$("[data-rename-cat]").forEach(b=>b.onclick=()=>editCategory(Number(b.dataset.renameCat)));
  $$("[data-delete-cat]").forEach(b=>b.onclick=()=>deleteCategory(Number(b.dataset.deleteCat)));
  $$("[data-move-cat]").forEach(b=>b.onclick=()=>moveCategory(Number(b.dataset.moveCat),Number(b.dataset.dir)));
}
function editCategory(id){
  const cat=state.admin.categorias.find(x=>x.id===id);
  openModal(cat?"Renomear categoria":"Nova categoria","Organize seus materiais por seção.",'<form class="modal-main" id="category-form">'+inputField("cat-name","Nome da categoria *",cat?.nome||"",{required:true,max:80})+'<div class="modal-footer" style="padding:18px 0 0;border:0"><button type="button" class="secondary-button" id="cat-cancel">Cancelar</button><button type="submit" class="primary-button">Salvar categoria</button></div></form>');
  $("#cat-cancel").onclick=adminModal;
  $("#category-form").onsubmit=async e=>{e.preventDefault();try{
    await api("/api/admin/category","POST",{acao:cat?"editar":"criar",id:cat?.id,nome:$("#cat-name").value});
    await adminReload();adminModal();toast("Categoria salva!");
  }catch(error){toast(error.message,true)}};
}
async function deleteCategory(id){
  const cat=state.admin.categorias.find(x=>x.id===id);
  if(!confirm("Excluir a categoria "+cat?.nome+"? Ela precisa estar vazia."))return;
  try{await api("/api/admin/category","POST",{acao:"excluir",id});await adminReload();adminModal();toast("Categoria excluída.");}catch(error){toast(error.message,true)}
}
async function moveCategory(id,dir){
  const ids=state.admin.categorias.map(x=>x.id),pos=ids.indexOf(id),next=pos+dir;
  if(next<0||next>=ids.length)return;
  [ids[pos],ids[next]]=[ids[next],ids[pos]];
  try{await api("/api/admin/category","POST",{acao:"ordenar",ordem:ids});await adminReload();adminModal();}catch(error){toast(error.message,true)}
}
function renderSettings(target){
  const c=state.admin.configuracoes||{};
  const days=c.limpeza_reservas||"nunca";
  target.innerHTML='<section class="panel-section"><div class="panel-head"><div><h3>Configurações gerais</h3><p>Limpeza de reservas, demonstração e cópias de segurança.</p></div></div>'+
    '<form id="settings-form">'+selectField("setting-cleanup","Excluir reservas devolvidas após",[{value:"nunca",label:"Nunca apagar"},{value:"1min",label:"1 minuto (teste)"},{value:"7",label:"7 dias"},{value:"15",label:"15 dias"},{value:"30",label:"30 dias"},{value:"60",label:"60 dias"},{value:"90",label:"90 dias"},{value:"personalizado",label:"Personalizado"}],["nunca","1min","7","15","30","60","90"].includes(days)?days:"personalizado")+
    '<div class="field" id="custom-days" '+(["nunca","1min","7","15","30","60","90"].includes(days)?'hidden':"")+'><label for="custom-days-number">Dias de armazenamento</label><input id="custom-days-number" type="number" min="1" max="3650" value="'+(/^\d+$/.test(days)?days:"45")+'"></div>'+
    '<p class="notice warning">Só serão apagadas reservas <strong>devolvidas</strong>. Pendentes, aprovadas, retiradas e atrasadas nunca são excluídas automaticamente. A opção de 1 minuto é para testes, verificada a cada minuto (pode levar até cerca de 2 minutos após a devolução); nos demais prazos, a limpeza acontece diariamente. Depois do teste, escolha um prazo maior ou Nunca apagar.</p>'+
    switchInput("setting-demo","Exibir identificação de demonstração",c.modo_demo==="sim","Desative quando substituir os testes pelos materiais oficiais.")+
    '<div style="display:flex;gap:10px;margin-top:17px;flex-wrap:wrap"><button type="submit" class="primary-button">Salvar configurações</button><button type="button" class="outline-button" id="run-cleanup">Executar limpeza agora</button></div></form>'+
    '<hr class="divider"><h3 style="font-size:17px">Backup do inventário</h3><p style="color:var(--muted);font-size:12px">Guarde uma cópia com categorias, materiais e reservas. A restauração substitui todos os registros atuais.</p>'+
    '<div style="display:flex;gap:9px;flex-wrap:wrap"><button type="button" class="outline-button" id="backup-download">↓ Baixar backup completo</button><button type="button" class="outline-button" id="backup-import">↑ Restaurar backup</button><input id="backup-file" type="file" accept=".json,application/json" hidden></div></section>';
  $("#setting-cleanup").onchange=()=>$("#custom-days").hidden=$("#setting-cleanup").value!=="personalizado";
  $("#settings-form").onsubmit=async e=>{e.preventDefault();const days=$("#setting-cleanup").value==="personalizado"?String($("#custom-days-number").value):$("#setting-cleanup").value;try{await api("/api/admin/settings","POST",{limpeza_reservas:days,modo_demo:$("#setting-demo").checked?"sim":"nao"});await adminReload();adminModal();toast("Configurações salvas!");}catch(error){toast(error.message,true)}};
  $("#run-cleanup").onclick=async()=>{if(!confirm("Executar agora a limpeza das reservas já concluídas, conforme o prazo definido?"))return;try{const r=await api("/api/admin/cleanup","POST",{});await adminReload();adminModal();toast(r.removidas+" reservas removidas.");}catch(error){toast(error.message,true)}};
  $("#backup-download").onclick=async()=>{
    try{const backup=await api("/api/admin/backup");saveDownload("backup-inventario-pet-"+localDate()+".json",JSON.stringify(backup,null,2));toast("Backup gerado!");}catch(error){toast(error.message,true)}
  };
  $("#backup-import").onclick=()=>$("#backup-file").click();
  $("#backup-file").onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    if(file.size>1500000){toast("Backup muito grande para este formato.",true);return;}
    if(!confirm("ATENÇÃO: o backup substituirá todos os materiais, categorias e reservas atuais. Quer continuar?"))return;
    try{const data=JSON.parse(await file.text());await api("/api/admin/restore","POST",data);await adminReload();adminModal();toast("Backup restaurado!");}catch(error){toast(error.message,true)}
  };
}
function saveDownload(name,contents){
  const blob=new Blob([contents],{type:"application/json;charset=utf-8"}),a=document.createElement("a"),url=URL.createObjectURL(blob);
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openPhoto(id){
  const x=byId(id);
  if(!x)return;
  const source=typeof itemImage==="function"?itemImage(x):x.imagem;
  if(!source){toast("Imagem indisponível para este material.",true);return;}
  const manual=/^data:image\//i.test(String(x.imagem||""));
  openModal(x.nome,manual?"Fotografia cadastrada do material.":"Ilustração de referência do componente.",
    '<div class="modal-main" style="text-align:center"><img class="photo-lightbox" alt="'+attr(x.nome)+'" src="'+attr(source)+'"></div>',{size:"wide"});
}
$("#search").oninput=e=>{state.query=e.target.value;render()};
$("#category-filters").addEventListener("click",e=>{const b=e.target.closest("[data-category]");if(!b)return;state.filter=b.dataset.category;render();});
$("#category-sections").addEventListener("click",e=>{
  const photo=e.target.closest("[data-photo]");if(photo){openPhoto(Number(photo.dataset.photo));return;}
  const defect=e.target.closest("[data-defect]");if(defect){const x=$("#defect-"+defect.dataset.defect);if(x)x.hidden=!x.hidden;return;}
  const book=e.target.closest("[data-reserve-item]");if(book)(state.identity?.tag==="petiano"&&!state.identity?.precisa_criar_login&&!state.identity?.trocar_senha?memberWithdrawModal:reserveModal)(Number(book.dataset.reserveItem));
});
$("#reserve-button").onclick=()=> (state.identity?.tag==="petiano"&&!state.identity?.precisa_criar_login&&!state.identity?.trocar_senha?memberWithdrawModal:reserveModal)(null);
$("#profile-button").onclick=()=>profileModal();
$("#admin-button").onclick=openAdmin;
$("#retry-button").onclick=async()=>{try{await publicReload()}catch{toast("Ainda sem conexão.",true)}};
(async()=>{
  if(document.body.dataset.adminRoute==="true")return;
  try{
    // Esperar catálogo, filamentos e identidade antes da primeira renderização.
    const [catalog,filamentData,identity]=await Promise.all([
      api("/api/catalog"),api("/api/filaments"),api("/api/identity/me")
    ]);
    state.data=catalog;
    UI.filaments=filamentData.filamentos||[];
    state.identity=identity.usuario||null;
    state.actor=state.identity?.nome||localStorage.getItem("pet_inventario_nome")||"";
    if(state.identity)localStorage.setItem("pet_inventario_nome",state.actor);
    $("#offline-alert").hidden=true;
    render();
    if(state.identity?.precisa_criar_login)setTimeout(()=>identityUpgradeModal(),400);
    else if(state.identity?.trocar_senha)setTimeout(()=>identityChangePasswordModal(true),400);
  }catch(error){
    console.error(error);
    $("#offline-alert").hidden=false;
    $("#category-sections").innerHTML='<div class="empty-state">Não foi possível carregar o inventário. Tente atualizar.</div>';
  }finally{document.body.classList.remove("catalog-loading");}
})();
