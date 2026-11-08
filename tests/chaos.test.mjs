/* Auditoria destrutiva 100% local: nenhuma requisicao ao dominio de producao.
 * Rodar: node --disable-warning=ExperimentalWarning tests/chaos.test.mjs
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import worker from "../src/index.js";

const sqlite=new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for(const filename of [
  "0001_base.sql","0002_avisos_email.sql","0003_dados_demonstracao.sql",
  "0004_usuarios_e_retiradas.sql","0005_proteger_reservas.sql","0006_login_senha.sql",
  "0007_inventario_oficial.sql","0008_notificacoes.sql","0009_filamentos.sql",
  "0010_historico_visibilidade.sql","0013_gmail_queue.sql","0014_email_usuarios.sql",
  "0015_autorizacao_emprestimos.sql","0016_permissoes_por_perfil.sql",
  "0020_central_vinculos.sql","0021_estoque_sem_defeitos.sql",
  "0022_seguranca_contas_email_recuperacao.sql","0023_devolucoes_visitantes_pendentes.sql",
  "0024_imagem_independente_vinculos.sql"
])sqlite.exec(readFileSync("migrations/"+filename,"utf8"));
// Coluna futura simulando dado que nunca deve aparecer no catálogo público.
sqlite.exec("ALTER TABLE componentes ADD COLUMN segredo_privado_admin TEXT DEFAULT 'SENTINELA_PRIVADA_NAO_EXIBIR'");
class Prepared {
  constructor(sql){this.sql=sql;this.values=[];}
  bind(...values){this.values=values;return this;}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.values)};}
  async run(){const r=sqlite.prepare(this.sql).run(...this.values);return {meta:{changes:r.changes,last_row_id:Number(r.lastInsertRowid)}};}
}
const DB={prepare:sql=>new Prepared(sql),async batch(qs){
  sqlite.exec("BEGIN IMMEDIATE");
  try{const done=[];for(const q of qs)done.push(await q.run());sqlite.exec("COMMIT");return done;}
  catch(e){sqlite.exec("ROLLBACK");throw e;}
}};
const env={DB,ADMIN_PASSWORD:"admin-test-very-secret"};
const domain="https://inventario-pet.pet-educacao.workers.dev";
let cases=0;
function status(expected,r,description){
  cases++;
  assert.equal(r.status,expected,description+" => "+JSON.stringify(r.body).slice(0,300));
}
async function request(path,method="GET",body=undefined,cookie="",extraHeaders={}){
  const headers={"CF-Connecting-IP":"198.51.100.200",...extraHeaders};
  if(cookie)headers.cookie=cookie;
  if(body!==undefined&&!headers["content-type"])headers["content-type"]="application/json";
  const res=await worker.fetch(new Request(domain+path,{method,headers,...(body===undefined?{}:{body:typeof body==="string"?body:JSON.stringify(body)})}),env);
  const payload=await res.json();
  if(res.status>=500)console.error("ERRO SERVIDOR em",method,path,payload);
  return {status:res.status,body:payload,cookie:res.headers.get("set-cookie")?.split(";")[0]||""};
}
const post=(p,d,c="",headers)=>request(p,"POST",d,c,headers);
const del=(p,c="")=>request(p,"DELETE",undefined,c);
const q=(sql,...args)=>sqlite.prepare(sql).get(...args);
const count=(sql,...args)=>Number(q(sql,...args).n||0);
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const plus=n=>{const x=new Date(today+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const now=()=>new Date().toISOString();
// Política do navegador: bloquear scripts injetados, carregamento de terceiros
// como script, iframes de sites falsos e envio de referrer sensível.
const assetEnv={...env,ASSETS:{fetch:async()=>new Response("<!doctype html><title>Inventário</title>",{status:200,headers:{"content-type":"text/html; charset=utf-8"}})}};
const htmlHeaders=await worker.fetch(new Request(domain+"/"),assetEnv);
assert.equal(htmlHeaders.status,200);
const csp=htmlHeaders.headers.get("content-security-policy")||"";
assert.match(csp,/script-src 'self'/);
assert.match(csp,/script-src-attr 'none'/);
assert.match(csp,/frame-ancestors 'self'/);
assert.match(csp,/frame-src 'self'/,"Ajuda embutida na mesma origem precisa permanecer disponível.");
assert.match(csp,/object-src 'none'/);
assert.match(csp,/connect-src 'self'/);
assert.match(csp,/base-uri 'self'/);
assert.doesNotMatch(csp,/script-src [^;]*'unsafe-inline'/);
assert.equal(htmlHeaders.headers.get("x-frame-options"),"SAMEORIGIN");
assert.equal(htmlHeaders.headers.get("referrer-policy"),"no-referrer");
assert.equal(htmlHeaders.headers.get("x-content-type-options"),"nosniff");
assert.match(htmlHeaders.headers.get("permissions-policy"),/camera=\(\)/);
cases+=12;
const catalogRaw=await worker.fetch(new Request(domain+"/api/catalog"),env);
assert.equal(catalogRaw.headers.get("cache-control"),"no-store","Catálogo JSON não deve ser cacheável.");
assert.equal(catalogRaw.headers.get("x-frame-options"),"SAMEORIGIN");
assert.equal(catalogRaw.headers.get("referrer-policy"),"no-referrer");
const publicPayload=await catalogRaw.json();
assert.doesNotMatch(JSON.stringify(publicPayload),/password_hash|password_salt|recovery_hash|admin_sessions|token_reserva|identity_mail_queue|__Host_pet/,"Catálogo público não pode vazar credenciais ou hashes.");
assert.doesNotMatch(JSON.stringify(publicPayload),/segredo_privado_admin|SENTINELA_PRIVADA_NAO_EXIBIR/,"Novas colunas sensíveis do banco nunca podem vazar via SELECT * público.");
cases+=4;
const r=await post("/api/login",{senha:env.ADMIN_PASSWORD});
status(200,r,"Login Admin");const admin=r.cookie;
const auth=(path,body)=>post(path,body,admin);
const visitor=await post("/api/identity/register",{nome:"Pessoa visitante de teste",login:"chaosvisitante",email:"chaos.visitante@example.com",senha:"abc"});
status(201,visitor,"Cadastro visitante com senha livre");
const another=await post("/api/identity/register",{nome:"Pessoa PETiane de teste",login:"chaospetiane",email:"chaos.petiane@example.com",senha:"1234"});
status(201,another,"Cadastro futura PETiane");
const visitorCookie=visitor.cookie;
const visitorId=visitor.body.usuario.id,memberId=another.body.usuario.id;
status(409,await post("/api/identity/register",{nome:"Outro",login:"outrochaos",email:"CHAOS.VISITANTE@EXAMPLE.COM",senha:"abc"}),"E-mail duplicado sem distinção de caixa");
status(200,await auth("/api/admin/users",{id:memberId,tag:"petiano"}),"Elevar cargo só pelo Admin");
const member=await post("/api/identity/login",{login:"chaospetiane",senha:"1234"});
status(200,member,"Login PETiane");const memberCookie=member.cookie;
// Inspecionar o próprio tráfego ou mudar a rota não deve oferecer acesso Admin.
for(const secretPath of ["/api/admin/state","/api/admin/backup","/api/admin/export","/api/admin/users","/api/admin/mail/log?historico=1"]){
  for(const cookie of ["",visitorCookie,memberCookie]){
    status(401,await request(secretPath,"GET",undefined,cookie),"Endpoint privado sem autenticação Admin "+secretPath);
  }
}
status(401,await post("/api/admin/restore",{formato:"inventario-pet-v2",categorias:[],componentes:[],reservas:[],filamentos:[]},visitorCookie),"Backup forjado não substitui inventário");
status(403,await post("/api/admin/category",{acao:"criar",nome:"Tentativa CSRF"},admin,{"origin":"https://evil.example"}),"Origin cruzada deve ser rejeitada mesmo com cookie Admin");
status(401,await post("/api/admin/category",{acao:"criar",nome:"Sem autorização"}),"Visitante não cria categoria");
status(401,await post("/api/admin/category",{acao:"criar",nome:"Sem autorização"},visitorCookie),"Cookie pessoal não é Admin");
status(403,await post("/api/admin/category",{acao:"criar",nome:"Origem falsa"},admin,{"origin":"https://site-malicioso.example"}),"Bloquear Origin de outro domínio");
status(401,await post("/api/member/withdraw",{componente_id:1,quantidade:1,data_devolucao:plus(4)}),"Retirada sem login");
status(403,await post("/api/member/withdraw",{componente_id:1,quantidade:1,data_devolucao:plus(4)},visitorCookie),"Visitante não retira diretamente");

// Categoria: criar, editar, proteger exclusão, excluir.
status(200,await auth("/api/admin/category",{acao:"criar",nome:"Laboratório Caos",visivel_visitante:true}),"Criar categoria");
const cat=q("SELECT id,nome FROM categorias WHERE nome='Laboratório Caos'");assert.ok(cat);
status(200,await auth("/api/admin/category",{acao:"editar",id:cat.id,nome:"Laboratório Caos Editado",visivel_visitante:true}),"Editar categoria");
status(200,await auth("/api/admin/category",{acao:"criar",nome:"Categoria Efêmera",visivel_visitante:false}),"Criar categoria descartável");
const disposableCat=q("SELECT id FROM categorias WHERE nome='Categoria Efêmera'");
status(400,await auth("/api/admin/category",{acao:"excluir",id:disposableCat.id,confirmacao:"errado"}),"Exclusão de categoria exige confirmação");
status(200,await auth("/api/admin/category",{acao:"excluir",id:disposableCat.id,confirmacao:"Categoria Efêmera"}),"Excluir categoria vazia");
assert.equal(count("SELECT COUNT(*) AS n FROM categorias WHERE id=?",disposableCat.id),0);
const itemData={categoria_id:cat.id,nome:"Sensor de teste",
  imagem:"",patrimonio:"PET-TESTE",identificacao:"T-01",quantidade:8,em_uso:0,
  observacoes:"Teste reversível",unidade:"unidades",visivel_visitante:true,
  permitir_petianos:true,permitir_visitantes:true,grupo_variacoes:"Tentativa de bypass"};
status(200,await auth("/api/admin/item",itemData),"Criar material");
const item=q("SELECT * FROM componentes WHERE nome='Sensor de teste'");
assert.ok(item);assert.equal(item.grupo_variacoes,"","Editor não pode criar vínculo");
status(200,await auth("/api/admin/item",{...itemData,id:item.id,nome:"Sensor de teste editado",quantidade:10}),"Editar material");
assert.equal(q("SELECT quantidade FROM componentes WHERE id=?",item.id).quantidade,10);
for(const quantity of [-1,1.5,1000001,Number.MAX_SAFE_INTEGER]){
  const before=q("SELECT quantidade FROM componentes WHERE id=?",item.id).quantidade;
  status(400,await auth("/api/admin/item",{...itemData,id:item.id,quantidade:quantity}),"Negar estoque inválido "+quantity);
  assert.equal(q("SELECT quantidade FROM componentes WHERE id=?",item.id).quantidade,before);
}
status(400,await auth("/api/admin/item",{...itemData,id:item.id,em_uso:11,quantidade:10}),"Em uso não supera quantidade");
status(400,await auth("/api/admin/item",{...itemData,id:item.id,imagem:"<svg onload=alert(1)></svg>"}),"Imagem SVG executável não permitida");
status(200,await auth("/api/admin/item/photo",{id:item.id,imagem:"data:image/png;base64,aGVsbG8="}),"Editar foto de material");
assert.match(q("SELECT imagem FROM componentes WHERE id=?",item.id).imagem,/data:image\/png/);
status(200,await auth("/api/admin/item/photo",{id:item.id,imagem:""}),"Restaurar imagem ilustrativa");
status(400,await auth("/api/admin/item/photo",{id:item.id,imagem:"data:text/html;base64,SGk="}),"Não aceitar HTML como foto");
status(200,await auth("/api/admin/variation-groups",{acao:"criar",nome:"Grupo Caos"}),"Criar vínculo vazio");
status(409,await auth("/api/admin/variation-groups",{acao:"criar",nome:"grupo caos"}),"Vínculo não pode duplicar caixa");
status(200,await auth("/api/admin/variations",{ids:[item.id],grupo:"Grupo Caos"}),"Vincular material");
assert.equal(q("SELECT grupo_variacoes FROM componentes WHERE id=?",item.id).grupo_variacoes,"Grupo Caos");
status(200,await auth("/api/admin/item",{...itemData,id:item.id,quantidade:10}),"Editor preserva vínculo");
assert.equal(q("SELECT grupo_variacoes FROM componentes WHERE id=?",item.id).grupo_variacoes,"Grupo Caos");
status(200,await auth("/api/admin/variation-groups",{acao:"renomear",nome:"Grupo Caos",novo_nome:"Grupo Caos Renomeado"}),"Renomear vínculo");
status(200,await auth("/api/admin/variation-groups",{acao:"excluir",nome:"Grupo Caos Renomeado"}),"Excluir vínculo preservando material");
assert.equal(q("SELECT grupo_variacoes FROM componentes WHERE id=?",item.id).grupo_variacoes,"");
assert.ok(q("SELECT id FROM componentes WHERE id=?",item.id));
status(400,await auth("/api/admin/visibility",{ids:[item.id,item.id],visivel_visitante:false}),"Negar IDs duplicados");
status(200,await auth("/api/admin/visibility",{ids:[item.id],visivel_visitante:false}),"Ocultar material");
assert.ok(!(await request("/api/catalog")).body.componentes.some(x=>x.id===item.id),"Visitante não pode ver componente oculto");
assert.ok((await request("/api/catalog","GET",undefined,memberCookie)).body.componentes.some(x=>x.id===item.id),"PETiane ainda pode consultar componente oculto");
status(200,await auth("/api/admin/visibility",{ids:[item.id],visivel_visitante:true}),"Reexibir material");

// Visitante: reserva, aprovar/recusar, devolução sinalizada com veredito do Admin.
const reserve={componente_id:item.id,quantidade:3,data_inicio:today,data_devolucao:plus(2),observacao:"Reserva de teste"};
status(400,await post("/api/reservations",{...reserve,data_devolucao:plus(-1)},visitorCookie),"Data fim não pode ser anterior");
status(201,await post("/api/reservations",reserve,visitorCookie),"Reservar material");
let loan=q("SELECT * FROM reservas WHERE componente_id=? ORDER BY id DESC LIMIT 1",item.id);
assert.equal(loan.status,"pendente");
status(409,await del("/api/admin/item?id="+item.id,admin),"Impedir excluir material com reserva pendente");
status(200,await auth("/api/admin/reservation",{id:loan.id,acao:"aprovar",responsavel:"Admin Teste"}),"Aprovar equivale a entregar");
assert.equal(q("SELECT em_uso FROM componentes WHERE id=?",item.id).em_uso,3);
status(409,await auth("/api/admin/reservation",{id:loan.id,acao:"aprovar"}),"Impedir aprovar duas vezes");
status(409,await auth("/api/admin/item",{...itemData,id:item.id,em_uso:2,quantidade:10}),"Editar em uso abaixo dos emprestados é proibido");
status(200,await post("/api/my/return",{id:loan.id},visitorCookie),"Visitante informa Devolvido");
assert.equal(q("SELECT em_uso FROM componentes WHERE id=?",item.id).em_uso,3);
status(409,await post("/api/my/return",{id:loan.id},visitorCookie),"Não aceitar sinalização duplicada");
status(200,await auth("/api/admin/reservation",{id:loan.id,acao:"cancelar_solicitacao_devolucao"}),"Não recebido");
assert.equal(q("SELECT status FROM reservas WHERE id=?",loan.id).status,"retirada");
status(200,await post("/api/my/return",{id:loan.id},visitorCookie),"Visitante reenvia Devolvido");
status(200,await auth("/api/admin/reservation",{id:loan.id,acao:"devolver"}),"Admin confirma recebido");
assert.equal(q("SELECT em_uso FROM componentes WHERE id=?",item.id).em_uso,0);
status(409,await auth("/api/admin/reservation",{id:loan.id,acao:"devolver"}),"Não devolver duas vezes");

// PETiane: retirada direta e devolução após ajuste de estoque.
const direct=await post("/api/member/withdraw",{componente_id:item.id,quantidade:2,data_devolucao:plus(2)},memberCookie);
status(201,direct,"Retirada direta PETiane");
assert.equal(q("SELECT em_uso FROM componentes WHERE id=?",item.id).em_uso,2);
status(409,await del("/api/admin/item?id="+item.id,admin),"Não excluir com retirada ativa");
status(200,await post("/api/my/return",{id:direct.body.retirada_id,descartados:1},memberCookie),"PETiane devolve descartando uma unidade");
assert.equal(q("SELECT quantidade,em_uso FROM componentes WHERE id=?",item.id).quantidade,9);
assert.equal(q("SELECT em_uso FROM componentes WHERE id=?",item.id).em_uso,0);
status(404,await post("/api/my/return",{id:direct.body.retirada_id},memberCookie),"Não devolver duas vezes no perfil");
status(200,await del("/api/admin/item?id="+item.id,admin),"Excluir material com histórico concluído");
assert.equal(count("SELECT COUNT(*) AS n FROM componentes WHERE id=?",item.id),0);
status(404,await del("/api/admin/item?id="+item.id,admin),"Não excluir material inexistente");
status(200,await auth("/api/admin/category",{acao:"excluir",id:cat.id,confirmacao:"Laboratório Caos Editado"}),"Excluir categoria sem materiais");

// Filamentos: criar, editar, proteger duplicidade, permitir remover sem pendências.
status(200,await auth("/api/admin/filaments",{acao:"criar",cor:"Cor de teste Caos",hexadecimal:"#AABBCC",quantidade:6}),"Criar filamento");
const filament=q("SELECT * FROM filamentos WHERE cor='Cor de teste Caos'");
assert.ok(filament?.componente_id);assert.equal(q("SELECT quantidade FROM componentes WHERE id=?",filament.componente_id).quantidade,6);
status(200,await auth("/api/admin/filaments",{acao:"editar",id:filament.id,cor:"Cor Caos Renomeada",hexadecimal:"#123456",quantidade:4}),"Editar filamento");
assert.equal(q("SELECT quantidade FROM componentes WHERE id=?",filament.componente_id).quantidade,4);
assert.equal(q("SELECT nome FROM componentes WHERE id=?",filament.componente_id).nome,"Filamento - Cor Caos Renomeada");
status(400,await auth("/api/admin/filaments",{acao:"editar",id:filament.id,cor:"X",hexadecimal:"#ZZZZZZ",quantidade:-1}),"Filamento inválido");
status(200,await auth("/api/admin/filaments",{acao:"excluir",id:filament.id}),"Excluir filamento sem empréstimos");
assert.equal(count("SELECT COUNT(*) AS n FROM filamentos WHERE id=?",filament.id),0);
assert.equal(q("SELECT arquivado FROM componentes WHERE id=?",filament.componente_id).arquivado,1);

// Fuzz HTTP/JSON/IDs e acessos indevidos: nunca retornar 500 para erro de entrada.
const badRequests=[
  ["/api/availability?id=abc&inicio="+today+"&fim="+plus(1),"GET",undefined,""],
  ["/api/availability?id=0&inicio="+today+"&fim="+plus(1),"GET",undefined,""],
  ["/api/admin/item","POST",{...itemData,id:-2},admin],
  ["/api/admin/variation-groups","POST",{acao:"excluir",nome:"Inexistente"},admin],
  ["/api/admin/variations","POST",{ids:[0],grupo:"x"},admin],
  ["/api/admin/visibility","POST",{ids:[-1],visivel_visitante:true},admin],
  ["/api/admin/filaments","POST",{acao:"editar",id:999999,cor:"Filamento",hexadecimal:"#000000",quantidade:1},admin],
  ["/api/admin/reservation","POST",{id:999999,acao:"aprovar"},admin],
  ["/api/admin/reservations/reset","POST",{confirmar:"INVÁLIDO"},admin],
  ["/api/admin/settings","POST",{limpeza_reservas:"999999"},admin],
  ["/api/identity/reset-by-email","POST",{token:"invalido",nova_senha:"ok"},""],
  ["/api/identity/email","POST",{email:"invalido",senha_atual:"x"},visitorCookie],
  ["/api/member/return","POST",{id:-1},memberCookie],
  ["/api/my/return","POST",{id:-1},visitorCookie],
  ["/api/identity/login","POST","{bad-json",""],
  ["/api/identity/register","POST","{bad-json",""],
  ["/api/admin/item","POST","{bad-json",admin],
];
for(const [path,method,body,cookie] of badRequests){
  const got=await request(path,method,body,cookie);
  cases++;
  assert.ok(got.status>=400&&got.status<500,
    "Entrada inválida deve retornar erro 4xx, não 5xx: "+method+" "+path+" HTTP "+got.status+" "+JSON.stringify(got.body));
}
const noAdmin=await request("/api/admin/state","GET");
status(401,noAdmin,"Painel sem sessão não permite acesso");
const reset=await auth("/api/admin/reservations/reset",{confirmar:true});
status(200,reset,"Limpeza total sem retiradas ativas");
assert.equal(count("SELECT COUNT(*) AS n FROM reservas"),0);
status(200,await post("/api/logout",{},admin),"Sair do Admin");
status(401,await request("/api/admin/state","GET",undefined,admin),"Sessão revogada ao sair");
status(200,await post("/api/identity/logout",{},memberCookie),"Sair da conta PETiane");
assert.equal((await request("/api/identity/me","GET",undefined,memberCookie)).body.usuario,null,"Sessão pessoal revogada");
console.log("CAOS OK:",cases,"verificações; categorias, materiais, fotos, grupos, permissões, reservas, devoluções, filamentos, exclusões, sessão e fuzz 4xx sem alterar produção.");
sqlite.close();
