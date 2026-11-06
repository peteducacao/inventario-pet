import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {identityAPI} from "../src/identity.js";

// A SQLite local reproduz as migracoes D1 sem criar usuarios ficticios no site real.
const sql=new DatabaseSync(":memory:");
sql.exec("PRAGMA foreign_keys=ON");
for(const name of ["0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql","0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql"]){
  sql.exec(readFileSync("migrations/"+name,"utf8"));
}
class Prepared{
  constructor(statement){this.statement=statement;this.args=[];}
  bind(...values){this.args=values;return this;}
  async run(){const r=sql.prepare(this.statement).run(...this.args);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
  async first(){return sql.prepare(this.statement).get(...this.args)||null;}
  async all(){return {results:sql.prepare(this.statement).all(...this.args)};}
}
const DB={
  prepare(statement){return new Prepared(statement);},
  async batch(prepared){
    sql.exec("BEGIN IMMEDIATE");
    try{const items=[];for(const p of prepared)items.push(await p.run());sql.exec("COMMIT");return items;}
    catch(e){sql.exec("ROLLBACK");throw e;}
  }
};
const env={DB};
const call=async(path,method="GET",body=null,cookie="",admin=false)=>{
  const request=new Request("https://inventario-pet.pet-educacao.workers.dev"+path,{
    method,headers:{...(body===null?{}:{"content-type":"application/json"}),...(cookie?{cookie}:{}),"CF-Connecting-IP":"192.0.2.42"},
    ...(body===null?{}:{body:JSON.stringify(body)})
  });
  const result=await identityAPI(request,env,async()=>admin);
  return {status:result.status,body:await result.json(),cookie:result.headers.get("set-cookie")?.split(";")[0]||"",headers:result.headers};
};
const register=async nome=>call("/api/identity/register","POST",{nome});
const a=await register("Sérgio"),b=await register("Sérgio");
assert.equal(a.status,201);
assert.equal(b.status,201);
assert.notEqual(a.body.usuario.id,b.body.usuario.id,"Dois Sergios precisam de IDs distintos");
assert.equal(a.body.usuario.tag,"visitante");
assert.match(a.cookie,/^__Host_pet_identity=/);
assert.match(a.headers.get("set-cookie"),/HttpOnly/);
assert.match(a.headers.get("set-cookie"),/Secure/);
assert.match(a.body.codigo_recuperacao,/^REC-[A-F0-9]{40}$/);
const noAuth=await call("/api/identity/me");
assert.equal(noAuth.body.usuario,null,"O ID publico nao autentica");
const fake=await call("/api/identity/me","GET",null,"__Host_pet_identity="+a.body.usuario.id);
assert.equal(fake.body.usuario,null,"O ID nao pode ser usado como cookie");

let res=await call("/api/admin/users","POST",{id:a.body.usuario.id,tag:"petiano"});
assert.equal(res.status,401,"Visitantes nao devem conceder tags");
res=await call("/api/admin/users","POST",{id:a.body.usuario.id,tag:"petiano"},'',true);
assert.equal(res.status,200);
const role=await call("/api/identity/me","GET",null,a.cookie);
assert.equal(role.body.usuario.tag,"petiano");
const role2=await call("/api/identity/me","GET",null,b.cookie);
assert.equal(role2.body.usuario.tag,"visitante");

const item=sql.prepare("SELECT id,quantidade,em_uso,com_defeito FROM componentes WHERE nome LIKE 'ESP32%'").get();
assert.ok(item);
const day=new Date().toISOString().slice(0,10);
const due=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const guestAttempt=await call("/api/member/withdraw","POST",{componente_id:item.id,quantidade:1,data_devolucao:due},b.cookie);
assert.equal(guestAttempt.status,403,"Visitante nao pode retirar diretamente");
const direct=await call("/api/member/withdraw","POST",{componente_id:item.id,quantidade:2,data_devolucao:due},a.cookie);
assert.equal(direct.status,201,JSON.stringify(direct.body));
const loan=sql.prepare("SELECT * FROM reservas WHERE id=?").get(direct.body.retirada_id);
assert.equal(loan.status,"retirada");
assert.equal(loan.tipo,"retirada_direta");
assert.equal(loan.quantidade,2);
assert.equal(sql.prepare("SELECT em_uso FROM componentes WHERE id=?").get(item.id).em_uso,item.em_uso+2);
const mine=await call("/api/member/history","GET",null,a.cookie);
assert.equal(mine.body.retiradas[0].id,loan.id);
const otherMine=await call("/api/member/history","GET",null,b.cookie);
assert.equal(otherMine.status,403);
const ownReturn=await call("/api/member/return","POST",{id:loan.id,defeituosos:1},a.cookie);
assert.equal(ownReturn.status,200);
assert.equal(sql.prepare("SELECT status FROM reservas WHERE id=?").get(loan.id).status,"devolvida");
assert.equal(sql.prepare("SELECT em_uso,com_defeito FROM componentes WHERE id=?").get(item.id).em_uso,item.em_uso);
assert.equal(sql.prepare("SELECT em_uso,com_defeito FROM componentes WHERE id=?").get(item.id).com_defeito,item.com_defeito+1);
const twice=await call("/api/member/return","POST",{id:loan.id,defeituosos:0},a.cookie);
assert.notEqual(twice.status,200,"Nao permitir devolucao duplicada");

const wrong=await call("/api/identity/recover","POST",{id:a.body.usuario.id,codigo:b.body.codigo_recuperacao});
assert.equal(wrong.status,401);
const recovered=await call("/api/identity/recover","POST",{id:a.body.usuario.id,codigo:a.body.codigo_recuperacao});
assert.equal(recovered.status,200);
assert.equal(recovered.body.usuario.tag,"petiano");
assert.ok(recovered.cookie && recovered.cookie!==a.cookie);
await call("/api/admin/users","POST",{id:a.body.usuario.id,tag:"visitante"},'',true);
const demoted=await call("/api/member/withdraw","POST",{componente_id:item.id,quantidade:1,data_devolucao:due},recovered.cookie);
assert.equal(demoted.status,403,"Tag removida deve bloquear retirada imediatamente");

// A trigger do banco protege quantidades prometidas em reservas aprovadas.
await call("/api/admin/users","POST",{id:a.body.usuario.id,tag:"petiano"},'',true);
const avail=sql.prepare("SELECT quantidade-em_uso-com_defeito AS n FROM componentes WHERE id=?").get(item.id).n;
sql.prepare("INSERT INTO reservas(componente_id,nome_solicitante,contato,quantidade,data_inicio,data_devolucao,status) VALUES (?,?,?, ?,?,?, 'aprovada')").run(item.id,"Reserva de teste","",avail-1,day,due);
const before=sql.prepare("SELECT COUNT(*) AS n FROM reservas WHERE tipo='retirada_direta'").get().n;
let reservationProtected=false;
try{
  const denied=await call("/api/member/withdraw","POST",{componente_id:item.id,quantidade:2,data_devolucao:due},recovered.cookie);
  reservationProtected=denied.status>=400;
}catch(error){reservationProtected=/indisponivel|material|estoque|SQLITE_CONSTRAINT/i.test(String(error));}
assert.ok(reservationProtected,"Retirada direta nao pode consumir estoque comprometido em reservas aprovadas");
assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM reservas WHERE tipo='retirada_direta'").get().n,before);

// O admin pode gerar novo codigo, mas nao revelar o antigo.
const unauthReset=await call("/api/admin/users/recovery","POST",{id:a.body.usuario.id});
assert.equal(unauthReset.status,401,"Codigo nao deve ser redefinido por visitante");
const recoveryReset=await call("/api/admin/users/recovery","POST",{id:a.body.usuario.id},"",true);
assert.equal(recoveryReset.status,200,JSON.stringify(recoveryReset.body));
assert.match(recoveryReset.body.codigo_recuperacao,/^REC-[A-F0-9]{40}$/);
assert.notEqual(recoveryReset.body.codigo_recuperacao,a.body.codigo_recuperacao);
assert.equal(await call("/api/identity/recover","POST",{id:a.body.usuario.id,codigo:a.body.codigo_recuperacao}).then(x=>x.status),401,"Codigo antigo deveria ser invalido");
assert.equal((await call("/api/identity/me","GET",null,recovered.cookie)).body.usuario,null,"Sessoes antigas precisam ser encerradas");
const reopened=await call("/api/identity/recover","POST",{id:a.body.usuario.id,codigo:recoveryReset.body.codigo_recuperacao});
assert.equal(reopened.status,200,"Novo codigo deve recuperar perfil");

// Excluir perfil com retirada ou reserva em aberto e proibido; preserva historico concluido.
const subject=sql.prepare("SELECT id FROM usuarios WHERE public_id=?").get(a.body.usuario.id).id;
const pendingLoan=sql.prepare("INSERT INTO reservas(componente_id,usuario_id,nome_solicitante,contato,quantidade,data_inicio,data_devolucao,status) VALUES (?,?,?,?,?,?,?,'pendente')").run(item.id,subject,"Sergio","",1,day,due).lastInsertRowid;
const deniedDelete=await call("/api/admin/users/delete","POST",{id:a.body.usuario.id},"",true);
assert.equal(deniedDelete.status,409,"Nao apagar usuario com reserva em andamento");
sql.prepare("UPDATE reservas SET status='recusada' WHERE id=?").run(pendingLoan);
assert.equal((await call("/api/admin/users/delete","POST",{id:a.body.usuario.id})).status,401,"Visitante nao pode apagar usuario");
const deleted=await call("/api/admin/users/delete","POST",{id:a.body.usuario.id},"",true);
assert.equal(deleted.status,200,JSON.stringify(deleted.body));
assert.equal(sql.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE public_id=?").get(a.body.usuario.id).n,0);
assert.equal((await call("/api/identity/me","GET",null,reopened.cookie)).body.usuario,null);
assert.equal(sql.prepare("SELECT status FROM reservas WHERE id=?").get(loan.id).status,"devolvida","Historico concluido deve ser mantido");
assert.equal(sql.prepare("SELECT usuario_id FROM reservas WHERE id=?").get(loan.id).usuario_id,null,"Historico nao deve apontar para cadastro excluido");

console.log("IDENTIDADE OK: dois nomes iguais, IDs distintos, cookies privados, recuperação, permissões, retirada, devolução, proteção de reserva, redefinição e exclusão de usuário.");
sql.close();
