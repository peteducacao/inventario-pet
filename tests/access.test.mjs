import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";
const db=new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys=ON");
for(const name of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql","0010_historico_visibilidade.sql","0013_gmail_queue.sql","0014_email_usuarios.sql","0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql","0023_devolucoes_visitantes_pendentes.sql"]){
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
  return {status:response.status,body,cookie:response.headers.get("set-cookie")?.split(";")[0]||"",setCookie:response.headers.get("set-cookie")||""};
};
const post=(path,body,cookie="")=>call(path,"POST",body,cookie);
const login=await post("/api/login",{senha:env.ADMIN_PASSWORD});
assert.equal(login.status,200,JSON.stringify(login.body));
const admin=login.cookie;
assert.match(login.setCookie,/^__Host_pet_session=[^;]+; Path=\/; Secure; HttpOnly; SameSite=Strict$/,"Login Admin deve emitir cookie de sessão seguro.");
assert.doesNotMatch(login.setCookie,/Max-Age|Expires/i,"Sessão Admin não pode sobreviver ao fechamento por um prazo fixo.");
const adminState=await call("/api/admin/state","GET",null,admin);
assert.equal(adminState.status,200,"Sessão administrativa deve funcionar normalmente enquanto o navegador está aberto.");
assert.match(adminState.setCookie,/^__Host_pet_session=[^;]+; Path=\/; Secure; HttpOnly; SameSite=Strict$/,"Reabertura do Admin deve converter também cookies persistentes anteriores para sessão.");
assert.equal((await call("/api/admin/state")).status,401,"Nova sessão sem cookie Admin deve exigir senha.");
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
const repeated=await postAdmin("/api/admin/visibility",{ids:[one.id,two.id],visivel_visitante:false,responsavel:"Teste de acesso"});
assert.equal(repeated.status,200,JSON.stringify(repeated.body));
assert.equal(repeated.body.alterados,0,"Não atualizar de novo itens que já são Só PETianes.");
assert.equal(repeated.body.inalterados,2);
assert.equal(db.prepare("SELECT quantidade FROM componentes WHERE id=?").get(one.id).quantidade,originalQuantity,"Estoque não deve mudar.");
assert.ok(!(await call("/api/catalog")).body.componentes.some(x=>x.id===one.id),"Visitante viu componente oculto.");
const start=new Date(Date.now()+4*86400000).toISOString().slice(0,10);
const end=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
assert.equal((await call("/api/availability?id="+one.id+"&inicio="+start+"&fim="+end)).status,404);
const payload={componente_id:one.id,quantidade:1,data_inicio:start,data_devolucao:end,nome_solicitante:"Solicitante de teste"};
assert.equal((await post("/api/reservations",payload)).status,401,"Sem conta pessoal a reserva deve ser recusada.");
assert.equal((await post("/api/reservations",payload,admin)).status,401,"A sessão do Admin não substitui o login de usuário.");
assert.equal(db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE usuario_id IS NULL").get().n,0,"Reserva anônima não pode ser registrada.");
const user=await post("/api/identity/register",{nome:"Pessoa teste",email:"teste.reserva@example.com",login:"pessoa123",senha:"SenhaSeguraTeste2026!"});
assert.equal(user.status,201,JSON.stringify(user.body));
const tag=await postAdmin("/api/admin/users",{id:user.body.usuario.id,tag:"petiano"});
assert.equal(tag.status,200,JSON.stringify(tag.body));
const loginUser=await post("/api/identity/login",{login:"pessoa123",senha:"SenhaSeguraTeste2026!"});
assert.equal(loginUser.status,200);
const verifiedReserve=await post("/api/reservations",{...payload,email:"ignorado@example.com"},loginUser.cookie);
assert.equal(verifiedReserve.status,201,JSON.stringify(verifiedReserve.body));
assert.equal(db.prepare("SELECT email FROM reservas ORDER BY id DESC LIMIT 1").get().email,"teste.reserva@example.com","Reserva usa o e-mail da conta, não o informado no pedido.");
assert.equal(db.prepare("SELECT usuario_id FROM reservas ORDER BY id DESC LIMIT 1").get().usuario_id,db.prepare("SELECT id FROM usuarios WHERE public_id=?").get(user.body.usuario.id).id,"Reserva deve pertencer à conta pessoal verificada.");
const reservedId=db.prepare("SELECT id FROM reservas WHERE usuario_id=? ORDER BY id DESC LIMIT 1").get(db.prepare("SELECT id FROM usuarios WHERE public_id=?").get(user.body.usuario.id).id).id;
const rejected=await postAdmin("/api/admin/reservation",{id:reservedId,acao:"recusar",responsavel:"Ana Maria (PET)",observacao:"Material indisponível na data solicitada"});
assert.equal(rejected.status,200,JSON.stringify(rejected.body));
assert.equal(rejected.body.notificacao_registrada,true,"Recusa ligada à conta deve gerar notificação.");
const rejectedNotices=await call("/api/notifications","GET",null,loginUser.cookie);
assert.equal(rejectedNotices.status,200);
assert.equal(rejectedNotices.body.nao_lidas,1,"Recusa deve aparecer no sino da conta.");
assert.match(rejectedNotices.body.notificacoes[0].mensagem,/recusada por Ana Maria \(PET\)/);
assert.match(rejectedNotices.body.notificacoes[0].mensagem,/Motivo: Material indisponível/);
assert.equal((await call("/api/notifications")).body.notificacoes.length,0,"Notificações não podem vazar para visitantes.");
assert.equal((await call("/api/my/loans","GET",null,loginUser.cookie)).body.emprestimos.find(r=>r.id===reservedId).responsavel_admin,"Ana Maria (PET)","Titular deve enxergar responsável pela recusa.");
const marked=await post("/api/notifications/read",{todos:true},loginUser.cookie);
assert.equal(marked.status,200);
assert.equal((await call("/api/notifications","GET",null,loginUser.cookie)).body.nao_lidas,0);

const memberCatalog=(await call("/api/catalog","GET",null,loginUser.cookie)).body;
assert.ok(memberCatalog.componentes.some(x=>x.id===one.id),"PETiano não vê item restrito.");
assert.equal((await call("/api/availability?id="+one.id+"&inicio="+start+"&fim="+end,"GET",null,loginUser.cookie)).status,200);
const category=memberCatalog.categorias.find(c=>c.id===one.categoria_id);
assert.ok(category);
const hiddenCategory=await postAdmin("/api/admin/category",{acao:"editar",id:category.id,nome:category.nome,visivel_visitante:false});
assert.equal(hiddenCategory.status,200,JSON.stringify(hiddenCategory.body));
const blockedRelease=await postAdmin("/api/admin/visibility",{ids:[one.id,two.id],visivel_visitante:true,responsavel:"Teste de acesso"});
assert.equal(blockedRelease.status,409,"Material de categoria restrita não pode ser liberado individualmente.");
assert.equal(db.prepare("SELECT visivel_visitante FROM componentes WHERE id=?").get(one.id).visivel_visitante,0,"Bloqueio não pode mudar item.");
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
const beforeRename=db.prepare("SELECT id,nome,patrimonio,identificacao,quantidade,em_uso,com_defeito,grupo_variacoes FROM componentes WHERE id IN (?,?) ORDER BY id").all(one.id,two.id);
const renameBody={grupo_atual:"Resistores",novo_nome:"Resistências",responsavel:"Admin de teste"};
assert.equal((await post("/api/admin/variations/rename",renameBody)).status,401,"Renomear grupos exige autenticação Admin.");
assert.equal((await postAdmin("/api/admin/variations/rename",{...renameBody,novo_nome:"x"})).status,400,"Nome do grupo muito curto deve ser rejeitado.");
assert.equal((await postAdmin("/api/admin/variations/rename",{...renameBody,grupo_atual:"Grupo inexistente"})).status,404,"Grupo inexistente não deve ser criado.");
const renamed=await postAdmin("/api/admin/variations/rename",renameBody);
assert.equal(renamed.status,200,JSON.stringify(renamed.body));
assert.equal(renamed.body.alterados,2,"Renomear deve atualizar toda a família, não um único material.");
const afterRename=db.prepare("SELECT id,nome,patrimonio,identificacao,quantidade,em_uso,com_defeito,grupo_variacoes FROM componentes WHERE id IN (?,?) ORDER BY id").all(one.id,two.id);
assert.deepEqual(afterRename.map(x=>({...x,grupo_variacoes:"Resistores"})),beforeRename.map(x=>({...x})),"Somente o título do grupo pode ser modificado.");
assert.ok(afterRename.every(x=>x.grupo_variacoes==="Resistências"),"Todos os materiais devem receber o novo nome de família.");
assert.equal((await postAdmin("/api/admin/variations/rename",renameBody)).status,404,"Um grupo antigo já renomeado não deve voltar a ser usado.");
const repeat=await postAdmin("/api/admin/variations/rename",{grupo_atual:"Resistências",novo_nome:"Resistências"});
assert.equal(repeat.status,200);
assert.equal(repeat.body.alterados,0,"Salvar o mesmo nome não deve alterar o banco.");
assert.ok(db.prepare("SELECT COUNT(*) AS n FROM historico_admin WHERE acao='Renomeou grupo de variações'").get().n>=1,"Alteração deve aparecer no histórico.");
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
// Auditoria de estoque: editar o material não pode apagar unidades ainda emprestadas.
const auditCategory=category.id;
const auditPayload={categoria_id:auditCategory,nome:"Auditoria de saldo com empréstimo ativo",
  quantidade:4,em_uso:0,imagem:"",patrimonio:"",identificacao:"",observacoes:"",
  unidade:"unidades",permitir_petianos:true,permitir_visitantes:true,visivel_visitante:true};
const auditCreate=await postAdmin("/api/admin/item",auditPayload);
assert.equal(auditCreate.status,200,JSON.stringify(auditCreate.body));
const auditItem=db.prepare("SELECT id FROM componentes WHERE nome=?").get(auditPayload.nome);
assert.ok(auditItem);
const auditWithdraw=await post("/api/member/withdraw",{componente_id:auditItem.id,quantidade:2,data_devolucao:end},loginUser.cookie);
assert.equal(auditWithdraw.status,201,JSON.stringify(auditWithdraw.body));
const unsafeEdit=await postAdmin("/api/admin/item",{...auditPayload,id:auditItem.id,em_uso:0});
assert.equal(unsafeEdit.status,409,"O editor não pode zerar Em uso com retirada ativa.");
assert.equal(db.prepare("SELECT em_uso FROM componentes WHERE id=?").get(auditItem.id).em_uso,2,"Falha do editor não deve mexer no estoque real.");
const safeEdit=await postAdmin("/api/admin/item",{...auditPayload,id:auditItem.id,em_uso:2,quantidade:5});
assert.equal(safeEdit.status,200,"Editar a quantidade total sem prejudicar empréstimos deve ser permitido.");
assert.equal((await post("/api/my/return",{id:auditWithdraw.body.retirada_id,descartados:0},loginUser.cookie)).status,200,"Devolução deve continuar funcionando após edição segura.");
assert.equal((await call("/api/admin/item?id="+auditItem.id,"DELETE",null,admin)).status,200);
const signedOut=await post("/api/logout",{},admin);
assert.equal(signedOut.status,200);
assert.match(signedOut.setCookie,/Max-Age=0/,"Logout explícito deve apagar imediatamente o cookie do Admin.");
assert.equal((await call("/api/admin/state","GET",null,admin)).status,401,"Logout revoga a sessão administrativa no banco.");
console.log("ACESSO OK: visitante/PETiano, filamentos, categorias, variações, histórico e exclusão segura.");
db.close();
