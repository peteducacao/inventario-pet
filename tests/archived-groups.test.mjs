import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const file of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql",
  "0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql",
  "0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql",
  "0010_historico_visibilidade.sql","0013_gmail_queue.sql","0014_email_usuarios.sql",
  "0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql",
  "0017_reabrir_reservas_e_retiradas.sql","0018_reorganizar_robotica_equipamentos.sql"
])db.exec(readFileSync("migrations/"+file,"utf8"));
const item=db.prepare("SELECT id FROM componentes WHERE arquivado=0 AND em_uso=0 AND quantidade>=2 LIMIT 1").get();
const other=db.prepare("SELECT id FROM componentes WHERE arquivado=0 AND em_uso=0 AND quantidade>=2 AND id<>? LIMIT 1").get(item.id);
const current=db.prepare("SELECT id FROM componentes WHERE arquivado=0 AND em_uso=0 AND quantidade>=2 AND id NOT IN (?,?) LIMIT 1").get(item.id,other.id);
assert.ok(item&&other&&current);
db.prepare("UPDATE componentes SET arquivado=1 WHERE id IN (?,?)").run(item.id,other.id);
db.prepare("UPDATE componentes SET arquivado=1,em_uso=1 WHERE id=?").run(current.id);
const insertReservation=db.prepare("INSERT INTO reservas(componente_id,nome_solicitante,email,quantidade,data_inicio,data_devolucao,status,solicitado_em) VALUES(?,'Teste','teste@example.com',1,'2026-11-01','2026-11-30',?,'2026-11-01T00:00:00Z')");
const finishedId=Number(insertReservation.run(item.id,"devolvida").lastInsertRowid);
const activeId=Number(insertReservation.run(other.id,"retirada").lastInsertRowid);
db.prepare("INSERT INTO mail_queue(reserva_id,evento,chave_unica,destinatario,assunto,mensagem,prazo_referencia,origem,situacao) VALUES(?,?,?,?,?,?,?,?,?)").run(finishedId,"manual","cleanup_archived_test","teste@example.com","Envio antigo","Mensagem","2026-11-30","manual","enviado");
const arduino=db.prepare("SELECT id,quantidade,em_uso,grupo_variacoes FROM componentes WHERE arquivado=0 AND LOWER(TRIM(nome))='arduino uno' ORDER BY id LIMIT 1").get();
assert.ok(arduino,"O inventário de teste precisa conter Arduino Uno");
db.prepare("UPDATE componentes SET grupo_variacoes='Arduino' WHERE id=?").run(arduino.id);
const anotherArduino=db.prepare("SELECT id FROM componentes WHERE arquivado=0 AND LOWER(TRIM(nome))='arduino uno' AND id<>? LIMIT 1").get(arduino.id);
let addedId=null;
if(!anotherArduino){
  addedId=Number(db.prepare("INSERT INTO componentes(categoria_id,nome,quantidade,em_uso,com_defeito,grupo_variacoes) SELECT categoria_id,'Arduino Uno',6,0,0,'' FROM componentes WHERE id=?").run(arduino.id).lastInsertRowid);
}else{
  addedId=anotherArduino.id;
  db.prepare("UPDATE componentes SET grupo_variacoes='' WHERE id=?").run(addedId);
}
const before=db.prepare("SELECT quantidade,em_uso FROM componentes WHERE id=?").get(addedId);
db.exec(readFileSync("migrations/0019_arquivados_vinculo_arduino.sql","utf8"));
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE arquivado=1").get().n,0,"Não deve sobrar material na antiga seção Arquivados");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE id=?").get(item.id).n,0,"Arquivado sem ativo precisa ser excluído definitivamente");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE id=?").get(finishedId).n,0,"Registro concluído de material excluído precisa sair");
assert.equal(db.prepare("SELECT situacao FROM mail_queue WHERE chave_unica='cleanup_archived_test'").get().situacao,"enviado","Histórico de e-mail enviado precisa permanecer");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE id=? AND arquivado=0").get(other.id).n,1,"Empréstimo ativo não pode ser apagado");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE id=?").get(activeId).n,1,"Empréstimo ativo precisa continuar no banco");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE id=? AND arquivado=0").get(current.id).n,1,"Estoque marcado como em uso não pode ser destruído");
assert.equal(db.prepare("SELECT grupo_variacoes FROM componentes WHERE id=?").get(addedId).grupo_variacoes,"Arduino","Novo Arduino Uno precisa ficar na família Arduino");
assert.deepEqual(db.prepare("SELECT quantidade,em_uso FROM componentes WHERE id=?").get(addedId),before,"Vincular não altera estoque");
assert.ok(db.prepare("SELECT COUNT(*) AS n FROM historico_admin WHERE acao='Limpou materiais arquivados'").get().n>0,"A limpeza deve ficar no histórico");
db.close();
console.log("ARQUIVADOS OK: excluídos definitivamente; ativos preservados; Arduino Uno vinculado sem alterar estoque.");
