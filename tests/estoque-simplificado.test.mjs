import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const db=new DatabaseSync(":memory:");
db.exec(`
CREATE TABLE categorias(id INTEGER PRIMARY KEY,nome TEXT,arquivada INTEGER DEFAULT 0,permitir_petianos INTEGER DEFAULT 0,permitir_visitantes INTEGER DEFAULT 0,permitir_emprestimos INTEGER DEFAULT 0);
CREATE TABLE componentes(id INTEGER PRIMARY KEY,categoria_id INTEGER,nome TEXT,quantidade INTEGER,em_uso INTEGER,com_defeito INTEGER,mostrar_defeito INTEGER,descricao_defeito TEXT,arquivado INTEGER DEFAULT 0,permitir_petianos INTEGER DEFAULT 0,permitir_visitantes INTEGER DEFAULT 0,permitir_emprestimos INTEGER DEFAULT 0);
CREATE TABLE filamentos(id INTEGER PRIMARY KEY,componente_id INTEGER,quantidade INTEGER,permitir_petianos INTEGER DEFAULT 0,permitir_visitantes INTEGER DEFAULT 0,permitir_emprestimos INTEGER DEFAULT 0);
INSERT INTO categorias(id,nome,permitir_petianos,permitir_visitantes) VALUES(1,'Robótica',0,1);
INSERT INTO categorias(id,nome) VALUES(2,'Filamentos');
INSERT INTO componentes(id,categoria_id,nome,quantidade,em_uso,com_defeito,mostrar_defeito,descricao_defeito) VALUES(1,1,'Arduino Uno',10,6,0,0,'');
INSERT INTO componentes(id,categoria_id,nome,quantidade,em_uso,com_defeito,mostrar_defeito,descricao_defeito) VALUES(2,1,'Arduino Nano',10,6,2,1,'Placa com defeito');
INSERT INTO componentes(id,categoria_id,nome,quantidade,em_uso,com_defeito,mostrar_defeito,descricao_defeito) VALUES(3,2,'Filamento Azul',6,1,2,1,'Rolo inutilizado');
INSERT INTO filamentos(id,componente_id,quantidade) VALUES(11,3,6);
`);
db.exec(readFileSync("migrations/0021_estoque_sem_defeitos.sql","utf8"));
const uno=db.prepare("SELECT quantidade,em_uso,com_defeito FROM componentes WHERE id=1").get();
assert.equal(uno.quantidade,10);
assert.equal(uno.em_uso,6);
assert.equal(uno.quantidade-uno.em_uso,4,"10 - 6 precisa dar quatro disponíveis");
assert.ok(5>uno.quantidade-uno.em_uso,"Solicitar cinco deve exceder a disponibilidade quatro");
const nano=db.prepare("SELECT quantidade,em_uso,com_defeito,descricao_defeito FROM componentes WHERE id=2").get();
assert.equal(nano.quantidade,8,"Duas unidades defeituosas devem ser descartadas, não virar disponíveis.");
assert.equal(nano.em_uso,6);
assert.equal(nano.quantidade-nano.em_uso,2);
assert.equal(nano.com_defeito,0);
assert.equal(nano.descricao_defeito,"");
assert.equal(db.prepare("SELECT COALESCE(SUM(quantidade),0) AS n FROM baixas_estoque").get().n,4);
assert.equal(db.prepare("SELECT quantidade FROM filamentos WHERE id=11").get().quantidade,4,
  "Filamento e componente espelhado devem ter a mesma quantidade após os descartes.");
assert.equal(db.prepare("SELECT permitir_petianos FROM categorias WHERE id=1").get().permitir_petianos,1,
  "Cargo Visitantes não deve bloquear PETianes.");
assert.equal(db.prepare("SELECT permitir_visitantes FROM categorias WHERE id=1").get().permitir_visitantes,1);
assert.equal(db.prepare("SELECT permitir_visitantes FROM categorias WHERE id=2").get().permitir_visitantes,0,
  "Estado antigo Ninguém deve virar PETianes, não abrir automaticamente a visitantes.");
assert.equal(db.prepare("SELECT permitir_petianos FROM categorias WHERE id=2").get().permitir_petianos,1);
db.close();

for(const script of ["public/app.js","public/final.js","public/admin-stage.js","public/identity-ui.js"]){
  const text=readFileSync(script,"utf8");
  if(script==="public/app.js"){
    assert.match(text,/id="i-available"/);
    assert.doesNotMatch(text,/stepInput\("i-broken"/);
  }
}
console.log("ESTOQUE OK: 10-6=4, baixa das peças inutilizadas, filamentos espelhados e públicos simplificados.");
