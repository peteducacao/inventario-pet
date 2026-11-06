// Identidades independentes de nomes: ID publico + credencial privada em cookie HttpOnly.
// O ID nao autentica. A tag PETiano so pode ser alterada pelo administrador.
const HEADERS = {"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const respond = (data,status=200,extra={}) => new Response(JSON.stringify(data),{status,headers:{...HEADERS,...extra}});
const error = (message,status=400) => respond({error:message},status);
const now = () => new Date().toISOString();
const clean = (v,max=120)=>String(v??"").trim().slice(0,max);
const sha256 = async value => [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,"0")).join("");
const randomHex = size => [...crypto.getRandomValues(new Uint8Array(size))].map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();
const publicUser = u => ({id:u.public_id,nome:u.nome,tag:u.papel,criado_em:u.criado_em,ativo:u.ativo===1});
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
  const user=await db.prepare("SELECT u.id,u.public_id,u.nome,u.papel,u.ativo,u.criado_em,u.ultimo_acesso FROM usuario_sessoes s JOIN usuarios u ON u.id=s.usuario_id WHERE s.hash=? AND s.expira_em>? AND u.ativo=1").bind(await sha256(token),now()).first();
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
async function register(req,env){
  const db=env.DB,existing=await loggedIn(req,db);
  if(existing)return respond({ok:true,usuario:publicUser(existing),ja_cadastrado:true});
  const b=await bodyJson(req,3000);
  const nome=clean(b.nome,80);
  if(nome.length<2)return error("Informe seu nome (ao menos duas letras).");
  if(!await rate(db,req,"cadastro",30))return error("Muitos cadastros neste dispositivo ou rede. Tente novamente mais tarde.",429);
  const recovery="REC-"+randomHex(20);
  let row=null;
  const time=now();
  for(let t=0;t<3;t++){
    const publicId="PET-"+randomHex(6);
    try{
      const result=await db.prepare("INSERT INTO usuarios(public_id,nome,papel,ativo,recovery_hash,criado_em,atualizado_em) VALUES(?,?,'visitante',1,?,?,?)").bind(publicId,nome,await sha256(recovery),time,time).run();
      row=await db.prepare("SELECT id,public_id,nome,papel,ativo,criado_em FROM usuarios WHERE id=?").bind(result.meta.last_row_id).first();
      break;
    }catch(e){if(!String(e).includes("UNIQUE"))throw e;}
  }
  if(!row)return error("Não foi possível gerar seu ID. Tente novamente.",503);
  const session=await addSession(db,row.id);
  return respond({ok:true,usuario:publicUser(row),codigo_recuperacao:recovery},201,{"set-cookie":session});
}
async function recover(req,env){
  const db=env.DB,b=await bodyJson(req,3000);
  const id=clean(b.id,30).toUpperCase(),code=clean(b.codigo,80).toUpperCase();
  if(!/^PET-[0-9A-F]{12}$/.test(id)||!/^REC-[0-9A-F]{40}$/.test(code))return error("ID ou código de recuperação inválido.",401);
  if(!await rate(db,req,"recuperacao",15,1))return error("Muitas tentativas. Tente mais tarde.",429);
  const u=await db.prepare("SELECT * FROM usuarios WHERE public_id=? AND ativo=1").bind(id).first();
  if(!u || await sha256(code)!==u.recovery_hash)return error("ID ou código de recuperação inválido.",401);
  const session=await addSession(db,u.id);
  await db.prepare("UPDATE usuarios SET ultimo_acesso=? WHERE id=?").bind(now(),u.id).run();
  return respond({ok:true,usuario:publicUser(u)},200,{"set-cookie":session});
}
async function rename(req,env,user){
  if(!user)return error("Cadastre seu perfil antes de editar o nome.",401);
  const b=await bodyJson(req,3000),name=clean(b.nome,80);
  if(name.length<2)return error("Informe seu nome.");
  await env.DB.prepare("UPDATE usuarios SET nome=?,atualizado_em=? WHERE id=?").bind(name,now(),user.id).run();
  return respond({ok:true,usuario:{...publicUser(user),nome:name}});
}
async function rotateRecovery(env,user){
  if(!user)return error("Identificação necessária.",401);
  const code="REC-"+randomHex(20);
  await env.DB.prepare("UPDATE usuarios SET recovery_hash=?,atualizado_em=? WHERE id=?").bind(await sha256(code),now(),user.id).run();
  return respond({ok:true,codigo_recuperacao:code});
}
async function listMine(db,user){
  const list=await rows(db,"SELECT r.id,r.componente_id,r.quantidade,r.data_inicio,r.data_devolucao,r.status,r.observacao,r.solicitado_em,r.retirado_em,r.devolvido_em,r.tipo,c.nome AS componente_nome FROM reservas r JOIN componentes c ON c.id=r.componente_id WHERE r.usuario_id=? ORDER BY r.solicitado_em DESC LIMIT 300",[user.id]);
  return respond({ok:true,retiradas:list});
}
async function withdraw(req,env,user){
  if(!user||user.papel!=="petiano")return error("Somente PETianos autorizados podem retirar materiais diretamente.",403);
  const b=await bodyJson(req,5000),id=Number(b.componente_id),quantity=Number(b.quantidade),due=clean(b.data_devolucao,10),note=clean(b.observacao,500);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000)return error("Material ou quantidade inválidos.");
  if(!formatDateValid(due)||due<brazilDate())return error("Informe uma data de devolução válida.");
  const item=await env.DB.prepare("SELECT id,nome,quantidade,em_uso,com_defeito,mostrar_quantidade FROM componentes WHERE id=?").bind(id).first();
  if(!item)return error("Material não encontrado.",404);
  if(item.mostrar_quantidade!==1)return error("Material indisponível para retirada.",409);
  if(item.quantidade-item.em_uso-item.com_defeito<quantity)return error("Estoque insuficiente para retirada.",409);
  const stamp=now(),actor=user.nome+" ("+user.public_id+")",today=brazilDate();
  const fields=["componente_id","nome_solicitante","contato","email","quantidade","data_inicio","data_devolucao","status","observacao","solicitado_em","retirado_em","responsavel_admin","usuario_id","tipo"];
  const values=[id,user.nome,"","",quantity,today,due,"retirada",note,stamp,stamp,actor,user.id,"retirada_direta"];
  const batch=await env.DB.batch([
    env.DB.prepare("INSERT INTO reservas ("+fields.join(",")+") VALUES ("+fields.map(()=>"?").join(",")+")").bind(...values),
    env.DB.prepare("UPDATE componentes SET em_uso=em_uso+?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?").bind(quantity,stamp,actor,"Retirada direta: "+quantity+" unidade(s)",id)
  ]);
  if(batch[0].meta?.changes!==1||batch[1].meta?.changes!==1)return error("Não foi possível registrar a retirada.",409);
  return respond({ok:true,retirada_id:batch[0].meta.last_row_id},201);
}
async function memberReturn(req,env,user){
  if(!user||user.papel!=="petiano")return error("Somente PETianos autorizados podem devolver diretamente.",403);
  const b=await bodyJson(req,3000),id=Number(b.id),broken=Number(b.defeituosos||0),note=clean(b.observacao,500);
  if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(broken)||broken<0)return error("Identificação ou quantidade inválida.");
  const r=await env.DB.prepare("SELECT * FROM reservas WHERE id=? AND usuario_id=? AND tipo='retirada_direta' AND status='retirada'").bind(id,user.id).first();
  if(!r)return error("Retirada não encontrada ou já devolvida.",404);
  if(broken>r.quantidade)return error("A quantidade com defeito não pode ultrapassar a retirada.");
  const component=await env.DB.prepare("SELECT em_uso FROM componentes WHERE id=?").bind(r.componente_id).first();
  if(!component||component.em_uso<r.quantidade)return error("Estoque em uso inconsistente. Procure o administrador.",409);
  const stamp=now(),actor=user.nome+" ("+user.public_id+")";
  // Em uma mesma transacao, atualizar o estoque apenas se a retirada ainda estiver ativa.
  const done=await env.DB.batch([
    env.DB.prepare("UPDATE componentes SET em_uso=em_uso-?,com_defeito=com_defeito+?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=? AND em_uso>=? AND EXISTS(SELECT 1 FROM reservas WHERE id=? AND usuario_id=? AND status='retirada')").bind(r.quantidade,broken,stamp,actor,"Devolução de "+r.quantidade+" unidade(s)"+(broken?" • "+broken+" com defeito":""),r.componente_id,r.quantidade,id,user.id),
    env.DB.prepare("UPDATE reservas SET status='devolvida',devolvido_em=?,responsavel_admin=?,observacao=? WHERE id=? AND usuario_id=? AND status='retirada'").bind(stamp,actor,note||r.observacao,id,user.id)
  ]);
  if(done[0].meta?.changes!==1||done[1].meta?.changes!==1)return error("Não foi possível registrar a devolução.",409);
  return respond({ok:true});
}
async function adminUpdate(req,env){
  const b=await bodyJson(req,3000);
  const id=clean(b.id,30).toUpperCase(),tag=clean(b.tag,20).toLowerCase();
  if(!/^PET-[0-9A-F]{12}$/.test(id))return error("ID inválido.");
  if(!["visitante","petiano"].includes(tag))return error("Tag inválida.");
  const active=b.ativo===false?0:1;
  const user=await env.DB.prepare("SELECT id FROM usuarios WHERE public_id=?").bind(id).first();
  if(!user)return error("Usuário não encontrado.",404);
  await env.DB.prepare("UPDATE usuarios SET papel=?,ativo=?,atualizado_em=? WHERE id=?").bind(tag,active,now(),user.id).run();
  if(!active)await env.DB.prepare("DELETE FROM usuario_sessoes WHERE usuario_id=?").bind(user.id).run();
  return respond({ok:true});
}
async function adminList(env){
  const list=await rows(env.DB,"SELECT public_id AS id,nome,papel AS tag,ativo,criado_em,ultimo_acesso FROM usuarios ORDER BY criado_em DESC LIMIT 1500");
  const loans=await rows(env.DB,"SELECT usuario_id,COUNT(*) AS n FROM reservas WHERE tipo='retirada_direta' AND status='retirada' AND usuario_id IS NOT NULL GROUP BY usuario_id");
  const usersIds=await rows(env.DB,"SELECT id,public_id FROM usuarios WHERE id IN (SELECT DISTINCT usuario_id FROM reservas WHERE tipo='retirada_direta' AND status='retirada')");
  const map=new Map(usersIds.map(x=>[x.id,x.public_id])),counts=new Map(loans.map(x=>[map.get(x.usuario_id),x.n]));
  return respond({ok:true,usuarios:list.map(x=>({...x,retiradas_ativas:counts.get(x.id)||0}))});
}
export async function identityAPI(req,env,adminAuth){
  const url=new URL(req.url),path=url.pathname,method=req.method,db=env.DB;
  if(!path.startsWith("/api/identity/")&&!path.startsWith("/api/member/")&&!path.startsWith("/api/admin/users"))return null;
  if(path==="/api/identity/register"&&method==="POST")return register(req,env);
  if(path==="/api/identity/recover"&&method==="POST")return recover(req,env);
  if(path==="/api/identity/me"&&method==="GET"){
    const u=await loggedIn(req,db);
    return respond({ok:true,usuario:u?publicUser(u):null});
  }
  if(path==="/api/identity/logout"&&method==="POST"){
    const token=cookieValue(req);
    if(token)await db.prepare("DELETE FROM usuario_sessoes WHERE hash=?").bind(await sha256(token)).run();
    return respond({ok:true},200,{"set-cookie":clearCookie()});
  }
  if(path==="/api/admin/users"){
    if(!await adminAuth())return error("Acesso administrativo necessário.",401);
    if(method==="GET")return adminList(env);
    if(method==="POST")return adminUpdate(req,env);
    return error("Método inválido.",405);
  }
  const u=await loggedIn(req,db);
  if(path==="/api/identity/name"&&method==="POST")return rename(req,env,u);
  if(path==="/api/identity/recovery-code"&&method==="POST")return rotateRecovery(env,u);
  if(path==="/api/member/withdraw"&&method==="POST")return withdraw(req,env,u);
  if(path==="/api/member/return"&&method==="POST")return memberReturn(req,env,u);
  if(path==="/api/member/history"&&method==="GET"){
    if(!u||u.papel!=="petiano")return error("Acesso reservado aos PETianos.",403);
    return listMine(db,u);
  }
  return error("Rota inválida.",404);
}
