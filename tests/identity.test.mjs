import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {identityAPI} from "../src/identity.js";

const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const f of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql","0013_gmail_queue.sql","0014_email_usuarios.sql","0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql","0022_seguranca_contas_email_recuperacao.sql"]){
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
assert.equal((await post("/api/identity/recover",{id:a.body.usuario.id,codigo:"REC-SIMPLES"})).status,200,"A recuperação deve responder sem revelar se existe conta; não deve autenticar pelo código antigo.");
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
assert.equal(list.body.totais.todos,4,"O painel deve contabilizar todas as contas cadastradas.");
assert.equal(list.body.totais.petiano,1,"O painel deve contabilizar PETianes após alterar tag.");
assert.equal(list.body.totais.visitante,3,"O painel deve contabilizar visitantes após alterar tag.");
assert.equal(list.body.totais.todos,list.body.totais.petiano+list.body.totais.visitante,"A soma dos perfis deve fechar.");
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
assert.equal((await post("/api/member/return",{id:loan.id,descartados:1},loginA.cookie)).status,200);
assert.equal((await post("/api/member/return",{id:loan.id,descartados:0},loginA.cookie)).status,404);
// O PETiane não deve receber avisos por ações que ele mesmo fez.
const petNotices=await call("/api/notifications","GET",null,loginA.cookie);
assert.equal(petNotices.status,200);
assert.ok(!petNotices.body.notificacoes.some(n=>n.titulo==="Devolução registrada"),
  "A devolução feita pelo próprio PETiane não deve tocar o sino.");
// Avisos redundantes antigos precisam desaparecer da consulta sem apagar o registro do banco.
db.prepare("INSERT INTO notificacoes(usuario_id,reserva_id,titulo,mensagem,tipo) VALUES(?,?,?,?,?)")
  .run(db.prepare("SELECT id FROM usuarios WHERE public_id=?").get(a.body.usuario.id).id,loan.id,
    "Devolução registrada","A devolução de seu material foi registrada.","devolucao");
const legacyPetNotices=await call("/api/notifications","GET",null,loginA.cookie);
assert.ok(!legacyPetNotices.body.notificacoes.some(n=>n.titulo==="Devolução registrada"),
  "Avisos antigos de auto-devolução também devem ficar ocultos para PETianes.");
assert.equal(legacyPetNotices.body.nao_lidas,0,"Avisos antigos ocultos não devem continuar contando no sino.");
// Ações administrativas continuam disponíveis no sino do PETiane.
db.prepare("INSERT INTO notificacoes(usuario_id,reserva_id,titulo,mensagem,tipo) VALUES(?,?,?,?,?)")
  .run(db.prepare("SELECT id FROM usuarios WHERE public_id=?").get(a.body.usuario.id).id,loan.id,
    "Mensagem da administração","Confira seu material.","info");
const adminPetNotices=await call("/api/notifications","GET",null,loginA.cookie);
assert.ok(adminPetNotices.body.notificacoes.some(n=>n.titulo==="Mensagem da administração"),
  "Notificações importantes da administração devem continuar visíveis.");
assert.equal(adminPetNotices.body.nao_lidas,1);
assert.equal(db.prepare("SELECT em_uso,com_defeito FROM componentes WHERE id=?").get(item.id).em_uso,item.em_uso);
assert.equal(db.prepare("SELECT em_uso,com_defeito FROM componentes WHERE id=?").get(item.id).com_defeito,0);
assert.equal(db.prepare("SELECT quantidade FROM componentes WHERE id=?").get(item.id).quantidade,item.quantidade-1,
  "Uma unidade descartada reduz o total, não aumenta o estoque disponível.");

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


