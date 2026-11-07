// Identidades independentes de nomes: ID publico + credencial privada em cookie HttpOnly.
// O ID nao autentica. A tag PETiano so pode ser alterada pelo administrador.
const HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const respond = (data,status=200,extra={}) => new Response(JSON.stringify(data),{status,headers:{...HEADERS,...extra}});
const error = (message,status=400) => respond({error:message},status);
const now = () => new Date().toISOString();
async function identityAudit(db,action,type,id,description,actor="Admin"){
 try{await db.prepare("INSERT INTO historico_admin(criado_em,responsavel,acao,tipo,registro_id,descricao) VALUES(?,?,?,?,?,?)")
   .bind(now(),clean(actor,100),clean(action,60),clean(type,50),Number.isInteger(Number(id))?Number(id):null,clean(description,1000)).run();}
 catch(e){console.error("Não foi possível gravar histórico",String(e).slice(0,160));}
}
const clean = (v,max=120)=>String(v??"").trim().slice(0,max);
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const randomHex = size => [...crypto.getRandomValues(new Uint8Array(size))].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
const publicUser = u => ({id:u.public_id,nome:u.nome,email:u.email||"",tag:u.papel,criado_em:u.criado_em,ativo:u.ativo===1,login:u.login||null,precisa_criar_login:!u.login,trocar_senha:!!u.must_change_password});
const expiry = () => new Date(Date.now()+180*86400000).toISOString();
const authCookie = "__Host_pet_identity";
const cookieValue = req => (req.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(authCookie+"="))?.slice(authCookie.length+1)||"";
const setCookie = value => authCookie+"="+value+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=15552000";
const clearCookie = () => authCookie+"=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0";
const brazilDate = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const formatDateValid = x => {
  if(typeof x!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(x))return false;
  const d=new Date(x+"T12:00:00Z");
  return !Number.isNaN(+d)&&d.toISOString().slice(0,10)===x;
};
async function bodyJson(req,max=6000){
  if(!req.headers.get("content-type")?.toLowerCase().includes("application/json"))throw Error("Use o formato JSON.");
  const raw=await req.text();if(raw.length>max)throw Error("Dados muito grandes.");
  const data=JSON.parse(raw);if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Dados inválidos.");
  return data;
}
const rows = async(db,sql,args=[]) => (await db.prepare(sql).bind(...args).all()).results||[];
async function loggedIn(req,db){
  const token=cookieValue(req);
  if(!/^[0-9a-f-]{60,90}$/.test(token))return null;
  const user=await db.prepare("SELECT u.id,u.public_id,u.nome,u.papel,u.ativo,u.criado_em,u.ultimo_acesso,u.email,u.login,u.password_hash,u.password_salt,u.password_iterations,u.must_change_password FROM usuario_sessoes s JOIN usuarios u ON u.id=s.usuario_id WHERE s.hash=? AND s.expira_em>? AND u.ativo=1").bind(await sha256(token),now()).first();
  return user||null;
}
async function addSession(db,id){
  const token=crypto.randomUUID()+crypto.randomUUID();
  await db.prepare("INSERT INTO usuario_sessoes(hash,usuario_id,expira_em) VALUES(?,?,?)").bind(await sha256(token),id,expiry()).run();
  return setCookie(token);
}
async function rate(db,req,tag,max,windowH=24) {
  const ip=clean(req.headers.get("CF-Connecting-IP")||"unknown",100);
  const marker=await sha256("identity:"+tag+":"+ip+":"+new Date().toISOString().slice(0,10));
  const start=new Date(Date.now()-windowH*3600000).toISOString();
  const count=await db.prepare("SELECT COUNT(*) AS n FROM reserva_limites WHERE hash=? AND criado_em>=?").bind(marker,start).first();
  if((count?.n||0)>=max)return false;
  await db.prepare("INSERT INTO reserva_limites(hash,criado_em) VALUES(?,?)").bind(marker,now()).run();
  return true;
}
// PBKDF2 com sal unico. Nunca guardar senha ou credencial temporaria em texto puro.
const ITERATIONS=100000;
const username = value => clean(value,30).toLowerCase();
const validUsername = value => /^[a-z0-9][a-z0-9._-]{3,23}$/.test(value);
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length<=180;
// Sem exigência de número mínimo de dígitos. Limite técnico amplo para prevenir abuso de memória.
const MAX_PASSWORD_LENGTH=2048;
const validPassword = value => typeof value==="string" && value.length>=1 && value.length<=MAX_PASSWORD_LENGTH;
const secureEquals = (a,b) => {
  if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
};
async function hashPassword(password,salt,iterations=ITERATIONS) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const saltBytes=new Uint8Array((salt.match(/.{2}/g)||[]).map(x=>parseInt(x,16)));
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:saltBytes,iterations},key,256);
  return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function verifyPassword(value,user) {
  if(!user.password_salt||!user.password_hash||!user.password_iterations||typeof value!=="string")return false;
  const digest=await hashPassword(value,user.password_salt,user.password_iterations);
  return secureEquals(digest,user.password_hash);
}
const securityFields=async secret => {
  const salt=randomHex(16),hash=await hashPassword(secret,salt);
  return {salt,hash};
};
const maybeDuplicate=e=>String(e?.message||e).includes("UNIQUE")||String(e?.message||e).includes("constraint failed");
async function register(req,env){
  const db=env.DB,existing=await loggedIn(req,db);
  if(existing)return respond({ok:true,usuario:publicUser(existing),ja_cadastrado:true});
  const b=await bodyJson(req,12000),nome=clean(b.nome,80),login=username(b.login),email=clean(b.email,180).toLowerCase(),password=b.senha;
  if(nome.length<2)return error("Informe seu nome.");
  if(!validEmail(email))return error("Informe um e-mail válido para criar sua conta.");
  if(!validUsername(login))return error("O login deve ter de 4 a 24 caracteres: letras sem acentos, números, ponto, traço ou _.");
  if(!validPassword(password))return error("Informe uma senha com até 2.048 caracteres.");
  if(!await rate(db,req,"cadastro",20))return error("Limite de cadastros atingido. Tente mais tarde.",429);
  const taken=await db.prepare("SELECT 1 AS n FROM usuarios WHERE login=?").bind(login).first();
  if(taken)return error("Este nome de usuário já está em uso.",409);
  const {hash,salt}=await securityFields(password),time=now(),recoveryHash=await sha256(crypto.randomUUID());
  let user;
  for(let attempt=0;attempt<4;attempt++){
    const publicId="PET-"+randomHex(6);
    try{
      const result=await db.prepare("INSERT INTO usuarios(public_id,nome,email,papel,ativo,recovery_hash,criado_em,atualizado_em,login,password_hash,password_salt,password_iterations,must_change_password) VALUES (?,?,?,'visitante',1,?,?,?,?,?,?,?,0)").bind(publicId,nome,email,recoveryHash,time,time,login,hash,salt,ITERATIONS).run();
      user=await db.prepare("SELECT * FROM usuarios WHERE id=?").bind(result.meta.last_row_id).first();
      break;
    }catch(e){
      if(!maybeDuplicate(e))throw e;
      const clash=await db.prepare("SELECT 1 AS n FROM usuarios WHERE login=?").bind(login).first();
      if(clash)return error("Este nome de usuário já está em uso.",409);
    }
  }
  if(!user)return error("Não foi possível criar a conta.",503);
  const session=await addSession(db,user.id);
  return respond({ok:true,usuario:publicUser(user)},201,{"set-cookie":session});
}
async function loginUser(req,env){
  const db=env.DB,b=await bodyJson(req,12000),login=username(b.login);
  if(!validUsername(login)||!validPassword(b.senha))return error("Login ou senha incorretos.",401);
  if(!await rate(db,req,"login:"+login,12,1))return error("Muitas tentativas de login. Tente mais tarde.",429);
  const u=await db.prepare("SELECT * FROM usuarios WHERE login=? AND ativo=1").bind(login).first();
  if(!u||!await verifyPassword(b.senha,u))return error("Login ou senha incorretos.",401);
  const session=await addSession(db,u.id);
  await db.prepare("UPDATE usuarios SET ultimo_acesso=? WHERE id=?").bind(now(),u.id).run();
  return respond({ok:true,usuario:publicUser(u)},200,{"set-cookie":session});
}
// Conversao de perfis antigos: requer a sessao privada ja existente, nunca apenas o ID.
async function upgradeLegacy(req,env){
  const user=await loggedIn(req,env.DB);
  if(!user)return error("Entre no perfil antigo neste aparelho ou peça redefinição ao administrador.",401);
  if(user.login)return error("Esta conta já usa login e senha.",409);
  const b=await bodyJson(req,12000),login=username(b.login),email=clean(b.email,180).toLowerCase(),password=b.senha;
  if(!validEmail(email))return error("Informe um e-mail válido para atualizar seu cadastro.");
  if(!validUsername(login))return error("Escolha um login de 4 a 24 caracteres (letras, números, ponto, _ ou traço).");
  if(!validPassword(password))return error("Informe uma senha com até 2.048 caracteres.");
  if(await env.DB.prepare("SELECT 1 AS n FROM usuarios WHERE login=?").bind(login).first())return error("Este login já está em uso.",409);
  const {hash,salt}=await securityFields(password);
  try {
    const applied=await env.DB.batch([
      env.DB.prepare("UPDATE usuarios SET login=?,email=?,password_hash=?,password_salt=?,password_iterations=?,must_change_password=0,atualizado_em=? WHERE id=? AND login IS NULL").bind(login,email,hash,salt,ITERATIONS,now(),user.id),
      env.DB.prepare("DELETE FROM usuario_sessoes WHERE usuario_id=?").bind(user.id)
    ]);
    if(applied[0].meta?.changes!==1)return error("Conta já atualizada. Entre com login e senha.",409);
  }catch(e){if(maybeDuplicate(e))return error("Este login já está em uso.",409);throw e;}
  const session=await addSession(env.DB,user.id);
  const updated=await env.DB.prepare("SELECT * FROM usuarios WHERE id=?").bind(user.id).first();
  return respond({ok:true,usuario:publicUser(updated)},200,{"set-cookie":session});
}
async function changePassword(req,env){
  const u=await loggedIn(req,env.DB);
  if(!u)return error("Entre no seu perfil antes de alterar a senha.",401);
  if(!u.login)return error("Primeiro configure login e senha para o perfil antigo.",409);
  const b=await bodyJson(req,12000),newPassword=b.nova_senha;
  if(!validPassword(newPassword))return error("Informe uma nova senha com até 2.048 caracteres.");
  if(!u.must_change_password&&!await verifyPassword(b.senha_atual,u))return error("Senha atual incorreta.",401);
  if(await verifyPassword(newPassword,u))return error("Escolha uma senha diferente da anterior.");
  const {hash,salt}=await securityFields(newPassword);
  await env.DB.batch([
    env.DB.prepare("UPDATE usuarios SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=0,atualizado_em=? WHERE id=?").bind(hash,salt,ITERATIONS,now(),u.id),
    env.DB.prepare("DELETE FROM usuario_sessoes WHERE usuario_id=?").bind(u.id)
  ]);
  const session=await addSession(env.DB,u.id);
  return respond({ok:true,usuario:{...publicUser(u),trocar_senha:false}},200,{"set-cookie":session});
}
async function updateEmail(req,env,user){
  if(!user)return error("Entre na sua conta para cadastrar o e-mail.",401);
  if(!user.login||user.must_change_password)return error("Finalize o acesso à sua conta antes de cadastrar o e-mail.",403);
  const b=await bodyJson(req,3000),email=clean(b.email,180).toLowerCase();
  if(!validEmail(email))return error("Informe um e-mail válido.");
  await env.DB.prepare("UPDATE usuarios SET email=?,atualizado_em=? WHERE id=?").bind(email,now(),user.id).run();
  return respond({ok:true,usuario:{...publicUser(user),email}});
}
async function rename(req,env,user){
  if(!user)return error("Cadastre seu perfil antes de editar o nome.",401);
  const b=await bodyJson(req,3000),name=clean(b.nome,80);
  if(name.length<2)return error("Informe seu nome.");
  await env.DB.prepare("UPDATE usuarios SET nome=?,atualizado_em=? WHERE id=?").bind(name,now(),user.id).run();
  return respond({ok:true,usuario:{...publicUser(user),nome:name}});
}
async function listMine(db,user){
  const list=await rows(db,"SELECT r.id,r.componente_id,r.quantidade,r.data_inicio,r.data_devolucao,r.sem_prazo,r.status,r.observacao,r.solicitado_em,r.retirado_em,r.devolvido_em,r.tipo,c.nome AS componente_nome FROM reservas r JOIN componentes c ON c.id=r.componente_id WHERE r.usuario_id=? ORDER BY r.solicitado_em DESC LIMIT 300",[user.id]);
  return respond({ok:true,retiradas:list});
}
async function withdraw(req,env,user){
  if(!user||user.papel!=="petiano")return error("Somente PETianos autorizados podem retirar materiais diretamente.",403);
  const b=await bodyJson(req,5000),id=Number(b.componente_id),quantity=Number(b.quantidade),due=clean(b.data_devolucao,10),email=clean(user.email,180).toLowerCase(),note=clean(b.observacao,500);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)return error("Material ou quantidade inválidos.");
  if(due&&(!formatDateValid(due)||due<brazilDate()))return error("Informe uma data de devolução válida.");
  if(!validEmail(email))return error("Cadastre seu e-mail em Minha conta antes de retirar materiais.");
  const item=await env.DB.prepare("SELECT id,nome,quantidade,em_uso,com_defeito,mostrar_quantidade,arquivado,categoria_id,permitir_emprestimos,permitir_petianos FROM componentes WHERE id=?").bind(id).first();
  if(!item)return error("Material não encontrado.",404);
  const cat=await env.DB.prepare("SELECT arquivada,permitir_emprestimos,permitir_petianos FROM categorias WHERE id=?").bind(item.categoria_id).first();
  if(item.arquivado===1||cat?.arquivada===1)return error("Material arquivado. Procure o administrador.",409);
  if(!cat||Number(cat.permitir_petianos)===0||Number(item.permitir_petianos)===0)return error("Retirada para PETianes desativada nesta categoria ou material.",409);
  if(item.quantidade-item.em_uso<quantity)return error("Estoque insuficiente para retirada.",409);
  const stamp=now(),actor=user.nome+" ("+user.public_id+")",today=brazilDate();
  const fields=["componente_id","nome_solicitante","contato","email","quantidade","data_inicio","data_devolucao","status","observacao","solicitado_em","retirado_em","responsavel_admin","usuario_id","tipo","sem_prazo"];
  const values=[id,user.nome,"",email,quantity,today,due||today,"retirada",note,stamp,stamp,actor,user.id,"retirada_direta",due?0:1];
  const batch=await env.DB.batch([
    env.DB.prepare("INSERT INTO reservas ("+fields.join(",")+") VALUES ("+fields.map(()=>"?").join(",")+")").bind(...values),
    env.DB.prepare("UPDATE componentes SET em_uso=em_uso+?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=? AND quantidade-em_uso>=?").bind(quantity,stamp,actor,"Retirada direta: "+quantity+" unidade(s)",id,quantity)
  ]);
  if(batch[0].meta?.changes!==1||batch[1].meta?.changes!==1)return error("Não foi possível registrar a retirada.",409);
  await identityAudit(env.DB,"Retirada direta","material",id,item.nome+" · "+quantity+" unidade(s)",actor);
  return respond({ok:true,retirada_id:batch[0].meta.last_row_id},201);
}
async function memberReturn(req,env,user){
  if(!user)return error("Entre em sua conta para registrar a devolução.",401);
  if(!user.login||user.must_change_password)return error("Finalize o cadastro da conta para devolver materiais.",403);
  const b=await bodyJson(req,3000),id=Number(b.id),discarded=Number(b.descartados ?? b.defeituosos ?? 0),note=clean(b.observacao,500);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(discarded)||discarded<0)return error("Identificação ou quantidade inválida.");
  const r=await env.DB.prepare("SELECT * FROM reservas WHERE id=? AND usuario_id=? AND status='retirada'").bind(id,user.id).first();
  if(!r)return error("Retirada não encontrada ou já devolvida.",404);
  if(discarded>r.quantidade)return error("O descarte não pode ultrapassar a quantidade retirada.");
  const component=await env.DB.prepare("SELECT quantidade,em_uso FROM componentes WHERE id=?").bind(r.componente_id).first();
  if(!component||component.em_uso<r.quantidade||component.quantidade<discarded)return error("Estoque em uso inconsistente. Procure o administrador.",409);
  const stamp=now(),actor=user.nome+" ("+user.public_id+")";
  // Em uma mesma transacao, atualizar o estoque apenas se a retirada ainda estiver ativa.
  const done=await env.DB.batch([
    env.DB.prepare("UPDATE componentes SET em_uso=em_uso-?,quantidade=quantidade-?,com_defeito=0,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=? AND em_uso>=? AND quantidade>=? AND EXISTS(SELECT 1 FROM reservas WHERE id=? AND usuario_id=? AND status='retirada')")
      .bind(r.quantidade,discarded,stamp,actor,"Devolução de "+r.quantidade+" unidade(s)"+(discarded?" • "+discarded+" descartada(s)":""),r.componente_id,r.quantidade,discarded,id,user.id),
    env.DB.prepare("UPDATE reservas SET status='devolvida',devolvido_em=?,responsavel_admin=?,observacao=? WHERE id=? AND usuario_id=? AND status='retirada'").bind(stamp,actor,note||r.observacao,id,user.id)
  ]);
  if(done[0].meta?.changes!==1||done[1].meta?.changes!==1)return error("Não foi possível registrar a devolução.",409);
  // O PETiane já confirmou a própria devolução: não gerar aviso redundante.
  // Para visitantes, a notificação interna de confirmação permanece.
  if(user.papel!=="petiano"){
    await env.DB.prepare("INSERT INTO notificacoes(usuario_id,reserva_id,titulo,mensagem,tipo) VALUES(?,?,?,?,?)")
      .bind(user.id,id,"Devolução registrada","A devolução de seu material foi registrada.","devolucao").run();
  }
  await identityAudit(env.DB,"Devolução pelo titular","material",r.componente_id,"Reserva #"+id+" · "+r.quantidade+" unidade(s)"+(discarded?" · "+discarded+" descartada(s)":""),actor);
  return respond({ok:true});
}
async function adminUpdate(req,env){
  const b=await bodyJson(req,3000);
  const id=clean(b.id,30).toUpperCase(),tag=clean(b.tag,20).toLowerCase();
  if(!/^PET-[0-9A-F]{12}$/.test(id))return error("ID inválido.");
  if(!["visitante","petiano"].includes(tag))return error("Cargo inválido.");
  const active=b.ativo===false?0:1;
  const user=await env.DB.prepare("SELECT id FROM usuarios WHERE public_id=?").bind(id).first();
  if(!user)return error("Usuário não encontrado.",404);
  const notify=typeof b.notificar_email==="boolean"?(b.notificar_email?1:0):null;
  await env.DB.prepare("UPDATE usuarios SET papel=?,ativo=?,notificar_email=COALESCE(?,notificar_email),atualizado_em=? WHERE id=?").bind(tag,active,notify,now(),user.id).run();
  if(!active)await env.DB.prepare("DELETE FROM usuario_sessoes WHERE usuario_id=?").bind(user.id).run();
  await identityAudit(env.DB,"Alterou acesso","usuario",user.id,id+" · "+tag+" · "+(active?"Ativo":"Bloqueado"));
  return respond({ok:true});
}
// A senha temporaria so aparece na resposta do reset; os valores armazenados sao hash+sal.
async function adminResetPassword(req,env){
  const b=await bodyJson(req,3000),id=clean(b.id,30).toUpperCase(),login=username(b.login);
  if(!/^PET-[0-9A-F]{12}$/.test(id))return error("ID inválido.");
  if(!validUsername(login))return error("Informe um login válido, de 4 a 24 caracteres.");
  const user=await env.DB.prepare("SELECT id,public_id,nome,ativo,login FROM usuarios WHERE public_id=?").bind(id).first();
  if(!user)return error("Usuário não encontrado.",404);
  if(user.ativo!==1)return error("Usuário bloqueado.",409);
  const owner=await env.DB.prepare("SELECT id FROM usuarios WHERE login=? AND id!=?").bind(login,user.id).first();
  if(owner)return error("Esse login já está em uso.",409);
  const temporary="PET-"+randomHex(12);
  const {hash,salt}=await securityFields(temporary);
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE usuarios SET login=?,password_hash=?,password_salt=?,password_iterations=?,must_change_password=1,atualizado_em=? WHERE id=?").bind(login,hash,salt,ITERATIONS,now(),user.id),
      env.DB.prepare("DELETE FROM usuario_sessoes WHERE usuario_id=?").bind(user.id)
    ]);
  }catch(e){if(maybeDuplicate(e))return error("Esse login já está em uso.",409);throw e;}
  await identityAudit(env.DB,"Redefiniu senha","usuario",user.id,user.nome+" · login "+login);
  return respond({ok:true,id:user.public_id,nome:user.nome,login,senha_temporaria:temporary});
}
async function adminDeleteUser(req,env){
  const b=await bodyJson(req,3000),id=clean(b.id,30).toUpperCase();
  if(!/^PET-[0-9A-F]{12}$/.test(id))return error("ID inválido.");
  const user=await env.DB.prepare("SELECT id,public_id,nome FROM usuarios WHERE public_id=?").bind(id).first();
  if(!user)return error("Usuário não encontrado.",404);
  const pending=await env.DB.prepare("SELECT COUNT(*) AS n FROM reservas WHERE usuario_id=? AND status IN ('pendente','aprovada','retirada')").bind(user.id).first();
  if(pending?.n>0)return error("Este usuário tem reservas ou retiradas em andamento. Finalize-as antes de excluir.",409);
  const done=await env.DB.batch([
    env.DB.prepare("UPDATE reservas SET usuario_id=NULL WHERE usuario_id=? AND status NOT IN ('pendente','aprovada','retirada')").bind(user.id),
    env.DB.prepare("DELETE FROM usuario_sessoes WHERE usuario_id=?").bind(user.id),
    env.DB.prepare("DELETE FROM usuarios WHERE id=? AND NOT EXISTS (SELECT 1 FROM reservas WHERE usuario_id=? AND status IN ('pendente','aprovada','retirada'))").bind(user.id,user.id)
  ]);
  if(done[2].meta?.changes!==1)return error("O usuário não pôde ser excluído.",409);
  await identityAudit(env.DB,"Excluiu usuário","usuario",user.id,user.nome+" · "+id);
  return respond({ok:true,excluido:id});
}
async function adminList(env){
  // Contar no D1, e não apenas na página carregada, para manter totais corretos.
  const summary=await env.DB.prepare("SELECT COUNT(*) AS todos,COALESCE(SUM(CASE WHEN papel='petiano' THEN 1 ELSE 0 END),0) AS petiano,COALESCE(SUM(CASE WHEN papel='visitante' THEN 1 ELSE 0 END),0) AS visitante FROM usuarios").first();
  const list=await rows(env.DB,"SELECT public_id AS id,nome,email,login,must_change_password,papel AS tag,ativo,notificar_email,criado_em,ultimo_acesso FROM usuarios ORDER BY criado_em DESC LIMIT 1500");
  const loans=await rows(env.DB,"SELECT usuario_id,COUNT(*) AS n FROM reservas WHERE tipo='retirada_direta' AND status='retirada' AND usuario_id IS NOT NULL GROUP BY usuario_id");
  const usersIds=await rows(env.DB,"SELECT id,public_id FROM usuarios WHERE id IN (SELECT DISTINCT usuario_id FROM reservas WHERE tipo='retirada_direta' AND status='retirada')");
  const map=new Map(usersIds.map(x=>[x.id,x.public_id])),counts=new Map(loans.map(x=>[map.get(x.usuario_id),x.n]));
  return respond({ok:true,usuarios:list.map(x=>({...x,retiradas_ativas:counts.get(x.id)||0})),
    totais:{todos:Number(summary?.todos)||0,petiano:Number(summary?.petiano)||0,visitante:Number(summary?.visitante)||0}});
}
export async function identityAPI(req,env,adminAuth){
  const url=new URL(req.url),path=url.pathname,method=req.method,db=env.DB;
  if(!path.startsWith("/api/identity/")&&!path.startsWith("/api/member/")&&!path.startsWith("/api/admin/users")&&!path.startsWith("/api/my/")&&!path.startsWith("/api/notifications"))return null;
  if(path==="/api/identity/register"&&method==="POST")return register(req,env);
  if(path==="/api/identity/login"&&method==="POST")return loginUser(req,env);
  if(path==="/api/identity/upgrade"&&method==="POST")return upgradeLegacy(req,env);
  if(path==="/api/identity/password"&&method==="POST")return changePassword(req,env);
  if(path==="/api/identity/email"&&method==="POST")return updateEmail(req,env,await loggedIn(req,db));
  if(path==="/api/identity/recover" || path==="/api/identity/recovery-code")return error("Recuperação antiga encerrada. Use login e senha ou solicite redefinição ao administrador.",410);
  if(path==="/api/identity/me"&&method==="GET"){
    const u=await loggedIn(req,db);
    return respond({ok:true,usuario:u?publicUser(u):null});
  }
  if(path==="/api/identity/logout"&&method==="POST"){
    const token=cookieValue(req);
    if(token)await db.prepare("DELETE FROM usuario_sessoes WHERE hash=?").bind(await sha256(token)).run();
    return respond({ok:true},200,{"set-cookie":clearCookie()});
  }
  if(path==="/api/admin/users/password" || path==="/api/admin/users/delete"){
    if(!await adminAuth())return error("Acesso administrativo necessário.",401);
    if(method!=="POST")return error("Método não permitido.",405);
    return path.endsWith("/password")?adminResetPassword(req,env):adminDeleteUser(req,env);
  }
  if(path==="/api/admin/users"){
    if(!await adminAuth())return error("Acesso administrativo necessário.",401);
    if(method==="GET")return adminList(env);
    if(method==="POST")return adminUpdate(req,env);
    return error("Método inválido.",405);
  }
  const u=await loggedIn(req,db);
  if(path==="/api/my/loans"&&method==="GET"){
    if(!u)return error("Entre em sua conta para consultar os empréstimos.",401);
    const loanRows=await rows(db,"SELECT r.id,r.componente_id,r.quantidade,r.data_inicio,r.data_devolucao,r.status,r.solicitado_em,r.retirado_em,r.devolvido_em,r.responsavel_admin,r.tipo,c.nome AS componente_nome,c.imagem AS componente_imagem FROM reservas r LEFT JOIN componentes c ON c.id=r.componente_id WHERE r.usuario_id=? ORDER BY r.solicitado_em DESC LIMIT 250",[u.id]);
    return respond({ok:true,emprestimos:loanRows});
  }
  if(path==="/api/notifications"&&method==="GET"){
    if(!u)return respond({ok:true,notificacoes:[],nao_lidas:0});
    // Ocultar também os avisos antigos de auto-devolução que já lotaram o sino
    // dos PETianes, sem apagar notificações de decisões do administrador.
    const isPetiane=u.papel==="petiano";
    const sql="SELECT id,reserva_id,titulo,mensagem,tipo,criada_em,lida_em FROM notificacoes WHERE usuario_id=?"+
      (isPetiane?" AND NOT (tipo='devolucao' AND titulo='Devolução registrada' AND mensagem='A devolução de seu material foi registrada.')":"")+
      " ORDER BY criada_em DESC LIMIT 50";
    const notices=await rows(db,sql,[u.id]);
    return respond({ok:true,notificacoes:notices,nao_lidas:notices.filter(n=>!n.lida_em).length});
  }
  if(path==="/api/notifications/read"&&method==="POST"){
    if(!u)return error("Entre em sua conta.",401);
    const payload=await bodyJson(req,1000);
    if(payload.todos===true)await db.prepare("UPDATE notificacoes SET lida_em=? WHERE usuario_id=? AND lida_em IS NULL").bind(now(),u.id).run();
    else{
      const id=Number(payload.id);
      if(!Number.isSafeInteger(id)||id<1)return error("Notificação inválida.");
      await db.prepare("UPDATE notificacoes SET lida_em=? WHERE id=? AND usuario_id=? AND lida_em IS NULL").bind(now(),id,u.id).run();
    }
    return respond({ok:true});
  }
  if(path==="/api/identity/name"&&method==="POST")return rename(req,env,u);
  if(path==="/api/identity/name"&&method==="POST"&&(u?.must_change_password||!u?.login))return error("Configure sua senha antes de continuar.",403);
  if(path.startsWith("/api/member/")&&u&&(u.must_change_password||!u.login))return error("Crie sua senha definitiva antes de usar as retiradas.",403);
  if(path==="/api/member/withdraw"&&method==="POST")return withdraw(req,env,u);
  if((path==="/api/member/return"||path==="/api/my/return")&&method==="POST")return memberReturn(req,env,u);
  if(path==="/api/member/history"&&method==="GET"){
    if(!u||u.papel!=="petiano")return error("Acesso reservado aos PETianos.",403);
    return listMine(db,u);
  }
  return error("Rota inválida.",404);
}

export async function currentIdentity(req,db){return loggedIn(req,db);}
