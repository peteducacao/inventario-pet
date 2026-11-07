import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const name of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql"]){
  db.exec(readFileSync("migrations/"+name,"utf8"));
}
class Prepared{
  constructor(query){this.query=query;this.params=[];}
  bind(...args){this.params=args;return this;}
  async first(){return db.prepare(this.query).get(...this.params)||null;}
  async all(){return {results:db.prepare(this.query).all(...this.params)};}
  async run(){const result=db.prepare(this.query).run(...this.params);return {meta:{changes:result.changes,last_row_id:Number(result.lastInsertRowid)}};}
}
const D1={prepare:query=>new Prepared(query),batch:async prepared=>{
  db.exec("BEGIN IMMEDIATE");
  try{const rows=[];for(const stmt of prepared)rows.push(await stmt.run());db.exec("COMMIT");return rows;}
  catch(err){db.exec("ROLLBACK");throw err;}
}};
const env={DB:D1,ADMIN_PASSWORD:"Senha-Teste-Painel-PET"};
const call=async(path,method="GET",data=null,cookie="")=>{
  const headers={"CF-Connecting-IP":"192.0.2.99",...(cookie?{cookie}:{})};
  if(data!==null)headers["content-type"]="application/json";
  const response=await worker.fetch(new Request("https://inventario-pet.pet-educacao.workers.dev"+path,{
    method,headers,...(data===null?{}:{body:JSON.stringify(data)})
  }),env);
  const body=await response.json();
  return {status:response.status,body,cookie:response.headers.get("set-cookie")?.split(";")[0]||""};
};
const post=(path,body,cookie="")=>call(path,"POST",body,cookie);
const login=await post("/api/login",{senha:env.ADMIN_PASSWORD});
assert.equal(login.status,200,JSON.stringify(login.body));
const admin=login.cookie;
const postAdmin=(path,body)=>post(path,body,admin);
const catalog=(await call("/api/catalog")).body;
assert.ok(catalog.componentes.length>100);
const one=catalog.componentes.find(x=>x.nome==="Resistor 100Ω");
const two=catalog.componentes.find(x=>x.nome==="Resistor 220Ω");
assert.ok(one&&two,"Resistores importados não encontrados.");
const originalQuantity=Number(one.quantidade);
const result=await postAdmin("/api/admin/visibility",{ids:[one.id,two.id],visivel_visitante:false,responsavel:"Teste de acesso"});
assert.equal(result.status,200,JSON.stringify(result.body));
assert.equal(result.body.alterados,2);
assert.equal(db.prepare("SELECT quantidade FROM componentes WHERE id=?").get(one.id).quantidade,originalQuantity,"Estoque não deve mudar.");
assert.ok(!(await call("/api/catalog")).body.componentes.some(x=>x.id===one.id),"Visitante viu componente oculto.");
const start=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
const end=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
assert.equal((await call("/api/availability?id="+one.id+"&inicio="+start+"&fim="+end)).status,404);
assert.equal((await post("/api/reservations",{componente_id:one.id,quantidade:1,data_inicio:start,data_devolucao:end,nome_solicitante:"Solicitante de teste"})).status,404);
const user=await post("/api/identity/register",{nome:"Pessoa teste",login:"pessoa123",senha:"SenhaSeguraTeste2026!"});
assert.equal(user.status,201,JSON.stringify(user.body));
const tag=await postAdmin("/api/admin/users",{id:user.body.usuario.id,tag:"petiano"});
assert.equal(tag.status,200,JSON.stringify(tag.body));
const loginUser=await post("/api/identity/login",{login:"pessoa123",senha:"SenhaSeguraTeste2026!"});
assert.equal(loginUser.status,200);
const memberCatalog=(await call("/api/catalog","GET",null,loginUser.cookie)).body;
assert.ok(memberCatalog.componentes.some(x=>x.id===one.id),"PETiano não vê item restrito.");
assert.equal((await call("/api/availability?id="+one.id+"&inicio="+start+"&fim="+end,"GET",null,loginUser.cookie)).status,200);
const category=memberCatalog.categorias.find(c=>c.id===one.categoria_id);
assert.ok(category);
const hiddenCategory=await postAdmin("/api/admin/category",{acao:"editar",id:category.id,nome:category.nome,visivel_visitante:false});
assert.equal(hiddenCategory.status,200,JSON.stringify(hiddenCategory.body));
assert.ok(!(await call("/api/catalog")).body.categorias.some(c=>c.id===category.id));
assert.ok((await call("/api/catalog","GET",null,loginUser.cookie)).body.categorias.some(c=>c.id===category.id));
await postAdmin("/api/admin/category",{acao:"editar",id:category.id,nome:category.nome,visivel_visitante:true});
const colors=await postAdmin("/api/admin/filaments",{acao:"criar",cor:"Teste-Violeta-Restrito",hexadecimal:"#7744CC",quantidade:8,visivel_visitante:false});
assert.equal(colors.status,200,JSON.stringify(colors.body));
assert.ok(!(await call("/api/filaments")).body.filamentos.some(x=>x.cor==="Teste-Violeta-Restrito"));
assert.ok((await call("/api/filaments","GET",null,loginUser.cookie)).body.filamentos.some(x=>x.cor==="Teste-Violeta-Restrito"));
const link=await postAdmin("/api/admin/variations",{ids:[one.id,two.id],grupo:"Resistores",responsavel:"Teste de variações"});
assert.equal(link.status,200,JSON.stringify(link.body));
assert.equal(db.prepare("SELECT grupo_variacoes FROM componentes WHERE id=?").get(two.id).grupo_variacoes,"Resistores");
assert.equal(db.prepare("SELECT quantidade FROM componentes WHERE id=?").get(one.id).quantidade,originalQuantity);
// Foto individual por variação: só altera imagem, preserva grupo e estoque.
const photo="data:image/png;base64,"+Buffer.from("imagem-de-teste").toString("base64");
assert.equal((await post("/api/admin/item/photo",{id:one.id,imagem:photo})).status,401,"Envio de foto requer Admin.");
assert.equal((await postAdmin("/api/admin/item/photo",{id:one.id,imagem:'<svg onload="bad()"></svg>'})).status,400,"Foto SVG não deve aceitar HTML ou scripts.");
const previous=db.prepare("SELECT quantidade,em_uso,com_defeito,grupo_variacoes FROM componentes WHERE id=?").get(one.id);
const savedPhoto=await postAdmin("/api/admin/item/photo",{id:one.id,imagem:photo,responsavel:"Teste de foto"});
assert.equal(savedPhoto.status,200,JSON.stringify(savedPhoto.body));
const afterPhoto=db.prepare("SELECT imagem,quantidade,em_uso,com_defeito,grupo_variacoes FROM componentes WHERE id=?").get(one.id);
assert.equal(afterPhoto.imagem,photo);
for(const key of ["quantidade","em_uso","com_defeito","grupo_variacoes"])assert.equal(afterPhoto[key],previous[key],"Foto não pode alterar "+key);
assert.notEqual(db.prepare("SELECT imagem FROM componentes WHERE id=?").get(two.id).imagem,photo,"Outra variação não deve receber a foto.");
assert.equal((await postAdmin("/api/admin/item/photo",{id:one.id,imagem:""})).status,200,"Restaurar ilustração deve funcionar.");
assert.equal(db.prepare("SELECT imagem FROM componentes WHERE id=?").get(one.id).imagem,"");
const allLogs=await call("/api/admin/log", "GET",null,admin);
assert.equal(allLogs.status,200);
assert.ok(allLogs.body.eventos.some(x=>x.acao.includes("Vinculou")),"Histórico das variações ausente.");
assert.equal((await call("/api/admin/log")).status,401,"Histórico precisa ser privado.");
const setLog=await postAdmin("/api/admin/log",{acao:"configurar",prazo:"3"});
assert.equal(setLog.status,200);
assert.equal((await call("/api/admin/log","GET",null,admin)).body.limpeza_historico,"3");
assert.equal((await postAdmin("/api/admin/log",{acao:"limpar",confirmar:"inseguro"})).status,400);
assert.equal((await postAdmin("/api/admin/log",{acao:"limpar",confirmar:"LIMPAR HISTÓRICO"})).status,200);
assert.equal((await call("/api/admin/log","GET",null,admin)).body.total,0);
const addCat=await postAdmin("/api/admin/category",{acao:"criar",nome:"Categoria de teste para exclusão",visivel_visitante:true});
assert.equal(addCat.status,200);
const catId=db.prepare("SELECT id FROM categorias WHERE nome=?").get("Categoria de teste para exclusão").id;
const addItem=await postAdmin("/api/admin/item",{categoria_id:catId,nome:"Componente descartável de teste",
 imagem:"",patrimonio:"",identificacao:"",quantidade:3,em_uso:0,com_defeito:0,
 mostrar_quantidade:true,mostrar_em_uso:true,mostrar_defeito:true,visivel_visitante:true,grupo_variacoes:"",unidade:"unidades"});
assert.equal(addItem.status,200,JSON.stringify(addItem.body));
assert.equal((await postAdmin("/api/admin/category",{acao:"excluir",id:catId,confirmacao:"errado"})).status,400);
const deleted=await postAdmin("/api/admin/category",{acao:"excluir",id:catId,confirmacao:"Categoria de teste para exclusão"});
assert.equal(deleted.status,200,JSON.stringify(deleted.body));
assert.equal(deleted.body.excluidos,1);
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM categorias WHERE id=?").get(catId).n,0,"Categoria deve ser realmente excluída.");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE categoria_id=?").get(catId).n,0,"Material da categoria deve ser excluído.");
assert.ok(!(await call("/api/catalog")).body.categorias.some(x=>x.id===catId));
console.log("ACESSO OK: visitante/PETiano, filamentos, categorias, variações, histórico e exclusão segura.");
db.close();
