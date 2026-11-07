import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import vm from "node:vm";

const db=new DatabaseSync(":memory:");
db.exec("CREATE TABLE componentes(id INTEGER PRIMARY KEY, nome TEXT, grupo_variacoes TEXT DEFAULT '', quantidade INTEGER, em_uso INTEGER, com_defeito INTEGER)");
db.exec("INSERT INTO componentes(nome,grupo_variacoes,quantidade,em_uso,com_defeito) VALUES ('Arduino Uno','Arduino',5,1,0),('Arduino Nano','',2,0,0)");
db.exec(readFileSync("migrations/0020_central_vinculos.sql","utf8"));
assert.deepEqual(db.prepare("SELECT nome FROM grupos_variacoes").all(),[{nome:"Arduino"}],
  "Migração deve preservar o nome de grupos já utilizados.");
db.prepare("INSERT INTO grupos_variacoes(nome) VALUES(?)").run("Grupo Vazio");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE grupo_variacoes='Grupo Vazio'").get().n,0,
  "Grupo vazio não deve adicionar nem alterar componente algum.");
assert.equal(db.prepare("SELECT quantidade FROM componentes WHERE nome='Arduino Uno'").get().quantidade,5);
db.exec(readFileSync("migrations/0020_central_vinculos.sql","utf8")); // idempotente
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM grupos_variacoes").get().n,2);
db.close();

let outputBlob=null,filename="";
const context={
  window:{},TextEncoder,Blob,
  URL:{createObjectURL:blob=>{outputBlob=blob;return "blob:teste";},revokeObjectURL:()=>{}},
  document:{body:{appendChild:()=>{}},createElement:()=>({
    set href(v){},set download(v){filename=v;},click:()=>{},remove:()=>{}
  })},
  setTimeout:()=>0,
};
vm.runInNewContext(readFileSync("public/excel-export.js","utf8"),context);
assert.equal(typeof context.window.exportPETInventoryXLSX,"function");
const example={
  categorias:[{id:1,nome:"Robótica",arquivada:0,visivel_visitante:1,permitir_petianos:1,permitir_visitantes:1}],
  componentes:[{id:1,nome:"Arduino Uno",categoria_id:1,grupo_variacoes:"Arduino",quantidade:5,em_uso:1,com_defeito:0,unidade:"unidades",
    visivel_visitante:1,permitir_petianos:1,permitir_visitantes:1,import_key:""}],
  grupos_variacoes:[{nome:"Arduino"},{nome:"Grupo Vazio"}],
  filamentos:[],reservas:[{id:1,componente_id:1,componente_nome:"Arduino Uno",nome_solicitante:"Teste",quantidade:1,status:"retirada"}]
};
const result=context.window.exportPETInventoryXLSX(example);
assert.equal(result.sheets,6);
assert.match(filename,/\.xlsx$/);
assert.ok(outputBlob?.size>3000,"Arquivo XLSX não pode ser vazio.");
const bytes=new Uint8Array(await outputBlob.arrayBuffer());
assert.equal(String.fromCharCode(...bytes.slice(0,2)),"PK","XLSX precisa ter cabeçalho ZIP válido.");
const raw=new TextDecoder().decode(bytes);
for(const marker of ["xl/workbook.xml","xl/worksheets/sheet6.xml","Resumo","Materiais","Vínculos","Categorias","Estoque","Movimentações","Grupo Vazio","Arduino Uno"]){
  assert.ok(raw.includes(marker),"Falta conteúdo XLSX: "+marker);
}
assert.match(readFileSync("public/app.js","utf8"),/id="i-has-link"/);
assert.doesNotMatch(readFileSync("public/app.js","utf8"),/id="i-variation-family"/);
assert.match(readFileSync("public/photo-editor.js","utf8"),/Mostrar foto inteira/);
assert.match(readFileSync("src/index.js","utf8"),/\/api\/admin\/variation-groups/);
assert.match(readFileSync("src/index.js","utf8"),/\/api\/admin\/export/);
console.log("CENTRAL OK: migração de grupos vazios, editor sem vínculo e exportação XLSX.");
