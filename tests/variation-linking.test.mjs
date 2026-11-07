import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
const migrations=[
  "0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql",
  "0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql",
  "0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql",
  "0010_historico_visibilidade.sql","0011_conciliar_experimentos.sql"
];
for(const m of migrations)db.exec(readFileSync("migrations/"+m,"utf8"));
const before=db.prepare("SELECT id,nome,quantidade,em_uso,com_defeito,grupo_variacoes,arquivado FROM componentes").all();
const pre=Object.fromEntries(before.map(i=>[i.id,i]));
const find=name=>db.prepare("SELECT nome,quantidade,em_uso,com_defeito,grupo_variacoes FROM componentes WHERE arquivado=0 AND nome=?").get(name);
assert.equal(find("Alcalina 1.5V Pilha normal").grupo_variacoes,"");
assert.equal(find("Alcalina 1.5V Pilha Palito").grupo_variacoes,"");
assert.equal(find("Alcalina 9V").grupo_variacoes,"");
// A escolha manual do administrador nunca deve ser substituída pelo vínculo automático.
db.prepare("UPDATE componentes SET grupo_variacoes='Controle customizado' WHERE arquivado=0 AND nome='Joystique duplo'").run();
db.exec(readFileSync("migrations/0012_linkar_variacoes_iniciais.sql","utf8"));
db.exec(readFileSync("migrations/0013_gmail_queue.sql","utf8"));
for(const name of ["Alcalina 1.5V Pilha normal","Alcalina 1.5V Pilha Palito","Alcalina 9V"]){
  const row=find(name);
  assert.ok(row,name+" ausente");
  assert.equal(row.grupo_variacoes,"Alcalina",name+" deveria pertencer a Alcalina");
}
const alkaline=db.prepare("SELECT nome,quantidade,em_uso,com_defeito FROM componentes WHERE arquivado=0 AND grupo_variacoes='Alcalina' ORDER BY nome").all();
assert.equal(alkaline.length,3,"Precisamos de três opções de pilhas alcalinas no card.");
assert.deepEqual(alkaline.map(x=>x.quantidade).sort((a,b)=>a-b),[4,25,31]);
assert.equal(alkaline.reduce((sum,item)=>sum+item.quantidade,0),60);
assert.equal(find("Joystique duplo").grupo_variacoes,"Controle customizado","Grupo manual não pode ser alterado.");
assert.equal(find("Arduino Uno").grupo_variacoes,"Arduino","Novo modelo Nano poderá ingressar no grupo sem renomear Uno.");
for(const [family,minimum] of Object.entries({
  Resistores:5,Capacitores:6,LEDs:6,Interruptores:2,Protoboards:2,
  "Kit jumper":2,"Suportes para baterias":2,Motores:3,Rodas:2,Sensores:5,
  Fontes:3,Carregadores:3,"Recarregáveis":6,Toalhas:4,Colas:2
})){
 const n=db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE arquivado=0 AND grupo_variacoes=?").get(family).n;
 assert.ok(n>=minimum,family+": apenas "+n+" vínculos; esperado pelo menos "+minimum);
}
assert.equal(find("Adaptador de bateria").grupo_variacoes,"","Adaptador não é um tipo de pilha.");
assert.equal(find("Adaptador de cartão").grupo_variacoes,"","Adaptador SD não é suporte de bateria.");
assert.equal(find("Tablet Samsung").grupo_variacoes,"","Tablets cadastrados individualmente não devem ser fundidos num grupo por engano.");
assert.equal(find("Notebook Positivo").grupo_variacoes,"","Notebooks com patrimônio individual permanecem separados.");
for(const row of db.prepare("SELECT * FROM componentes").all()){
 const prior=pre[row.id];
 assert.deepEqual([row.quantidade,row.em_uso,row.com_defeito,row.arquivado],
   [prior.quantidade,prior.em_uso,prior.com_defeito,prior.arquivado],
   "Agrupamento não pode alterar estoque nem situação: "+row.nome);
}
const assigned=db.prepare("SELECT COUNT(*) AS n FROM agrupamento_variacoes_backup").get().n;
assert.ok(assigned>=55,"Poucos itens foram vinculados: "+assigned);
const groups=db.prepare("SELECT COUNT(DISTINCT grupo_variacoes) AS n FROM componentes WHERE grupo_variacoes<>'' AND arquivado=0").get().n;
const logs=db.prepare("SELECT COUNT(*) AS n FROM historico_admin WHERE acao='Vinculou variações iniciais'").get().n;
assert.ok(logs>=10,"Histórico deve registrar as famílias vinculadas.");
console.log("FAMÍLIAS OK: "+assigned+" cadastros vinculados em "+groups+" famílias; Alcalina tem 3 variações e 60 unidades totais preservadas.");
db.close();
