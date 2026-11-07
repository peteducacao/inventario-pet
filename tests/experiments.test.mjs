import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const name of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql"]){
 db.exec(readFileSync("migrations/"+name,"utf8"));
}
const row=(q,...args)=>db.prepare(q).get(...args);
const before=row("SELECT COALESCE(SUM(quantidade),0) AS total FROM componentes WHERE arquivado=0").total;
const exp=row("SELECT id,categoria_id,quantidade FROM componentes WHERE nome='Mini Motor' AND categoria_id=(SELECT id FROM categorias WHERE nome='Experimentos')");
const ele=row("SELECT id,quantidade,em_uso,com_defeito FROM componentes WHERE nome='Mini Motor' AND categoria_id=(SELECT id FROM categorias WHERE nome='Eletrônica')");
assert.ok(exp&&ele);
assert.equal(ele.quantidade,5);assert.equal(exp.quantidade,12);
assert.equal(row("SELECT COUNT(*) AS n FROM componentes WHERE categoria_id=(SELECT id FROM categorias WHERE nome='Experimentos') AND arquivado=0").n,26);
// Executa a mesma migração que o Cloudflare aplicará ao D1.
db.exec(readFileSync("migrations/0011_conciliar_experimentos.sql","utf8"));
db.exec(readFileSync("migrations/0013_gmail_queue.sql","utf8"));
db.exec(readFileSync("migrations/0014_email_usuarios.sql","utf8"));
db.exec(readFileSync("migrations/0015_autorizacao_emprestimos.sql","utf8"));
db.exec(readFileSync("migrations/0016_permissoes_por_perfil.sql","utf8"));
const motor=row("SELECT id,quantidade,em_uso,com_defeito FROM componentes WHERE id=?",ele.id);
assert.deepEqual([motor.quantidade,motor.em_uso,motor.com_defeito],[17,12,0]);
assert.equal(motor.quantidade-motor.em_uso-motor.com_defeito,5);
assert.equal(row("SELECT arquivado FROM componentes WHERE id=?",exp.id).arquivado,1);
const after=row("SELECT COALESCE(SUM(quantidade),0) AS total FROM componentes WHERE arquivado=0").total;
assert.equal(after,before,"Não deve criar nem perder uma única unidade do estoque total.");
assert.equal(row("SELECT COUNT(*) AS n FROM conciliacao_experimentos_vinculos").n,26);
assert.equal(row("SELECT COUNT(*) AS n FROM conciliacao_experimentos_backup").n,51,"Snapshot deve guardar as 26 origens e os 25 destinos distintos.");
assert.equal(row("SELECT COUNT(*) AS n FROM componentes WHERE categoria_id=(SELECT id FROM categorias WHERE nome='Experimentos') AND arquivado=0").n,0);
assert.equal(row("SELECT arquivada FROM categorias WHERE nome='Experimentos'").arquivada,1);
assert.equal(row("SELECT quantidade FROM componentes WHERE id=?",exp.id).quantidade,12,"Registros originais continuam íntegros para auditoria.");
assert.ok(row("SELECT snapshot FROM conciliacao_experimentos_backup WHERE material_id=?",ele.id).snapshot.includes('"quantidade":5'));
assert.ok(row("SELECT COUNT(*) AS n FROM historico_admin WHERE acao='Conciliação inicial'").n>0);
console.log("CONCILIAÇÃO OK: 26 origens auditáveis, total preservado e Mini Motor 17/12/5.");
db.close();
