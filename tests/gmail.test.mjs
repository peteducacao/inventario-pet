import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {queueManual,generateDailyEmails,mailBridgeAPI,mailAdminAPI,queueNewLoanReminder,triggerRecoveryEmail} from "../src/mail-bridge.js";
const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for(const f of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql","0011_conciliar_experimentos.sql","0012_linkar_variacoes_iniciais.sql","0013_gmail_queue.sql","0014_email_usuarios.sql","0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql","0022_seguranca_contas_email_recuperacao.sql"]){
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
// A janela de acompanhamento só mostra a fila ainda não enviada. O registro de envios permanece no banco.
const mailLog=await(await adminCall("/api/admin/mail/log")).json();
assert.equal(mailLog.ok,true);
assert.ok(mailLog.items.length>0,"A janela deve listar cobranças ainda pendentes.");
assert.ok(mailLog.items.every(x=>["pendente","processando"].includes(x.situacao)),"A janela não deve exibir e-mails já enviados, cancelados ou com erro.");
assert.ok(mailLog.items.some(x=>x.reserva_id===testId),"A cobrança nova deve aparecer nos pendentes.");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM mail_queue WHERE situacao='enviado'").get().n,1,"O histórico interno de envios deve ser preservado.");

// Preferências por tag e momento: editar sem habilitar ou desabilitar a outra tag.
const originalEvents=await(await adminCall("/api/admin/mail/events")).json();
assert.equal(originalEvents.profiles.petiano.ativado,false);
assert.equal(originalEvents.profiles.visitante.ativado,true);
assert.equal(originalEvents.profiles.visitante.eventos.antes,true);
const chooseAll=()=>Object.fromEntries(["antes","hoje","atraso2","atraso7","manual"].map(event=>[event,true]));
const visitors=chooseAll(),petianes=chooseAll();
visitors.antes=false;petianes.atraso7=false;
assert.equal((await adminCall("/api/admin/mail/events",{profiles:{visitante:visitors,petiano:petianes}})).status,200);
const savedEvents=await(await adminCall("/api/admin/mail/events")).json();
assert.equal(savedEvents.profiles.visitante.eventos.antes,false);
assert.equal(savedEvents.profiles.petiano.eventos.atraso7,false);
const tomorrowDue=insert("alerta-futuro@example.com",dayAdd(1));
const foundTomorrow=await generateDailyEmails(env);
assert.equal(foundTomorrow.ok,true);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM mail_queue WHERE reserva_id=? AND evento='antes'").get(tomorrowDue).n,0,
  "Desativar apenas aviso antecipado do visitante deve impedir aquele envio automático.");
visitors.antes=true;visitors.manual=false;
await adminCall("/api/admin/mail/events",{profiles:{visitante:visitors,petiano:petianes}});
const checkedTomorrow=await generateDailyEmails(env);
assert.ok(checkedTomorrow.enfileirados>=1,"Verificação manual prepara o aviso de amanhã para empréstimo retirado.");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM mail_queue WHERE reserva_id=? AND evento='antes'").get(tomorrowDue).n,1);
assert.equal((await queueManual(DB,tomorrowDue)).ok,false,"O bloqueio da cobrança manual deve ser aplicado mesmo quando aviso automático está ligado.");
visitors.manual=true;
assert.equal((await adminCall("/api/admin/mail/events",{profiles:{visitante:visitors,petiano:petianes}})).status,200);

// Mesmo transporte autenticado do Gmail: mensagens de conta são separadas das cobranças.
const recoveryHash="a".repeat(64),created=new Date().toISOString(),expiry=new Date(Date.now()+20*60000).toISOString();
sqlite.prepare("INSERT INTO identity_recovery_tokens(hash,usuario_id,criado_em,expira_em) VALUES(?,?,?,?)").run(recoveryHash,petUser,created,expiry);
const personalId=Number(sqlite.prepare("INSERT INTO identity_mail_queue(usuario_id,tipo,recovery_hash,destinatario,assunto,mensagem,criado_em) VALUES(?,'recuperacao',?,?,?,?,?)")
  .run(petUser,recoveryHash,"pet@example.com","Recuperar senha - teste","Link de teste",created).lastInsertRowid);
