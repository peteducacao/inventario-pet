import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const migrations=[
  "0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql",
  "0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql",
  "0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql",
  "0009_filamentos.sql","0010_historico_visibilidade.sql",
  "0013_gmail_queue.sql","0014_email_usuarios.sql",
  "0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql",
  "0017_reabrir_reservas_e_retiradas.sql"
];
const sql=readFileSync("migrations/0018_reorganizar_robotica_equipamentos.sql","utf8");
function setup(){
  const db=new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  for(const name of migrations)db.exec(readFileSync("migrations/"+name,"utf8"));
  return db;
}
const allItems=db=>db.prepare("SELECT id,categoria_id,nome,import_key,patrimonio,identificacao,quantidade,em_uso,com_defeito,visivel_visitante,permitir_petianos,permitir_visitantes FROM componentes ORDER BY id").all();
const cat=db=>Object.fromEntries(db.prepare("SELECT nome,id,arquivada,visivel_visitante,permitir_petianos,permitir_visitantes FROM categorias").all().map(x=>[x.nome,x]));
const stock=db=>db.prepare("SELECT id,nome,import_key,patrimonio,identificacao,quantidade,em_uso,com_defeito,visivel_visitante,permitir_petianos,permitir_visitantes FROM componentes ORDER BY id").all();

function validate(db,previous,robotId,oldEqId,changed){
  const cats=cat(db),after=allItems(db),byId=new Map(after.map(x=>[x.id,x]));
  assert.ok(cats["Robótica"],"Robótica precisa existir");
  assert.equal(cats["Robótica"].arquivada,0,"Robótica deve continuar ativa");
  assert.equal(cats["Equipamentos"].id,oldEqId,"Equipamentos deve aproveitar a categoria existente");
  assert.ok(!cats["Eletrônica"]||cats["Eletrônica"].arquivada===1,"Categoria antiga Eletrônica não pode continuar no catálogo");
  for(const name of ["Tablets","Notebooks"]){
    assert.equal(cats[name].arquivada,1,name+" vazia deve sair dos filtros sem ser excluída do banco");
    assert.equal(after.filter(x=>x.categoria_id===cats[name].id).length,0,"Nenhum material pode permanecer em "+name);
  }
  assert.equal(after.length,previous.length,"Migração não pode criar ou apagar materiais");
  for(const before of previous){
    const a=byId.get(before.id);
    assert.ok(a,"Material desapareceu: "+before.id);
    if(changed(before)){
      assert.equal(a.categoria_id,oldEqId,"Tablet/notebook não foi para Equipamentos: "+before.nome);
    }else if(before.categoria_id===robotId){
      assert.equal(a.categoria_id,cats["Robótica"].id,"Material de robótica não deve mudar para Equipamentos");
    }else{
      assert.equal(a.categoria_id,before.categoria_id,"Categoria inesperadamente alterada: "+before.nome);
    }
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE status='retirada'").get().n,1,"Empréstimo em andamento deve permanecer");
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM historico_admin WHERE acao='Reclassificou materiais'").get().n>=1,"Reorganização deve ser registrada no histórico");
}

const db=setup();
const categories=cat(db);
assert.ok(categories["Eletrônica"]&&categories["Equipamentos"]&&categories.Tablets&&categories.Notebooks);
const equipmentId=categories["Equipamentos"].id,robotId=categories["Eletrônica"].id;
const before=allItems(db);
const isTarget=x=>x.categoria_id===categories.Tablets.id||x.categoria_id===categories.Notebooks.id||
  /^(tablet|notebook)/i.test(x.nome);
const moved=before.filter(isTarget);
assert.ok(moved.length>=52,"Inventário original deveria conter os tablets e notebooks reais");
assert.equal(before.filter(x=>x.nome.startsWith("Notebook")&&isTarget(x)).length,17);
assert.equal(before.filter(x=>x.nome.startsWith("Tablet")&&isTarget(x)).length>=35);

// Empréstimo de notebook em andamento antes da reorganização: comprovar que a
// mudança de categoria não atualiza os registros nem modifica a quantidade em uso.
const sample=before.find(x=>x.import_key==="IMPORT20261030-N001");
assert.ok(sample);
db.prepare("UPDATE componentes SET em_uso=em_uso+1 WHERE id=?").run(sample.id);
const active=db.prepare("INSERT INTO reservas(componente_id,nome_solicitante,email,quantidade,data_inicio,data_devolucao,status,solicitado_em) VALUES(?,'Teste interno','teste@example.com',1,'2026-11-07','2026-11-30','retirada','2026-11-07T12:00:00Z')")
  .run(sample.id).lastInsertRowid;
const withLoan=allItems(db),beforeStock=stock(db);
db.exec(sql);
validate(db,withLoan,robotId,equipmentId,isTarget);
assert.deepEqual(stock(db),beforeStock,"Quantidade, em uso, defeitos, patrimônio e permissões não podem mudar");
assert.equal(db.prepare("SELECT componente_id,status FROM reservas WHERE id=?").get(active).componente_id,sample.id);
assert.equal(db.prepare("SELECT id FROM categorias WHERE nome='Robótica'").get().id,robotId,"Renomear preserva o ID original");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM categorias WHERE nome='Tablets' OR nome='Notebooks'").get().n,2,"Categorias vazias devem ser arquivadas, não excluídas");
db.close();

// Situação alternativa: a equipe já criou Robótica antes da migração.
// Reunir materiais sem duplicar categorias e sem perder IDs de materiais.
const dbExisting=setup(),old=cat(dbExisting),itemsExisting=allItems(dbExisting);
const existingId=Number(dbExisting.prepare("INSERT INTO categorias(nome,ordem,visivel_visitante,arquivada,permitir_petianos,permitir_visitantes,permitir_emprestimos) VALUES('Robótica',9,1,0,1,1,1)").run().lastInsertRowid);
dbExisting.prepare("UPDATE componentes SET em_uso=em_uso+1 WHERE id=?").run(sample.id);
dbExisting.prepare("INSERT INTO reservas(componente_id,nome_solicitante,email,quantidade,data_inicio,data_devolucao,status,solicitado_em) VALUES(?,'Teste interno','teste@example.com',1,'2026-11-07','2026-11-30','retirada','2026-11-07T12:00:00Z')").run(sample.id);
const prevDuplicate=allItems(dbExisting);
dbExisting.exec(sql);
validate(dbExisting,prevDuplicate,old["Eletrônica"].id,old["Equipamentos"].id,x=>
  x.categoria_id===old.Tablets.id||x.categoria_id===old.Notebooks.id||/^(tablet|notebook)/i.test(x.nome));
assert.equal(dbExisting.prepare("SELECT id FROM categorias WHERE nome='Robótica'").get().id,existingId,"Se Robótica já existe, reaproveitar ID em vez de criar outra");
assert.equal(dbExisting.prepare("SELECT COUNT(*) AS n FROM componentes WHERE categoria_id=?").get(old["Eletrônica"].id).n,0);
dbExisting.close();
console.log("CATEGORIAS OK: Eletrônica → Robótica; 35 tablets e 17 notebooks → Equipamentos; estoques, ativos e IDs preservados; categorias vazias arquivadas.");
