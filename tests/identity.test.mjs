import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {identityAPI} from "../src/identity.js";

const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const f of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql","0013_gmail_queue.sql","0014_email_usuarios.sql","0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql"]){
  db.exec(readFileSync("migrations/"+f,"utf8"));
}
class Prepared {
  constructor(sql){this.sql=sql;this.values=[];}
  bind(...args){this.values=args;return this;}
  async first(){return db.prepare(this.sql).get(...this.values)||null;}
  async all(){return {results:db.prepare(this.sql).all(...this.values)};}
  async run(){const r=db.prepare(this.sql).run(...this.values);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
}
const DB={
  prepare(sql){return new Prepared(sql);},
  async batch(qs){
    db.exec("BEGIN IMMEDIATE");
    try{const result=[];for(const p of qs)result.push(await p.run());db.exec("COMMIT");return result;}
    catch(e){db.exec("ROLLBACK");throw e;}
  }
};
const env={DB};
const call=async(path,method="GET",payload=null,cookie="",admin=false)=>{
  const req=new Request("https://inventario-pet.pet-educacao.workers.dev"+path,{
    method,headers:{"CF-Connecting-IP":"192.0.2.43",...(payload===null?{}:{"content-type":"application/json"}),...(cookie?{cookie}:{})},
    ...(payload===null?{}:{body:JSON.stringify(payload)})
  });
  const response=await identityAPI(req,env,async()=>admin);
  assert.ok(response,"Rota deveria existir: "+path);
  const body=await response.json();
  return {status:response.status,body,cookie:response.headers.get("set-cookie")?.split(";")[0]||"",headers:response.headers};
};
const post=(path,payload,cookie="",admin=false)=>call(path,"POST",payload,cookie,admin);
const registration=(nome,login,senha)=>post("/api/identity/register",{nome,email:login+"@example.com",login,senha});
assert.equal((await post("/api/identity/register",{nome:"Sem e-mail",login:"semmail01",senha:"teste"})).status,400,"Novas contas precisam de e-mail.");
const senhaA="SenhaSegura!2026",senhaB="OutraSenhaSegura!2026";
const a=await registration("Sérgio","sergio01",senhaA);
const b=await registration("Sérgio","sergio02",senhaB);
assert.equal(a.status,201,JSON.stringify(a.body));
assert.equal(b.status,201,JSON.stringify(b.body));
assert.notEqual(a.body.usuario.id,b.body.usuario.id,"Pessoas com nome igual precisam de IDs distintos.");
assert.equal(a.body.usuario.tag,"visitante");
assert.equal(a.body.usuario.login,"sergio01");
assert.ok(!JSON.stringify(a.body).includes("codigo_recuperacao"));
assert.match(a.cookie,/^__Host_pet_identity=/);
assert.match(a.headers.get("set-cookie"),/HttpOnly/);
assert.match(a.headers.get("set-cookie"),/Secure/);
const saved=db.prepare("SELECT login,password_hash,password_salt,password_iterations FROM usuarios WHERE login=?").get("sergio01");
assert.notEqual(saved.password_hash,senhaA,"Senha nunca deve ser salva em claro.");
assert.match(saved.password_hash,/^[0-9a-f]{64}$/);
assert.ok(saved.password_iterations>=100000);
assert.notEqual(saved.password_salt,db.prepare("SELECT password_salt FROM usuarios WHERE login='sergio02'").get().password_salt);
assert.equal((await registration("Qualquer","sergio01","SenhaDistinta2026!")).status,409);
assert.equal((await registration("Teste","ab","SenhaDistinta2026!")).status,400);
const single=await registration("Teste senha curta","tester3","1");
assert.equal(single.status,201,"Senha numérica de um único dígito é permitida.");
assert.equal((await post("/api/identity/login",{login:"tester3",senha:"1"})).status,200);
const longPassword="9876543210".repeat(30);
const longAccount=await registration("Teste senha longa","testelonga",longPassword);
assert.equal(longAccount.status,201);
assert.equal((await post("/api/identity/login",{login:"testelonga",senha:longPassword})).status,200);
const changedShort=await post("/api/identity/password",{senha_atual:"1",nova_senha:"2"},single.cookie);
assert.equal(changedShort.status,200,"Troca para outro dígito permitida.");
assert.equal((await post("/api/identity/login",{login:"tester3",senha:"2"})).status,200);
assert.equal((await registration("Teste","tester4","")).status,400,"Senha vazia continua proibida.");
assert.equal((await registration("Teste","tester5","9".repeat(2049))).status,400,"Limite técnico evita sobrecarga.");
assert.equal((await call("/api/identity/me")).body.usuario,null);
assert.equal((await call("/api/identity/me","GET",null,"__Host_pet_identity="+a.body.usuario.id)).body.usuario,null);
assert.equal((await post("/api/identity/recover",{id:a.body.usuario.id,codigo:"REC-SIMPLES"})).status,410,"Código antigo não pode autenticar.");
assert.equal((await post("/api/identity/recovery-code",{})).status,410);
assert.equal((await post("/api/identity/login",{login:"sergio01",senha:"SenhaErrada2026"})).status,401);
const loginA=await post("/api/identity/login",{login:"SERGIO01",senha:senhaA});
assert.equal(loginA.status,200,JSON.stringify(loginA.body));
assert.equal(loginA.body.usuario.login,"sergio01");
const loginB=await post("/api/identity/login",{login:"sergio02",senha:senhaB});
assert.equal(loginB.status,200);

assert.equal((await post("/api/admin/users",{id:a.body.usuario.id,tag:"petiano"})).status,401);
const grant=await post("/api/admin/users",{id:a.body.usuario.id,tag:"petiano"},"",true);
assert.equal(grant.status,200);
assert.equal((await call("/api/identity/me","GET",null,loginA.cookie)).body.usuario.tag,"petiano");
assert.equal((await call("/api/identity/me","GET",null,loginB.cookie)).body.usuario.tag,"visitante");
const list=await call("/api/admin/users","GET",null,"",true);
assert.equal(list.body.usuarios.find(u=>u.login==="sergio01").tag,"petiano");
assert.ok(!JSON.stringify(list.body).includes(senhaA));
assert.ok(!JSON.stringify(list.body).includes(saved.password_hash));

const item=db.prepare("SELECT * FROM componentes WHERE nome LIKE 'Esp 32%' AND arquivado=0").get();
assert.ok(item);
const start=new Date().toISOString().slice(0,10),end=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
assert.equal((await post("/api/member/withdraw",{componente_id:item.id,quantidade:1,data_devolucao:end},loginB.cookie)).status,403);
const taken=await post("/api/member/withdraw",{componente_id:item.id,quantidade:2,data_devolucao:end},loginA.cookie);
assert.equal(taken.status,201,JSON.stringify(taken.body));
const loan=db.prepare("SELECT * FROM reservas WHERE id=?").get(taken.body.retirada_id);
assert.equal(loan.status,"retirada");assert.equal(loan.tipo,"retirada_direta");
assert.equal(db.prepare("SELECT em_uso FROM componentes WHERE id=?").get(item.id).em_uso,item.em_uso+2);
assert.equal((await call("/api/member/history","GET",null,loginA.cookie)).body.retiradas[0].id,loan.id);
assert.equal((await call("/api/member/history","GET",null,loginB.cookie)).status,403);

const deniedActive=await post("/api/admin/users/delete",{id:a.body.usuario.id},"",true);
assert.equal(deniedActive.status,409,"Não apagar conta com retirada aberta.");
assert.equal((await post("/api/member/return",{id:loan.id,defeituosos:1},loginA.cookie)).status,200);
assert.equal((await post("/api/member/return",{id:loan.id,defeituosos:0},loginA.cookie)).status,404);
assert.equal(db.prepare("SELECT em_uso,com_defeito FROM componentes WHERE id=?").get(item.id).em_uso,item.em_uso);
assert.equal(db.prepare("SELECT em_uso,com_defeito FROM componentes WHERE id=?").get(item.id).com_defeito,item.com_defeito+1);

assert.equal((await post("/api/admin/users/password",{id:a.body.usuario.id,login:"sergio01"})).status,401,"Somente o admin pode redefinir senha.");
const reset=await post("/api/admin/users/password",{id:a.body.usuario.id,login:"sergio01"},"",true);
assert.equal(reset.status,200,JSON.stringify(reset.body));
assert.match(reset.body.senha_temporaria,/^PET-[A-F0-9]{24}$/);
assert.ok(!JSON.stringify(reset.body).includes(senhaA));
assert.equal((await call("/api/identity/me","GET",null,loginA.cookie)).body.usuario,null,"Reset invalida sessões existentes.");
assert.equal((await post("/api/identity/login",{login:"sergio01",senha:senhaA})).status,401,"Senha antiga não funciona.");
const temp=await post("/api/identity/login",{login:"sergio01",senha:reset.body.senha_temporaria});
assert.equal(temp.status,200,JSON.stringify(temp.body));
assert.equal(temp.body.usuario.trocar_senha,true);
assert.equal((await post("/api/member/withdraw",{componente_id:item.id,quantidade:1,data_devolucao:end},temp.cookie)).status,403,"Senha temporária não deve permitir retirar.");
const changed=await post("/api/identity/password",{nova_senha:"SenhaNovaDefinitiva!2026"},temp.cookie);
assert.equal(changed.status,200,JSON.stringify(changed.body));
assert.equal(changed.body.usuario.trocar_senha,false);
assert.equal((await call("/api/identity/me","GET",null,temp.cookie)).body.usuario,null);
assert.equal((await post("/api/identity/login",{login:"sergio01",senha:reset.body.senha_temporaria})).status,401);
const finalLogin=await post("/api/identity/login",{login:"sergio01",senha:"SenhaNovaDefinitiva!2026"});
assert.equal(finalLogin.status,200);
const weakChange=await post("/api/identity/password",{senha_atual:"incorreta",nova_senha:"NovaSenhaForte2027"},finalLogin.cookie);
assert.equal(weakChange.status,401);
const validChange=await post("/api/identity/password",{senha_atual:"SenhaNovaDefinitiva!2026",nova_senha:"NovaSenhaForte2027"},finalLogin.cookie);
assert.equal(validChange.status,200);

const refused=await post("/api/admin/users/delete",{id:a.body.usuario.id});
assert.equal(refused.status,401);
const deleted=await post("/api/admin/users/delete",{id:a.body.usuario.id},"",true);
assert.equal(deleted.status,200,JSON.stringify(deleted.body));
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE login='sergio01'").get().n,0);
assert.equal(db.prepare("SELECT status FROM reservas WHERE id=?").get(loan.id).status,"devolvida");
assert.equal(db.prepare("SELECT usuario_id FROM reservas WHERE id=?").get(loan.id).usuario_id,null);

// Perfil legado autenticado: migrar sem apagar tag nem histórico.
const old=db.prepare("INSERT INTO usuarios(public_id,nome,papel,ativo,recovery_hash,criado_em,atualizado_em) VALUES (? ,?,'petiano',1,?,?,?)").run("PET-AABBCCDDEEFF","PETiano antigo","obsolete",start,start);
const oldId=Number(old.lastInsertRowid);
const token=crypto.randomUUID()+crypto.randomUUID();
const digest=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)))].map(x=>x.toString(16).padStart(2,"0")).join("");
db.prepare("INSERT INTO usuario_sessoes(hash,usuario_id,expira_em) VALUES(?,?,?)").run(digest,oldId,new Date(Date.now()+86400000).toISOString());
const oldCookie="__Host_pet_identity="+token;
const initial=await call("/api/identity/me","GET",null,oldCookie);
assert.equal(initial.body.usuario.precisa_criar_login,true);
assert.equal(initial.body.usuario.tag,"petiano");
const migrated=await post("/api/identity/upgrade",{login:"petianoantigo",email:"antigo@example.com",senha:"SenhaMigrada!2026"},oldCookie);
assert.equal(migrated.status,200,JSON.stringify(migrated.body));
assert.equal(migrated.body.usuario.precisa_criar_login,false);
assert.equal(migrated.body.usuario.tag,"petiano");
assert.equal((await call("/api/identity/me","GET",null,oldCookie)).body.usuario,null,"Sessão legada precisa encerrar.");
assert.equal((await post("/api/identity/login",{login:"petianoantigo",senha:"SenhaMigrada!2026"})).status,200);
const legacyWithoutSession=await post("/api/identity/upgrade",{login:"invasor",senha:"InvasorSenha2026!"});
assert.equal(legacyWithoutSession.status,401,"Migração não pode usar ID sozinho.");
const legacyReset=await post("/api/admin/users/password",{id:"PET-AABBCCDDEEFF",login:"petianoantigo"},"",true);
assert.equal(legacyReset.status,200);
assert.equal((await post("/api/identity/login",{login:"petianoantigo",senha:legacyReset.body.senha_temporaria})).body.usuario.trocar_senha,true);

console.log("LOGIN OK: conta única, PBKDF2 com sal, tags, retiradas, troca de senha, reset admin, bloqueio temporário, exclusão e migração legada.");
db.close();
