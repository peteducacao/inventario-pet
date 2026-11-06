/* PET Educação — perfil com identidade privada, permissões e retiradas. */
function setIdentity(user){
  state.identity=user;
  state.actor=user?.nome||"";
  if(user)localStorage.setItem("pet_inventario_nome",user.nome);
  else localStorage.removeItem("pet_inventario_nome");
  render();
}
async function copyValue(value,field){
  try{await navigator.clipboard.writeText(value);toast("Copiado!");}
  catch{if(field){field.focus();field.select();}toast("Selecione o texto para copiar.");}
}
function identityRegisterModal(first=false){
  const html='<form class="modal-main" id="register-user-form">'+
    '<div class="field"><label for="identity-name">Seu nome</label><input id="identity-name" autocomplete="name" maxlength="80" required placeholder="Como podemos chamar você?" value="'+attr(state.actor)+'"></div>'+
    '<p class="notice">Todo perfil começa como <strong>Visitante</strong>. O site gera seu ID automaticamente. Somente um administrador pode dar a tag <strong>PETiano</strong>.</p>'+
    '<div class="modal-footer" style="border:0;padding:17px 0 0"><button type="submit" class="primary-button" id="identity-register-submit">Criar meu perfil</button></div>'+
    '<div class="identity-separator">Já tem um ID e um código de recuperação?</div><button type="button" class="outline-button" id="identity-recover-button" style="width:100%">Usar perfil existente</button>'+
    '</form>';
  openModal("Quem é você, PETiane?","Seu perfil será identificado no inventário, sem senhas complicadas.",html);
  $("#identity-recover-button").onclick=identityRecoverModal;
  $("#register-user-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#identity-register-submit");btn.disabled=true;btn.textContent="Criando perfil…";
    try{
      const result=await api("/api/identity/register","POST",{nome:$("#identity-name").value});
      setIdentity(result.usuario);
      if(result.codigo_recuperacao)identityShowRecovery(result.codigo_recuperacao,true);
      else identityProfileModal();
      toast("Perfil criado e identificado!");
    }catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Criar meu perfil";}
  };
  if(first)$("#identity-name")?.focus();
}
function identityShowRecovery(code,newAccount=false){
  const id=state.identity?.id||"";
  openModal(newAccount?"Seu perfil foi criado!":"Novo código gerado",
    "Guarde o código privado para recuperar seu perfil caso troque de aparelho.",
    '<div class="modal-main"><p class="notice warning"><strong>Importante:</strong> este código aparece apenas agora. O ID pode ser compartilhado com o administrador, mas o código de recuperação é secreto.</p>'+
    '<div class="field"><label for="recovery-public-id">Seu ID público</label><div class="copy-field"><input id="recovery-public-id" readonly value="'+attr(id)+'"><button type="button" class="outline-button" id="copy-identity-id">Copiar</button></div></div>'+
    '<div class="field"><label for="secret-recovery-code">Código privado de recuperação</label><div class="copy-field"><input id="secret-recovery-code" readonly value="'+attr(code)+'"><button type="button" class="outline-button" id="copy-identity-secret">Copiar</button></div></div>'+
    '<button type="button" class="primary-button" id="recovery-done" style="width:100%">Entendi, continuar</button></div>');
  $("#copy-identity-id").onclick=()=>copyValue(id,$("#recovery-public-id"));
  $("#copy-identity-secret").onclick=()=>copyValue(code,$("#secret-recovery-code"));
  $("#recovery-done").onclick=identityProfileModal;
}
function identityRecoverModal(){
  const body='<form class="modal-main" id="identity-recover-form">'+
    '<p class="notice">Seu ID é público, mas o código de recuperação é privado. Use os dois para acessar seu perfil em outro navegador.</p>'+
    '<div class="field"><label for="identity-recovery-id">ID do perfil</label><input id="identity-recovery-id" placeholder="PET-XXXXXXXXXXXX" maxlength="20" autocomplete="off" required></div>'+
    '<div class="field"><label for="identity-recovery-code">Código privado de recuperação</label><input id="identity-recovery-code" placeholder="REC-..." maxlength="60" autocomplete="off" required></div>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0"><button type="button" class="secondary-button" id="identity-create-new">Criar novo perfil</button><button type="submit" class="primary-button" id="identity-recover-submit">Entrar no meu perfil</button></div></form>';
  openModal("Recuperar perfil","Acesse suas permissões mesmo em outro aparelho.",body);
  $("#identity-create-new").onclick=identityRegisterModal;
  $("#identity-recover-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#identity-recover-submit");btn.disabled=true;
    try{
      const result=await api("/api/identity/recover","POST",{id:$("#identity-recovery-id").value,codigo:$("#identity-recovery-code").value});
      setIdentity(result.usuario);identityProfileModal();toast("Perfil recuperado!");
    }catch(error){toast(error.message,true);btn.disabled=false;}
  };
}
function identityProfileModal(){
  const u=state.identity;if(!u)return identityRegisterModal();
  const member=u.tag==="petiano";
  const body='<div class="modal-main"><div class="identity-profile-head"><div class="identity-avatar">'+esc(u.nome.slice(0,1).toUpperCase())+'</div><div><strong>'+esc(u.nome)+'</strong><span class="status '+(member?"picked":"done")+'">'+(member?"✓ PETiano":"Visitante")+'</span></div></div>'+
    '<div class="field"><label for="identity-public-id">Meu ID público</label><div class="copy-field"><input id="identity-public-id" readonly value="'+attr(u.id)+'"><button type="button" class="outline-button" id="identity-copy-id">Copiar ID</button></div><small class="hint">Passe este ID ao administrador para solicitar a tag PETiano. O ID não é uma senha.</small></div>'+
    (member?'<div class="notice"><strong>Tag PETiano ativa:</strong> você já pode retirar materiais diretamente e registrar suas devoluções, sem aguardar aprovação.</div>':'<div class="notice">Seu perfil é de visitante. Você pode solicitar reservas, que precisam de aprovação do PET.</div>')+
    '<div class="identity-actions">'+(member?'<button type="button" class="primary-button" id="identity-open-withdraw">Registrar retirada</button><button type="button" class="outline-button" id="identity-my-items">Minhas retiradas</button>':'')+
    '<button type="button" class="outline-button" id="identity-refresh-tag">Atualizar minha tag</button><button type="button" class="outline-button" id="identity-rename">Alterar meu nome</button><button type="button" class="outline-button" id="identity-new-recovery">Novo código de recuperação</button>'+
    '<button type="button" class="danger-button" id="identity-logout">Sair deste dispositivo</button></div></div>';
  openModal("Meu perfil","Identificação individual e permissões.",body);
  $("#identity-copy-id").onclick=()=>copyValue(u.id,$("#identity-public-id"));
  if(member){
    $("#identity-open-withdraw").onclick=()=>memberWithdrawModal();
    $("#identity-my-items").onclick=memberHistoryModal;
  }
  $("#identity-refresh-tag").onclick=async()=>{
    try{
      const r=await api("/api/identity/me");
      if(!r.usuario){setIdentity(null);identityRecoverModal();toast("Seu acesso expirou. Use seu ID e o código privado.",true);return;}
      const old=state.identity?.tag;setIdentity(r.usuario);identityProfileModal();
      toast(r.usuario.tag===old?"Seu perfil já está atualizado.":"Sua tag foi atualizada!");
    }catch(error){toast(error.message,true);}
  };
  $("#identity-rename").onclick=identityRenameModal;
  $("#identity-new-recovery").onclick=async()=>{
    if(!confirm("Gerar outro código? O anterior deixará de funcionar. Guarde o novo código em lugar seguro."))return;
    try{const result=await api("/api/identity/recovery-code","POST",{});identityShowRecovery(result.codigo_recuperacao);}catch(error){toast(error.message,true);}
  };
  $("#identity-logout").onclick=async()=>{
    if(!confirm("Sair deste dispositivo? Para voltar a este perfil, você precisará do ID e do código de recuperação."))return;
    try{await api("/api/identity/logout","POST",{});setIdentity(null);identityRegisterModal();toast("Você saiu deste perfil.");}
    catch(error){toast(error.message,true);}
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
  const all=state.data.componentes;
  if(!all.length){toast("Não há materiais cadastrados.",true);return;}
  const initial=byId(initialId)||all[0];
  const today=localDate(),seven=localDate(new Date(Date.now()+7*86400000));
  const body='<form class="modal-main" id="member-withdraw-form">'+
    '<p class="notice"><strong>'+esc(state.identity.nome)+'</strong> · '+esc(state.identity.id)+'<br>Esta retirada será registrada diretamente, sem aprovação prévia.</p>'+
    '<div class="field"><label for="member-item">Material</label><select id="member-item" required>'+all.map(x=>'<option value="'+x.id+'" '+(x.id===initial.id?"selected":"")+'>'+esc(x.nome)+'</option>').join("")+'</select></div>'+
    '<div class="field-grid"><div class="field"><label for="member-qty">Quantidade</label><div class="stepper"><button type="button" class="step" data-target="member-qty" data-delta="-1">−</button><input id="member-qty" type="number" min="1" max="1000" value="1" required><button type="button" class="step" data-target="member-qty" data-delta="1">+</button></div></div>'+
    dateInput("member-due","Previsão de devolução",seven,today)+'</div>'+
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
    if(!due||due<today||!Number.isInteger(q)||q<1){text.textContent="Informe quantidade e data válidas.";return;}
    try{
      const result=await api("/api/availability?id="+id+"&inicio="+today+"&fim="+due);
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
      return '<div class="admin-list-row"><div class="main-info"><strong>'+esc(x.componente_nome)+' · '+x.quantidade+' unidade(s)</strong><small>Retirado: '+esc(fmt(x.retirado_em))+' · Previsto: '+esc(formatDay(x.data_devolucao))+'</small><span class="status '+(live?"picked":"done")+'">'+(live?"Em uso":"Devolvido")+'</span></div>'+(live?'<button type="button" class="primary-button small-button" data-member-return="'+x.id+'">Devolver</button>':'')+'</div>';
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
  $("#member-return-cancel").onclick=memberHistoryModal;
  $$(".step").forEach(b=>b.onclick=()=>stepNumber(b.dataset.target,Number(b.dataset.delta)));
  $("#member-return-form").onsubmit=async e=>{
    e.preventDefault();const btn=$("#member-return-submit");btn.disabled=true;
    try{
      await api("/api/member/return","POST",{id:loan.id,defeituosos:Number($("#member-broken").value),observacao:$("#member-return-note").value});
      await publicReload();toast("Devolução registrada!");await memberHistoryModal();
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
  target.innerHTML='<section class="panel-section"><div class="panel-head"><div><h3>Usuários cadastrados</h3><p>'+users.length+' perfil(is). Pesquise pelo nome ou ID, mesmo se duas pessoas tiverem o mesmo nome.</p></div></div>'+
    '<div class="field"><label for="user-search">Buscar usuário</label><input id="user-search" type="search" placeholder="Nome ou ID PET-..." value="'+attr(userSearch)+'"></div>'+
    '<p class="notice warning" style="margin-bottom:14px">O código de recuperação antigo nunca é visível, nem para o administrador. Você pode gerar outro código quando a pessoa perder o acesso.</p>'+
    '<div class="admin-list" id="users-list"></div></section>';
  const list=$("#users-list");
  function updateList(){
    const query=userSearch.toLocaleLowerCase("pt-BR").trim();
    const visible=users.filter(u=>!query||(u.nome+" "+u.id).toLocaleLowerCase("pt-BR").includes(query));
    list.innerHTML=visible.length?visible.map(u=>{
      const member=u.tag==="petiano",active=u.ativo===1;
      return '<div class="admin-list-row user-role-row"><div class="main-info"><strong>'+esc(u.nome)+' <span class="status '+(member?"picked":"done")+'">'+(member?"PETiano":"Visitante")+'</span></strong>'+
        '<small>ID: <code>'+esc(u.id)+'</code> · Desde '+esc(formatDay(u.criado_em.slice(0,10)))+'</small>'+
        '<small>'+u.retiradas_ativas+' retirada(s) em uso'+(active?"":" · CONTA BLOQUEADA")+'</small></div>'+
        '<div class="actions user-actions">'+
        '<button type="button" class="'+(member?"secondary-button":"primary-button")+' small-button" data-user-id="'+attr(u.id)+'" data-user-tag="'+(member?"visitante":"petiano")+'" '+(active?"":"disabled")+'>'+(member?"Remover tag":"Tornar PETiano")+'</button>'+
        '<button type="button" class="outline-button small-button" data-user-recovery="'+attr(u.id)+'" '+(active?"":"disabled")+'>Novo código</button>'+
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
    $$("[data-user-recovery]",list).forEach(btn=>btn.onclick=()=>{
      const u=users.find(x=>x.id===btn.dataset.userRecovery);
      if(u)adminRecoveryModal(u);
    });
    $$("[data-user-delete]",list).forEach(btn=>btn.onclick=()=>{
      const u=users.find(x=>x.id===btn.dataset.userDelete);
      if(u)adminDeleteUserModal(u);
    });
  }
  $("#user-search").oninput=e=>{userSearch=e.target.value;updateList();};
  updateList();
}
function adminRecoveryModal(u){
  openModal("Recuperar acesso de usuário","Perfil: "+u.nome+" · "+u.id,
    '<div class="modal-main"><p class="notice warning">Confirme pessoalmente a identidade do integrante antes de gerar um código. O código anterior deixará de funcionar e o usuário precisará entrar novamente em todos os dispositivos.</p>'+
    '<p style="font-size:13px">O sistema não permite visualizar o código privado antigo. Você poderá copiar o novo código uma única vez e entregá-lo ao integrante.</p>'+
    '<div class="modal-footer" style="border:0;padding:15px 0 0"><button type="button" class="secondary-button" id="admin-recovery-cancel">Cancelar</button><button type="button" class="primary-button" id="admin-recovery-generate">Gerar novo código</button></div></div>');
  $("#admin-recovery-cancel").onclick=adminModal;
  $("#admin-recovery-generate").onclick=async()=>{
    const btn=$("#admin-recovery-generate");
    btn.disabled=true;btn.textContent="Gerando…";
    try{
      const result=await api("/api/admin/users/recovery","POST",{id:u.id});
      adminShowRecoveryCode(result);
    }catch(error){toast(error.message,true);btn.disabled=false;btn.textContent="Gerar novo código";}
  };
}
function adminShowRecoveryCode(result){
  openModal("Novo código gerado","Entregue estas informações somente ao titular do perfil.",
    '<div class="modal-main">'+
    '<p class="notice warning"><strong>Atenção:</strong> o código antigo foi invalidado, assim como as sessões anteriores. Copie o novo código agora. Por segurança ele não aparecerá novamente no painel.</p>'+
    '<div class="field"><label for="admin-recovery-id">ID público de '+esc(result.nome)+'</label><div class="copy-field"><input id="admin-recovery-id" readonly value="'+attr(result.id)+'"><button type="button" class="outline-button" id="admin-copy-id">Copiar</button></div></div>'+
    '<div class="field"><label for="admin-new-code">Novo código privado</label><div class="copy-field"><input id="admin-new-code" readonly value="'+attr(result.codigo_recuperacao)+'"><button type="button" class="outline-button" id="admin-copy-code">Copiar</button></div></div>'+
    '<p class="notice">O integrante acessa <strong>Meu perfil → Usar perfil existente</strong> e informa o ID e o novo código.</p>'+
    '<button type="button" class="primary-button" style="width:100%" id="admin-recovery-done">Concluir</button></div>');
  $("#admin-copy-id").onclick=()=>copyValue(result.id,$("#admin-recovery-id"));
  $("#admin-copy-code").onclick=()=>copyValue(result.codigo_recuperacao,$("#admin-new-code"));
  $("#admin-recovery-done").onclick=adminModal;
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
