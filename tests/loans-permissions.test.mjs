import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";

const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
const migrations=[
  "0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql",
  "0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql",
  "0006_login_senha.sql","0007_inventario_oficial.sql","0008_notificacoes.sql",
  "0009_filamentos.sql","0010_historico_visibilidade.sql",
  "0011_conciliar_experimentos.sql","0012_linkar_variacoes_iniciais.sql",
  "0013_gmail_queue.sql","0014_email_usuarios.sql"
];
for(const name of migrations)sqlite.exec(readFileSync("migrations/"+name,"utf8"));
// Simular cores já existentes ANTES da migração, que devem sobreviver inalteradas.
sqlite.prepare("INSERT INTO filamentos(cor,hexadecimal,quantidade,ordem,atualizado_em,visivel_visitante) VALUES('Azul teste','#3366DD',6,0,CURRENT_TIMESTAMP,1)").run();
sqlite.prepare("INSERT INTO filamentos(cor,hexadecimal,quantidade,ordem,atualizado_em,visivel_visitante) VALUES('Vermelho teste','#CC3344',3,1,CURRENT_TIMESTAMP,1)").run();
sqlite.exec(readFileSync("migrations/0015_autorizacao_emprestimos.sql","utf8"));
sqlite.exec(readFileSync("migrations/0016_permissoes_por_perfil.sql","utf8"));
sqlite.exec(readFileSync("migrations/0023_devolucoes_visitantes_pendentes.sql","utf8"));
class Statement{
 constructor(sql){this.sql=sql;this.args=[];}
 bind(...args){this.args=args;return this;}
 async first(){return sqlite.prepare(this.sql).get(...this.args)||null;}
 async all(){return {results:sqlite.prepare(this.sql).all(...this.args)};}
 async run(){const r=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
}
const DB={prepare:sql=>new Statement(sql),async batch(statements){
 sqlite.exec("BEGIN IMMEDIATE");try{const list=[];for(const stmt of statements)list.push(await stmt.run());sqlite.exec("COMMIT");return list;}
 catch(e){sqlite.exec("ROLLBACK");throw e;}
}};
const env={DB,ADMIN_PASSWORD:"senha-teste-permissoes"};
async function req(path,method="GET",data=undefined,cookie=""){
 const resp=await worker.fetch(new Request("https://inventario-pet.pet-educacao.workers.dev"+path,{
   method,headers:{"CF-Connecting-IP":"192.0.2.77",...(cookie?{cookie}:{}),...(data===undefined?{}:{"content-type":"application/json"})},
   ...(data===undefined?{}:{body:JSON.stringify(data)})
 }),env);
 return {status:resp.status,body:await resp.json(),cookie:resp.headers.get("set-cookie")?.split(";")[0]||""};
}
const adminLogin=await req("/api/login","POST",{senha:env.ADMIN_PASSWORD});
assert.equal(adminLogin.status,200);
const admin=adminLogin.cookie,postAdmin=(path,body)=>req(path,"POST",body,admin);
const user=await req("/api/identity/register","POST",{nome:"Pessoa Visitante",email:"visitante-test@example.com",login:"visitanteteste",senha:"teste123"});
assert.equal(user.status,201,JSON.stringify(user.body));
const visitor=user.cookie;
const memberUser=await req("/api/identity/register","POST",{nome:"Pessoa PETiane",email:"petiane-test@example.com",login:"petianeteste",senha:"teste123"});
assert.equal(memberUser.status,201,JSON.stringify(memberUser.body));
assert.equal((await postAdmin("/api/admin/users",{id:memberUser.body.usuario.id,tag:"petiano"})).status,200);
const member=(await req("/api/identity/login","POST",{login:"petianeteste",senha:"teste123"})).cookie;
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const next=n=>{const dt=new Date(today+"T12:00:00Z");dt.setUTCDate(dt.getUTCDate()+n);return dt.toISOString().slice(0,10);};
const end=next(5);
const blue=sqlite.prepare("SELECT f.id,f.quantidade,f.componente_id,f.permitir_emprestimos,c.em_uso,c.quantidade AS vinculados FROM filamentos f JOIN componentes c ON c.id=f.componente_id WHERE f.cor='Azul teste'").get();
const red=sqlite.prepare("SELECT f.id,f.componente_id FROM filamentos f WHERE f.cor='Vermelho teste'").get();
assert.equal(blue.quantidade,6);
assert.equal(blue.vinculados,6,"Estoque anterior da cor deve ser preservado.");
assert.equal(blue.permitir_emprestimos,0,"Filamentos começam bloqueados.");
assert.ok(blue.componente_id&&red.componente_id&&blue.componente_id!==red.componente_id);
const filamentCat=sqlite.prepare("SELECT id,permitir_emprestimos FROM categorias WHERE nome='Filamentos'").get();
assert.equal(filamentCat.permitir_emprestimos,0);
const catalog=await req("/api/catalog");
assert.equal(catalog.body.categorias.find(c=>c.nome==="Filamentos").permitir_emprestimos,0);
assert.equal((await req("/api/availability?id="+blue.componente_id+"&inicio="+today+"&fim="+end)).status,409);
assert.equal((await req("/api/reservations","POST",{componente_id:blue.componente_id,quantidade:1,data_inicio:today,data_devolucao:end},visitor)).status,409);
assert.equal((await req("/api/member/withdraw","POST",{componente_id:blue.componente_id,quantidade:1,data_devolucao:end},member)).status,409);
let bulk=await postAdmin("/api/admin/category",{acao:"emprestimos",id:filamentCat.id,permitir_emprestimos:true});
assert.equal(bulk.status,200,JSON.stringify(bulk.body));
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM filamentos WHERE permitir_emprestimos=1").get().n,2,"Liberar categoria deve liberar todas as cores.");
const colors=(await req("/api/filaments")).body.filamentos;
assert.ok(colors.find(x=>x.id===blue.id&&x.permitir_emprestimos===1));
assert.equal((await req("/api/availability?id="+blue.componente_id+"&inicio="+today+"&fim="+end)).body.disponiveis,6);
const reserved=await req("/api/reservations","POST",{componente_id:blue.componente_id,quantidade:2,data_inicio:today,data_devolucao:end},visitor);
assert.equal(reserved.status,201,JSON.stringify(reserved.body));
const rId=sqlite.prepare("SELECT id FROM reservas WHERE componente_id=? ORDER BY id DESC LIMIT 1").get(blue.componente_id).id;
assert.equal(sqlite.prepare("SELECT email FROM reservas WHERE id=?").get(rId).email,"visitante-test@example.com");
assert.equal((await postAdmin("/api/admin/reservation",{id:rId,acao:"aprovar"})).status,200);
assert.equal(sqlite.prepare("SELECT status FROM reservas WHERE id=?").get(rId).status,"retirada","Aprovar já deve registrar a entrega.");
assert.ok(sqlite.prepare("SELECT retirado_em FROM reservas WHERE id=?").get(rId).retirado_em,"Aprovação salva a data da retirada.");
assert.equal((await postAdmin("/api/admin/reservation",{id:rId,acao:"retirar"})).status,409,"Não exigir nem permitir uma segunda retirada.");
assert.equal((await postAdmin("/api/admin/reservation",{id:rId,acao:"aprovar"})).status,409,"Não aprovar duas vezes.");
assert.equal(sqlite.prepare("SELECT em_uso FROM componentes WHERE id=?").get(blue.componente_id).em_uso,2);
assert.equal((await req("/api/filaments")).body.filamentos.find(x=>x.id===blue.id).em_uso,2);
assert.equal((await req("/api/my/loans","GET",undefined,visitor)).body.emprestimos.find(r=>r.id===rId).status,"retirada");
assert.equal((await req("/api/my/return","POST",{id:rId,defeituosos:0},member)).status,404,"Outro titular não pode devolver empréstimo alheio.");
assert.equal((await req("/api/my/return","POST",{id:rId,descartados:1},visitor)).status,403,"Visitante não pode informar descarte.");
const requested=await req("/api/my/return","POST",{id:rId,observacao:"Entreguei na recepção"},visitor);
assert.equal(requested.status,200,"Visitante deve solicitar devolução.");
assert.equal(requested.body.aguardando_confirmacao,true);
assert.equal((await req("/api/my/return","POST",{id:rId},visitor)).status,409,"Solicitação repetida deve ser bloqueada.");
assert.equal(sqlite.prepare("SELECT status FROM reservas WHERE id=?").get(rId).status,"retirada","Visitante não pode concluir empréstimo.");
assert.equal(sqlite.prepare("SELECT em_uso FROM componentes WHERE id=?").get(blue.componente_id).em_uso,2,"Estoque continua em uso até confirmação do Admin.");
assert.equal((await req("/api/my/loans","GET",undefined,visitor)).body.emprestimos.find(x=>x.id===rId).devolucao_solicitada_observacao,"Entreguei na recepção");
assert.equal((await postAdmin("/api/admin/reservation",{id:rId,acao:"cancelar_solicitacao_devolucao",responsavel:"Responsável PET"})).status,200);
assert.equal(sqlite.prepare("SELECT devolucao_solicitada_em FROM reservas WHERE id=?").get(rId).devolucao_solicitada_em,null);
assert.equal((await req("/api/my/return","POST",{id:rId},visitor)).status,200,"Após recusa o visitante pode solicitar novamente.");
assert.equal((await postAdmin("/api/admin/reservation",{id:rId,acao:"devolver",responsavel:"Responsável PET",descartados:0})).status,200,"O Admin confirma a devolução.");
assert.equal(sqlite.prepare("SELECT status FROM reservas WHERE id=?").get(rId).status,"devolvida");
assert.equal(sqlite.prepare("SELECT em_uso FROM componentes WHERE id=?").get(blue.componente_id).em_uso,0,"Estoque liberado só na confirmação.");
assert.equal((await postAdmin("/api/admin/reservation",{id:rId,acao:"devolver"})).status,409,"Bloquear confirmação dupla.");
const direct=await req("/api/member/withdraw","POST",{componente_id:blue.componente_id,quantidade:1,data_devolucao:""},member);
assert.equal(direct.status,201,JSON.stringify(direct.body));
assert.equal(sqlite.prepare("SELECT em_uso FROM componentes WHERE id=?").get(blue.componente_id).em_uso,1);
assert.equal((await req("/api/my/return","POST",{id:direct.body.retirada_id,defeituosos:0},member)).status,200);
assert.equal(sqlite.prepare("SELECT em_uso FROM componentes WHERE id=?").get(blue.componente_id).em_uso,0);
let individual=await postAdmin("/api/admin/filaments",{acao:"emprestimos",id:blue.id,permitir_emprestimos:false});
assert.equal(individual.status,200);
assert.equal((await req("/api/availability?id="+blue.componente_id+"&inicio="+today+"&fim="+end)).status,409,"Bloquear cor não pode desbloquear a categoria.");
assert.equal((await req("/api/availability?id="+red.componente_id+"&inicio="+today+"&fim="+end)).status,200,"Bloqueio individual não deve bloquear outra cor.");
assert.equal((await postAdmin("/api/admin/category",{acao:"emprestimos",id:filamentCat.id,permitir_emprestimos:false})).status,200);
assert.equal((await req("/api/availability?id="+red.componente_id+"&inicio="+today+"&fim="+end)).status,409);
const electronic=sqlite.prepare("SELECT id,permitir_emprestimos FROM categorias WHERE nome='Eletrônica'").get();
const arduino=sqlite.prepare("SELECT id FROM componentes WHERE nome='Arduino Uno' AND arquivado=0").get();
assert.equal(electronic.permitir_emprestimos,1,"Categorias anteriores continuam habilitadas.");
assert.equal((await postAdmin("/api/admin/item/loans",{id:arduino.id,permitir_emprestimos:false})).status,200);
assert.equal((await req("/api/availability?id="+arduino.id+"&inicio="+today+"&fim="+end)).status,409);
assert.equal((await postAdmin("/api/admin/category",{acao:"emprestimos",id:electronic.id,permitir_emprestimos:true})).status,200);
assert.equal((await req("/api/availability?id="+arduino.id+"&inicio="+today+"&fim="+end)).status,200,"A liberação em massa reativa todos os materiais.");
// Opções de seletor em uma ação: Ninguém, PETianes, Visitantes, Todos.
const catOnlyVisitor=await postAdmin("/api/admin/category",{acao:"emprestimos",id:electronic.id,perfil:"combinado",permitir_petianos:false,permitir_visitantes:true});
assert.equal(catOnlyVisitor.status,200,JSON.stringify(catOnlyVisitor.body));
const categoryAfter=sqlite.prepare("SELECT permitir_petianos,permitir_visitantes FROM categorias WHERE id=?").get(electronic.id);
assert.equal(categoryAfter.permitir_petianos,0,"PETianes devem ficar bloqueados.");
assert.equal(categoryAfter.permitir_visitantes,1,"Categoria deve permitir somente visitantes.");
assert.equal((await req("/api/availability?id="+arduino.id+"&inicio="+today+"&fim="+end,"GET",undefined,visitor)).status,200);
assert.equal((await req("/api/member/withdraw","POST",{componente_id:arduino.id,quantidade:1,data_devolucao:end},member)).status,409);
const onlyPet=await postAdmin("/api/admin/item/loans",{id:arduino.id,perfil:"combinado",permitir_petianos:true,permitir_visitantes:false});
assert.equal(onlyPet.status,200);
assert.equal(sqlite.prepare("SELECT permitir_petianos,permitir_visitantes FROM componentes WHERE id=?").get(arduino.id).permitir_visitantes,0);
const allAllowed=await postAdmin("/api/admin/category",{acao:"emprestimos",id:electronic.id,perfil:"combinado",permitir_petianos:true,permitir_visitantes:true});
assert.equal(allAllowed.status,200);
assert.equal(sqlite.prepare("SELECT permitir_petianos,permitir_visitantes FROM componentes WHERE id=?").get(arduino.id).permitir_visitantes,1);
const nobody=await postAdmin("/api/admin/filaments",{acao:"emprestimos",id:blue.id,perfil:"combinado",permitir_petianos:false,permitir_visitantes:false});
assert.equal(nobody.status,200);
assert.equal(sqlite.prepare("SELECT permitir_petianos,permitir_visitantes FROM filamentos WHERE id=?").get(blue.id).permitir_petianos,0);
const backup=await req("/api/admin/backup","GET",undefined,admin);
assert.equal(backup.status,200);
assert.ok(backup.body.filamentos.every(c=>c.componente_id),"Backup inclui os vínculos das cores.");
assert.ok(backup.body.componentes.some(c=>c.import_key==="FILAMENTO-"+blue.id));
const restored=await req("/api/admin/restore","POST",backup.body,admin);
assert.equal(restored.status,200,JSON.stringify(restored.body).slice(0,600));
assert.equal(sqlite.prepare("SELECT quantidade FROM filamentos WHERE id=?").get(blue.id).quantidade,6);
assert.equal(sqlite.prepare("SELECT componente_id FROM filamentos WHERE id=?").get(blue.id).componente_id,blue.componente_id);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM componentes WHERE import_key=?").get("FILAMENTO-"+blue.id).n,1,"Não duplicar cor em restauração.");
assert.equal(sqlite.prepare("SELECT permitir_emprestimos FROM categorias WHERE id=?").get(filamentCat.id).permitir_emprestimos,0);
assert.equal(sqlite.prepare("SELECT permitir_emprestimos FROM componentes WHERE id=?").get(blue.componente_id).permitir_emprestimos,0);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM reservas WHERE componente_id=?").get(blue.componente_id).n,2);
// A migração de correção libera todas as categorias e cores existentes sem perder dados.
sqlite.exec(readFileSync("migrations/0017_reabrir_reservas_e_retiradas.sql","utf8"));
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM categorias WHERE arquivada=0 AND (permitir_petianos=0 OR permitir_visitantes=0)").get().n,0,"Categorias ativas devem oferecer as duas ações.");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM componentes WHERE arquivado=0 AND (permitir_petianos=0 OR permitir_visitantes=0)").get().n,0,"Materiais ativos devem oferecer ambas as ações.");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM filamentos WHERE permitir_petianos=0 OR permitir_visitantes=0").get().n,0,"Cores cadastradas devem oferecer reserva e retirada.");
assert.equal(sqlite.prepare("SELECT quantidade FROM filamentos WHERE id=?").get(blue.id).quantidade,6,"Migração não deve alterar estoque.");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM reservas WHERE componente_id=?").get(blue.componente_id).n,2,"Migração não deve apagar empréstimos.");
const newColor=await postAdmin("/api/admin/filaments",{acao:"criar",cor:"Roxo de teste",hexadecimal:"#9933CC",quantidade:2,visivel_visitante:true});
assert.equal(newColor.status,200,JSON.stringify(newColor.body));
const created=sqlite.prepare("SELECT permitir_petianos,permitir_visitantes,componente_id FROM filamentos WHERE cor='Roxo de teste'").get();
assert.equal(created.permitir_petianos,1,"Novo filamento deve começar liberado para PETianes.");
assert.equal(created.permitir_visitantes,1,"Novo filamento deve começar liberado para visitantes.");
assert.equal(sqlite.prepare("SELECT permitir_petianos,permitir_visitantes FROM componentes WHERE id=?").get(created.componente_id).permitir_visitantes,1,"O material vinculado também deve permitir reserva.");

