import { identityAPI, currentIdentity } from "./identity.js";
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
    com_defeito: integer(data.com_defeito),
    mostrar_quantidade: data.mostrar_quantidade ? 1 : 0,
    mostrar_em_uso: data.mostrar_em_uso ? 1 : 0,
    mostrar_defeito: data.mostrar_defeito ? 1 : 0,
    descricao_defeito: str(data.descricao_defeito, 1400),
    observacoes: str(data.observacoes, 1200),
    unidade: str(data.unidade||"unidades", 40)
  };
  if (!x.nome) throw new Error("Informe o nome do material.");
  if ([x.quantidade, x.em_uso, x.com_defeito].some(n => !Number.isSafeInteger(n) || n < 0 || n > 1000000)) throw new Error("Confira as quantidades.");
  if (x.em_uso + x.com_defeito > x.quantidade) throw new Error("A soma em uso + defeito ultrapassa a quantidade total.");
  if (x.imagem && !(/^\/img\/[a-zA-Z0-9_.-]+\.(svg|webp|jpg|jpeg|png)$/.test(x.imagem) || /^https:\/\//.test(x.imagem) || /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(x.imagem))) throw new Error("A imagem deve ser uma foto válida.");
  return x;
}
const fields = ["categoria_id","nome","imagem","patrimonio","identificacao","quantidade","em_uso","com_defeito","mostrar_quantidade","mostrar_em_uso","mostrar_defeito","descricao_defeito","observacoes","unidade"];
const names = { categoria_id:"Categoria",nome:"Nome",imagem:"Fotografia",patrimonio:"Patrimônio",identificacao:"Identificação",quantidade:"Quantidade",em_uso:"Em uso",com_defeito:"Com defeito",mostrar_quantidade:"Exibição da quantidade",mostrar_em_uso:"Exibição de em uso",mostrar_defeito:"Exibição de defeitos",descricao_defeito:"Descrição dos defeitos",observacoes:"Observações",unidade:"Unidade" };
function changes(before, after) {
  if (!before) return "Material cadastrado";
  const diffs = fields.filter(key => String(before[key] ?? "") !== String(after[key] ?? "")).map(key => key === "imagem" ? "Fotografia atualizada" : names[key] + ": " + str(before[key] ?? "—", 42) + " → " + str(after[key] ?? "—", 42));
  return diffs.join(" | ") || "Cadastro confirmado";
}
async function catalog(db, isAdmin = false) {
  const cats = await results(db, "SELECT id,nome,ordem FROM categorias ORDER BY ordem,nome");
  const items = await results(db, isAdmin ? "SELECT * FROM componentes ORDER BY nome COLLATE NOCASE" : "SELECT * FROM componentes WHERE arquivado=0 ORDER BY nome COLLATE NOCASE");
  if (!isAdmin) for (const item of items) { delete item.ultimo_responsavel; delete item.detalhes_alteracao; }
  return { categorias: cats, componentes: items };
}
async function state(db) {
  const data = await catalog(db, true);
  data.reservas = await results(db, "SELECT r.*, c.nome AS componente_nome FROM reservas r LEFT JOIN componentes c ON c.id=r.componente_id ORDER BY r.solicitado_em DESC LIMIT 1500");
  const config = await results(db, "SELECT chave,valor FROM configuracoes");
  data.configuracoes = Object.fromEntries(config.map(x => [x.chave, x.valor]));
  data.ultima_atualizacao = data.componentes.reduce((best,item)=>item.ultima_alteracao>best?item.ultima_alteracao:best,"");
  return data;
}
const maxReserved = async (db, id, start, end, except = -1) => {
  const found = await db.prepare("SELECT COALESCE(SUM(quantidade),0) AS n FROM reservas WHERE componente_id=? AND id!=? AND status='aprovada' AND data_inicio<=? AND data_devolucao>=?").bind(id, except, end, start).first();
  return found?.n || 0;
};
const baseAvailable = item => item.mostrar_quantidade ? Math.max(0, item.quantidade - item.em_uso - item.com_defeito) : 0;
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
  if (path === "/api/health") {
    const row = await db.prepare("SELECT COUNT(*) AS n FROM categorias").first();
    return j({ ok:true, service:"Inventário PET", database:"connected", categories:row?.n ?? 0 });
  }
  if (path === "/api/catalog" && method === "GET") {
    const data = await catalog(db);
    const mode = await db.prepare("SELECT valor FROM configuracoes WHERE chave='modo_demo'").first();
    return j({ ...data, demonstracao:mode?.valor === "sim" });
  }
  if (path === "/api/availability" && method === "GET") {
    const id = requireId(url.searchParams.get("id")), a = url.searchParams.get("inicio"), b = url.searchParams.get("fim");
    if (!dateOK(a) || !dateOK(b) || a > b) return bad("Período inválido.");
    const item = await db.prepare("SELECT * FROM componentes WHERE id=?").bind(id).first();
    if (!item || item.arquivado===1) return bad("Material não encontrado.", 404);
    return j({ disponiveis:Math.max(0, baseAvailable(item) - await maxReserved(db,id,a,b)) });
  }
  if (path === "/api/reservations" && method === "POST") {
    const body = await input(req, 8000);
    if (body.website) return j({ ok:true });
    const id = requireId(body.componente_id);
    const quantidade = Number(body.quantidade);
    const identity = await currentIdentity(req, db);
    const nome = identity ? identity.nome : str(body.nome_solicitante, 100);
    const contato = str(body.contato, 140);
    const email = str(body.email, 180).toLowerCase();
    if (!validEmail(email)) return bad("Informe um e-mail válido ou deixe o campo vazio.");
    const inicio = str(body.data_inicio, 10), fim = str(body.data_devolucao, 10);
    if (nome.length < 2 || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 1000 || !dateOK(inicio) || !dateOK(fim) || fim < inicio || inicio < todayBR()) return bad("Confira o nome, a quantidade e as datas da reserva.");
    if (contato.length > 140) return bad("Contato grande demais.");
    const item = await db.prepare("SELECT * FROM componentes WHERE id=?").bind(id).first();
    if (!item || item.arquivado===1) return bad("Material não encontrado.",404);
    if (baseAvailable(item) - await maxReserved(db,id,inicio,fim) < quantidade) return bad("Não há quantidade disponível para essas datas.",409);
    if (!await safeRate(db,req,"reserva",5)) return bad("Limite de solicitações por hora atingido. Tente mais tarde.",429);
    await db.prepare("INSERT INTO reservas (componente_id,nome_solicitante,contato,email,quantidade,data_inicio,data_devolucao,status,observacao,solicitado_em,usuario_id) VALUES (?,?,?,?,?,?,?,'pendente',?,?,?)").bind(id,nome,contato,email,quantidade,inicio,fim,str(body.observacao,500),now(),identity?.id||null).run();
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
    return j({ ok:true },200,{ "set-cookie":"__Host_pet_session="+token+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200" });
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
  if (path === "/api/admin/state" && method === "GET") return j(await state(db));
  if (path === "/api/admin/item" && method === "POST") {
    const body = await input(req);
    const item = validateItem(body);
    const id = body.id ? requireId(body.id) : null;
    const categoria = await db.prepare("SELECT id FROM categorias WHERE id=?").bind(item.categoria_id).first();
    if (!categoria) return bad("Categoria não encontrada.");
    const old = id ? await db.prepare("SELECT * FROM componentes WHERE id=?").bind(id).first() : null;
    if (id && !old) return bad("Material não encontrado.",404);
    const available = baseAvailable(item);
    if (id && (await db.prepare("SELECT COALESCE(SUM(quantidade),0) AS n FROM reservas WHERE componente_id=? AND status='aprovada'").bind(id).first()).n > available) return bad("As quantidades não cobrem as reservas já aprovadas.",409);
    const actor = str(body.responsavel,100) || "PETiane";
    const audit = [now(),actor,changes(old,item)];
    const vals = fields.map(k => item[k]);
    if (id) {
      await db.prepare("UPDATE componentes SET "+fields.map(k=>k+"=?").join(",")+",ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?").bind(...vals,...audit,id).run();
    } else {
      await db.prepare("INSERT INTO componentes("+fields.join(",")+",ultima_alteracao,ultimo_responsavel,detalhes_alteracao) VALUES ("+Array(fields.length+3).fill("?").join(",")+")").bind(...vals,...audit).run();
    }
    return j({ ok:true });
  }
  if (path === "/api/admin/item" && method === "DELETE") {
    const id = requireId(url.searchParams.get("id"));
    const active = await db.prepare("SELECT COUNT(*) AS n FROM reservas WHERE componente_id=? AND status IN ('pendente','aprovada','retirada')").bind(id).first();
    if (active.n) return bad("Existem reservas ativas deste material. Finalize-as antes de excluir.",409);
    await db.prepare("UPDATE componentes SET arquivado=1,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?")
      .bind(now(),"Administração","Material arquivado",id).run();
    return j({ ok:true,arquivado:true });
  }
  if(path==="/api/admin/item/unarchive" && method==="POST"){
    const b=await input(req,1500),id=requireId(b.id);
    await db.prepare("UPDATE componentes SET arquivado=0,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?").bind(now(),"Administração","Material restaurado",id).run();
    return j({ok:true});
  }
  if (path === "/api/admin/category" && method === "POST") {
    const b = await input(req,9000);
    const name = str(b.nome,80);
    if (b.acao === "criar") {
      if (!name) return bad("Informe o nome da categoria.");
      await db.prepare("INSERT INTO categorias(nome,ordem) VALUES(?,?)").bind(name,Number(b.ordem)||0).run();
    } else if (b.acao === "editar") {
      if (!name) return bad("Informe o nome da categoria.");
      await db.prepare("UPDATE categorias SET nome=? WHERE id=?").bind(name,requireId(b.id)).run();
    } else if (b.acao === "excluir") {
      const id = requireId(b.id), linked = await db.prepare("SELECT COUNT(*) AS n FROM componentes WHERE categoria_id=?").bind(id).first();
      if (linked.n) return bad("Mova os materiais desta categoria antes de excluí-la.",409);
      await db.prepare("DELETE FROM categorias WHERE id=?").bind(id).run();
    } else if (b.acao === "ordenar") {
      if (!Array.isArray(b.ordem) || b.ordem.length > 100) return bad("Ordem inválida.");
      const queries = b.ordem.map((id, i) => db.prepare("UPDATE categorias SET ordem=? WHERE id=?").bind(i,requireId(id)));
      if (queries.length) await db.batch(queries);
    } else return bad("Ação inválida.");
    return j({ ok:true });
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
      const reserved = await maxReserved(db,item.id,r.data_inicio,r.data_devolucao,r.id);
      if (baseAvailable(item) - reserved < r.quantidade) return bad("Estoque insuficiente para aprovar esta reserva.",409);
      await db.prepare("UPDATE reservas SET status='aprovada',aprovado_em=?,responsavel_admin=? WHERE id=? AND status='pendente'").bind(current,actor,id).run();
    } else if (action === "recusar" && ["pendente","aprovada"].includes(r.status)) {
      await db.prepare("UPDATE reservas SET status='recusada',responsavel_admin=?,observacao=? WHERE id=?").bind(actor,str(b.observacao,500),id).run();
    } else if (action === "retirar" && r.status === "aprovada") {
      if (baseAvailable(item) < r.quantidade) return bad("Não há estoque suficiente para registrar a retirada.",409);
      await db.batch([
        db.prepare("UPDATE componentes SET em_uso=em_uso+?, ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=? AND quantidade-em_uso-com_defeito>=?").bind(r.quantidade,current,actor,"Retirada da reserva #"+id+": "+r.quantidade+" unidade(s)",item.id,r.quantidade),
        db.prepare("UPDATE reservas SET status='retirada',retirado_em=?,responsavel_admin=? WHERE id=? AND status='aprovada'").bind(current,actor,id)
      ]);
    } else if (action === "devolver" && r.status === "retirada") {
      const broken = Number(b.defeituosos || 0);
      if (!Number.isSafeInteger(broken) || broken < 0 || broken > r.quantidade) return bad("Quantidade de unidades defeituosas inválida.");
      if (item.em_uso < r.quantidade) return bad("O estoque em uso está inconsistente. Verifique antes da devolução.",409);
      await db.batch([
        db.prepare("UPDATE componentes SET em_uso=em_uso-?,com_defeito=com_defeito+?,ultima_alteracao=?,ultimo_responsavel=?,detalhes_alteracao=? WHERE id=?").bind(r.quantidade,broken,current,actor,"Devolução da reserva #"+id+(broken?" • "+broken+" com defeito":""),item.id),
        db.prepare("UPDATE reservas SET status='devolvida',devolvido_em=?,responsavel_admin=?,observacao=? WHERE id=? AND status='retirada'").bind(current,actor,str(b.observacao,500),id)
      ]);
    } else return bad("Ação não permitida para o estado atual desta reserva.",409);
    if(r.usuario_id){
      let titulo="",mensagem="",tipo="info";
      if(action==="aprovar"){titulo="Reserva aprovada";mensagem="Sua solicitação de "+item.nome+" foi aprovada.";tipo="aprovada";}
      else if(action==="recusar"){titulo="Reserva recusada";mensagem="A solicitação de "+item.nome+" não foi aprovada.";tipo="recusada";}
      else if(action==="retirar"){titulo="Retirada registrada";mensagem="A retirada de "+item.nome+" foi registrada.";tipo="retirada";}
      else if(action==="devolver"){titulo="Devolução confirmada";mensagem="A devolução de "+item.nome+" foi confirmada.";tipo="devolucao";}
      if(titulo)await db.prepare("INSERT INTO notificacoes(usuario_id,reserva_id,titulo,mensagem,tipo) VALUES(?,?,?,?,?)").bind(r.usuario_id,id,titulo,mensagem,tipo).run();
    }
    return j({ ok:true });
  }
  if (path === "/api/admin/settings" && method === "POST") {
    const b = await input(req,4000), days = String(b.limpeza_reservas);
    if (days !== "nunca" && days !== "1min" && (!Number.isSafeInteger(Number(days)) || Number(days) < 1 || Number(days) > 3650)) return bad("Escolha um prazo válido.");
    await db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('limpeza_reservas',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(days).run();
    if (b.modo_demo === "sim" || b.modo_demo === "nao") await db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('modo_demo',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(b.modo_demo).run();
    if (b.avisos_email === "sim" || b.avisos_email === "nao") await db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('avisos_email',?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(b.avisos_email).run();
    return j({ ok:true });
  }
  if (path === "/api/admin/backup" && method === "GET") {
    const data = await state(db);
    return j({ formato:"inventario-pet-v1", gerado_em:now(), ...data },200,{ "content-disposition":'attachment; filename="backup-inventario-pet.json"' });
  }
  if (path === "/api/admin/restore" && method === "POST") {
    const b = await input(req,1700000);
    if (b.formato !== "inventario-pet-v1" || !Array.isArray(b.categorias) || !Array.isArray(b.componentes) || !Array.isArray(b.reservas) || b.categorias.length > 150 || b.componentes.length > 1800 || b.reservas.length > 8000) return bad("Backup inválido ou grande demais.");
    if (!b.categorias.every(x=>Number.isSafeInteger(x.id) && !!str(x.nome,80)) || !b.componentes.every(x=>Number.isSafeInteger(x.id) && Number.isSafeInteger(x.categoria_id)) || !b.reservas.every(x=>Number.isSafeInteger(x.id) && Number.isSafeInteger(x.componente_id))) return bad("O backup tem registros inválidos.");
    const ops = [
      db.prepare("DELETE FROM reservas"),
      db.prepare("DELETE FROM componentes"),
      db.prepare("DELETE FROM categorias"),
      db.prepare("DELETE FROM configuracoes")
    ];
    for (const c of b.categorias) ops.push(db.prepare("INSERT INTO categorias(id,nome,ordem) VALUES(?,?,?)").bind(c.id,str(c.nome,80),Number(c.ordem)||0));
    for (const raw of b.componentes) {
      const v = validateItem(raw);
      ops.push(db.prepare("INSERT INTO componentes(id,"+fields.join(",")+",ultima_alteracao,ultimo_responsavel,detalhes_alteracao) VALUES("+Array(fields.length+4).fill("?").join(",")+")").bind(raw.id,...fields.map(k=>v[k]),raw.ultima_alteracao||null,str(raw.ultimo_responsavel,100),str(raw.detalhes_alteracao,2000)));
    }
    for (const r of b.reservas) ops.push(db.prepare("INSERT INTO reservas(id,componente_id,nome_solicitante,contato,email,quantidade,data_inicio,data_devolucao,status,observacao,solicitado_em,aprovado_em,retirado_em,devolvido_em,responsavel_admin,aviso_atraso_em) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(r.id,r.componente_id,str(r.nome_solicitante,100),str(r.contato,140),str(r.email,180),Number(r.quantidade)||1,r.data_inicio,r.data_devolucao,r.status,str(r.observacao,500),r.solicitado_em||now(),r.aprovado_em||null,r.retirado_em||null,r.devolvido_em||null,str(r.responsavel_admin,100),r.aviso_atraso_em||null));
    const cfg = b.configuracoes && typeof b.configuracoes === "object" ? b.configuracoes : {};
    for (const [key, value] of Object.entries(cfg)) if (/^[a-z_]{1,50}$/.test(key)) ops.push(db.prepare("INSERT INTO configuracoes(chave,valor) VALUES(?,?)").bind(key,str(value,100)));
    if (!cfg.limpeza_reservas) ops.push(db.prepare("INSERT INTO configuracoes(chave,valor) VALUES('limpeza_reservas','nunca')"));
    await db.batch(ops);
    return j({ ok:true });
  }
  if (path === "/api/admin/reminder" && method === "POST") {
    const b = await input(req,2000), id = requireId(b.id);
    const row = await db.prepare("SELECT r.*,c.nome AS componente_nome FROM reservas r JOIN componentes c ON c.id=r.componente_id WHERE r.id=?").bind(id).first();
    if (!row || row.status !== "retirada" || row.data_devolucao >= todayBR()) return bad("Somente retiradas em atraso podem receber cobrança.",409);
    const sent = await emailReminder(env, row);
    if (!sent) return bad("Configure o serviço de e-mail e confira o endereço do solicitante.",503);
    await db.prepare("UPDATE reservas SET aviso_atraso_em=? WHERE id=?").bind(now(),id).run();
    return j({ok:true});
  }
  if (path === "/api/admin/cleanup" && method === "POST") {
    const count = await cleanup(db);
    return j({ ok:true, removidas:count });
  }
  return bad("Rota não encontrada.",404);
}
async function emailReminder(env, row) {
  if (!env.BREVO_API_KEY || !env.EMAIL_FROM || !validEmail(row.email) || !row.email) return false;
  const message = "Olá, "+row.nome_solicitante+"!\n\nO PET Educação informa que a devolução do material \""+row.componente_nome+"\" (reserva #"+row.id+") estava prevista para "+row.data_devolucao.split("-").reverse().join("/")+" e ainda não foi registrada.\n\nPedimos, por gentileza, que entre em contato com o PET para combinar a devolução. Caso já tenha devolvido, desconsidere este lembrete e avise nossa equipe.\n\nPET Educação";
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:"POST",
    headers:{"api-key":env.BREVO_API_KEY,"content-type":"application/json","accept":"application/json"},
    body:JSON.stringify({sender:{email:env.EMAIL_FROM,name:"PET Educação"},to:[{email:row.email,name:row.nome_solicitante}],subject:"PET Educação: lembrete de devolução do material",textContent:message})
  });
  if (!response.ok) { console.error("Brevo: erro de envio",response.status); return false; }
  return true;
}
async function automaticEmails(env) {
  if (!env.DB || !env.BREVO_API_KEY || !env.EMAIL_FROM) return;
  const setting = await env.DB.prepare("SELECT valor FROM configuracoes WHERE chave='avisos_email'").first();
  if (setting?.valor !== "sim") return;
  const due = await results(env.DB,"SELECT r.*,c.nome AS componente_nome FROM reservas r JOIN componentes c ON c.id=r.componente_id WHERE r.status='retirada' AND r.data_devolucao<? AND r.email!='' AND r.aviso_atraso_em IS NULL ORDER BY r.data_devolucao ASC LIMIT 80",[todayBR()]);
  for (const row of due) {
    try {
      if (await emailReminder(env,row)) await env.DB.prepare("UPDATE reservas SET aviso_atraso_em=? WHERE id=? AND aviso_atraso_em IS NULL").bind(now(),row.id).run();
    } catch(error) { console.error("Falha em lembrete da reserva",row.id,String(error).slice(0,100)); }
  }
}
async function cleanup(db) {
  const cfg = await db.prepare("SELECT valor FROM configuracoes WHERE chave='limpeza_reservas'").first();
  const days = cfg?.valor;
  let removed = 0;
  if (days === "1min" || (days && days !== "nunca" && Number(days)>0)) {
    const cutoff = new Date(Date.now() - (days === "1min" ? 60000 : Number(days) * 86400000)).toISOString();
    const done = await db.prepare("DELETE FROM reservas WHERE status='devolvida' AND devolvido_em IS NOT NULL AND devolvido_em < ?").bind(cutoff).run();
    removed = done.meta?.changes || 0;
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
      await automaticEmails(env);
      await cleanup(env.DB);
    })());
  }
};
