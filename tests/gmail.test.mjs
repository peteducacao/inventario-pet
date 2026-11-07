import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {queueManual,generateDailyEmails,mailBridgeAPI,mailAdminAPI} from "../src/mail-bridge.js";
const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for(const f of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql","0011_conciliar_experimentos.sql","0012_linkar_variacoes_iniciais.sql","0013_gmail_queue.sql","0014_email_usuarios.sql","0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql"]){
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
const item=sqlite.prepare("SELECT id FROM componentes WHERE quantidade-em_uso-com_defeito>=1 LIMIT 1").get();
assert.ok(item);
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const dayAdd=d=>{const z=new Date(today+"T12:00:00Z");z.setUTCDate(z.getUTCDate()+d);return z.toISOString().slice(0,10);};
const petUser=Number(sqlite.prepare("INSERT INTO usuarios(public_id,nome,email,papel,ativo,recovery_hash,criado_em,atualizado_em) VALUES ('PET-ABCDEF123456','PETiane de teste','pet@example.com','petiano',1,'testerecovery',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").run().lastInsertRowid);
const insert=(email,due,extra={})=>{
  const obj={email,due,sem_prazo:0,tipo:"reserva",usuario_id:null,...extra};
  const r=sqlite.prepare("INSERT INTO reservas(componente_id,nome_solicitante,email,quantidade,data_inicio,data_devolucao,status,tipo,sem_prazo,usuario_id) VALUES (?,?,?,1,?,?,'retirada',?,?,?)")
    .run(item.id,"Visitante de Teste",obj.email,obj.due<today?obj.due:today,obj.due,obj.tipo,obj.sem_prazo,obj.usuario_id);
  return Number(r.lastInsertRowid);
};
const rid=insert("visita@example.com",dayAdd(-2));
assert.equal((await queueManual(DB,rid)).ok,true);
assert.equal((await queueManual(DB,rid)).ok,true);
const none=insert("",dayAdd(-2));
assert.equal((await queueManual(DB,none)).ok,false,"Não enviar sem e-mail");
const noDate=insert("nodate@example.com",today,{sem_prazo:1,usuario_id:petUser});
assert.equal((await queueManual(DB,noDate)).ok,false,"Não cobrar sem prazo");
const disabled=insert("pet@example.com",today,{usuario_id:petUser});
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
// Editar um modelo não pode enviar mensagens automaticamente.
const adminCall=(path,body)=>{
  const opt=body===undefined?{method:"GET"}:{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)};
  return mailAdminAPI(new Request("https://inventario-pet.pet-educacao.workers.dev"+path,opt),env);
};
const listed=await(await adminCall("/api/admin/mail/templates")).json();
assert.equal(listed.templates.length,5,"Cinco modelos personalizáveis devem aparecer no painel.");
const saveModel=await adminCall("/api/admin/mail/templates",{evento:"manual",assunto:"PET: devolução de {material}",mensagem:"Olá, {nome}! A devolução de {material} está prevista para {prazo}. Registro #{registro}. {link}"});
assert.equal(saveModel.status,200,"Administrador deve conseguir editar o modelo.");
const stored=await(await adminCall("/api/admin/mail/templates")).json();
assert.match(stored.templates.find(x=>x.evento==="manual").assunto,/devolução de/);
const invalid=await adminCall("/api/admin/mail/templates",{evento:"manual",assunto:"\nInjeção",mensagem:"Mensagem longa o suficiente"});
assert.equal(invalid.status,400,"Assuntos com quebra de linha devem ser rejeitados.");
const testId=insert("modelo@example.com",dayAdd(4));
const preview=await(await adminCall("/api/admin/mail/preview?id="+testId)).json();
assert.equal(preview.assunto,"PET: devolução de "+sqlite.prepare("SELECT nome FROM componentes WHERE id=?").get(item.id).nome);
assert.match(preview.mensagem,/Olá, Visitante de Teste!/);
assert.doesNotMatch(preview.mensagem,/\{material\}|\{prazo\}/,"A prévia deve preencher os dados reais.");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM mail_queue WHERE reserva_id=?").get(testId).n,0,"A prévia não pode enviar cobrança.");
const edited=await adminCall("/api/admin/mail/queue",{id:testId,assunto:"Cobrança revisada de teste",mensagem:"Olá! Este texto foi alterado diretamente no painel antes do envio."});
assert.equal(edited.status,200);
const queued=sqlite.prepare("SELECT assunto,mensagem FROM mail_queue WHERE reserva_id=?").get(testId);
assert.equal(queued.assunto,"Cobrança revisada de teste");
assert.match(queued.mensagem,/alterado diretamente no painel/);
const repeated=await(await adminCall("/api/admin/mail/queue",{id:testId,assunto:"Cobrança repetida de teste",mensagem:"Esta mensagem duplicada não deve substituir a primeira."})).json();
assert.equal(repeated.queued,false,"Não repetir cobrança no mesmo dia.");
console.log("MODELOS GMAIL OK: salvar, prévia, validação, edição manual e não duplicação.");
console.log("GMAIL OK: segurança, fila, preferência por tag, prazos, duplicação e devolução.");
