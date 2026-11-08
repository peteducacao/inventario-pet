import { identityAPI, currentIdentity } from "./identity.js";
import { mailBridgeAPI, mailAdminAPI, generateDailyEmails, queueManual } from "./mail-bridge.js";
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const j = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
const bad = (message, status = 400) => j({ error: message }, status);
const now = () => new Date().toISOString();
const str = (value, max = 200) => String(value ?? "").trim().slice(0, max);
const integer = value => value === "" || value == null ? NaN : Number(value);
const validEmail = email => !email || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 180);
const dateOK = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const dt = new Date(value + "T12:00:00Z");
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === value;
};
const todayBR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const toHash = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(x => x.toString(16).padStart(2, "0")).join("");
// Cookie de sessão (sem Expires/Max-Age): perde validade ao encerrar a sessão do navegador.
const adminSessionCookie = token => "__Host_pet_session="+token+"; Path=/; Secure; HttpOnly; SameSite=Strict";
const cookie = (req, key) => {
  const value = (req.headers.get("cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(key + "="));
  return value ? value.slice(key.length + 1) : "";
};
const results = async (db, sql, args = []) => (await db.prepare(sql).bind(...args).all()).results || [];
const requireId = value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Identificador inválido.");
  return n;
};
async function input(req, limit = 260000) {
  const raw = await req.text();
  if (raw.length > limit) throw new Error("Dados grandes demais.");
  let obj;
  try { obj = JSON.parse(raw); } catch { throw new Error("Os dados enviados são inválidos."); }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("Dados inválidos.");
  return obj;
}
async function auth(req, db) {
  const token = cookie(req, "__Host_pet_session");
  if (!token || token.length > 100) return false;
  const row = await db.prepare("SELECT hash FROM admin_sessions WHERE hash=? AND expires_at>?").bind(await toHash(token), now()).first();
  return !!row;
}
function validateItem(data) {
  const x = {
    categoria_id: requireId(data.categoria_id),
    nome: str(data.nome, 140),
    imagem: str(data.imagem, 110000),
    patrimonio: str(data.patrimonio, 160),
    identificacao: str(data.identificacao, 120),
    quantidade: integer(data.quantidade),
    em_uso: integer(data.em_uso),
    com_defeito: 0, // campo legado: descarte subtrai do total
    mostrar_quantidade: 1,
    mostrar_em_uso: 1,
    mostrar_defeito: 0,
    descricao_defeito: "",
    observacoes: str(data.observacoes, 1200),
    unidade: str(data.unidade||"unidades", 40),
    visivel_visitante: data.visivel_visitante === undefined ? 1 : (data.visivel_visitante ? 1 : 0),
    grupo_variacoes: str(data.grupo_variacoes,80),
    permitir_petianos: data.permitir_petianos===undefined?(data.permitir_emprestimos===undefined?1:Number(!!data.permitir_emprestimos)):Number(!!data.permitir_petianos),
    permitir_visitantes: data.permitir_visitantes===undefined?(data.permitir_emprestimos===undefined?1:Number(!!data.permitir_emprestimos)):Number(!!data.permitir_visitantes),
    permitir_emprestimos: (data.permitir_petianos===undefined && data.permitir_visitantes===undefined)?(data.permitir_emprestimos===undefined?1:Number(!!data.permitir_emprestimos)):Number(!!(data.permitir_petianos||data.permitir_visitantes))
  };
  if (!x.nome) throw new Error("Informe o nome do material.");
  if ([x.quantidade, x.em_uso].some(n => !Number.isSafeInteger(n) || n < 0 || n > 1000000)) throw new Error("Confira as quantidades.");
  if (x.em_uso > x.quantidade) throw new Error("Em uso não pode ultrapassar a quantidade total.");
  if (x.imagem && !(/^\/img\/[a-zA-Z0-9_.-]+\.(svg|webp|jpg|jpeg|png)$/.test(x.imagem) || /^https:\/\//.test(x.imagem) || /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(x.imagem))) throw new Error("A imagem deve ser uma foto válida.");
  return x;
}
const fields = ["categoria_id","nome","imagem","patrimonio","identificacao","quantidade","em_uso","com_defeito","mostrar_quantidade","mostrar_em_uso","mostrar_defeito","descricao_defeito","observacoes","unidade","visivel_visitante","grupo_variacoes","permitir_emprestimos","permitir_petianos","permitir_visitantes"];
const names = { categoria_id:"Categoria",nome:"Nome",imagem:"Fotografia",patrimonio:"Patrimônio",identificacao:"Identificação",quantidade:"Quantidade",em_uso:"Em uso",com_defeito:"Com defeito",mostrar_quantidade:"Exibição da quantidade",mostrar_em_uso:"Exibição de em uso",mostrar_defeito:"Exibição de defeitos",descricao_defeito:"Descrição dos defeitos",observacoes:"Observações",unidade:"Unidade",visivel_visitante:"Exibição para visitantes",grupo_variacoes:"Família de variações",permitir_emprestimos:"Empréstimos",permitir_petianos:"Retirada para PETianes",permitir_visitantes:"Retirada para visitantes" };
function changes(before, after) {
  if (!before) return "Material cadastrado";
  const diffs = fields.filter(key => String(before[key] ?? "") !== String(after[key] ?? "")).map(key => key === "imagem" ? "Fotografia atualizada" : names[key] + ": " + str(before[key] ?? "—", 42) + " → " + str(after[key] ?? "—", 42));
  return diffs.join(" | ") || "Cadastro confirmado";
}
const isPETiano = user => user?.papel === "petiano" && !!user.login && !user.must_change_password;
const isFilamentMirror = item => /^FILAMENTO-\d+$/.test(String(item?.import_key||""));
const borrowable = (item,cat,member=false) => !!item && !!cat && Number(cat.arquivada)!==1 && Number(item[member?"permitir_petianos":"permitir_visitantes"])===1 && Number(cat[member?"permitir_petianos":"permitir_visitantes"])===1;
const allowedToSee = (item, category, member) => !!category && Number(category.arquivada)!==1 && (member || (Number(item.visivel_visitante ?? 1) === 1 && Number(category.visivel_visitante ?? 1) === 1));
async function auditLog(db, action, type, id, description, actor="Admin"){
  try{
    await db.prepare("INSERT INTO historico_admin(criado_em,responsavel,acao,tipo,registro_id,descricao) VALUES(?,?,?,?,?,?)")
      .bind(now(),str(actor,100)||"Admin",str(action,50),str(type,40),id||null,str(description,1400)).run();
  }catch(error){console.error("Erro ao registrar histórico administrativo",String(error).slice(0,200));}
}
async function catalog(db, isAdmin = false, member = false) {
  let cats = await results(db, "SELECT id,nome,ordem,visivel_visitante,arquivada,permitir_emprestimos,permitir_petianos,permitir_visitantes FROM categorias ORDER BY ordem,nome");
  let items = await results(db, isAdmin ? "SELECT * FROM componentes ORDER BY nome COLLATE NOCASE" : "SELECT * FROM componentes WHERE arquivado=0 ORDER BY nome COLLATE NOCASE");
  if(isAdmin)items=items.filter(item=>!isFilamentMirror(item));
  if (!isAdmin) {
    if (!member){
      const publicIds=new Set(cats.filter(c=>Number(c.visivel_visitante)!==0).map(c=>c.id));
      cats=cats.filter(c=>publicIds.has(c.id)&&Number(c.arquivada)!==1);
      items=items.filter(item=>cats.some(c=>c.id===item.categoria_id) && Number(item.visivel_visitante ?? 1)!==0);
    }
    cats=cats.filter(c=>Number(c.arquivada)!==1);
    items=items.filter(item=>cats.some(c=>c.id===item.categoria_id));
    for (const item of items) { delete item.ultimo_responsavel; delete item.detalhes_alteracao; }
  }
  return { categorias: cats, componentes: items };
}
async function listVariationGroups(db) {
  const existing=await results(db,"SELECT DISTINCT TRIM(grupo_variacoes) AS nome FROM componentes WHERE TRIM(COALESCE(grupo_variacoes,''))<>''");
  try {
    const stored=await results(db,"SELECT nome FROM grupos_variacoes ORDER BY nome COLLATE NOCASE");
    return [...new Map([...stored,...existing].filter(x=>x.nome).map(x=>[x.nome.toLocaleLowerCase("pt-BR"),{nome:x.nome}])).values()]
      .sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR",{sensitivity:"base"}));
  } catch(error) {
    // Compatibilidade com bancos de teste de migrações anteriores à 0020.
    if(!String(error).includes("no such table"))throw error;
    return existing;
  }
}
async function state(db) {
  const data = await catalog(db, true);
  data.reservas = await results(db, "SELECT r.*, c.nome AS componente_nome, u.email AS email_conta FROM reservas r LEFT JOIN componentes c ON c.id=r.componente_id LEFT JOIN usuarios u ON u.id=r.usuario_id ORDER BY r.solicitado_em DESC LIMIT 1500");
  data.filamentos = await results(db,"SELECT f.*,c.em_uso,c.com_defeito FROM filamentos f LEFT JOIN componentes c ON c.id=f.componente_id ORDER BY f.ordem,f.cor COLLATE NOCASE");
  // Inclui grupos vazios, que não existem em componentes e nunca entram no catálogo.
  data.grupos_variacoes = await listVariationGroups(db);
  const config = await results(db, "SELECT chave,valor FROM configuracoes");
  data.configuracoes = Object.fromEntries(config.map(x => [x.chave, x.valor]));
  data.ultima_atualizacao = data.componentes.reduce((best,item)=>item.ultima_alteracao>best?item.ultima_alteracao:best,"");
  return data;
}
async function renameVariationGroup(db,body) {
  const current=str(body.grupo_atual,80),next=str(body.novo_nome,80);
  if(current.length<2||next.length<2)return bad("Informe os nomes atual e novo do vínculo.");
  const norm=value=>String(value||"").trim().toLocaleLowerCase("pt-BR");
  const groups=await listVariationGroups(db);
  const source=groups.find(g=>norm(g.nome)===norm(current));
  if(!source)return bad("Vínculo não encontrado.",404);
  if(source.nome===next&&current===next)return j({ok:true,alterados:0});
  if(groups.some(g=>norm(g.nome)===norm(next)&&norm(g.nome)!==norm(current)))
    return bad("Já existe outro vínculo com esse nome.",409);
  const members=await results(db,"SELECT id,grupo_variacoes FROM componentes WHERE TRIM(COALESCE(grupo_variacoes,''))<>''");
  const affected=members.filter(x=>norm(x.grupo_variacoes)===norm(current));
  const actor=str(body.responsavel,100)||"Admin",stamp=now();
  const ops=affected.map(x=>db.prepare("UPDATE componentes SET grupo_variacoes=?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?")
    .bind(next,stamp,actor,"Grupo de variações: "+current+" → "+next,x.id));
  const hasTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='grupos_variacoes'").first();
  if(hasTable){
    // Grupos antigos criados antes da migração também são preservados.
    ops.push(db.prepare("INSERT OR IGNORE INTO grupos_variacoes(nome) VALUES(?)").bind(source.nome));
    ops.push(db.prepare("UPDATE grupos_variacoes SET nome=? WHERE nome=?").bind(next,source.nome));
  }
  if(ops.length)await db.batch(ops);
  await auditLog(db,"Renomeou grupo de variações","material",null,current+" → "+next+" · "+affected.length+" materiais",actor);
  return j({ok:true,alterados:affected.length});
}
const maxReserved = async (db, id, start, end, except = -1) => {
  const found = await db.prepare("SELECT COALESCE(SUM(quantidade),0) AS n FROM reservas WHERE componente_id=? AND id!=? AND status='aprovada' AND data_inicio<=? AND data_devolucao>=?").bind(id, except, end, start).first();
  return found?.n || 0;
};
const baseAvailable = item => Math.max(0, Number(item.quantidade||0) - Number(item.em_uso||0));
async function safeRate(db, req, prefix, max, hours = 1) {
  const ip = req.headers.get("CF-Connecting-IP") || "unknown";
  const hash = await toHash(prefix + ":" + ip + ":" + new Date().toISOString().slice(0, 10));
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const row = await db.prepare("SELECT COUNT(*) AS n FROM reserva_limites WHERE hash=? AND criado_em>=?").bind(hash, since).first();
  if ((row?.n || 0) >= max) return false;
  await db.prepare("INSERT INTO reserva_limites(hash,criado_em) VALUES(?,?)").bind(hash, now()).run();
  return true;
}
async function processRequest(req, env) {
  const url = new URL(req.url), path = url.pathname, method = req.method, db = env.DB;
  if (!db) return bad("O banco de dados não está configurado.", 503);
  if (!["GET", "HEAD"].includes(method)) {
    const origin = req.headers.get("origin");
    if (origin && origin !== url.origin) return bad("Origem não permitida.", 403);
  }
  const mailBridge = await mailBridgeAPI(req,env);
  if (mailBridge) return mailBridge;
  if (path === "/api/health") {
    const row = await db.prepare("SELECT COUNT(*) AS n FROM categorias").first();
    return j({ ok:true, service:"Inventário PET", database:"connected", categories:row?.n ?? 0 });
  }
  if (path === "/api/catalog" && method === "GET") {
    const user = await currentIdentity(req,db);
    const data = await catalog(db,false,isPETiano(user));
    const mode = await db.prepare("SELECT valor FROM configuracoes WHERE chave='modo_demo'").first();
    return j({ ...data, demonstracao:mode?.valor === "sim" });
  }
  if(path==="/api/filaments" && method==="GET"){
    const user=await currentIdentity(req,db);
    const member=isPETiano(user);
    const sql="SELECT f.id,f.cor,f.hexadecimal,f.quantidade,f.ordem,f.atualizado_em,f.visivel_visitante,f.permitir_emprestimos,f.permitir_petianos,f.permitir_visitantes,f.componente_id,c.em_uso,c.com_defeito,cat.id AS categoria_id,cat.permitir_emprestimos AS categoria_permite,cat.permitir_petianos AS categoria_petianos,cat.permitir_visitantes AS categoria_visitantes FROM filamentos f JOIN componentes c ON c.id=f.componente_id JOIN categorias cat ON cat.id=c.categoria_id WHERE c.arquivado=0 AND cat.arquivada=0"+(member?"":" AND f.visivel_visitante=1 AND cat.visivel_visitante=1")+" ORDER BY f.ordem,f.cor COLLATE NOCASE";
    const filamentos=await results(db,sql);
    return j({ok:true,filamentos});
  }
  if (path === "/api/availability" && method === "GET") {
    const id = requireId(url.searchParams.get("id")), a = url.searchParams.get("inicio"), b = url.searchParams.get("fim");
    if (!dateOK(a) || !dateOK(b) || a > b) return bad("Período inválido.");
    const item = await db.prepare("SELECT * FROM componentes WHERE id=?").bind(id).first();
    const category = item?await db.prepare("SELECT visivel_visitante,arquivada,permitir_emprestimos,permitir_petianos,permitir_visitantes FROM categorias WHERE id=?").bind(item.categoria_id).first():null;
    if (!item || item.arquivado===1 || !allowedToSee(item,category,isPETiano(await currentIdentity(req,db)))) return bad("Material não encontrado.", 404);
    if(!borrowable(item,category,isPETiano(await currentIdentity(req,db))))return bad("Retirada não autorizada para este perfil, categoria ou material.",409);
    return j({ disponiveis:Math.max(0, baseAvailable(item) - await maxReserved(db,id,a,b)) });
  }
  if (path === "/api/reservations" && method === "POST") {
    const body = await input(req, 8000);
    if (body.website) return j({ ok:true });
    const identity = await currentIdentity(req, db);
    if (!identity) return bad("Entre na sua conta pessoal para solicitar uma reserva.",401);
    if (!identity.login || identity.must_change_password) return bad("Finalize a configuração da sua senha para solicitar reservas.",403);
    const id = requireId(body.componente_id);
    const quantidade = Number(body.quantidade);
    const nome = identity.nome;
    const contato = str(body.contato, 140);
    const email = str(identity.email,180).toLowerCase();
    if (!email || !validEmail(email)) return bad("Cadastre um e-mail válido em Minha conta antes de reservar materiais.",409);
    const inicio = str(body.data_inicio, 10), fim = str(body.data_devolucao, 10);
    if (nome.length < 2 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 1000 || !dateOK(inicio) || !dateOK(fim) || fim < inicio || inicio < todayBR()) return bad("Confira o nome, a quantidade e as datas da reserva.");
    if (contato.length > 140) return bad("Contato grande demais.");
    const item = await db.prepare("SELECT * FROM componentes WHERE id=?").bind(id).first();
    const category = item?await db.prepare("SELECT visivel_visitante,arquivada,permitir_emprestimos,permitir_petianos,permitir_visitantes FROM categorias WHERE id=?").bind(item.categoria_id).first():null;
    if (!item || item.arquivado===1 || !allowedToSee(item,category,isPETiano(identity))) return bad("Material não encontrado.",404);
    if(!borrowable(item,category,isPETiano(identity)))return bad("Retirada não autorizada para este perfil, categoria ou material.",409);
    if (baseAvailable(item) - await maxReserved(db,id,inicio,fim) < quantidade) return bad("Não há quantidade disponível para essas datas.",409);
    if (!await safeRate(db,req,"reserva",5)) return bad("Limite de solicitações por hora atingido. Tente mais tarde.",429);
    await db.prepare("INSERT INTO reservas (componente_id,nome_solicitante,contato,email,quantidade,data_inicio,data_devolucao,status,observacao,solicitado_em,usuario_id) VALUES (?,?,?,?,?,?,?,'pendente',?,?,?)").bind(id,nome,contato,email,quantidade,inicio,fim,str(body.observacao,500),now(),identity.id).run();
    return j({ ok:true, mensagem:"Solicitação enviada. Aguarde a aprovação do PET." },201);
  }
  if (path === "/api/login" && method === "POST") {
    if (!env.ADMIN_PASSWORD) return bad("O acesso administrativo ainda não foi configurado.",503);
    const body = await input(req,2500);
    if (!await safeRate(db,req,"login",15)) return bad("Muitas tentativas de acesso. Aguarde uma hora.",429);
    const expected = await toHash(env.ADMIN_PASSWORD), got = await toHash(String(body.senha || ""));
    if (got !== expected) return bad("Senha incorreta.",401);
    const token = crypto.randomUUID() + crypto.randomUUID();
    await db.prepare("INSERT INTO admin_sessions(hash,expires_at) VALUES (?,?)").bind(await toHash(token),new Date(Date.now()+12*3600000).toISOString()).run();
    return j({ ok:true },200,{ "set-cookie":adminSessionCookie(token) });
  }
  if (path === "/api/logout" && method === "POST") {
    const token = cookie(req, "__Host_pet_session");
    if (token) await db.prepare("DELETE FROM admin_sessions WHERE hash=?").bind(await toHash(token)).run();
    return j({ ok:true },200,{ "set-cookie":"__Host_pet_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0" });
  }
  const identityResponse=await identityAPI(req,env,()=>auth(req,db));
  if(identityResponse)return identityResponse;
  if (!path.startsWith("/api/admin/")) return bad("Endereço não encontrado.",404);
  if (!await auth(req,db)) return bad("Entre no painel administrativo.",401);
  const mailAdmin = await mailAdminAPI(req,env);
  if (mailAdmin) return mailAdmin;
  if (path === "/api/admin/state" && method === "GET") {
    // Ao abrir o Admin, converter também cookies antigos de 12h para o formato de sessão.
    // O cookie é reemitido sem prazo persistente; o servidor conserva o limite de 12h.
    return j(await state(db),200,{"set-cookie":adminSessionCookie(cookie(req,"__Host_pet_session"))});
  }
  if(path==="/api/admin/log" && method==="GET"){
    const page=Math.max(1,Math.min(1000,Number(url.searchParams.get("pagina"))||1));
    const filter=str(url.searchParams.get("tipo"),40);
    const where=["material","categoria","filamento","reserva","usuario","sistema"].includes(filter)?" WHERE tipo=?":"";
    const args=where?[filter]:[];
    const count=await db.prepare("SELECT COUNT(*) AS n FROM historico_admin"+where).bind(...args).first();
    const logs=await results(db,"SELECT id,criado_em,responsavel,acao,tipo,registro_id,descricao FROM historico_admin"+where+" ORDER BY criado_em DESC,id DESC LIMIT 35 OFFSET ?",[...args,(page-1)*35]);
    const cfg=await db.prepare("SELECT valor FROM configuracoes WHERE chave='limpeza_historico'").first();
    return j({ok:true,eventos:logs,total:count?.n||0,pagina:page,limpeza_historico:cfg?.valor||"nunca"});
  }
  if(path==="/api/admin/log" && method==="POST"){
    const body=await input(req,1500);
    if(body.acao==="configurar"){
      const prazo=String(body.prazo);
      if(!["nunca","1","3","5","7","15","30"].includes(prazo))return bad("Prazo do histórico inválido.");
      await db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('limpeza_historico',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(prazo).run();
      await auditLog(db,"Configuração","sistema",null,"Prazo do histórico: "+(prazo==="nunca"?"Nunca":prazo+" dia(s)"),body.responsavel);
      return j({ok:true});
    }
    if(body.acao==="limpar"){
      if(body.confirmar!=="LIMPAR HISTÓRICO")return bad("Confirmação de limpeza inválida.",400);
      const n=await db.prepare("DELETE FROM historico_admin").run();
      return j({ok:true,removidos:n.meta?.changes||0});
    }
    return bad("Ação de histórico inválida.");
  }
  if(path==="/api/admin/visibility" && method==="POST"){
    const body=await input(req,14000);
    const ids=Array.isArray(body.ids)?body.ids.map(Number):[];
    if(!ids.length||ids.length>250||ids.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(ids).size!==ids.length)return bad("Selecione até 250 materiais válidos.");
    const show=body.visivel_visitante?1:0;
    const objects=await results(db,"SELECT c.id,c.nome,c.visivel_visitante,cat.visivel_visitante AS categoria_visivel,cat.arquivada AS categoria_arquivada FROM componentes c JOIN categorias cat ON cat.id=c.categoria_id WHERE c.id IN ("+ids.map(()=>"?").join(",")+")",ids);
    if(objects.length!==ids.length)return bad("Alguns materiais não foram encontrados.",404);
    if(show&&objects.some(x=>Number(x.categoria_visivel)===0||Number(x.categoria_arquivada)===1)){
      return bad("Há materiais de categorias restritas ou arquivadas. Libere a categoria antes de exibir esses materiais para todos.",409);
    }
    const changes=objects.filter(x=>Number(x.visivel_visitante)!==show);
    if(!changes.length)return j({ok:true,alterados:0,inalterados:objects.length});
    await db.batch(changes.map(x=>db.prepare("UPDATE componentes SET visivel_visitante=?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?")
      .bind(show,now(),str(body.responsavel,100)||"Admin","Exibição para visitantes: "+(show?"todos":"só PETianes"),x.id)));
    await auditLog(db,show?"Liberou exibição":"Restringiu exibição","material",null,changes.length+" materiais: "+changes.map(x=>x.nome).slice(0,16).join(", "),body.responsavel);
    return j({ok:true,alterados:changes.length,inalterados:objects.length-changes.length});
  }
  if(path==="/api/admin/variation-groups" && method==="POST"){
    const body=await input(req,2500),action=str(body.acao,20);
    const name=str(body.nome,80),next=str(body.novo_nome,80);
    const norm=value=>String(value||"").trim().toLocaleLowerCase("pt-BR");
    const known=await listVariationGroups(db);
    const matches=value=>known.find(group=>norm(group.nome)===norm(value));
    const actor=str(body.responsavel,100)||"Admin";
    if(action==="criar"){
      if(name.length<2)return bad("Informe um nome de vínculo com pelo menos 2 caracteres.");
      if(matches(name))return bad("Já existe um vínculo com esse nome.",409);
      await db.prepare("INSERT INTO grupos_variacoes(nome) VALUES(?)").bind(name).run();
      await auditLog(db,"Criou grupo","material",null,name,actor);
      return j({ok:true,nome:name});
    }
    if(action==="excluir"){
      const current=matches(name);
      if(!current)return bad("Vínculo não encontrado.",404);
      const members=await results(db,"SELECT id FROM componentes WHERE LOWER(TRIM(grupo_variacoes))=LOWER(?)",[current.nome]);
      const stamp=now();
      const ops=members.map(x=>db.prepare("UPDATE componentes SET grupo_variacoes='',ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?")
        .bind(stamp,actor,"Vínculo "+current.nome+" removido; material individual preservado",x.id));
      ops.push(db.prepare("DELETE FROM grupos_variacoes WHERE nome=?").bind(current.nome));
      await db.batch(ops);
      await auditLog(db,"Excluiu grupo","material",null,current.nome+" · "+members.length+" material(is) preservado(s)",actor);
      return j({ok:true,desvinculados:members.length});
    }
    if(action!=="renomear")return bad("Ação de vínculo inválida.");
    body.grupo_atual=name;body.novo_nome=next;
    // Renomeação é processada pelo mesmo núcleo utilizado pela rota antiga.
    return renameVariationGroup(db,body);
  }
  if(path==="/api/admin/variations/rename" && method==="POST"){
    return renameVariationGroup(db,await input(req,2500));
  }
  if(path==="/api/admin/variations" && method==="POST"){
    const body=await input(req,12000),ids=Array.isArray(body.ids)?body.ids.map(Number):[];
    if(!ids.length||ids.length>150||ids.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(ids).size!==ids.length)return bad("Selecione os materiais que serão vinculados.");
    const label=str(body.grupo,80);
    if(label && label.length<2)return bad("Informe um nome de grupo válido.");
    const objects=await results(db,"SELECT id,nome FROM componentes WHERE id IN ("+ids.map(()=>"?").join(",")+")",ids);
    if(objects.length!==ids.length)return bad("Alguns materiais não foram encontrados.",404);
    const ops=ids.map(id=>db.prepare("UPDATE componentes SET grupo_variacoes=?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?")
      .bind(label,now(),str(body.responsavel,100)||"Admin","Grupo de variações: "+(label||"Sem grupo"),id));
    const hasTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='grupos_variacoes'").first();
    if(label&&hasTable)ops.unshift(db.prepare("INSERT OR IGNORE INTO grupos_variacoes(nome) VALUES(?)").bind(label));
    await db.batch(ops);
    await auditLog(db,label?"Vinculou variações":"Desvinculou variações","material",null,objects.map(x=>x.nome).slice(0,16).join(", ")+" → "+(label||"Sem grupo"),body.responsavel);
    return j({ok:true,vinculados:objects.length});
  }
  if(path==="/api/admin/filaments" && method==="POST"){
    const b=await input(req,3000),action=str(b.acao,20);
    if(action==="excluir"){
      const id=requireId(b.id),old=await db.prepare("SELECT * FROM filamentos WHERE id=?").bind(id).first();
      if(!old)return bad("Cor não encontrada.",404);
      const active=await db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE componente_id=? AND status IN ('pendente','aprovada','retirada')").bind(old.componente_id).first();
      if(active?.n)return bad("Há empréstimos ativos ou pendentes desta cor. Conclua-os antes de excluir.",409);
      await db.batch([
        db.prepare("DELETE FROM filamentos WHERE id=?").bind(id),
        db.prepare("UPDATE componentes SET arquivado=1,permitir_emprestimos=0,permitir_petianos=0,permitir_visitantes=0 WHERE id=?").bind(old.componente_id)
      ]);
      await auditLog(db,"Excluiu","filamento",id,old.cor+" (histórico preservado)");
      return j({ok:true});
    }
    if(action==="ordenar"){
      if(!Array.isArray(b.ordem)||b.ordem.length>500||b.ordem.some(x=>!Number.isSafeInteger(Number(x))||Number(x)<1)||new Set(b.ordem.map(Number)).size!==b.ordem.length)return bad("Ordem inválida.");
      if(b.ordem.length)await db.batch(b.ordem.map((id,i)=>db.prepare("UPDATE filamentos SET ordem=? WHERE id=?").bind(i,Number(id))));
      return j({ok:true});
    }
    if(action==="emprestimos"){
      const id=requireId(b.id),f=await db.prepare("SELECT id,cor,componente_id FROM filamentos WHERE id=?").bind(id).first();
      if(!f)return bad("Filamento não encontrado.",404);
      const profile=b.perfil;
      if(profile==="combinado"){
        if(typeof b.permitir_petianos!=="boolean"||typeof b.permitir_visitantes!=="boolean")return bad("Selecione uma permissão válida.");
        const pet=Number(b.permitir_petianos),visitor=Number(b.permitir_visitantes),both=Number(!!(pet||visitor));
        await db.batch([
          db.prepare("UPDATE filamentos SET permitir_petianos=?,permitir_visitantes=?,permitir_emprestimos=? WHERE id=?").bind(pet,visitor,both,id),
          db.prepare("UPDATE componentes SET permitir_petianos=?,permitir_visitantes=?,permitir_emprestimos=? WHERE id=?").bind(pet,visitor,both,f.componente_id)
        ]);
        await auditLog(db,"Alterou empréstimos","filamento",id,f.cor+" · "+(pet&&visitor?"Todos":pet?"PETianes":visitor?"Visitantes":"Ninguém"));
      }else if(profile==="petianos"||profile==="visitantes"){
        if(typeof b.permitir!=="boolean")return bad("Permissão inválida.");
        const col=profile==="petianos"?"permitir_petianos":"permitir_visitantes";
        const other=profile==="petianos"?"permitir_visitantes":"permitir_petianos",enabled=b.permitir?1:0;
        await db.batch([
          db.prepare("UPDATE filamentos SET "+col+"=?,permitir_emprestimos=CASE WHEN ?=1 OR "+other+"=1 THEN 1 ELSE 0 END WHERE id=?").bind(enabled,enabled,id),
          db.prepare("UPDATE componentes SET "+col+"=?,permitir_emprestimos=CASE WHEN ?=1 OR "+other+"=1 THEN 1 ELSE 0 END WHERE id=?").bind(enabled,enabled,f.componente_id)
        ]);
        await auditLog(db,"Alterou retiradas","filamento",id,f.cor+" · "+(profile==="petianos"?"PETianes":"Visitantes")+" · "+(enabled?"Liberada":"Bloqueada"));
      }else{
        if(typeof b.permitir_emprestimos!=="boolean")return bad("Permissão inválida.");
        const enabled=b.permitir_emprestimos?1:0;
        await db.batch([
          db.prepare("UPDATE filamentos SET permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=? WHERE id=?").bind(enabled,enabled,enabled,id),
          db.prepare("UPDATE componentes SET permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=? WHERE id=?").bind(enabled,enabled,enabled,f.componente_id)
        ]);
        await auditLog(db,"Alterou empréstimos","filamento",id,f.cor+" · "+(enabled?"Liberados":"Bloqueados"));
      }
      return j({ok:true});
    }
    if(action!=="criar"&&action!=="editar")return bad("Ação inválida.");
    const cor=str(b.cor,55),hexadecimal=str(b.hexadecimal,7).toUpperCase(),q=integer(b.quantidade),show=b.visivel_visitante===undefined?1:(b.visivel_visitante?1:0);
    if(!cor||cor.length<2||!/^#[0-9A-F]{6}$/.test(hexadecimal)||!Number.isSafeInteger(q)||q<0||q>1000000)return bad("Informe cor, código de cor e quantidade válidos.");
    if(action==="criar"){
      const position=await db.prepare("SELECT COALESCE(MAX(ordem),-1)+1 AS proximo FROM filamentos").first();
      const pet=b.permitir_petianos===undefined?Number(b.permitir_emprestimos!==false):Number(b.permitir_petianos===true);
      const visitor=b.permitir_visitantes===undefined?Number(b.permitir_emprestimos!==false):Number(b.permitir_visitantes===true);
      const enabled=Number(!!(pet||visitor));
      await db.batch([
        db.prepare("INSERT INTO filamentos(cor,hexadecimal,quantidade,ordem,atualizado_em,visivel_visitante,permitir_emprestimos,permitir_petianos,permitir_visitantes) VALUES(?,?,?,?,?,?,?,?,?)").bind(cor,hexadecimal,q,position.proximo,now(),show,enabled,pet,visitor),
        db.prepare("INSERT INTO componentes(categoria_id,nome,quantidade,em_uso,com_defeito,import_key,unidade,visivel_visitante,permitir_emprestimos,permitir_petianos,permitir_visitantes,ultima_alteracao) SELECT cat.id,'Filamento - '||f.cor,f.quantidade,0,0,'FILAMENTO-'||f.id,'rolos',f.visivel_visitante,f.permitir_emprestimos,f.permitir_petianos,f.permitir_visitantes,? FROM filamentos f JOIN categorias cat ON cat.nome='Filamentos' WHERE f.cor=?").bind(now(),cor),
        db.prepare("UPDATE filamentos SET componente_id=(SELECT id FROM componentes WHERE import_key='FILAMENTO-'||filamentos.id) WHERE cor=?").bind(cor)
      ]);
      await auditLog(db,"Cadastrou","filamento",null,cor+" · "+q+" rolo(s)");
    }else{
      const id=requireId(b.id),old=await db.prepare("SELECT * FROM filamentos WHERE id=?").bind(id).first();
      if(!old)return bad("Filamento não encontrado.",404);
      const component=await db.prepare("SELECT em_uso,com_defeito FROM componentes WHERE id=?").bind(old.componente_id).first();
      if(!component)return bad("Vínculo do filamento não encontrado.",409);
      const approved=await db.prepare("SELECT COALESCE(SUM(quantidade),0) AS n FROM reservas WHERE componente_id=? AND status='aprovada'").bind(old.componente_id).first();
      if(q<Number(component.em_uso)+Number(approved?.n||0))return bad("A quantidade não cobre os materiais em uso e já aprovados.",409);
      const pet=b.permitir_petianos===undefined?(b.permitir_emprestimos===undefined?Number(old.permitir_petianos):Number(b.permitir_emprestimos===true)):Number(b.permitir_petianos===true);
      const visitor=b.permitir_visitantes===undefined?(b.permitir_emprestimos===undefined?Number(old.permitir_visitantes):Number(b.permitir_emprestimos===true)):Number(b.permitir_visitantes===true);
      const enabled=Number(!!(pet||visitor));
      await db.batch([
        db.prepare("UPDATE filamentos SET cor=?,hexadecimal=?,quantidade=?,visivel_visitante=?,permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=?,atualizado_em=? WHERE id=?").bind(cor,hexadecimal,q,show,enabled,pet,visitor,now(),id),
        db.prepare("UPDATE componentes SET nome=?,quantidade=?,visivel_visitante=?,permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=?,ultima_alteracao=? WHERE id=?").bind("Filamento - "+cor,q,show,enabled,pet,visitor,now(),old.componente_id)
      ]);
      await auditLog(db,"Editou","filamento",id,old.cor+" → "+cor+" · "+old.quantidade+" → "+q+" rolo(s)");
    }
    return j({ok:true});
  }
  if (path === "/api/admin/item/photo" && method === "POST") {
    // Atualizar apenas a foto de UMA variação. Não envia nem altera estoque,
    // emprestimos, categoria, permissões ou qualquer outro campo do item.
    const b=await input(req,115000),id=requireId(b.id);
    if(typeof b.imagem!=="string"||b.imagem.length>110000||
      (b.imagem!==""&&!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(b.imagem)))
      return bad("A foto deve ser PNG, JPEG ou WEBP válido.");
    const old=await db.prepare("SELECT id,nome,imagem,import_key FROM componentes WHERE id=? AND arquivado=0").bind(id).first();
    if(isFilamentMirror(old))return bad("Edite filamentos pela aba Filamentos.",409);
    if(!old)return bad("Material não encontrado.",404);
    if(old.imagem===b.imagem)return j({ok:true,sem_alteracao:true});
    const actor=str(b.responsavel,100)||"Admin";
    await db.prepare("UPDATE componentes SET imagem=?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?")
      .bind(b.imagem,now(),actor,b.imagem?"Foto individual atualizada":"Ilustração padrão restaurada",id).run();
    await auditLog(db,b.imagem?"Atualizou foto":"Restaurou desenho","material",id,old.nome,actor);
    return j({ok:true,id});
  }
  if (path === "/api/admin/item" && method === "POST") {
    const body = await input(req);
    const item = validateItem(body);
    const id = body.id ? requireId(body.id) : null;
    const categoria = await db.prepare("SELECT id,nome FROM categorias WHERE id=? AND arquivada=0").bind(item.categoria_id).first();
    if(categoria?.nome==="Filamentos")return bad("Cadastre as cores pela aba Filamentos.",409);
    if (!categoria) return bad("Categoria não encontrada.");
    const old = id ? await db.prepare("SELECT * FROM componentes WHERE id=?").bind(id).first() : null;
    if (id && !old) return bad("Material não encontrado.",404);
    // Vínculos só podem ser alterados pela central própria, nunca pelo editor.
    item.grupo_variacoes=old?.grupo_variacoes||"";
    if(isFilamentMirror(old))return bad("Edite esta cor pela aba Filamentos.",409);
    const available = baseAvailable(item);
    if (id && (await db.prepare("SELECT COALESCE(SUM(quantidade),0) AS n FROM reservas WHERE componente_id=? AND status='aprovada'").bind(id).first()).n > available) return bad("As quantidades não cobrem as reservas já aprovadas.",409);
    const actor = str(body.responsavel,100) || "PETiane";
    const audit = [now(),actor,changes(old,item)];
    const vals = fields.map(k => item[k]);
    if (id) {
      await db.prepare("UPDATE componentes SET "+fields.map(k=>k+"=?").join(",")+",ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?").bind(...vals,...audit,id).run();
      await auditLog(db,"Editou","material",id,item.nome+" · "+audit[2],actor);
    } else {
      const saved=await db.prepare("INSERT INTO componentes("+fields.join(",")+",ultima_alteracao,ultimo_responsavel,detalhes_alteracao) VALUES ("+Array(fields.length+3).fill("?").join(",")+")").bind(...vals,...audit).run();
      await auditLog(db,"Cadastrou","material",saved.meta?.last_row_id,item.nome,actor);
    }
    return j({ ok:true });
  }
  if (path === "/api/admin/item" && method === "DELETE") {
    const id=requireId(url.searchParams.get("id"));
    const old=await db.prepare("SELECT id,nome,import_key FROM componentes WHERE id=?").bind(id).first();
    if(!old)return bad("Material não encontrado.",404);
    if(isFilamentMirror(old))return bad("Altere este filamento na aba Filamentos.",409);
    const active=await db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE componente_id=? AND status IN ('pendente','aprovada','retirada')").bind(id).first();
    if(Number(active?.n)>0)return bad("Há reservas pendentes ou empréstimos ativos. Conclua-os antes de excluir o material.",409);
    const finished=await db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE componente_id=?").bind(id).first();
    // Excluir de verdade, sem criar um novo registro invisível em Arquivados.
    // A interface baixa antes um backup JSON completo da base do inventário.
    await db.batch([
      db.prepare("UPDATE mail_queue SET situacao='cancelado',token_reserva=NULL,ultimo_erro='Material excluído pelo administrador' WHERE reserva_id IN (SELECT id FROM reservas WHERE componente_id=?) AND situacao IN ('pendente','processando')").bind(id),
      db.prepare("DELETE FROM reservas WHERE componente_id=?").bind(id),
      db.prepare("DELETE FROM componentes WHERE id=?").bind(id)
    ]);
    await auditLog(db,"Excluiu definitivamente","material",id,old.nome+" · "+Number(finished?.n||0)+" reserva(s) concluída(s) vinculada(s) removida(s)");
    return j({ok:true,excluido:true,reservas_concluidas_removidas:Number(finished?.n||0)});
  }
  if(path==="/api/admin/item/unarchive" && method==="POST"){
    const b=await input(req,1500),id=requireId(b.id);
    const old=await db.prepare("SELECT nome,import_key FROM componentes WHERE id=?").bind(id).first();
    if(isFilamentMirror(old))return bad("Altere este filamento na aba Filamentos.",409);
    await db.prepare("UPDATE componentes SET arquivado=0,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?").bind(now(),"Admin","Material restaurado",id).run();
    await auditLog(db,"Restaurou","material",id,old?.nome||"Material");
    return j({ok:true});
  }
  if (path === "/api/admin/category" && method === "POST") {
    const b = await input(req,9000),name=str(b.nome,80),show=b.visivel_visitante===undefined?1:(b.visivel_visitante?1:0);
    if(b.acao==="emprestimos"){
      const id=requireId(b.id);
      const cat=await db.prepare("SELECT nome,arquivada FROM categorias WHERE id=?").bind(id).first();
      if(!cat||cat.arquivada)return bad("Categoria não encontrada.",404);
      const profile=b.perfil;
      if(profile==="combinado"){
        if(typeof b.permitir_petianos!=="boolean"||typeof b.permitir_visitantes!=="boolean")return bad("Selecione uma permissão válida.");
        const pet=Number(b.permitir_petianos),visitor=Number(b.permitir_visitantes),both=Number(!!(pet||visitor));
        await db.batch([
          db.prepare("UPDATE categorias SET permitir_petianos=?,permitir_visitantes=?,permitir_emprestimos=? WHERE id=?").bind(pet,visitor,both,id),
          db.prepare("UPDATE componentes SET permitir_petianos=?,permitir_visitantes=?,permitir_emprestimos=? WHERE categoria_id=?").bind(pet,visitor,both,id),
          db.prepare("UPDATE filamentos SET permitir_petianos=?,permitir_visitantes=?,permitir_emprestimos=? WHERE componente_id IN (SELECT id FROM componentes WHERE categoria_id=?)").bind(pet,visitor,both,id)
        ]);
        await auditLog(db,"Alterou empréstimos","categoria",id,cat.nome+" · "+(pet&&visitor?"Todos":pet?"PETianes":visitor?"Visitantes":"Ninguém"));
      }else if(profile==="petianos"||profile==="visitantes"){
        if(typeof b.permitir!=="boolean")return bad("Informe a permissão desejada.");
        const col=profile==="petianos"?"permitir_petianos":"permitir_visitantes";
        const other=profile==="petianos"?"permitir_visitantes":"permitir_petianos",enabled=b.permitir?1:0;
        await db.batch([
          db.prepare("UPDATE categorias SET "+col+"=?,permitir_emprestimos=CASE WHEN ?=1 OR "+other+"=1 THEN 1 ELSE 0 END WHERE id=?").bind(enabled,enabled,id),
          db.prepare("UPDATE componentes SET "+col+"=?,permitir_emprestimos=CASE WHEN ?=1 OR "+other+"=1 THEN 1 ELSE 0 END WHERE categoria_id=?").bind(enabled,enabled,id),
          db.prepare("UPDATE filamentos SET "+col+"=?,permitir_emprestimos=CASE WHEN ?=1 OR "+other+"=1 THEN 1 ELSE 0 END WHERE componente_id IN (SELECT id FROM componentes WHERE categoria_id=?)").bind(enabled,enabled,id)
        ]);
        await auditLog(db,"Alterou retiradas","categoria",id,cat.nome+" · "+(profile==="petianos"?"PETianes":"Visitantes")+" · Todos os itens "+(enabled?"liberados":"bloqueados"));
      }else{
        if(typeof b.permitir_emprestimos!=="boolean")return bad("Informe a permissão desejada.");
        const enabled=b.permitir_emprestimos?1:0;
        await db.batch([
          db.prepare("UPDATE categorias SET permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=? WHERE id=?").bind(enabled,enabled,enabled,id),
          db.prepare("UPDATE componentes SET permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=? WHERE categoria_id=?").bind(enabled,enabled,enabled,id),
          db.prepare("UPDATE filamentos SET permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=? WHERE componente_id IN (SELECT id FROM componentes WHERE categoria_id=?)").bind(enabled,enabled,enabled,id)
        ]);
        await auditLog(db,"Alterou empréstimos","categoria",id,cat.nome+" · Todos os itens "+(enabled?"liberados":"bloqueados"));
      }
      return j({ok:true});
    }
    if (b.acao === "criar") {
      if (!name || name.toLowerCase()==="filamentos") return bad("Informe outro nome para a nova categoria.");
      const saved=await db.prepare("INSERT INTO categorias(nome,ordem,visivel_visitante,arquivada) VALUES(?,?,?,0)").bind(name,Number(b.ordem)||0,show).run();
      await auditLog(db,"Cadastrou","categoria",saved.meta?.last_row_id,name);
    } else if (b.acao === "editar") {
      if (!name) return bad("Informe o nome da categoria.");
      const id=requireId(b.id),old=await db.prepare("SELECT nome FROM categorias WHERE id=?").bind(id).first();
      if(!old)return bad("Categoria inexistente.",404);
      if(old.nome==="Filamentos" && name!==old.nome)return bad("A categoria Filamentos não pode ser renomeada porque usa um estoque próprio.",409);
      await db.prepare("UPDATE categorias SET nome=?,visivel_visitante=? WHERE id=?").bind(name,show,id).run();
      await auditLog(db,"Editou","categoria",id,old.nome+" → "+name+" · exibição "+(show?"Todos":"PETianes"));
    } else if (b.acao === "excluir") {
      const id=requireId(b.id);
      const category=await db.prepare("SELECT nome FROM categorias WHERE id=? AND arquivada=0").bind(id).first();
      if(!category)return bad("Categoria não encontrada.",404);
      if(category.nome==="Filamentos")return bad("A categoria Filamentos é permanente. Exclua cores na aba Filamentos.",409);
      if(b.confirmacao!==category.nome)return bad("Confirme digitando exatamente o nome da categoria.",400);
      const active=await db.prepare("SELECT COUNT(*) AS n FROM reservas r JOIN componentes c ON r.componente_id=c.id WHERE c.categoria_id=? AND r.status IN ('pendente','aprovada','retirada')").bind(id).first();
      if(active.n)return bad("Há reservas ou retiradas abertas. Finalize-as antes de excluir a categoria e seus materiais.",409);
      const linked=await db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE categoria_id=?").bind(id).first();
      // DELETE permanente mediante confirmação do nome. Registros de empréstimos encerrados
      // também são removidos para cumprir a integridade referencial. O backup é baixado
      // pelo painel antes de chamar esta rota. Nenhuma alteração é feita com pendências.
      await db.batch([
        db.prepare("DELETE FROM reservas WHERE componente_id IN (SELECT id FROM componentes WHERE categoria_id=?)").bind(id),
        db.prepare("DELETE FROM componentes WHERE categoria_id=?").bind(id),
        db.prepare("DELETE FROM categorias WHERE id=?").bind(id)
      ]);
      await auditLog(db,"Excluiu definitivamente","categoria",id,category.nome+" · "+(linked?.n||0)+" materiais excluídos após confirmação");
      return j({ok:true,excluidos:linked?.n||0});
    } else if (b.acao === "restaurar") {
      const id=requireId(b.id),cat=await db.prepare("SELECT nome FROM categorias WHERE id=? AND arquivada=1").bind(id).first();
      if(!cat)return bad("Categoria arquivada não encontrada.",404);
      await db.prepare("UPDATE categorias SET arquivada=0 WHERE id=?").bind(id).run();
      await auditLog(db,"Restaurou","categoria",id,cat.nome+" (materiais permanecem arquivados até restauração individual)");
    } else if (b.acao === "ordenar") {
      if (!Array.isArray(b.ordem) || b.ordem.length > 100) return bad("Ordem inválida.");
      const queries = b.ordem.map((id, i) => db.prepare("UPDATE categorias SET ordem=? WHERE id=?").bind(i,requireId(id)));
      if (queries.length) await db.batch(queries);
    } else return bad("Ação inválida.");
    return j({ ok:true });
  }
  if(path==="/api/admin/item/loans" && method==="POST"){
    const b=await input(req,2000),id=requireId(b.id);
    const item=await db.prepare("SELECT nome,import_key FROM componentes WHERE id=?").bind(id).first();
    if(!item||isFilamentMirror(item))return bad("Material não encontrado ou pertence à aba Filamentos.",404);
    const profile=b.perfil;
    if(profile==="combinado"){
        if(typeof b.permitir_petianos!=="boolean"||typeof b.permitir_visitantes!=="boolean")return bad("Selecione uma permissão válida.");
        const pet=Number(b.permitir_petianos),visitor=Number(b.permitir_visitantes),both=Number(!!(pet||visitor));
        await db.prepare("UPDATE componentes SET permitir_petianos=?,permitir_visitantes=?,permitir_emprestimos=? WHERE id=?").bind(pet,visitor,both,id).run();
        await auditLog(db,"Alterou empréstimos","material",id,item.nome+" · "+(pet&&visitor?"Todos":pet?"PETianes":visitor?"Visitantes":"Ninguém"));
      }else if(profile==="petianos"||profile==="visitantes"){
      if(typeof b.permitir!=="boolean")return bad("Permissão inválida.");
      const col=profile==="petianos"?"permitir_petianos":"permitir_visitantes";
      const other=profile==="petianos"?"permitir_visitantes":"permitir_petianos",enabled=b.permitir?1:0;
      await db.prepare("UPDATE componentes SET "+col+"=?,permitir_emprestimos=CASE WHEN ?=1 OR "+other+"=1 THEN 1 ELSE 0 END WHERE id=?").bind(enabled,enabled,id).run();
      await auditLog(db,"Alterou retiradas","material",id,item.nome+" · "+(profile==="petianos"?"PETianes":"Visitantes")+" · "+(enabled?"Liberada":"Bloqueada"));
    }else{
      if(typeof b.permitir_emprestimos!=="boolean")return bad("Permissão inválida.");
      const enabled=b.permitir_emprestimos?1:0;
      await db.prepare("UPDATE componentes SET permitir_emprestimos=?,permitir_petianos=?,permitir_visitantes=? WHERE id=?").bind(enabled,enabled,enabled,id).run();
      await auditLog(db,"Alterou empréstimos","material",id,item.nome+" · "+(enabled?"Liberados":"Bloqueados"));
    }
    return j({ok:true});
  }
  if (path === "/api/admin/reservation" && method === "POST") {
    const b = await input(req,8000), id = requireId(b.id), action = str(b.acao,30);
    const actor = str(b.responsavel,80) || "PETiane";
    const r = await db.prepare("SELECT * FROM reservas WHERE id=?").bind(id).first();
    if (!r) return bad("Reserva não encontrada.",404);
    const item = await db.prepare("SELECT * FROM componentes WHERE id=?").bind(r.componente_id).first();
    if (!item) return bad("Material não encontrado.",404);
    const current = now();
    if (action === "aprovar" && r.status === "pendente") {
      // Aprovar é entregar: uma única operação atualiza reserva, retirada e estoque.
      const reserved = await maxReserved(db,item.id,r.data_inicio,r.data_devolucao,r.id);
      if (baseAvailable(item) - reserved < r.quantidade) return bad("Estoque insuficiente para aprovar e entregar este material.",409);
      const today=todayBR();
      const handoffDay=r.data_devolucao>=today?today:r.data_inicio;
      const outcome=await db.batch([
        db.prepare("UPDATE reservas SET status='retirada',aprovado_em=?,retirado_em=?,data_inicio=?,responsavel_admin=? WHERE id=? AND status='pendente' AND EXISTS(SELECT 1 FROM componentes WHERE id=? AND quantidade-em_uso>=?)").bind(current,current,handoffDay,actor,id,item.id,r.quantidade),
        db.prepare("UPDATE componentes SET em_uso=em_uso+?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=? AND quantidade-em_uso>=? AND EXISTS(SELECT 1 FROM reservas WHERE id=? AND status='retirada' AND retirado_em=?)").bind(r.quantidade,current,actor,"Reserva aprovada e entregue #"+id+": "+r.quantidade+" unidade(s)",item.id,r.quantidade,id,current)
      ]);
      if(outcome[0].meta?.changes!==1||outcome[1].meta?.changes!==1){
        // Não permitir que duas aprovações de uma mesma solicitação contem estoque duas vezes.
        return bad("Não foi possível confirmar a entrega. Atualize o painel e confira o estoque.",409);
      }
    } else if (action === "recusar" && ["pendente","aprovada"].includes(r.status)) {
      await db.prepare("UPDATE reservas SET status='recusada',responsavel_admin=?,observacao=? WHERE id=?").bind(actor,str(b.observacao,500),id).run();
    } else if (action === "retirar" && r.status === "aprovada") {
      if (baseAvailable(item) < r.quantidade) return bad("Não há estoque suficiente para registrar a retirada.",409);
      await db.batch([
        db.prepare("UPDATE componentes SET em_uso=em_uso+?, ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=? AND quantidade-em_uso>=?").bind(r.quantidade,current,actor,"Retirada da reserva #"+id+": "+r.quantidade+" unidade(s)",item.id,r.quantidade),
        db.prepare("UPDATE reservas SET status='retirada',retirado_em=?,responsavel_admin=? WHERE id=? AND status='aprovada'").bind(current,actor,id)
      ]);
    } else if (action === "cancelar_solicitacao_devolucao" && r.status === "retirada" && r.devolucao_solicitada_em) {
      const rejected=await db.prepare("UPDATE reservas SET devolucao_solicitada_em=NULL,devolucao_solicitada_observacao='' WHERE id=? AND status='retirada' AND devolucao_solicitada_em IS NOT NULL").bind(id).run();
      if(rejected.meta?.changes!==1)return bad("Solicitação já processada.",409);
    } else if (action === "devolver" && r.status === "retirada") {
      const discarded=Number(b.descartados ?? b.defeituosos ?? 0);
      if(!Number.isSafeInteger(discarded)||discarded<0||discarded>r.quantidade)
        return bad("Quantidade de unidades descartadas inválida.");
      if(item.em_uso<r.quantidade||item.quantidade<discarded)
        return bad("O estoque em uso está inconsistente. Verifique antes da devolução.",409);
      const result=await db.batch([
        db.prepare("UPDATE componentes SET em_uso=em_uso-?,quantidade=quantidade-?,com_defeito=0,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=? AND em_uso>=? AND quantidade>=?")
          .bind(r.quantidade,discarded,current,actor,"Devolução da reserva #"+id+(discarded?" • "+discarded+" unidade(s) descartada(s)":""),item.id,r.quantidade,discarded),
        db.prepare("UPDATE filamentos SET quantidade=quantidade-? WHERE componente_id=? AND quantidade>=?").bind(discarded,item.id,discarded),
        db.prepare("UPDATE reservas SET status='devolvida',devolvido_em=?,devolucao_solicitada_em=NULL,devolucao_solicitada_observacao='',responsavel_admin=?,observacao=? WHERE id=? AND status='retirada'")
          .bind(current,actor,str(b.observacao,500),id)
      ]);
      if(result[0].meta?.changes!==1||result[2].meta?.changes!==1)
        return bad("Não foi possível confirmar a devolução. Confira o estoque.",409);
    } else return bad("Ação não permitida para o estado atual desta reserva.",409);
    // Registrar o resultado para o titular vinculado à reserva. A senha do Admin, por si,
    // só não identifica uma pessoa; nesse caso não atribuir falsamente uma decisão.
    const actorName=actor==="Administração"||actor==="Admin"||actor==="PETiane"?"Administração do PET":actor;
    if(r.usuario_id){
      let titulo="",mensagem="",tipo="info";
      const subject="a reserva #"+id+" de "+item.nome;
      if(action==="aprovar"){titulo="Reserva aprovada e retirada registrada";mensagem="Sua "+subject+" foi aprovada e a entrega registrada por "+actorName+". Você já pode registrar a devolução em Meus empréstimos.";tipo="retirada";}
      else if(action==="recusar"){
        titulo="Reserva recusada";
        const reason=str(b.observacao,500);
        mensagem="Sua "+subject+" foi recusada por "+actorName+"."+(reason?" Motivo: "+reason:"");
        tipo="recusada";
      }
      else if(action==="retirar"){titulo="Retirada registrada";mensagem="A retirada da "+subject+" foi registrada por "+actorName+".";tipo="retirada";}
      else if(action==="devolver"){titulo="Devolução confirmada";mensagem="A devolução da "+subject+" foi confirmada por "+actorName+".";tipo="devolucao";}
      else if(action==="cancelar_solicitacao_devolucao"){titulo="Solicitação de devolução não confirmada";mensagem="A solicitação de devolução da "+subject+" não foi confirmada por "+actorName+". O material continua em uso; solicite novamente quando realizar a entrega.";tipo="devolucao";}
      if(titulo)await db.prepare("INSERT INTO notificacoes(usuario_id,reserva_id,titulo,mensagem,tipo) VALUES(?,?,?,?,?)").bind(r.usuario_id,id,titulo,mensagem,tipo).run();
    }
    await auditLog(db,action==="aprovar"?"Aprovou e entregou":action[0].toUpperCase()+action.slice(1),"reserva",id,item.nome+" · #"+id+" · "+r.quantidade+" unidade(s)",actorName);
    return j({ ok:true, notificacao_registrada:Boolean(r.usuario_id) });
  }
  if (path === "/api/admin/settings" && method === "POST") {
    const b = await input(req,4000), days = String(b.limpeza_reservas);
    if (days !== "nunca" && days !== "1min" && (!Number.isSafeInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650)) return bad("Escolha um prazo válido.");
    await db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('limpeza_reservas',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(days).run();
    if (b.modo_demo === "sim" || b.modo_demo === "nao") await db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('modo_demo',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(b.modo_demo).run();
    if (b.avisos_email === "sim" || b.avisos_email === "nao") await db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('avisos_email',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(b.avisos_email).run();
    await auditLog(db,"Configuração","sistema",null,"Configurações de reservas atualizadas");
    return j({ ok:true });
  }
  if (path === "/api/admin/export" && method === "GET") {
    // Exportação completa para Excel, sem senhas/sessões/segredos.
    const data=await state(db);
    data.reservas=await results(db,"SELECT r.id,r.componente_id,c.nome AS componente_nome,r.nome_solicitante,r.quantidade,r.tipo,r.status,r.data_inicio,r.data_devolucao,r.devolvido_em,r.devolucao_solicitada_em,r.devolucao_solicitada_observacao,r.solicitado_em,r.contato,r.observacao FROM reservas r LEFT JOIN componentes c ON c.id=r.componente_id ORDER BY r.id DESC");
    return j({categorias:data.categorias,componentes:data.componentes,
      grupos_variacoes:data.grupos_variacoes,filamentos:data.filamentos,reservas:data.reservas});
  }
  if (path === "/api/admin/backup" && method === "GET") {
    const data=await state(db);
    const [historico,conciliacao_experimentos_vinculos,conciliacao_experimentos_backup]=await Promise.all([
      results(db,"SELECT * FROM historico_admin ORDER BY id ASC LIMIT 30000"),
      results(db,"SELECT * FROM conciliacao_experimentos_vinculos ORDER BY origem_id"),
      results(db,"SELECT * FROM conciliacao_experimentos_backup ORDER BY material_id")
    ]);
    return j({formato:"inventario-pet-v2",gerado_em:now(),...data,
      componentes:await results(db,"SELECT * FROM componentes ORDER BY id"),
      historico,conciliacao_experimentos_vinculos,conciliacao_experimentos_backup},
      200,{"content-disposition":'attachment; filename="backup-inventario-pet.json"'});
  }
  if (path === "/api/admin/restore" && method === "POST") {
    const b=await input(req,30000000);
    const v2=b.formato==="inventario-pet-v2";
    if (!["inventario-pet-v1","inventario-pet-v2"].includes(b.formato)
      ||!Array.isArray(b.categorias)||!Array.isArray(b.componentes)||!Array.isArray(b.reservas)
      ||b.categorias.length>150||b.componentes.length>1800||b.reservas.length>8000
      ||(b.filamentos && (!Array.isArray(b.filamentos)||b.filamentos.length>1000))
      ||(b.historico && (!Array.isArray(b.historico)||b.historico.length>30000)))
      return bad("Backup inválido ou grande demais.");
    if (!b.categorias.every(x=>Number.isSafeInteger(x.id)&&!!str(x.nome,80))
      ||!b.componentes.every(x=>Number.isSafeInteger(x.id)&&Number.isSafeInteger(x.categoria_id))
      ||!b.reservas.every(x=>Number.isSafeInteger(x.id)&&Number.isSafeInteger(x.componente_id)))
      return bad("O backup tem registros inválidos.");
    if(!v2 || !Array.isArray(b.filamentos))return bad("Use um backup completo v2 com filamentos para preservar os estoques.",409);
    const activeUsers=new Set((await results(db,"SELECT id FROM usuarios")).map(x=>Number(x.id)));
    const hasGroupTable=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='grupos_variacoes'").first();
    // Reposição única e atômica das tabelas do inventário. Contas/senhas de
    // usuários não são exportadas nem apagadas nesta operação.
    const ops=[
      db.prepare("DELETE FROM reservas"),
      db.prepare("DELETE FROM filamentos"),
      db.prepare("DELETE FROM componentes"),
      ...(hasGroupTable?[db.prepare("DELETE FROM grupos_variacoes")]:[]),
      db.prepare("DELETE FROM categorias"),
      db.prepare("DELETE FROM configuracoes")
    ];
    if(hasGroupTable){
      const saved=Array.isArray(b.grupos_variacoes)?b.grupos_variacoes:[];
      const names=new Map([...saved.map(x=>typeof x==="string"?x:x?.nome),...b.componentes.map(x=>x.grupo_variacoes)]
        .map(x=>str(x,80)).filter(x=>x.length>=2).map(x=>[x.toLocaleLowerCase("pt-BR"),x]));
      for(const name of names.values())ops.push(db.prepare("INSERT OR IGNORE INTO grupos_variacoes(nome) VALUES(?)").bind(name));
    }
    for (const c of b.categorias){
      ops.push(db.prepare("INSERT INTO categorias(id,nome,ordem,visivel_visitante,arquivada,permitir_emprestimos,permitir_petianos,permitir_visitantes) VALUES(?,?,?,?,?,?,?,?)")
        .bind(c.id,str(c.nome,80),Number(c.ordem)||0,c.visivel_visitante===undefined?1:(c.visivel_visitante?1:0),c.arquivada?1:0,c.permitir_emprestimos===undefined?(c.nome==="Filamentos"?0:1):(c.permitir_emprestimos?1:0),c.permitir_petianos===undefined?(c.permitir_emprestimos===undefined?(c.nome==="Filamentos"?0:1):Number(!!c.permitir_emprestimos)):Number(!!c.permitir_petianos),c.permitir_visitantes===undefined?(c.permitir_emprestimos===undefined?(c.nome==="Filamentos"?0:1):Number(!!c.permitir_emprestimos)):Number(!!c.permitir_visitantes)));
    }
    ops.push(db.prepare("INSERT OR IGNORE INTO categorias(nome,ordem,visivel_visitante,arquivada,permitir_emprestimos,permitir_petianos,permitir_visitantes) SELECT 'Filamentos',COALESCE(MAX(ordem),0)+1,1,0,0,0,0 FROM categorias"));
    const materialFields=[...fields,"arquivado","import_key"];
    for (const raw of b.componentes){
      const damaged=Math.max(0,Number(raw.com_defeito||0));
      const v=validateItem({...raw,quantidade:Math.max(Number(raw.em_uso||0),Number(raw.quantidade||0)-damaged)});
      const vals=[...fields.map(k=>v[k]),raw.arquivado?1:0,str(raw.import_key,120)||null];
      ops.push(db.prepare("INSERT INTO componentes(id,"+materialFields.join(",")+
        ",ultima_alteracao,ultimo_responsavel,detalhes_alteracao) VALUES("+
        Array(materialFields.length+4).fill("?").join(",")+")")
        .bind(raw.id,...vals,raw.ultima_alteracao||null,str(raw.ultimo_responsavel,100),
          str(raw.detalhes_alteracao,2000)));
    }
    for (const r of b.reservas){
      const uid=activeUsers.has(Number(r.usuario_id))?Number(r.usuario_id):null;
      // Tipo 'reserva' é temporário apenas durante INSERT para não disparar a
      // proteção de *nova* retirada direta ao reconstruir um histórico antigo.
      ops.push(db.prepare("INSERT INTO reservas(id,componente_id,nome_solicitante,contato,email,quantidade,data_inicio,data_devolucao,status,observacao,solicitado_em,aprovado_em,retirado_em,devolvido_em,responsavel_admin,aviso_atraso_em,usuario_id,tipo,devolucao_solicitada_em,devolucao_solicitada_observacao) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(r.id,r.componente_id,str(r.nome_solicitante,100),str(r.contato,140),
          str(r.email,180),Number(r.quantidade)||1,r.data_inicio,r.data_devolucao,r.status,
          str(r.observacao,500),r.solicitado_em||now(),r.aprovado_em||null,
          r.retirado_em||null,r.devolvido_em||null,str(r.responsavel_admin,100),
          r.aviso_atraso_em||null,uid,"reserva",r.status==="retirada"?(r.devolucao_solicitada_em||null):null,r.status==="retirada"?str(r.devolucao_solicitada_observacao,500):""));
    }
    for(const r of b.reservas)if(r.tipo==="retirada_direta")
      ops.push(db.prepare("UPDATE reservas SET tipo='retirada_direta' WHERE id=?").bind(r.id));
    const cfg=b.configuracoes&&typeof b.configuracoes==="object"?b.configuracoes:{};
    for (const [key,value] of Object.entries(cfg))
      if(/^[a-z_]{1,50}$/.test(key))ops.push(db.prepare("INSERT INTO configuracoes(chave,valor) VALUES(?,?)").bind(key,str(value,100)));
    if (!cfg.limpeza_reservas)ops.push(db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('limpeza_reservas','nunca')"));
    if (!cfg.limpeza_historico)ops.push(db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('limpeza_historico','nunca')"));
    if(v2&&Array.isArray(b.filamentos)){
      const knownMirrors=new Set(b.componentes.map(x=>Number(x.id)));
      for(const color of b.filamentos)ops.push(db.prepare(
        "INSERT INTO filamentos(id,cor,hexadecimal,quantidade,ordem,atualizado_em,visivel_visitante,permitir_emprestimos,permitir_petianos,permitir_visitantes,componente_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(color.id,str(color.cor,55),str(color.hexadecimal,7),
        Math.max(0,Number(color.quantidade||0)-Math.max(0,Number(b.componentes.find(x=>Number(x.id)===Number(color.componente_id))?.com_defeito||0))),
        Number(color.ordem)||0,color.atualizado_em||now(),color.visivel_visitante===0?0:1,
        color.permitir_emprestimos?1:0,color.permitir_petianos===undefined?Number(!!color.permitir_emprestimos):Number(!!color.permitir_petianos),color.permitir_visitantes===undefined?Number(!!color.permitir_emprestimos):Number(!!color.permitir_visitantes),knownMirrors.has(Number(color.componente_id))?Number(color.componente_id):null));
      // Backups antigos não possuíam vínculo: reconstruir os materiais espelhados
      // depois de restaurar as cores, preservando todas as quantidades e históricos.
      ops.push(db.prepare("INSERT OR IGNORE INTO componentes(categoria_id,nome,quantidade,em_uso,com_defeito,import_key,unidade,visivel_visitante,permitir_emprestimos,permitir_petianos,permitir_visitantes,ultima_alteracao) SELECT cat.id,'Filamento - '||f.cor,f.quantidade,0,0,'FILAMENTO-'||f.id,'rolos',f.visivel_visitante,f.permitir_emprestimos,f.permitir_petianos,f.permitir_visitantes,f.atualizado_em FROM filamentos f JOIN categorias cat ON cat.nome='Filamentos' WHERE f.componente_id IS NULL"));
      ops.push(db.prepare("UPDATE filamentos SET componente_id=(SELECT c.id FROM componentes c WHERE c.import_key='FILAMENTO-'||filamentos.id) WHERE componente_id IS NULL"));
    }
    ops.push(db.prepare("UPDATE filamentos SET quantidade=(SELECT quantidade FROM componentes WHERE id=filamentos.componente_id) WHERE componente_id IS NOT NULL"));
    if(v2&&Array.isArray(b.historico)){
      ops.push(db.prepare("DELETE FROM historico_admin"));
      for(const event of b.historico)ops.push(db.prepare(
        "INSERT INTO historico_admin(id,criado_em,responsavel,acao,tipo,registro_id,descricao) VALUES(?,?,?,?,?,?,?)"
      ).bind(event.id,event.criado_em||now(),str(event.responsavel,100),
        str(event.acao,50),str(event.tipo,40),event.registro_id||null,str(event.descricao,1400)));
    }
    if(v2&&Array.isArray(b.conciliacao_experimentos_vinculos)){
      ops.push(db.prepare("DELETE FROM conciliacao_experimentos_vinculos"));
      for(const link of b.conciliacao_experimentos_vinculos)ops.push(db.prepare(
        "INSERT INTO conciliacao_experimentos_vinculos(origem_id,destino_id,quantidade_transferida,defeitos_transferidos,operacao,registrado_em) VALUES(?,?,?,?,?,?)"
      ).bind(link.origem_id,link.destino_id,link.quantidade_transferida,link.defeitos_transferidos,link.operacao,link.registrado_em||now()));
    }
    if(v2&&Array.isArray(b.conciliacao_experimentos_backup)){
      ops.push(db.prepare("DELETE FROM conciliacao_experimentos_backup"));
      for(const snapshot of b.conciliacao_experimentos_backup)ops.push(db.prepare(
        "INSERT INTO conciliacao_experimentos_backup(material_id,snapshot,registrado_em) VALUES(?,?,?)"
      ).bind(snapshot.material_id,snapshot.snapshot,snapshot.registrado_em||now()));
    }
    await db.batch(ops);
    await auditLog(db,"Restaurou backup","sistema",null,
      "Backup "+b.formato+" restaurado: "+b.componentes.length+" materiais, "+
      b.categorias.length+" categorias e "+(b.filamentos?.length||0)+" filamentos.");
    return j({ok:true});
  }
  if (path === "/api/admin/reminder" && method === "POST") {
    const b=await input(req,2000), id=requireId(b.id);
    const scheduled=await queueManual(db,id);
    return scheduled.ok?j({ok:true,mensagem:"Cobrança incluída na fila do Gmail."}):bad(scheduled.reason,409);
  }
  if (path === "/api/admin/reservations/reset" && method === "POST") {
    const b=await input(req,2000);
    if(b.confirmar!=="APAGAR TODAS AS RESERVAS")return bad("Confirmação incorreta. Nenhum registro foi excluído.",400);
    const active=await db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE status IN ('retirada','aprovada')").first();
    if(Number(active?.n)>0)return bad("Existem "+active.n+" retirada(s) ativas ou aprovações antigas. Registre todas as devoluções antes de apagar os registros para proteger o estoque.",409);
    const existing=await db.prepare("SELECT COUNT(*) AS n FROM reservas").first();
    const count=Number(existing?.n)||0;
    // Operação única no D1. Preservar o histórico de mensagens efetivamente enviadas,
    // mas cancelar as que ainda não saíram e remover notificações vinculadas às reservas.
    await db.batch([
      db.prepare("UPDATE mail_queue SET situacao='cancelado',ultimo_erro='Histórico de reservas limpo pelo administrador',token_reserva=NULL WHERE reserva_id IS NOT NULL AND situacao IN ('pendente','processando')"),
      db.prepare("DELETE FROM notificacoes WHERE reserva_id IS NOT NULL"),
      db.prepare("DELETE FROM reservas")
    ]);
    await auditLog(db,"Limpou reservas","sistema",null,"Excluiu todos os "+count+" registros de reservas após confirmação e backup. Estoque ativo preservado.");
    return j({ok:true,removidos:count});
  }
  if (path === "/api/admin/cleanup" && method === "POST") {
    const count = await cleanup(db);
    await auditLog(db,"Limpeza","sistema",null,count+" reservas concluídas removidas");
    return j({ ok:true, removidas:count });
  }
  return bad("Rota não encontrada.",404);
}
async function cleanup(db) {
  const cfg = await db.prepare("SELECT valor FROM configuracoes WHERE chave='limpeza_reservas'").first();
  const days = cfg?.valor;
  let removed = 0;
  if (days === "1min" || (days && days !== "nunca" && Number(days)>0)) {
    const cutoff = new Date(Date.now() - (days === "1min" ? 60000 : Number(days) * 86400000)).toISOString();
    // Concluídas = devolvidas, recusadas e canceladas. Pendentes e retiradas ficam intocadas.
    // Recusadas/canceladas não possuem timestamp próprio; usar a data de solicitação.
    const done = await db.prepare("DELETE FROM reservas WHERE (status='devolvida' AND COALESCE(devolvido_em,solicitado_em) < ?) OR (status IN ('recusada','cancelada') AND solicitado_em < ?)").bind(cutoff,cutoff).run();
    removed = done.meta?.changes || 0;
  }
  const logSetting=await db.prepare("SELECT valor FROM configuracoes WHERE chave='limpeza_historico'").first();
  const limit=logSetting?.valor;
  if(limit&&limit!=="nunca"&&Number(limit)>0){
    const deadline=new Date(Date.now()-Number(limit)*86400000).toISOString();
    await db.prepare("DELETE FROM historico_admin WHERE criado_em<?").bind(deadline).run();
  }
  await db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").bind(now()).run();
  await db.prepare("DELETE FROM usuario_sessoes WHERE expira_em < ?").bind(now()).run();
  await db.prepare("DELETE FROM reserva_limites WHERE criado_em < ?").bind(new Date(Date.now()-2*86400000).toISOString()).run();
  return removed;
}
export default {
  async fetch(req, env) {
    const path = new URL(req.url).pathname;
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(req);
    try { return await processRequest(req,env); }
    catch (error) {
      console.error("Inventario API:", error?.message || error);
      const msg = String(error?.message || "");
      if (msg.includes("UNIQUE constraint")) return bad("Já existe um cadastro com esse nome.",409);
      if (msg.includes("FOREIGN KEY constraint")) return bad("O registro está ligado a outros dados.",409);
      if (msg.includes("CHECK constraint")) return bad("As quantidades ou os dados são inconsistentes.",409);
      return bad(msg.length < 180 ? msg : "Não foi possível concluir a operação.",500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      if (event.cron === "* * * * *") {
        const setting = await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave='limpeza_reservas'").first();
        if (setting?.valor === "1min") await cleanup(env.DB);
        return;
      }
      await generateDailyEmails(env);
      await cleanup(env.DB);
    })());
  }
};