// Matemática exigida: quantidade 10, seis em uso, somente quatro disponíveis.
const unit=await postAdmin("/api/admin/item",{
  categoria_id:electronic.id,nome:"Teste de disponibilidade 10-6",quantidade:10,em_uso:6,
  imagem:"",observacoes:"",identificacao:"",patrimonio:"",visivel_visitante:true,
  permitir_petianos:true,permitir_visitantes:true,mostrar_quantidade:true,mostrar_em_uso:true,unidade:"unidades"
});
assert.equal(unit.status,200,JSON.stringify(unit.body));
const constrained=sqlite.prepare("SELECT id FROM componentes WHERE nome='Teste de disponibilidade 10-6'").get();
assert.ok(constrained);
const availableFour=await req("/api/availability?id="+constrained.id+"&inicio="+today+"&fim="+end,"GET",undefined,visitor);
assert.equal(availableFour.status,200,JSON.stringify(availableFour.body));
assert.equal(availableFour.body.disponiveis,4);
const excess=await req("/api/reservations","POST",{componente_id:constrained.id,quantidade:5,data_inicio:today,data_devolucao:end},visitor);
assert.equal(excess.status,409,"Jamais aceitar reserva de cinco unidades se só há quatro disponíveis.");
console.log("EMPRÉSTIMOS OK: categoria, material, filamentos, reserva, retirada, devolução, bloqueio, estoque e restauração.");
sqlite.close();
