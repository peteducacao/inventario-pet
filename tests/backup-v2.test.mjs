import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";

const db=new DatabaseSync(":memory:");db.exec("PRAGMA foreign_keys=ON");
const files=["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql",
"0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql",
"0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql",
"0010_historico_visibilidade.sql","0011_conciliar_experimentos.sql","0013_gmail_queue.sql","0014_email_usuarios.sql","0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql","0023_devolucoes_visitantes_pendentes.sql"];
for(const file of files)db.exec(readFileSync("migrations/"+file,"utf8"));
class P{
 constructor(sql){this.sql=sql;this.a=[];}
 bind(...a){this.a=a;return this;}
 async first(){return db.prepare(this.sql).get(...this.a)||null;}
 async all(){return {results:db.prepare(this.sql).all(...this.a)};}
 async run(){const r=db.prepare(this.sql).run(...this.a);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
}
const DB={prepare:s=>new P(s),batch:async cmds=>{
 db.exec("BEGIN IMMEDIATE");
 try{const results=[];for(const cmd of cmds)results.push(await cmd.run());db.exec("COMMIT");return results;}
 catch(error){db.exec("ROLLBACK");throw error;}
}};
const env={DB,ADMIN_PASSWORD:"teste-de-backup"};
async function request(path,method="GET",data=null,cookie=""){
 const res=await worker.fetch(new Request("https://inventario-pet.pet-educacao.workers.dev"+path,{
  method,headers:{...(cookie?{cookie}:{}),...(data?{"content-type":"application/json"}:{})},
  ...(data?{body:JSON.stringify(data)}:{})
 }),env);
 const payload=await res.json();return {code:res.status,data:payload,cookie:res.headers.get("set-cookie")?.split(";")[0]};
}
const login=await request("/api/login","POST",{senha:env.ADMIN_PASSWORD});
assert.equal(login.code,200);const cookie=login.cookie;
const one=db.prepare("SELECT id,quantidade,em_uso,import_key FROM componentes WHERE nome='Mini Motor' AND arquivado=0").get();
const cat=db.prepare("SELECT id FROM categorias WHERE nome='Eletrônica'").get();
db.prepare("UPDATE componentes SET grupo_variacoes='Motores',visivel_visitante=0 WHERE id=?").run(one.id);
db.prepare("UPDATE categorias SET visivel_visitante=0 WHERE id=?").run(cat.id);
db.prepare("INSERT INTO filamentos(cor,hexadecimal,quantidade,ordem,visivel_visitante) VALUES('Turquesa','#22AACC',4,40,0)").run();
db.prepare("INSERT INTO usuarios(public_id,nome,papel,ativo,recovery_hash,criado_em,atualizado_em) VALUES('PET-TESTE-BACKUP','Usuário teste','petiano',1,'HASH','2026-01-01','2026-01-01')").run();
const user=db.prepare("SELECT id FROM usuarios WHERE public_id='PET-TESTE-BACKUP'").get().id;
db.prepare("UPDATE componentes SET em_uso=em_uso+1 WHERE id=?").run(one.id);
db.prepare("INSERT INTO reservas(componente_id,nome_solicitante,quantidade,data_inicio,data_devolucao,status,usuario_id,tipo) VALUES(?,?,1,'2027-01-10','2027-01-11','retirada',?,'retirada_direta')").run(one.id,"Usuário teste",user);
const loan=db.prepare("SELECT id FROM reservas WHERE componente_id=? AND tipo='retirada_direta'").get(one.id).id;
// O catálogo mostra somente históricos recentes; backup/restauração NÃO podem truncá-los.
const fixture=1510;
const addClosed=db.prepare("INSERT INTO reservas(componente_id,nome_solicitante,email,quantidade,data_inicio,data_devolucao,status,solicitado_em) VALUES(?, 'Histórico de teste', '',1,'2027-01-10','2027-01-11','devolvida',?)");
db.exec("BEGIN IMMEDIATE");
try{
  for(let i=0;i<fixture;i++)addClosed.run(one.id,new Date(Date.now()+(i+1)*1000).toISOString());
  db.exec("COMMIT");
}catch(e){db.exec("ROLLBACK");throw e;}
const originalClosed=db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE status='devolvida'").get().n;
const mailBody=("Prezada pessoa, seu material foi registrado. Confirme a devolução no horário combinado.\\n").repeat(42);
assert.ok(mailBody.length>100&&mailBody.length<=5000);
db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('mail_template_hoje_body',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").run(mailBody);
const before=await request("/api/admin/backup","GET",null,cookie);
assert.equal(before.code,200,JSON.stringify(before.data).slice(0,160));
const saved=before.data;
assert.equal(saved.formato,"inventario-pet-v2");
assert.ok(saved.historico.length>0);
assert.equal(saved.categorias.find(x=>x.id===cat.id).visivel_visitante,0);
assert.equal(saved.filamentos.find(x=>x.cor==="Turquesa").visivel_visitante,0);
assert.equal(saved.componentes.find(x=>x.id===one.id).grupo_variacoes,"Motores");
assert.equal(saved.reservas.find(x=>x.id===loan).tipo,"retirada_direta");
assert.equal(saved.reservas.filter(x=>x.status==="devolvida").length,originalClosed,"Backup deve incluir TODAS as 1.510 devoluções, não apenas o limite de 1.500 do Admin.");
assert.equal(saved.configuracoes.mail_template_hoje_body,mailBody,"Modelo completo precisa constar no backup.");
assert.ok(saved.conciliacao_experimentos_backup.length>0);
db.prepare("UPDATE componentes SET quantidade=quantidade+10 WHERE id=?").run(one.id);
db.prepare("UPDATE categorias SET visivel_visitante=1 WHERE id=?").run(cat.id);
db.prepare("DELETE FROM filamentos WHERE cor='Turquesa'").run();
const restore=await request("/api/admin/restore","POST",saved,cookie);
assert.equal(restore.code,200,JSON.stringify(restore.data).slice(0,250));
const material=db.prepare("SELECT * FROM componentes WHERE id=?").get(one.id);
assert.equal(material.quantidade,one.quantidade);
assert.equal(material.em_uso,one.em_uso+1);
assert.equal(material.grupo_variacoes,"Motores");
assert.equal(material.visivel_visitante,0);
assert.equal(material.import_key,one.import_key);
assert.equal(db.prepare("SELECT visivel_visitante FROM categorias WHERE id=?").get(cat.id).visivel_visitante,0);
assert.equal(db.prepare("SELECT visivel_visitante FROM filamentos WHERE cor='Turquesa'").get().visivel_visitante,0);
assert.equal(db.prepare("SELECT tipo FROM reservas WHERE id=?").get(loan).tipo,"retirada_direta");
assert.equal(db.prepare("SELECT usuario_id FROM reservas WHERE id=?").get(loan).usuario_id,user);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE status='devolvida'").get().n,originalClosed,"Restaurar precisa preservar as 1.510 devoluções.");
assert.equal(db.prepare("SELECT valor FROM configuracoes WHERE chave='mail_template_hoje_body'").get().valor,mailBody,"Texto completo do Gmail não pode ser truncado em 100 caracteres.");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM conciliacao_experimentos_vinculos").get().n,26);
assert.ok(db.prepare("SELECT COUNT(*) AS n FROM historico_admin").get().n>1);
console.log("BACKUP V2 OK: quantidades, categorias, cores, visibilidade, empréstimos, histórico e migração.");
db.close();
