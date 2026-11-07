import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";

const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for(const name of [
  "0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql",
  "0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql",
  "0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql",
  "0009_filamentos.sql","0010_historico_visibilidade.sql",
  "0013_gmail_queue.sql","0014_email_usuarios.sql",
  "0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql",
  "0017_reabrir_reservas_e_retiradas.sql"
])sqlite.exec(readFileSync("migrations/"+name,"utf8"));
class Statement{
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null;}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}
  async run(){const x=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:x.changes,last_row_id:Number(x.lastInsertRowid)}};}
}
const db={
  prepare:sql=>new Statement(sql),
  async batch(qs){sqlite.exec("BEGIN IMMEDIATE");try{
    const r=[];for(const stmt of qs)r.push(await stmt.run());sqlite.exec("COMMIT");return r;
  }catch(e){sqlite.exec("ROLLBACK");throw e;}}
};
const env={DB:db,ADMIN_PASSWORD:"TesteAdminLimpeza#2026"};
const call=async(path,method="GET",payload=null,cookie="")=>{
  const result=await worker.fetch(new Request("https://inventario-pet.pet-educacao.workers.dev"+path,{
    method,
    headers:{"CF-Connecting-IP":"192.0.2.230",...(cookie?{cookie}:{}),...(payload===null?{}:{"content-type":"application/json"})},
    ...(payload===null?{}:{body:JSON.stringify(payload)})
  }),env);
  return {status:result.status,body:await result.json(),cookie:result.headers.get("set-cookie")?.split(";")[0]||""};
};
const adminLogin=await call("/api/login","POST",{senha:env.ADMIN_PASSWORD});
assert.equal(adminLogin.status,200);
const cookie=adminLogin.cookie;
const adminPost=(path,body)=>call(path,"POST",body,cookie);
const item=sqlite.prepare("SELECT id FROM componentes WHERE quantidade-em_uso-com_defeito>=3 LIMIT 1").get();
assert.ok(item,"Sem material disponível no teste");
const isoOld=new Date(Date.now()-20*86400000).toISOString();
const isoNow=new Date().toISOString();
const dateOld=isoOld.slice(0,10),dateNow=isoNow.slice(0,10);
const insert=(status,when,returned=null)=>{
  const result=sqlite.prepare("INSERT INTO reservas(componente_id,nome_solicitante,email,quantidade,data_inicio,data_devolucao,status,solicitado_em,devolvido_em) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(item.id,"Conta de teste","teste@example.com",1,dateOld,dateNow,status,when,returned);
  return Number(result.lastInsertRowid);
};
const oldReturned=insert("devolvida",isoOld,isoOld);
const oldRejected=insert("recusada",isoOld);
const oldCanceled=insert("cancelada",isoOld);
const recentRejected=insert("recusada",isoNow);
const pending=insert("pendente",isoOld);
const active=insert("retirada",isoOld);
sqlite.prepare("UPDATE componentes SET em_uso=em_uso+1 WHERE id=?").run(item.id);
const email=sqlite.prepare("INSERT INTO mail_queue(reserva_id,evento,chave_unica,destinatario,assunto,mensagem,prazo_referencia,origem,situacao) VALUES (?,?,?,?,?,?,?,?,?)");
email.run(pending,"manual","cleanup_pending_unique","teste@example.com","Teste fila pendente","Mensagem de teste",dateNow,"manual","pendente");
email.run(active,"manual","cleanup_sent_unique","teste@example.com","Teste enviado","Mensagem de teste",dateNow,"manual","enviado");

const before=sqlite.prepare("SELECT COUNT(*) AS n FROM reservas").get().n;
assert.equal(before,6);
const configured=await adminPost("/api/admin/settings",{limpeza_reservas:"7",modo_demo:"nao"});
assert.equal(configured.status,200);
const cleanup=await adminPost("/api/admin/cleanup",{});
assert.equal(cleanup.status,200,JSON.stringify(cleanup.body));
assert.equal(cleanup.body.removidas,3,"A limpeza deve eliminar devolvidas, recusadas e canceladas antigas");
for(const id of [oldReturned,oldRejected,oldCanceled]){
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM reservas WHERE id=?").get(id).n,0,"Concluído antigo não foi removido: "+id);
}
for(const id of [recentRejected,pending,active]){
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM reservas WHERE id=?").get(id).n,1,"Registro que não venceu foi apagado: "+id);
}
const adminState=await call("/api/admin/state","GET",null,cookie);
assert.equal(adminState.status,200);
assert.equal(adminState.body.reservas.length,3,"Concluídas e Todas devem refletir a exclusão real, sem registros fantasmas");
const resetBlocked=await adminPost("/api/admin/reservations/reset",{confirmar:"APAGAR TODAS AS RESERVAS"});
assert.equal(resetBlocked.status,409,"Nunca apagar retiradas em uso");
assert.match(resetBlocked.body.error,/devolu/i);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM reservas").get().n,3);
assert.equal(sqlite.prepare("SELECT em_uso FROM componentes WHERE id=?").get(item.id).em_uso,1,"Estoque ativo deve permanecer");
const withoutSession=await call("/api/admin/reservations/reset","POST",{confirmar:"APAGAR TODAS AS RESERVAS"});
assert.equal(withoutSession.status,401,"Reset deve exigir sessão Admin");
const invalid=await adminPost("/api/admin/reservations/reset",{confirmar:"qualquer coisa"});
assert.equal(invalid.status,400,"Reset deve exigir confirmação textual exata");
sqlite.prepare("UPDATE componentes SET em_uso=em_uso-1 WHERE id=?").run(item.id);
sqlite.prepare("UPDATE reservas SET status='devolvida',devolvido_em=? WHERE id=?").run(isoNow,active);
const done=await adminPost("/api/admin/reservations/reset",{confirmar:"APAGAR TODAS AS RESERVAS"});
assert.equal(done.status,200,JSON.stringify(done.body));
assert.equal(done.body.removidos,3);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM reservas").get().n,0,"Reset completo deve esvaziar Concluídas e Todas");
assert.equal(sqlite.prepare("SELECT em_uso FROM componentes WHERE id=?").get(item.id).em_uso,0,"Reset não deve alterar estoque já devolvido");
assert.equal(sqlite.prepare("SELECT situacao FROM mail_queue WHERE chave_unica='cleanup_pending_unique'").get().situacao,"cancelado","Fila pendente deve ser cancelada");
assert.equal(sqlite.prepare("SELECT situacao FROM mail_queue WHERE chave_unica='cleanup_sent_unique'").get().situacao,"enviado","Histórico do Gmail enviado não pode ser apagado");
assert.equal(sqlite.prepare("SELECT reserva_id FROM mail_queue WHERE chave_unica='cleanup_sent_unique'").get().reserva_id,null,"Vínculo de reserva excluída deve ser limpo");
assert.ok(sqlite.prepare("SELECT COUNT(*) AS n FROM historico_admin WHERE acao='Limpou reservas'").get().n>0,"Reset deve ser registrado em histórico");
console.log("RESERVAS OK: limpar concluídas antigas, manter pendentes/ativas, reset total protegido, Gmail e estoque preservados.");
