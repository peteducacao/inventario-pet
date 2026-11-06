/* Inventário PET Educação — interface leve, sem frameworks. */
"use strict";
const state = { data:{categorias:[],componentes:[],demonstracao:false}, admin:null, tab:"materiais", filter:"all", query:"", actor:localStorage.getItem("pet_inventario_nome")||"", busy:false, modal:null };
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
    '<div class="item-footer"><span class="date-small">Atualizado: '+esc(fmt(x.ultima_alteracao))+'</span><button class="link-button" data-reserve-item="'+x.id+'" type="button">Reservar ›</button></div></div></article>';
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
function profileModal(first=false){
  openModal("Quem é você, PETiane?","Seu nome identifica suas alterações no painel, sem precisar criar conta.",'<form id="profile-form" class="modal-main"><div class="field"><label for="p-name">Como podemos chamar você?</label><input id="p-name" name="name" maxlength="80" required autocomplete="name" placeholder="Seu nome" value="'+attr(state.actor)+'"></div><p class="notice">Este nome ficará lembrado apenas neste navegador. Em outro aparelho, basta informá-lo novamente. Você pode alterá-lo quando quiser.</p><div class="modal-footer" style="padding:18px 0 0;border:0"><button type="submit" class="primary-button">Salvar meu nome</button></div></form>');
  $("#profile-form").onsubmit=e=>{e.preventDefault();const name=$("#p-name").value.trim();if(!name)return;state.actor=name;localStorage.setItem("pet_inventario_nome",name);closeModal();render();toast("Bem-vindo(a), "+name+"!")};
  if(first)$("#p-name").focus();
}
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
  if(state.admin){adminModal();return;}
  try{
    state.admin=await api("/api/admin/state");adminModal();return;
  }catch(error){if(!error.message.includes("Entre no painel")){toast(error.message,true);return;}}
  openModal("Painel administrativo","Acesso restrito aos integrantes responsáveis pelo inventário.",'<form class="modal-main" id="login-form"><div class="field"><label for="admin-password">Senha administrativa</label><input type="password" id="admin-password" required autocomplete="current-password" placeholder="Informe a senha compartilhada"></div><p class="notice">O nome do PETiane é usado apenas para identificar as alterações. Não substitui a senha administrativa.</p><div class="modal-footer" style="padding:18px 0 0;border:0"><button class="primary-button" type="submit">Entrar no painel</button></div></form>');
  $("#login-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#login-form button[type=submit]");btn.disabled=true;btn.textContent="Entrando…";
    try{await api("/api/login","POST",{senha:$("#admin-password").value});await adminReload();adminModal();toast("Acesso autorizado!");}
    catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Entrar no painel";}
  };
}
function adminModal(){
  if(!state.admin)return openAdmin();
  const tabs=[["materiais","Materiais"],["reservas","Reservas"],["categorias","Categorias"],["configuracoes","Configurações"]];
  const count=state.admin.reservas.filter(r=>r.status==="pendente").length;
  const content='<nav class="tabs" aria-label="Áreas do painel">'+tabs.map(([key,label])=>'<button type="button" class="tab '+(state.tab===key?"active":"")+'" data-tab="'+key+'">'+label+(key==="reservas"&&count?' ('+count+')':"")+'</button>').join("")+'</nav><div id="admin-tab-body"></div>';
  openModal("Gerenciar inventário","Administração do PET Educação · "+(state.actor||"PETiane"),content,{size:"full"});
  $$(".tab").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;adminModal()});
  renderTab();
}
function renderTab(){
  const target=$("#admin-tab-body");
  if(!target||!state.admin)return;
  if(state.tab==="materiais")return renderAdminMaterials(target);
  if(state.tab==="reservas")return renderAdminReservations(target);
  if(state.tab==="categorias")return renderAdminCategories(target);
  return renderSettings(target);
}
function renderAdminMaterials(target){
  target.innerHTML='<section class="panel-section"><div class="panel-head"><div><h3>Materiais cadastrados</h3><p>Alterações só são gravadas quando você clicar em salvar.</p></div><button class="primary-button small-button" id="add-item">+ Novo material</button></div><div class="admin-list">'+state.admin.componentes.map(x=>'<div class="admin-list-row"><div class="main-info"><strong>'+esc(x.nome)+'</strong><small>'+esc(nameCategory(x.categoria_id))+' · Total: '+moneyless(x.quantidade)+' · Disponível: '+moneyless(available(x))+'</small></div><div class="actions"><button type="button" class="outline-button small-button" data-edit-item="'+x.id+'">Editar</button><button type="button" class="danger-button small-button" data-remove-item="'+x.id+'">Excluir</button></div></div>').join("")+'</div></section>';
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
  const categories=state.admin.categorias.map(c=>({value:c.id,label:c.nome}));
  if(!categories.length){toast("Cadastre uma categoria primeiro.",true);state.tab="categorias";adminModal();return;}
  const body='<form id="item-form" class="modal-main"><div class="field-grid">'+inputField("i-name","Nome do material *",x?.nome||"",{required:true})+selectField("i-category","Categoria",categories,x?.categoria_id||categories[0].value)+'</div>'+
    '<div class="field-grid">'+inputField("i-id","Identificação / modelo",x?.identificacao||"",{max:120})+inputField("i-patrimony","Número de patrimônio",x?.patrimonio||"",{max:160})+'</div>'+
    '<div class="field"><label>Foto do componente</label><div id="i-photo-preview" class="media-preview">'+(x?.imagem?'<img alt="Imagem atual" src="'+attr(x.imagem)+'">':'<span style="font-size:40px">📷</span>')+'</div><input type="file" id="i-photo" accept="image/png,image/jpeg,image/webp" style="margin-top:9px"><small class="hint">A foto será otimizada automaticamente para manter o site leve.</small><button type="button" class="outline-button small-button" id="i-photo-remove" style="align-self:start">Remover foto</button></div>'+
    '<div class="field-grid thirds">'+stepInput("i-quantity","Quantidade",x?.quantidade||0)+stepInput("i-used","Em uso",x?.em_uso||0)+stepInput("i-broken","Com defeito",x?.com_defeito||0)+'</div>'+
    '<div class="notice" id="i-available" style="margin-bottom:14px">Disponíveis: '+available(x||{mostrar_quantidade:1,quantidade:0,em_uso:0,com_defeito:0})+'</div>'+
    '<h3 style="font-size:15px;margin:14px 0 4px">O que mostrar no inventário</h3>'+
    switchInput("i-show-quantity","Exibir quantidade",x?flag(x.mostrar_quantidade):true,"Desativado: exibirá Sem estoque.")+
    switchInput("i-show-used","Exibir em uso",x?flag(x.mostrar_em_uso):true)+
    switchInput("i-show-broken","Exibir com defeito",x?flag(x.mostrar_defeito):false)+
    '<div class="field" style="margin-top:15px"><label for="i-description">Informações gerais dos defeitos (opcional)</label><textarea id="i-description" maxlength="1400" placeholder="Descreva aqui os problemas observados nas unidades com defeito">'+esc(x?.descricao_defeito||"")+'</textarea></div>'+
    (x?.ultima_alteracao?'<div class="audit"><strong>Última alteração salva</strong><span>'+esc(x.ultimo_responsavel||"PETiane")+' · '+esc(fmt(x.ultima_alteracao))+'</span><p>'+esc(x.detalhes_alteracao||"Registro atualizado")+'</p></div>':"")+
    '<div class="modal-footer" style="padding:18px 0 0;border:0"><button type="button" class="secondary-button" id="i-cancel">Cancelar</button><button type="submit" class="primary-button" id="i-save">Salvar alterações</button></div></form>';
  openModal(x?"Editar material":"Adicionar material","Informe os dados do cadastro e confirme para gravar.",body,{size:"wide"});
  let image=x?.imagem||"";
  $("#i-photo-remove").onclick=()=>{image="";$("#i-photo-preview").innerHTML='<span style="font-size:40px">📷</span>';$("#i-photo").value=""};
  $("#i-photo").onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(!file.type.startsWith("image/")){toast("Selecione uma fotografia.",true);return;}
    try{image=await shrinkImage(file);$("#i-photo-preview").innerHTML='<img src="'+attr(image)+'" alt="Nova foto">';toast("Fotografia pronta para salvar.");}catch(error){toast(error.message,true);}
  };
  function calc(){let q=Number($("#i-quantity").value)||0,u=Number($("#i-used").value)||0,b=Number($("#i-broken").value)||0;$("#i-available").textContent="Disponíveis: "+Math.max(0,q-u-b)+(u+b>q?" · Atenção: uso + defeito ultrapassa o total.":"");}
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta),calc));
  for(const el of ["i-quantity","i-used","i-broken"])$("#"+el).addEventListener("change",calc);
  $("#i-cancel").onclick=()=>{adminModal()};
  $("#item-form").onsubmit=async e=>{
    e.preventDefault();const submit=$("#i-save");submit.disabled=true;submit.textContent="Salvando…";
    const body={id:x?.id||null,responsavel:state.actor||"PETiane",categoria_id:Number($("#i-category").value),nome:$("#i-name").value,identificacao:$("#i-id").value,patrimonio:$("#i-patrimony").value,imagem: image,quantidade:Number($("#i-quantity").value),em_uso:Number($("#i-used").value),com_defeito:Number($("#i-broken").value),mostrar_quantidade:$("#i-show-quantity").checked,mostrar_em_uso:$("#i-show-used").checked,mostrar_defeito:$("#i-show-broken").checked,descricao_defeito:$("#i-description").value};
    try{await api("/api/admin/item","POST",body);await adminReload();adminModal();toast("Material salvo com sucesso!");}
    catch(error){toast(error.message,true);submit.disabled=false;submit.textContent="Salvar alterações";}
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