// Segurança de conta sem tocar dados reais: email único, reautenticação e recuperação por Gmail.
const duplicateEmail=await post("/api/identity/register",{nome:"Outra pessoa",email:"SERGIO02@EXAMPLE.COM",login:"outra-pessoa",senha:"1"});
assert.equal(duplicateEmail.status,409,"Mesmo e-mail, ainda que em maiúsculas, não pode criar outra conta.");
assert.equal((await post("/api/identity/email",{email:"novo-sergio02@example.com",senha_atual:"errada"},loginB.cookie)).status,401,"Trocar e-mail exige senha atual.");
assert.equal((await post("/api/identity/email",{email:"testelonga@example.com",senha_atual:senhaB},loginB.cookie)).status,409,"E-mail de outra conta não pode ser utilizado.");
const updatedEmail=await post("/api/identity/email",{email:"novo-sergio02@example.com",senha_atual:senhaB},loginB.cookie);
assert.equal(updatedEmail.status,200,JSON.stringify(updatedEmail.body));
assert.equal(updatedEmail.body.usuario.email,"novo-sergio02@example.com");
assert.equal((await call("/api/identity/me","GET",null,loginB.cookie)).body.usuario,null,"Troca de e-mail encerra sessões anteriores.");
assert.ok(db.prepare("SELECT id FROM identity_mail_queue WHERE destinatario='sergio02@example.com' AND tipo='aviso'").get(),"A troca deve avisar o e-mail antigo.");
const newLogin=await post("/api/identity/login",{login:"sergio02",senha:senhaB});
assert.equal(newLogin.status,200);
const unknownRecover=await post("/api/identity/recover",{email:"ninguem@exemplo.com"});
const validRecover=await post("/api/identity/recover",{email:"novo-sergio02@example.com"});
assert.equal(unknownRecover.status,200);
assert.equal(validRecover.status,200);
assert.deepEqual(unknownRecover.body,validRecover.body,"Recuperação não pode revelar existência da conta.");
const recoveryMail=db.prepare("SELECT mensagem,recovery_hash FROM identity_mail_queue WHERE tipo='recuperacao' AND destinatario='novo-sergio02@example.com'").get();
assert.ok(recoveryMail,"Recuperação deve entrar na fila, sem enviar e-mail real no teste.");
const linkToken=recoveryMail.mensagem.match(/#redefinir=([A-F0-9]{64})/);
assert.ok(linkToken,"O e-mail deve conter link temporário forte.");
assert.notEqual(recoveryMail.recovery_hash,linkToken[1],"O token deve ficar armazenado como hash.");
await post("/api/identity/recover",{email:"novo-sergio02@example.com"});
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM identity_recovery_tokens WHERE usuario_id=(SELECT id FROM usuarios WHERE login='sergio02')").get().n,1,"Não enviar spam ao solicitar repetidamente em 15 minutos.");
assert.equal((await post("/api/identity/reset-by-email",{token:"F".repeat(64),nova_senha:"7"})).status,400);
const validReset=await post("/api/identity/reset-by-email",{token:linkToken[1],nova_senha:"7"});
assert.equal(validReset.status,200,JSON.stringify(validReset.body));
assert.equal((await call("/api/identity/me","GET",null,newLogin.cookie)).body.usuario,null,"Reset invalida sessões antigas.");
assert.equal((await post("/api/identity/reset-by-email",{token:linkToken[1],nova_senha:"8"})).status,400,"Link não deve ser reutilizado.");
assert.equal((await post("/api/identity/login",{login:"sergio02",senha:senhaB})).status,401);
assert.equal((await post("/api/identity/login",{login:"sergio02",senha:"7"})).status,200,"Nova senha simples é permitida por escolha do usuário.");
assert.ok(db.prepare("SELECT id FROM identity_mail_queue WHERE assunto LIKE 'Senha redefinida%'").get(),"A alteração de senha precisa produzir aviso de segurança.");

console.log("LOGIN OK: conta única, PBKDF2 com sal, tags, retiradas, troca de senha, reset admin, bloqueio temporário, exclusão e migração legada.");
db.close();
