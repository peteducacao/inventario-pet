/* PET Educação — perfil com identidade privada, permissões e retiradas. */
function setIdentity(user){
  state.identity=user;
  state.actor=user?.nome||"";
  if(user)localStorage.setItem("pet_inventario_nome",user.nome);
  else localStorage.removeItem("pet_inventario_nome");
  render();
  if(typeof refreshNotifications==="function")refreshNotifications();
  if(document.body.dataset.loansRoute==="true" && typeof openMyLoans==="function")openMyLoans();
  // Após login/logout ou mudança de tag, recarregar os dados com as novas permissões.
  if(document.body.dataset.adminRoute!=="true" && typeof UI!=="undefined"){
    Promise.all([api("/api/catalog"),api("/api/filaments")]).then(([catalog,colors])=>{
      state.data=catalog;UI.filaments=colors.filamentos||[];render();
    }).catch(error=>console.warn("Atualização de acesso:",error.message));
  }
}
async function copyValue(value,field){
  try{await navigator.clipboard.writeText(value);toast("Copiado!");}
  catch{if(field){field.focus();field.select();}toast("Selecione o texto para copiar.");}
}
function passwordField(id,label,autocomplete="current-password"){
  return '<div class="field"><label for="'+id+'">'+esc(label)+'</label><div class="password-input-wrap"><input type="password" id="'+id+'" autocomplete="'+autocomplete+'" required placeholder="Digite sua senha"><button type="button" class="show-password" data-password-show="'+id+'" aria-label="Mostrar senha">Mostrar</button></div></div>';
}
function wirePasswordVisibility(){
  $$("[data-password-show]").forEach(btn=>btn.onclick=()=>{
    const input=$("#"+btn.dataset.passwordShow);
    if(!input)return;
    const show=input.type==="password";
    input.type=show?"text":"password";
    btn.textContent=show?"Ocultar":"Mostrar";
    btn.setAttribute("aria-label",show?"Ocultar senha":"Mostrar senha");
  });
}
function accountFields(prefix,nome=""){
  return '<div class="field"><label for="'+prefix+'-name">Nome completo</label><input id="'+prefix+'-name" maxlength="80" required autocomplete="name" placeholder="Como podemos chamar você?" value="'+attr(nome)+'"></div>'+
    '<div class="field"><label for="'+prefix+'-email">E-mail</label><input id="'+prefix+'-email" type="email" maxlength="180" required autocomplete="email" placeholder="seuemail@exemplo.com"></div>'+
    '<div class="field"><label for="'+prefix+'-login">Nome de usuário</label><input id="'+prefix+'-login" maxlength="24" minlength="4" autocapitalize="none" spellcheck="false" required autocomplete="username" placeholder="Ex.: sergio01"></div>'+
    '<p class="hint" style="margin:-8px 0 15px">De 4 a 24 caracteres, sem espaços ou acentos. Pode usar letras, números, ponto, traço e _.</p>'+
    passwordField(prefix+"-password","Criar senha","new-password")+
    passwordField(prefix+"-confirm","Repetir senha","new-password");
}
function identityLoginModal(first=false){
  openModal("Entrar no inventário","Use seu nome de usuário e sua senha. A tag Visitante ou PETiano continua vinculada à sua conta.",
    '<form class="modal-main" id="identity-login-form">'+
    '<div class="field"><label for="identity-login">Nome de usuário</label><input id="identity-login" maxlength="24" autocapitalize="none" spellcheck="false" autocomplete="username" required placeholder="Ex.: sergio01"></div>'+
    passwordField("identity-login-password","Senha")+
    '<button type="button" class="link-button" id="identity-forgot" style="margin-bottom:16px">Esqueci minha senha</button>'+
    '<div class="modal-footer" style="border:0;padding:12px 0 0"><button type="submit" class="primary-button" id="identity-login-submit" style="width:100%">Entrar</button></div>'+
    '<div class="identity-separator">Primeiro acesso?</div><button type="button" class="outline-button" id="identity-open-register" style="width:100%">Criar minha conta</button></form>');
  wirePasswordVisibility();
  $("#identity-forgot").onclick=()=>{
    openModal("Esqueci minha senha","Recuperação de acesso pelo PET.",
      '<div class="modal-main"><p>Peça a um administrador do PET para encontrar seu cadastro na aba <strong>Usuários</strong> e clicar em <strong>Redefinir senha</strong>.</p><p class="notice">O administrador vai gerar uma senha temporária e informar seu nome de usuário. Você deverá escolher uma senha definitiva ao entrar.</p><button type="button" class="primary-button" id="identity-forgot-back" style="width:100%">Voltar ao login</button></div>');
    $("#identity-forgot-back").onclick=identityLoginModal;
  };
  $("#identity-open-register").onclick=()=>identityRegisterModal(true);
  $("#identity-login-form").onsubmit=async e=>{
    e.preventDefault();
    const btn=$("#identity-login-submit");btn.disabled=true;btn.textContent="Entrando…";
    try{
      const r=await api("/api/identity/login","POST",{login:$("#identity-login").value,senha:$("#identity-login-password").value});
      setIdentity(r.usuario);
      if(r.usuario.trocar_senha)identityChangePasswordModal(true);
      else identityProfileModal();
      toast("Você entrou no seu perfil!");
    }catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Entrar";}
  };
  if(first)$("#identity-login")?.focus();
}
function identityRegisterModal(first=false){
  if(state.identity?.precisa_criar_login)return identityUpgradeModal();
  openModal("Criar minha conta","Cada integrante tem seu próprio login. Toda conta nova começa como Visitante.",
    '<form class="modal-main" id="register-user-form">'+accountFields("reg",state.actor)+
    '<p class="notice">A tag <strong>PETiano</strong> é liberada apenas por um administrador. Não é necessário anotar códigos de recuperação.</p>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0"><button type="submit" class="primary-button" id="identity-register-submit" style="width:100%">Criar conta</button></div>'+
    '<div class="identity-separator">Já tem uma conta?</div><button type="button" class="outline-button" id="identity-register-login" style="width:100%">Entrar com login e senha</button></form>');
  wirePasswordVisibility();
  $("#identity-register-login").onclick=identityLoginModal;
  $("#register-user-form").onsubmit=async e=>{
    e.preventDefault();
    const senha=$("#reg-password").value;
    if(senha!==$("#reg-confirm").value){toast("As senhas não coincidem.",true);return;}
    const btn=$("#identity-register-submit");btn.disabled=true;btn.textContent="Criando conta…";
    try{
      const r=await api("/api/identity/register","POST",{nome:$("#reg-name").value,email:$("#reg-email").value.trim(),login:$("#reg-login").value,senha});
      setIdentity(r.usuario);identityProfileModal();toast("Conta criada com sucesso!");
    }catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Criar conta";}
  };
  if(first)$("#reg-name")?.focus();
}
function identityUpgradeModal(){
  const u=state.identity;if(!u)return identityLoginModal();
  if(!u.precisa_criar_login)return identityProfileModal();
  openModal("Atualizar meu cadastro","Seu perfil antigo e sua tag serão preservados. Só precisamos configurar um login e senha.",
    '<form class="modal-main" id="identity-upgrade-form"><p class="notice">Encontramos seu perfil de <strong>'+esc(u.nome)+'</strong> ('+esc(u.id)+'). Sua tag e suas movimentações não serão alteradas.</p>'+
    '<div class="field"><label for="upgrade-email">E-mail</label><input type="email" id="upgrade-email" maxlength="180" required autocomplete="email" placeholder="seuemail@exemplo.com"></div>'+
    '<div class="field"><label for="upgrade-login">Escolha um nome de usuário</label><input id="upgrade-login" maxlength="24" minlength="4" autocapitalize="none" autocomplete="username" required placeholder="Ex.: sergio01"></div>'+
    '<p class="hint" style="margin:-9px 0 14px">De 4 a 24 caracteres, sem espaços nem acentos.</p>'+
    passwordField("upgrade-password","Criar senha","new-password")+
    passwordField("upgrade-confirm","Repetir senha","new-password")+
    '<button type="submit" class="primary-button" style="width:100%">Salvar login e senha</button></form>');
  wirePasswordVisibility();
  $("#identity-upgrade-form").onsubmit=async e=>{
    e.preventDefault();if($("#upgrade-password").value!==$("#upgrade-confirm").value){toast("As senhas não coincidem.",true);return;}
    const btn=$("#identity-upgrade-form button[type=submit]");btn.disabled=true;
    try{
      const r=await api("/api/identity/upgrade","POST",{login:$("#upgrade-login").value,email:$("#upgrade-email").value.trim(),senha:$("#upgrade-password").value});
      setIdentity(r.usuario);identityProfileModal();toast("Sua conta antiga foi atualizada!");
    }catch(error){toast(error.message,true);btn.disabled=false;}
  };
}
function identityChangePasswordModal(force=false){
  const u=state.identity;if(!u)return identityLoginModal();
  if(u.precisa_criar_login)return identityUpgradeModal();
  const must=force||u.trocar_senha;
  const form='<form class="modal-main" id="identity-change-form">'+
    (must?'<p class="notice warning">Você entrou com uma senha temporária. Para continuar, escolha uma nova senha particular.</p>':passwordField("identity-old-password","Senha atual"))+
    passwordField("identity-new-password","Nova senha","new-password")+
    passwordField("identity-new-confirm","Repetir nova senha","new-password")+
    '<div class="modal-footer" style="padding:15px 0 0;border:0"><button type="button" class="secondary-button" id="identity-change-cancel">'+(must?"Sair":"Cancelar")+'</button><button type="submit" class="primary-button" id="identity-change-submit">Salvar senha</button></div></form>';
  openModal(must?"Criar senha definitiva":"Alterar minha senha","Sua senha é pessoal e não fica visível para o administrador.",form);
  wirePasswordVisibility();
  $("#identity-change-cancel").onclick=async()=>{
    if(!must)return identityProfileModal();
    await identityLogout();
  };
  $("#identity-change-form").onsubmit=async e=>{
    e.preventDefault();const password=$("#identity-new-password").value;
    if(password!==$("#identity-new-confirm").value){toast("As senhas não coincidem.",true);return;}
    const btn=$("#identity-change-submit");btn.disabled=true;
    try{
      const r=await api("/api/identity/password","POST",{nova_senha:password,senha_atual:must?"":$("#identity-old-password").value});
      setIdentity(r.usuario);identityProfileModal();toast("Senha atualizada com sucesso!");
    }catch(error){toast(error.message,true);btn.disabled=false;}
  };
}
async function identityLogout(){
  try{
    await api("/api/identity/logout","POST",{});
    setIdentity(null);identityLoginModal();toast("Você saiu deste dispositivo.");
  }catch(error){toast(error.message,true);}
}
function identityProfileModal(){
  const u=state.identity;if(!u)return identityLoginModal();
  if(u.precisa_criar_login)return identityUpgradeModal();
  if(u.trocar_senha)return identityChangePasswordModal(true);
  if(!u.email)return identityEmailModal(true);
  const member=u.tag==="petiano";
  const body='<div class="modal-main"><div class="identity-profile-head"><div class="identity-avatar">'+esc(u.nome.slice(0,1).toUpperCase())+'</div><div><strong>'+esc(u.nome)+'</strong><span class="status '+(member?"picked":"done")+'">'+(member?"✓ PETiano":"Visitante")+'</span></div></div>'+
    '<div class="field"><label for="identity-my-login">Meu nome de usuário</label><input id="identity-my-login" readonly value="'+attr(u.login||"")+'"></div>'+
    '<div class="field"><label for="identity-my-email">Meu e-mail</label><input id="identity-my-email" readonly value="'+attr(u.email||"")+'"></div>'+
    '<div class="field"><label for="identity-public-id">Meu ID público</label><div class="copy-field"><input id="identity-public-id" readonly value="'+attr(u.id)+'"><button type="button" class="outline-button" id="identity-copy-id">Copiar ID</button></div><small class="hint">O administrador pode encontrar você pelo nome de usuário ou ID.</small></div>'+
    (member?'<div class="notice"><strong>Tag PETiano ativa:</strong> você pode registrar retiradas e devoluções sem aprovação.</div>':'<div class="notice">Sua tag é Visitante. Solicitações de reserva aguardam aprovação do PET.</div>')+
    '<div class="identity-actions">'+(member?'<button type="button" class="primary-button" id="identity-open-withdraw">Registrar retirada</button><button type="button" class="outline-button" id="identity-my-items">Minhas retiradas</button>':'')+
    '<button type="button" class="outline-button" id="identity-refresh-tag">Atualizar minha tag</button>'+
    '<button type="button" class="outline-button" id="identity-email-edit">Alterar meu e-mail</button>'+
    '<button type="button" class="outline-button" id="identity-rename">Alterar meu nome</button>'+
    '<button type="button" class="outline-button" id="identity-change-password">Alterar minha senha</button>'+
    '<button type="button" class="danger-button" id="identity-logout">Sair deste dispositivo</button></div></div>';
  openModal("Meu perfil","Login individual e permissões.",body);
  $("#identity-copy-id").onclick=()=>copyValue(u.id,$("#identity-public-id"));
  if(member){
    $("#identity-open-withdraw").onclick=()=>memberWithdrawModal();
    $("#identity-my-items").onclick=memberHistoryModal;
  }
  $("#identity-refresh-tag").onclick=async()=>{
    try{
      const r=await api("/api/identity/me");
      if(!r.usuario){setIdentity(null);identityLoginModal();toast("Sua sessão expirou. Entre novamente.",true);return;}
      const old=state.identity?.tag;setIdentity(r.usuario);identityProfileModal();
      toast(r.usuario.tag===old?"Seu perfil já está atualizado.":"Sua tag foi atualizada!");
    }catch(error){toast(error.message,true);}
  };
  $("#identity-change-password").onclick=()=>identityChangePasswordModal(false);
  $("#identity-rename").onclick=identityRenameModal;
  $("#identity-email-edit").onclick=()=>identityEmailModal();
  $("#identity-logout").onclick=()=>{if(confirm("Deseja sair deste dispositivo?"))identityLogout();};
}
function identityEmailModal(required=false){
  const u=state.identity;if(!u)return identityLoginModal();
  openModal(required?"Complete seu cadastro":"Alterar e-mail",required?
    "Seu login e sua tag continuam iguais. Informe um e-mail para utilizarmos nas reservas e nos empréstimos.":
    "Este endereço será utilizado nas comunicações do Inventário PET.",
    '<form class="modal-main" id="identity-email-form">'+
    '<div class="field"><label for="identity-email-value">E-mail</label><input type="email" id="identity-email-value" maxlength="180" required autocomplete="email" value="'+attr(u.email||"")+'" placeholder="seuemail@exemplo.com"></div>'+
    '<p class="notice">O cadastro do e-mail não ativa cobranças para PETianes; isso depende da configuração da tag.</p>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0">'+
    (required?'':'<button type="button" class="secondary-button" id="identity-email-cancel">Cancelar</button>')+
    '<button type="submit" class="primary-button" id="identity-email-submit">Salvar e-mail</button></div></form>');
  const cancel=$("#identity-email-cancel");if(cancel)cancel.onclick=identityProfileModal;
  $("#identity-email-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#identity-email-submit");btn.disabled=true;btn.textContent="Salvando…";
    try{
      const r=await api("/api/identity/email","POST",{email:$("#identity-email-value").value.trim()});
      setIdentity(r.usuario);identityProfileModal();toast("E-mail atualizado com sucesso.");
    }catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Salvar e-mail";}
  };
}
function identityRenameModal(){
  openModal("Alterar meu nome","O ID permanece o mesmo mesmo se você mudar o nome.",
    '<form class="modal-main" id="identity-rename-form"><div class="field"><label for="identity-new-name">Nome</label><input id="identity-new-name" maxlength="80" required value="'+attr(state.identity.nome)+'"></div><div class="modal-footer" style="border:0;padding:15px 0 0"><button type="button" class="secondary-button" id="identity-rename-cancel">Cancelar</button><button type="submit" class="primary-button">Salvar meu nome</button></div></form>');
  $("#identity-rename-cancel").onclick=identityProfileModal;
  $("#identity-rename-form").onsubmit=async e=>{
    e.preventDefault();try{
      const result=await api("/api/identity/name","POST",{nome:$("#identity-new-name").value});
      setIdentity(result.usuario);identityProfileModal();toast("Nome atualizado.");
    }catch(error){toast(error.message,true);}
  };
}
async function memberWithdrawModal(initialId){
  if(state.identity?.tag!=="petiano"){toast("Aguarde a liberação da tag PETiano pelo administrador.",true);return identityProfileModal();}
  if(!state.identity.email)return identityEmailModal(true);
  const all=borrowableItems();
  if(!all.length){toast("Não há materiais liberados para retirada.",true);return;}
  const initial=all.find(x=>x.id===initialId)||all[0];
  const today=localDate();
  const body='<form class="modal-main" id="member-withdraw-form">'+
    '<p class="notice"><strong>'+esc(state.identity.nome)+'</strong> · '+esc(state.identity.id)+'<br>Esta retirada será registrada diretamente, sem aprovação prévia.</p>'+
    '<div class="field"><label for="member-item">Material</label><select id="member-item" required>'+all.map(x=>'<option value="'+x.id+'" '+(x.id===initial.id?"selected":"")+'>'+esc(x.nome)+'</option>').join("")+'</select></div>'+
    '<div class="field-grid"><div class="field"><label for="member-qty">Quantidade</label><div class="stepper"><button type="button" class="step" data-target="member-qty" data-delta="-1">−</button><input id="member-qty" type="number" min="1" max="1000" value="1" required><button type="button" class="step" data-target="member-qty" data-delta="1">+</button></div></div>'+
    '<div class="field"><label for="member-due">Previsão de devolução (opcional)</label><input type="date" id="member-due" min="'+today+'"></div></div>'+
    '<p class="hint">E-mail da conta: '+esc(state.identity.email)+'. A notificação depende das regras da tag PETiane.</p>'+
    '<p id="member-availability" class="reservation-availability">Consultando disponibilidade…</p>'+
    '<div class="field"><label for="member-note">Observação (opcional)</label><textarea id="member-note" maxlength="500" placeholder="Onde ou para qual atividade será utilizado?"></textarea></div>'+
    '<div class="modal-footer" style="border:0;padding:14px 0 0"><button type="button" class="secondary-button" id="member-cancel">Cancelar</button><button type="submit" class="primary-button" id="member-submit">Confirmar retirada</button></div></form>';
  openModal("Registrar retirada","PETianos autorizados podem registrar o que pegaram.",body);
  $("#member-cancel").onclick=identityProfileModal;
  let request=0;
  async function check(){
    const index=++request,id=Number($("#member-item").value),due=$("#member-due").value,q=Number($("#member-qty").value);
    const text=$("#member-availability"),submit=$("#member-submit");
    text.textContent="Consultando disponibilidade…";submit.disabled=true;
    if((due&&due<today)||!Number.isInteger(q)||q<1){text.textContent="Confira quantidade e data.";return;}
    try{
      const result=await api("/api/availability?id="+id+"&inicio="+today+"&fim="+(due||today));
      if(index!==request||!document.contains(text))return;
      const ok=result.disponiveis>=q;
      text.className="reservation-availability "+(ok?"available":"unavailable");
      text.textContent=result.disponiveis+" unidade(s) disponíveis para o período"+(ok?"":" — ajuste a solicitação.");
      submit.disabled=!ok;
    }catch(error){if(index!==request||!document.contains(text))return;text.textContent=error.message;}
  }
  for(const id of ["member-item","member-qty","member-due"])$("#"+id).addEventListener("change",check);
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta)));
  $("#member-withdraw-form").onsubmit=async e=>{
    e.preventDefault();const submit=$("#member-submit");submit.disabled=true;submit.textContent="Registrando…";
    try{
      const r=await api("/api/member/withdraw","POST",{componente_id:Number($("#member-item").value),quantidade:Number($("#member-qty").value),data_devolucao:$("#member-due").value,observacao:$("#member-note").value});
      await publicReload();
      toast("Retirada #"+r.retirada_id+" registrada no painel!");
      await memberHistoryModal();
    }catch(error){toast(error.message,true);submit.disabled=false;submit.textContent="Confirmar retirada";}
  };
  check();
}
async function memberHistoryModal(){
  if(state.identity?.tag!=="petiano")return identityProfileModal();
  openModal("Minhas retiradas","Materiais que você retirou diretamente.",'<div class="modal-main" id="member-history">Carregando…</div>');
  const list=$("#member-history");
  try{
    const r=await api("/api/member/history");
    if(!document.contains(list))return;
    list.innerHTML=(r.retiradas||[]).length?'<div class="admin-list">'+r.retiradas.map(x=>{
      const live=x.status==="retirada";
      return '<div class="admin-list-row"><div class="main-info"><strong>'+esc(x.componente_nome)+' · '+x.quantidade+' unidade(s)</strong><small>Retirado: '+esc(fmt(x.retirado_em))+' · Previsto: '+(x.sem_prazo?'Sem prazo':esc(formatDay(x.data_devolucao)))+'</small><span class="status '+(live?"picked":"done")+'">'+(live?"Em uso":"Devolvido")+'</span></div>'+(live?'<button type="button" class="primary-button small-button" data-member-return="'+x.id+'">Devolver</button>':'')+'</div>';
    }).join("")+'</div>':'<div class="empty-state">Nenhuma retirada direta registrada até agora.</div>';
    list.innerHTML+='<div style="margin-top:16px"><button type="button" class="secondary-button" id="member-back-profile">Voltar ao perfil</button></div>';
    $("#member-back-profile").onclick=identityProfileModal;
    $$("[data-member-return]").forEach(btn=>btn.onclick=()=>memberReturnModal(r.retiradas.find(x=>x.id===Number(btn.dataset.memberReturn))));
  }catch(error){if(document.contains(list))list.textContent="Não foi possível carregar: "+error.message;}
}
function memberReturnModal(loan){
  if(!loan)return memberHistoryModal();
  const body='<form id="member-return-form" class="modal-main"><p>Confirmar a devolução de <strong>'+loan.quantidade+' unidade(s) de '+esc(loan.componente_nome)+'</strong>?</p>'+
    '<div class="field"><label for="member-broken">Unidades que voltaram com defeito</label><div class="stepper"><button type="button" class="step" data-target="member-broken" data-delta="-1">−</button><input id="member-broken" type="number" min="0" max="'+loan.quantidade+'" value="0" required><button type="button" class="step" data-target="member-broken" data-delta="1">+</button></div></div>'+
    '<div class="field"><label for="member-return-note">Observações (opcional)</label><textarea id="member-return-note" maxlength="500" placeholder="Condição do material"></textarea></div>'+
    '<div class="modal-footer" style="border:0;padding:13px 0 0"><button type="button" class="secondary-button" id="member-return-cancel">Cancelar</button><button type="submit" class="primary-button" id="member-return-submit">Confirmar devolução</button></div></form>';
  openModal("Devolver material","Seu estoque será atualizado imediatamente.",body);
  $("#member-return-cancel").onclick=()=>{
    if(document.body.dataset.loansRoute==="true"){closeModal();openMyLoans();}
    else memberHistoryModal();
  };
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta)));
  $("#member-return-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#member-return-submit");btn.disabled=true;
    try{
      await api("/api/member/return","POST",{id:loan.id,defeituosos:Number($("#member-broken").value),observacao:$("#member-return-note").value});
      await publicReload();toast("Devolução registrada!");
      if(document.body.dataset.loansRoute==="true"){closeModal();await openMyLoans();}
      else await memberHistoryModal();
    }catch(error){toast(error.message,true);btn.disabled=false;}
  };
}
let userSearch="";
async function renderAdminUsers(target){
  target.innerHTML='<section class="panel-section"><div class="panel-head"><div><h3>Usuários e tags</h3><p>Todo perfil começa como visitante. Somente o administrador libera a tag PETiano.</p></div></div><div class="loading-placeholder">Carregando usuários…</div></section>';
  try{
    const r=await api("/api/admin/users");
    if(!document.contains(target)||state.tab!=="usuarios")return;
    renderAdminUserList(target,r.usuarios||[]);
  }catch(error){if(document.contains(target))target.innerHTML='<section class="panel-section"><div class="alert alert-error">'+esc(error.message)+'</div></section>';}
}
function renderAdminUserList(target,users){
  target.innerHTML='<section class="panel-section"><div class="panel-head"><div><h3>Usuários cadastrados</h3><p>'+users.length+' perfil(is). Pesquise por nome, login ou ID, mesmo que duas pessoas tenham nomes iguais.</p></div></div>'+
    '<div class="field"><label for="user-search">Buscar usuário</label><input id="user-search" type="search" placeholder="Nome, login ou ID PET-..." value="'+attr(userSearch)+'"></div>'+
    '<p class="notice" style="margin-bottom:14px">Se alguém esquecer a senha, use <strong>Redefinir senha</strong> para gerar uma senha temporária. A antiga nunca pode ser visualizada.</p>'+
    '<div class="admin-list" id="users-list"></div></section>';
  const list=$("#users-list");
  function updateList(){
    const query=userSearch.toLocaleLowerCase("pt-BR").trim();
    const visible=users.filter(u=>!query||(u.nome+" "+(u.login||"")+" "+u.id).toLocaleLowerCase("pt-BR").includes(query));
    list.innerHTML=visible.length?visible.map(u=>{
      const member=u.tag==="petiano",active=u.ativo===1;
      return '<div class="admin-list-row user-role-row"><div class="main-info"><strong>'+esc(u.nome)+' <span class="status '+(member?"picked":"done")+'">'+(member?"PETiano":"Visitante")+'</span></strong>'+
        '<small>Login: <strong>'+esc(u.login||"Não configurado")+'</strong> · ID: <code>'+esc(u.id)+'</code></small>'+
        '<small>'+u.retiradas_ativas+' retirada(s) em uso'+(active?"":" · CONTA BLOQUEADA")+'</small></div>'+
        '<div class="actions user-actions">'+
        '<button type="button" class="'+(member?"secondary-button":"primary-button")+' small-button" data-user-id="'+attr(u.id)+'" data-user-tag="'+(member?"visitante":"petiano")+'" '+(active?"":"disabled")+'>'+(member?"Remover tag":"Tornar PETiano")+'</button>'+
        '<button type="button" class="outline-button small-button" data-user-password="'+attr(u.id)+'" '+(active?"":"disabled")+'>Redefinir senha</button>'+
        '<button type="button" class="danger-button small-button" data-user-delete="'+attr(u.id)+'">Excluir</button></div></div>';
    }).join(""):'<div class="empty-state">Nenhum usuário encontrado.</div>';
    $$("[data-user-tag]",list).forEach(btn=>btn.onclick=async()=>{
      const u=users.find(x=>x.id===btn.dataset.userId);
      if(!u)return;
      const tag=btn.dataset.userTag;
      if(!confirm((tag==="petiano"?"Conceder":"Remover")+" a tag PETiano de "+u.nome+" ("+u.id+")?"))return;
      btn.disabled=true;
      try{
        await api("/api/admin/users","POST",{id:u.id,tag});
        toast("Tag atualizada para "+(tag==="petiano"?"PETiano":"Visitante")+".");
        await renderAdminUsers(target);
      }catch(error){toast(error.message,true);btn.disabled=false;}
    });
    $$("[data-user-password]",list).forEach(btn=>btn.onclick=()=>{
      const u=users.find(x=>x.id===btn.dataset.userPassword);
      if(u)adminResetPasswordModal(u);
    });
    $$("[data-user-delete]",list).forEach(btn=>btn.onclick=()=>{
      const u=users.find(x=>x.id===btn.dataset.userDelete);
      if(u)adminDeleteUserModal(u);
    });
  }
  $("#user-search").oninput=e=>{userSearch=e.target.value;updateList();};
  updateList();
}
function adminResetPasswordModal(u){
  openModal("Redefinir senha","Perfil: "+u.nome+" · "+u.id,
    '<form class="modal-main" id="admin-reset-password-form">'+
    '<p class="notice warning"><strong>Verifique pessoalmente a identidade do integrante.</strong> A senha atual será invalidada e todos os dispositivos serão desconectados. A pessoa terá de criar uma senha definitiva ao entrar.</p>'+
    '<div class="field"><label for="admin-reset-login">Nome de usuário</label><input id="admin-reset-login" maxlength="24" minlength="4" required autocapitalize="none" spellcheck="false" value="'+attr(u.login||"")+'" placeholder="Ex.: sergio01"></div>'+
    '<p class="hint">Para perfis antigos sem login, defina um nome de usuário agora. Letras sem acentos, números, ponto, _ ou traço.</p>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0"><button type="button" class="secondary-button" id="admin-reset-cancel">Cancelar</button><button type="submit" class="primary-button" id="admin-reset-submit">Gerar senha temporária</button></div></form>');
  $("#admin-reset-cancel").onclick=adminModal;
  $("#admin-reset-password-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#admin-reset-submit");btn.disabled=true;btn.textContent="Gerando…";
    try{
      const result=await api("/api/admin/users/password","POST",{id:u.id,login:$("#admin-reset-login").value});
      adminShowTemporaryPassword(result);
    }catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Gerar senha temporária";}
  };
}
function adminShowTemporaryPassword(result){
  openModal("Senha temporária gerada","Entregue as informações somente ao titular do perfil.",
    '<div class="modal-main">'+
    '<p class="notice warning">A senha anterior foi invalidada e os dispositivos foram desconectados. <strong>Copie a senha temporária agora:</strong> ela só aparece nesta tela.</p>'+
    '<div class="field"><label for="admin-temp-login">Nome de usuário de '+esc(result.nome)+'</label><div class="copy-field"><input id="admin-temp-login" readonly value="'+attr(result.login)+'"><button type="button" class="outline-button" id="admin-copy-login">Copiar</button></div></div>'+
    '<div class="field"><label for="admin-temp-password">Senha temporária</label><div class="copy-field"><input id="admin-temp-password" readonly value="'+attr(result.senha_temporaria)+'"><button type="button" class="outline-button" id="admin-copy-password">Copiar</button></div></div>'+
    '<p class="notice">O integrante entra normalmente com o login e a senha temporária, depois escolhe sua própria senha definitiva.</p>'+
    '<button type="button" class="primary-button" style="width:100%" id="admin-reset-done">Concluir</button></div>');
  $("#admin-copy-login").onclick=()=>copyValue(result.login,$("#admin-temp-login"));
  $("#admin-copy-password").onclick=()=>copyValue(result.senha_temporaria,$("#admin-temp-password"));
  $("#admin-reset-done").onclick=adminModal;
}
function adminDeleteUserModal(u){
  openModal("Excluir usuário","Confirme a exclusão de "+u.nome+" · "+u.id,
    '<div class="modal-main"><p class="notice warning"><strong>Esta exclusão é permanente.</strong> O perfil, a tag e as sessões serão encerrados. O histórico das movimentações concluídas será preservado para controle patrimonial.</p>'+
    '<p style="font-size:13px">Se houver uma reserva ou retirada ainda em andamento, a exclusão será bloqueada até que ela seja finalizada.</p>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0"><button type="button" class="secondary-button" id="admin-delete-cancel">Cancelar</button><button type="button" class="danger-button" id="admin-delete-confirm">Excluir definitivamente</button></div></div>');
  $("#admin-delete-cancel").onclick=adminModal;
  $("#admin-delete-confirm").onclick=async()=>{
    const btn=$("#admin-delete-confirm");btn.disabled=true;btn.textContent="Excluindo…";
    try{
      await api("/api/admin/users/delete","POST",{id:u.id});
      userSearch="";adminModal();toast("Perfil excluído. Registros concluídos permanecem no histórico.");
    }catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Excluir definitivamente";}
  };
}