const personalNext=await(await call("/api/mail/next")).json();
assert.equal(personalNext.item.id,"conta-"+personalId,"A fila de contas usa IDs separados dos empréstimos.");
assert.equal(personalNext.item.to,"pet@example.com");
assert.equal((await call("/api/mail/ack",token,{id:personalNext.item.id,lock:personalNext.item.lock,ok:true})).status,200);
const sentPersonal=sqlite.prepare("SELECT situacao,mensagem FROM identity_mail_queue WHERE id=?").get(personalId);
assert.equal(sentPersonal.situacao,"enviado");
assert.equal(sentPersonal.mensagem,"","O conteúdo sensível do link não deve permanecer no histórico após envio.");
sqlite.prepare("UPDATE identity_recovery_tokens SET expira_em=? WHERE hash=?").run(new Date(Date.now()-5000).toISOString(),recoveryHash);
const expiredId=Number(sqlite.prepare("INSERT INTO identity_mail_queue(usuario_id,tipo,recovery_hash,destinatario,assunto,mensagem,criado_em) VALUES(?,'recuperacao',?,?,?,?,?)")
  .run(petUser,recoveryHash,"pet@example.com","Expirado","Link expirado",created).lastInsertRowid);
await call("/api/mail/next");
assert.equal(sqlite.prepare("SELECT situacao FROM identity_mail_queue WHERE id=?").get(expiredId).situacao,"cancelado","Nunca enviar link expirado.");

// Prazo hoje: notificar mesmo quando a retirada ocorreu depois do cron diário.
const todayLoan=insert("alerta-hoje@example.com",today);
const sameDay=await queueNewLoanReminder(env,todayLoan);
assert.equal(sameDay.queued,true,"O aviso do dia deve entrar na fila ao registrar a retirada.");
assert.equal((await queueNewLoanReminder(env,todayLoan)).queued,false,"Nunca duplicar aviso do mesmo dia.");
assert.equal(sqlite.prepare("SELECT evento FROM mail_queue WHERE reserva_id=? AND evento='hoje'").get(todayLoan).evento,"hoje");
const pendingToday=await(await adminCall("/api/admin/mail/log")).json();
assert.ok(pendingToday.items.some(item=>item.reserva_id===todayLoan),"O aviso de hoje deve aparecer entre pendentes.");
const history=await(await adminCall("/api/admin/mail/log?historico=1")).json();
assert.ok(history.items.some(item=>item.situacao==="enviado"),"O histórico administrativo deve revelar os enviados.");
const diagnostic=await adminCall("/api/admin/mail/test",{email:"teste-inventario@example.com"});
assert.equal(diagnostic.status,200);
assert.equal(sqlite.prepare("SELECT evento FROM mail_queue WHERE destinatario=? ORDER BY id DESC LIMIT 1").get("teste-inventario@example.com").evento,"teste");
const failedTestId=sqlite.prepare("SELECT id FROM mail_queue WHERE destinatario=? ORDER BY id DESC LIMIT 1").get("teste-inventario@example.com").id;
sqlite.prepare("UPDATE mail_queue SET situacao='erro',ultimo_erro='Erro simulado' WHERE id=?").run(failedTestId);
const failedHistory=await(await adminCall("/api/admin/mail/log?historico=1")).json();
assert.ok(failedHistory.items.some(item=>item.id===failedTestId&&item.situacao==="erro"),"Erros também devem ser visíveis no histórico.");
assert.equal((await adminCall("/api/admin/mail/retry",{id:failedTestId})).status,200,"Admin deve poder reenviar mensagem com erro.");
assert.equal(sqlite.prepare("SELECT situacao FROM mail_queue WHERE id=?").get(failedTestId).situacao,"pendente");
assert.equal((await adminCall("/api/admin/mail/retry",{id:failedTestId})).status,409,"Não reencaminhar em duplicidade.");
const prepare=await adminCall("/api/admin/mail/prepare",{});
assert.equal(prepare.status,200,"O Admin deve poder preparar lembretes manualmente.");
const onlyRecovery=await(await call("/api/mail/next?tipo=recuperacao")).json();
assert.equal(onlyRecovery.item,null,"O acionamento imediato da recuperação não deve disparar cobranças.");
assert.equal(await triggerRecoveryEmail(env),false,"Sem Web App configurado mantém a fila de recuperação normal.");
const realFetch=globalThis.fetch;
let triggered=false;
try{
  globalThis.fetch=async (url,options)=>{
    triggered=true;
    assert.match(String(url),/^https:\/\/script\.google\.com\/macros\/s\//);
    assert.equal(JSON.parse(options.body).acao,"recuperacao");
    assert.equal(JSON.parse(options.body).token,token);
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
  };
  assert.equal(await triggerRecoveryEmail({...env,PET_MAIL_WEBHOOK_URL:"https://script.google.com/macros/s/teste-app/exec"}),true);
  assert.equal(triggered,true);
}finally{globalThis.fetch=realFetch;}

console.log("AGENDAMENTO POR TAG OK: visitantes/PETianes, pré-vencimento e cobrança manual.");
console.log("MODELOS GMAIL OK: salvar, prévia, validação, edição manual e não duplicação.");
console.log("GMAIL OK: segurança, fila, preferência por tag, prazos, duplicação e devolução.");
