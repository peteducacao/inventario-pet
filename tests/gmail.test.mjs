import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {queueManual,generateDailyEmails,mailBridgeAPI} from "../src/mail-bridge.js";
const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for(const f of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql","0011_conciliar_experimentos.sql","0012_linkar_variacoes_iniciais.sql","0013_gmail_queue.sql","0014_email_usuarios.sql"]){
  sqlite.exec(readFileSync("migrations/"+f,"utf8"));
}
class Statement {
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null;}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}
  async run(){const a=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:a.changes,last_row_id:Number(a.lastInsertRowid)}};}
}
const DB={prepare:sql=>new Statement(sql),async batch(arr){sqlite.exec("BEGIN");try{const r=[];for(const s of arr)r.push(await s.run());sqlite.exec("COMMIT");return r;}catch(e){sqlite.exec("ROLLBACK");throw e;}}};
const token="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const env={DB,MAIL_BRIDGE_TOKEN:token};
const item=sqlite.prepare("SELECT id FROM componentes LIMIT 1").get();
assert.ok(item);
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dayAdd=d=>{const z=new Date(today+"T12:00:00Z");z.setUTCDate(z.getUTCDate()+d);return z.toISOString().slice(0,10);};
const insert=(email,due,extra={})=>{
  const obj={email,due,sem_prazo:0,tipo:"reserva",...extra};
  const r=sqlite.prepare("INSERT INTO reservas(componente_id,nome_solicitante,email,quantidade,data_inicio,data_devolucao,status,tipo,sem_prazo) VALUES (?,?,?,1,?,?,'retirada',?,?)")
    .run(item.id,"Visitante de Teste",obj.email,today,obj.due,obj.tipo,obj.sem_prazo);
  return Number(r.lastInsertRowid);
};
const rid=insert("visita@example.com",dayAdd(-2));
assert.equal((await queueManual(DB,rid)).ok,true);
assert.equal((await queueManual(DB,rid)).ok,true);
const none=insert("",dayAdd(-2));
assert.equal((await queueManual(DB,none)).ok,false,"Não enviar sem e-mail");
const noDate=insert("nodate@example.com",today,{sem_prazo:1,tipo:"retirada_direta"});
assert.equal((await queueManual(DB,noDate)).ok,false,"Não cobrar sem prazo");
const disabled=insert("pet@example.com",today,{tipo:"retirada_direta"});
assert.equal((await queueManual(DB,disabled)).ok,false,"PETianes desativados por padrão");
const call=(path,secret=token,body)=>{
  const opts={method:body?"POST":"GET",headers:{Authorization:"Bearer "+secret}};
  if(body){opts.headers["content-type"]="application/json";opts.body=JSON.stringify(body);}
  return mailBridgeAPI(new Request("https://inventario-pet.pet-educacao.workers.dev"+path,opts),env);
};
assert.equal((await call("/api/mail/next","wrong")).status,403,"Ponte deve negar segredo inválido");
assert.equal((await call("/api/mail/status")).status,200);
let ret=await(await call("/api/mail/next")).json();
assert.equal(ret.item.to,"visita@example.com");
const ack=await call("/api/mail/ack",token,{id:ret.item.id,lock:ret.item.lock,ok:true});
assert.equal(ack.status,200);
assert.equal(sqlite.prepare("SELECT situacao FROM mail_queue WHERE id=?").get(ret.item.id).situacao,"enviado");
sqlite.prepare("INSERT INTO configuracoes(chave,valor) VALUES('avisos_email','sim') ON CONFLICT(chave) DO UPDATE SET valor='sim'").run();
await generateDailyEmails(env);
const count=sqlite.prepare("SELECT COUNT(*) AS n FROM mail_queue WHERE reserva_id=? AND evento='atraso2'").get(rid).n;
assert.equal(count,1);
await generateDailyEmails(env);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM mail_queue WHERE reserva_id=? AND evento='atraso2'").get(rid).n,1,"Não duplicar lembrete");
sqlite.prepare("UPDATE reservas SET status='devolvida' WHERE id=?").run(rid);
ret=await(await call("/api/mail/next")).json();
assert.equal(ret.item,null,"Não enviar notificação depois da devolução");
console.log("GMAIL OK: segurança, fila, preferência por tag, prazos, duplicação e devolução.");
