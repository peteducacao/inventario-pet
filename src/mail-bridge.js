/* Gmail via Google Apps Script: o Worker mantém a fila; o Script só envia.
 * Nenhuma credencial é colocada no frontend ou no repositório.
 */
const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const fail=(message,status=400)=>reply({error:message},status);
const clean=(s,n=200)=>String(s??"").trim().slice(0,n);
const emailOK=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s||"")&&s.length<=180;
const dayBR=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const iso=()=>new Date().toISOString();
const rows=async(db,sql,args=[])=>((await db.prepare(sql).bind(...args).all()).results||[]);
const pref=async(db,key,fallback)=>((await db.prepare("SELECT valor FROM configuracoes WHERE chave=?").bind(key).first())?.valor??fallback);
const digest=async x=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(x)))).map(v=>v.toString(16).padStart(2,"0")).join("");
const formatDate=s=>s&&/^\d{4}-\d\d-\d\d$/.test(s)?s.split("-").reverse().join("/"):"sem prazo";
const TEMPLATE_TYPES={antes:"Um dia antes do prazo",hoje:"No dia da devolução",atraso2:"Dois dias de atraso",atraso7:"Sete dias de atraso",manual:"Cobrança manual",nao_recebido:"Entrega não confirmada"};
const TEMPLATE_EVENTS=Object.keys(TEMPLATE_TYPES);
const MAIL_PROFILES={petiano:"PETianes",visitante:"Visitantes"};
const emailEventKey=(tag,event)=>"mail_event_"+tag+"_"+event;
async function eventEnabled(db,tag,event){
  if(!Object.hasOwn(MAIL_PROFILES,tag)||!Object.hasOwn(TEMPLATE_TYPES,event))return false;
  return await pref(db,emailEventKey(tag,event),"sim")==="sim";
}
const BASE_END="\n\nMaterial: {material}\nQuantidade: {quantidade}\nDevolução prevista: {prazo}\nRegistro: #{registro}\n\nPedimos que organize a devolução ou entre em contato com a equipe do PET Educação. Se já devolveu, avise a equipe para atualizar o registro.\n\nPET Educação - UFS\n{link}";
function defaultTemplate(event){
  if(event==="nao_recebido")return {
    assunto:"Inventário PET Educação - Entrega não confirmada",
    mensagem:"Olá, {nome}!\n\nA equipe do PET Educação não confirmou o recebimento do material {material} ({quantidade} unidade(s), registro #{registro}).\n\nO empréstimo continua em uso. Depois de entregar o material, acesse {link}, entre em Meus empréstimos e marque Devolvido novamente. Se você já fez a entrega, entre em contato com a equipe do PET Educação para conferência.\n\nPET Educação - UFS"
  };
  const intro={antes:"A devolução do material abaixo está prevista para amanhã.",hoje:"A data prevista para devolução do material é hoje.",atraso2:"Nossa equipe identificou que a devolução do material abaixo está em atraso.",atraso7:"Nossa equipe identificou que a devolução do material abaixo está em atraso há alguns dias.",manual:"Este é um lembrete da equipe do PET Educação sobre o material ainda em empréstimo."}[event];
  return {assunto:["atraso2","atraso7","manual"].includes(event)?"Inventário PET Educação - Lembrete de devolução":"Inventário PET Educação - Prazo de devolução",mensagem:"Olá, {nome}!\n\n"+intro+BASE_END};
}
function validateTemplate(assunto,mensagem){
  if(typeof assunto!=="string"||assunto.trim().length<5||assunto.trim().length>180||/[\r\n]/.test(assunto))throw Error("Assunto inválido. Use de 5 a 180 caracteres em uma linha.");
  if(typeof mensagem!=="string"||mensagem.trim().length<15||mensagem.length>5000)throw Error("O texto precisa ter de 15 a 5.000 caracteres.");
  return {assunto:assunto.trim(),mensagem:mensagem.trim()};
}
async function templateFor(db,event){
  if(!Object.hasOwn(TEMPLATE_TYPES,event))throw Error("Tipo de e-mail inválido.");
  const model=defaultTemplate(event);
  return {assunto:await pref(db,"mail_template_"+event+"_subject",model.assunto),mensagem:await pref(db,"mail_template_"+event+"_body",model.mensagem)};
}
function renderTemplate(model,row){
  const fields={nome:clean(row.nome_solicitante,100),material:clean(row.componente_nome,150),quantidade:String(row.quantidade),prazo:formatDate(row.data_devolucao),registro:String(row.id),link:"https://inventario-pet.pet-educacao.workers.dev"};
  const render=value=>value.replace(/\{(nome|material|quantidade|prazo|registro|link)\}/g,(_,key)=>fields[key]);
  return {subject:render(model.assunto),body:render(model.mensagem)};
}
async function content(db,row,event,custom=null){
  return renderTemplate(custom?validateTemplate(custom.assunto,custom.mensagem):await templateFor(db,event),row);
}
async function current(db,id){
  const row=await db.prepare("SELECT r.*,c.nome AS componente_nome,COALESCE(u.papel, CASE WHEN r.tipo='retirada_direta' THEN 'petiano' ELSE 'visitante' END) AS tag, COALESCE(u.notificar_email,1) AS permite_usuario,u.email AS email_conta FROM reservas r JOIN componentes c ON c.id=r.componente_id LEFT JOIN usuarios u ON u.id=r.usuario_id WHERE r.id=?").bind(id).first();
  if(!row)return null;
  // Sempre utilizar o endereço atualizado da conta; só o histórico desvinculado
  // conserva o e-mail registrado no momento da solicitação.
  if(row.usuario_id)row.email=row.email_conta||"";
  delete row.email_conta;
  return row;
}
async function allowed(db,row,event=null){
  if(!row||row.status!=="retirada"||row.devolucao_solicitada_em||!emailOK(row.email)||Number(row.permite_usuario)===0)return false;
  const flag=row.tag==="petiano"?"notificacoes_petianos":"notificacoes_visitantes";
  if(await pref(db,flag,row.tag==="petiano"?"nao":"sim")!=="sim")return false;
  return event===null||await eventEnabled(db,row.tag,event);
}
async function queue(db,row,event,origin="automatica",custom=null){
  if(!await allowed(db,row,event))return {ok:false,reason:"Sem e-mail, empréstimo ainda não retirado ou este tipo de notificação está desativado para a pessoa/tag."};
  if(Number(row.sem_prazo)===1||!row.data_devolucao)return {ok:false,reason:"Empréstimo sem prazo definido."};
  const msg=await content(db,row,event,custom);
  const key=origin==="manual"?"manual:"+row.id+":"+dayBR()+":"+row.data_devolucao:"auto:"+row.id+":"+event+":"+row.data_devolucao;
  const result=await db.prepare("INSERT OR IGNORE INTO mail_queue(reserva_id,evento,chave_unica,destinatario,assunto,mensagem,prazo_referencia,origem,criado_em) VALUES(?,?,?,?,?,?,?,?,?)")
    .bind(row.id,event,key,row.email,msg.subject,msg.body,row.data_devolucao,origin,iso()).run();
  return {ok:true,queued:result.meta?.changes===1};
}
// Aviso de "Não recebido", somente após alteração da reserva no banco.
// O carimbo da tentativa original identifica o evento e impede duplicação.
export async function queueUnreceivedReturnEmail(env,id,attempt){
  try{
    if(!env?.DB||!attempt)return {ok:false,queued:false};
    const db=env.DB,row=await current(db,id);
    if(!await allowed(db,row,"nao_recebido"))
      return {ok:false,queued:false,reason:"Sem e-mail válido ou avisos desabilitados."};
    const msg=await content(db,row,"nao_recebido");
    const key="auto:"+row.id+":nao_recebido:"+String(attempt);
    const inserted=await db.prepare("INSERT OR IGNORE INTO mail_queue(reserva_id,evento,chave_unica,destinatario,assunto,mensagem,prazo_referencia,origem,criado_em) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(row.id,"nao_recebido",key,row.email,msg.subject,msg.body,row.data_devolucao||"","automatica",iso()).run();
    return {ok:true,queued:inserted.meta?.changes===1};
  }catch(error){
    console.error("Falha ao preparar aviso de não recebimento",String(error).slice(0,120));
    return {ok:false,queued:false};
  }
}
export async function queueManual(db,id,custom=null){
  const row=await current(db,id);
  if(!row)return {ok:false,reason:"Empréstimo não encontrado."};
  return queue(db,row,"manual","manual",custom);
}
// Acompanhamento pontual de novas retiradas aprovadas depois do cron diário.
function eventForDue(date,due){
  if(!due)return null;
  const days=Math.round((Date.parse(date+"T12:00:00Z")-Date.parse(due+"T12:00:00Z"))/86400000);
  return days===-1?"antes":days===0?"hoje":days===2?"atraso2":days===7?"atraso7":null;
}
export async function queueNewLoanReminder(env,id){
  try{
    if(!env.DB||await pref(env.DB,"avisos_email","nao")!=="sim")return {ok:false};
    const row=await current(env.DB,id);
    if(!row||row.sem_prazo)return {ok:false};
    const event=eventForDue(dayBR(),row.data_devolucao);
    return event?await queue(env.DB,row,event):{ok:true,queued:false};
  }catch(error){console.error("Falha ao preparar aviso da retirada",String(error).slice(0,140));return {ok:false};}
}
export async function generateDailyEmails(env){
  if(!env.DB||await pref(env.DB,"avisos_email","nao")!=="sim")return {ok:false,reason:"Lembretes automáticos desativados.",verificados:0,enfileirados:0};
  const today=dayBR();let checked=0,queued=0;
  const due=await rows(env.DB,"SELECT r.id FROM reservas r LEFT JOIN usuarios u ON u.id=r.usuario_id WHERE r.status='retirada' AND r.sem_prazo=0 AND r.data_devolucao!='' AND (r.email!='' OR u.email!='') ORDER BY r.data_devolucao ASC LIMIT 1500");
  for(const record of due){
    try{
      const row=await current(env.DB,record.id);
      if(!row)continue;
      checked++;
      const event=eventForDue(today,row.data_devolucao);
      if(event && await allowed(env.DB,row,event)){
        const outcome=await queue(env.DB,row,event);
        if(outcome.queued)queued++;
      }
    }catch(e){console.error("Erro ao preparar lembrete",record.id,String(e).slice(0,120));}
  }
  return {ok:true,verificados:checked,enfileirados:queued,hoje:today};
}
// Caminho opcional de entrega imediata: Google Apps Script publicado como Web App.
// Sem configuração, o mesmo e-mail segue na fila normal (gatilho de 5 minutos).
export async function triggerRecoveryEmail(env){
  const endpoint=String(env?.PET_MAIL_WEBHOOK_URL||"").trim();
  if(!endpoint||!env?.MAIL_BRIDGE_TOKEN)return false;
  let url;
  try{
    url=new URL(endpoint);
    if(url.protocol!=="https:"||url.hostname!=="script.google.com"||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))throw Error("URL de Apps Script inválida");
    const response=await fetch(url.toString(),{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({acao:"recuperacao",token:env.MAIL_BRIDGE_TOKEN}),
      signal:AbortSignal.timeout(25000)
    });
    if(!response.ok)throw Error("HTTP "+response.status);
    const result=await response.json();
    if(result?.ok!==true)throw Error("Web App não confirmou o acionamento");
    return true;
  }catch(error){
    console.error("Envio imediato de recuperação indisponível; mensagem permanece na fila:",String(error?.message||error).slice(0,180));
    return false;
  }
}
export async function mailAdminAPI(req,env){
  const path=new URL(req.url).pathname, db=env.DB;
  if(path==="/api/admin/mail/events"&&req.method==="GET"){
    const profiles={};
    for(const [tag,name] of Object.entries(MAIL_PROFILES)){
      const events={};
      for(const event of TEMPLATE_EVENTS)events[event]=await eventEnabled(db,tag,event);
      profiles[tag]={nome:name,ativado:await pref(db,tag==="petiano"?"notificacoes_petianos":"notificacoes_visitantes",tag==="petiano"?"nao":"sim")==="sim",eventos:events};
    }
    return reply({ok:true,profiles,tipos:TEMPLATE_TYPES,automaticos:await pref(db,"avisos_email","nao")==="sim"});
  }
  if(path==="/api/admin/mail/events"&&req.method==="POST"){
    let data;try{data=await req.json();}catch{return fail("Dados inválidos.");}
    if(!data||typeof data!=="object"||!data.profiles||typeof data.profiles!=="object")return fail("Preferências inválidas.");
    const statements=[];
    for(const tag of Object.keys(MAIL_PROFILES)){
      const settings=data.profiles[tag];
      if(!settings||typeof settings!=="object")return fail("Informe as preferências para "+MAIL_PROFILES[tag]+".");
      for(const event of TEMPLATE_EVENTS){
        if(typeof settings[event]!=="boolean")return fail("Escolha ativar ou desativar "+TEMPLATE_TYPES[event]+" para "+MAIL_PROFILES[tag]+".");
        statements.push(db.prepare("INSERT INTO configuracoes(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor")
          .bind(emailEventKey(tag,event),settings[event]?"sim":"nao"));
      }
    }
    await db.batch(statements);
    return reply({ok:true,mensagem:"Preferências de e-mail por perfil e tipo salvas."});
  }
  if(path==="/api/admin/mail/templates"&&req.method==="GET"){
    const templates=[];
    for(const event of TEMPLATE_EVENTS)templates.push({evento:event,nome:TEMPLATE_TYPES[event],...await templateFor(db,event)});
    return reply({ok:true,templates,variaveis:["nome","material","quantidade","prazo","registro","link"]});
  }
  if(path==="/api/admin/mail/templates"&&req.method==="POST"){
    let data;
    try{const raw=await req.text();if(raw.length>11000)return fail("Mensagem muito grande.");data=JSON.parse(raw);}
    catch{return fail("Dados inválidos.");}
    if(!Object.hasOwn(TEMPLATE_TYPES,data?.evento))return fail("Modelo de e-mail inválido.");
    let model;try{model=validateTemplate(data.assunto,data.mensagem);}catch(e){return fail(e.message);}
    await db.batch([
      db.prepare("INSERT INTO configuracoes(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind("mail_template_"+data.evento+"_subject",model.assunto),
      db.prepare("INSERT INTO configuracoes(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind("mail_template_"+data.evento+"_body",model.mensagem)
    ]);
    return reply({ok:true,mensagem:"Modelo salvo para os próximos e-mails."});
  }
  if(path==="/api/admin/mail/preview"&&req.method==="GET"){
    const id=Number(new URL(req.url).searchParams.get("id"));
    if(!Number.isSafeInteger(id)||id<1)return fail("Empréstimo inválido.");
    const row=await current(db,id);
    if(!row)return fail("Empréstimo não encontrado.",404);
    if(!await allowed(db,row,"manual"))return fail("A cobrança manual não está permitida para esta pessoa ou tag.",409);
    if(Number(row.sem_prazo)===1||!row.data_devolucao)return fail("Empréstimo sem prazo definido.",409);
    const msg=await content(db,row,"manual");
    return reply({ok:true,id,destinatario:row.email,assunto:msg.subject,mensagem:msg.body});
  }
  if(path==="/api/admin/mail/log"&&req.method==="GET"){
    const history=new URL(req.url).searchParams.get("historico")==="1";
    const items=await rows(db,"SELECT id,reserva_id,evento,destinatario,assunto,origem,situacao,criado_em,enviado_em,ultimo_erro FROM mail_queue "+(history?"":"WHERE situacao IN ('pendente','processando') ")+"ORDER BY id DESC LIMIT 150");
    return reply({ok:true,items,configurado:!!env.MAIL_BRIDGE_TOKEN&&env.MAIL_BRIDGE_TOKEN.length>=32});
  }
  if(path==="/api/admin/mail/queue"&&req.method==="POST"){
    let payload;
    try{payload=await req.json();}catch{return fail("Dados inválidos.");}
    const id=Number(payload?.id);
    if(!Number.isSafeInteger(id)||id<1)return fail("Empréstimo inválido.");
    let custom=null;
    if(payload?.assunto!==undefined||payload?.mensagem!==undefined){
      try{custom=validateTemplate(payload.assunto,payload.mensagem);}
      catch(e){return fail(e.message);}
    }
    const result=await queueManual(db,id,custom);
    return result.ok?reply({ok:true,queued:result.queued,mensagem:result.queued?"Cobrança colocada na fila do Gmail.":"Já existe uma cobrança manual deste empréstimo para hoje."}):fail(result.reason,409);
  }
  if(path==="/api/admin/mail/prepare"&&req.method==="POST"){
    const result=await generateDailyEmails(env);
    return reply(result,result.ok?200:409);
  }
  if(path==="/api/admin/mail/retry"&&req.method==="POST"){
    let data;try{data=await req.json();}catch{return fail("Dados inválidos.");}
    const id=Number(data?.id);
    if(!Number.isSafeInteger(id)||id<1)return fail("E-mail inválido.");
    const pending=await db.prepare("UPDATE mail_queue SET situacao='pendente',processado_em=NULL,token_reserva=NULL,ultimo_erro=NULL,tentativa=0 WHERE id=? AND situacao='erro'").bind(id).run();
    if(pending.meta?.changes!==1)return fail("Este e-mail não está com erro ou já foi reenviado.",409);
    return reply({ok:true,mensagem:"Reenvio colocado na fila. Confira o histórico."});
  }
  if(path==="/api/admin/mail/test"&&req.method==="POST"){
    let data;try{data=await req.json();}catch{return fail("Dados inválidos.");}
    const email=clean(data?.email,180).toLowerCase();
    if(!emailOK(email))return fail("Informe um e-mail válido.");
    const start=new Date(Date.now()-3600000).toISOString();
    const recent=await db.prepare("SELECT COUNT(*) AS n FROM mail_queue WHERE evento='teste' AND criado_em>?").bind(start).first();
    if(Number(recent?.n||0)>=3)return fail("Limite de três testes de e-mail por hora. Aguarde para tentar de novo.",429);
    const stamp=iso(),id=crypto.randomUUID();
    const outcome=await db.prepare("INSERT INTO mail_queue(reserva_id,evento,chave_unica,destinatario,assunto,mensagem,prazo_referencia,origem,criado_em) VALUES(NULL,'teste',?,?,?,?,?,'manual',?)")
      .bind("teste:"+id,email,"Teste de e-mail - Inventário PET Educação","Este é um e-mail de teste solicitado pelo administrador do Inventário PET Educação. O envio pela integração Gmail está funcionando até a etapa de entrega ao serviço de e-mail.\n\nData: "+stamp+"\n\nPET Educação - UFS","",stamp).run();
    return outcome.meta?.changes===1?reply({ok:true,mensagem:"E-mail de teste colocado na fila. Consulte o histórico para confirmar o envio."}):fail("Não foi possível enfileirar o teste.",409);
  }
  if(path==="/api/admin/mail/settings"&&req.method==="POST"){
    let payload;
    try{payload=await req.json();}catch{return fail("Dados inválidos.");}
    const keys=["avisos_email","notificacoes_petianos","notificacoes_visitantes"];
    for(const key of keys)if(!["sim","nao"].includes(payload?.[key]))return fail("Configuração inválida: "+key);
    await db.batch(keys.map(key=>db.prepare("INSERT INTO configuracoes(chave,valor) VALUES(?,?) ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor").bind(key,payload[key])));
    return reply({ok:true});
  }
  return null;
}
export async function mailBridgeAPI(req,env){
  const path=new URL(req.url).pathname;
  if(!["/api/mail/next","/api/mail/ack","/api/mail/status"].includes(path))return null;
  if(!env.MAIL_BRIDGE_TOKEN||String(env.MAIL_BRIDGE_TOKEN).length<32)return fail("Integração Gmail não configurada.",503);
  const expected=await digest("Bearer "+env.MAIL_BRIDGE_TOKEN),received=await digest(req.headers.get("authorization")||"");
  if(expected!==received)return fail("Credencial inválida.",403);
  const db=env.DB;
  if(path==="/api/mail/status" && req.method==="GET")return reply({ok:true,servico:"Gmail bridge",autenticado:true});
  if(path==="/api/mail/next"&&req.method==="GET"){
    const onlyRecovery=new URL(req.url).searchParams.get("tipo")==="recuperacao";
    const deadline=new Date(Date.now()-15*60000).toISOString();
    // Recuperações e avisos da conta compartilham o Apps Script, sem se misturar às cobranças.
    const accountCandidates=await rows(db,"SELECT id,usuario_id,tipo,recovery_hash,destinatario,assunto,mensagem FROM identity_mail_queue WHERE (situacao='pendente' OR (situacao='processando' AND processado_em<?)) "+(onlyRecovery?"AND tipo='recuperacao' ":"")+"ORDER BY id ASC LIMIT 20",[deadline]);
    for(const item of accountCandidates){
      if(item.tipo==="recuperacao"){
        const valid=await db.prepare("SELECT 1 AS n FROM identity_recovery_tokens WHERE hash=? AND usuario_id=? AND usado_em IS NULL AND expira_em>?").bind(item.recovery_hash,item.usuario_id,iso()).first();
        if(!valid){
          await db.prepare("UPDATE identity_mail_queue SET situacao='cancelado',mensagem='',ultimo_erro='Recuperação expirada ou cancelada' WHERE id=? AND situacao IN ('pendente','processando')").bind(item.id).run();
          continue;
        }
      }
      const lock=crypto.randomUUID();
      const marked=await db.prepare("UPDATE identity_mail_queue SET situacao='processando',processado_em=?,token_reserva=?,tentativa=tentativa+1 WHERE id=? AND (situacao='pendente' OR (situacao='processando' AND processado_em<?))").bind(iso(),lock,item.id,deadline).run();
      if(marked.meta?.changes===1)return reply({ok:true,item:{id:"conta-"+item.id,to:item.destinatario,subject:item.assunto,body:item.mensagem,lock}});
    }
    if(onlyRecovery)return reply({ok:true,item:null});
    const candidates=await rows(db,"SELECT id,reserva_id,evento,destinatario,assunto,mensagem,prazo_referencia FROM mail_queue WHERE situacao='pendente' OR (situacao='processando' AND processado_em<?) ORDER BY id ASC LIMIT 20",[deadline]);
    for(const item of candidates){
      const row=item.reserva_id?await current(db,item.reserva_id):null;
      if(!(item.evento==="teste"&&item.reserva_id==null&&emailOK(item.destinatario))&&
        (!row||!await allowed(db,row,item.evento)||row.email!==item.destinatario||row.data_devolucao!==item.prazo_referencia||(item.evento!=="nao_recebido"&&Number(row.sem_prazo)===1))){
        await db.prepare("UPDATE mail_queue SET situacao='cancelado',ultimo_erro='Empréstimo modificado, devolvido ou notificações desativadas' WHERE id=? AND situacao IN ('pendente','processando')").bind(item.id).run();
        continue;
      }
      const lock=crypto.randomUUID();
      const marked=await db.prepare("UPDATE mail_queue SET situacao='processando',processado_em=?,token_reserva=?,tentativa=tentativa+1 WHERE id=? AND (situacao='pendente' OR (situacao='processando' AND processado_em<?))")
        .bind(iso(),lock,item.id,deadline).run();
      if(marked.meta?.changes===1)return reply({ok:true,item:{id:item.id,to:item.destinatario,subject:item.assunto,body:item.mensagem,lock}});
    }
    return reply({ok:true,item:null});
  }
  if(path==="/api/mail/ack"&&req.method==="POST"){
    let b;
    try{b=await req.json();}catch{return fail("Dados inválidos.");}
    const accountId=/^conta-(\d+)$/.exec(String(b?.id||""));
    if(accountId){
      const id=Number(accountId[1]),lock=clean(b?.lock,100);
      if(!Number.isSafeInteger(id)||id<1||!lock)return fail("Confirmação inválida.");
      const sent=b.ok===true;
      const updated=await db.prepare("UPDATE identity_mail_queue SET situacao=?,enviado_em=?,ultimo_erro=?,mensagem='',token_reserva=NULL WHERE id=? AND situacao='processando' AND token_reserva=?")
        .bind(sent?"enviado":"erro",sent?iso():null,sent?null:clean(b.error,250)||"Falha no Gmail",id,lock).run();
      return updated.meta?.changes===1?reply({ok:true}):fail("Confirmação expirada.",409);
    }
    const id=Number(b?.id),lock=clean(b?.lock,100);
    if(!Number.isSafeInteger(id)||id<1||!lock)return fail("Confirmação inválida.");
    const sent=b.ok===true;
    const updated=await db.prepare("UPDATE mail_queue SET situacao=?,enviado_em=?,ultimo_erro=?,token_reserva=NULL WHERE id=? AND situacao='processando' AND token_reserva=?")
      .bind(sent?"enviado":"erro",sent?iso():null,sent?null:clean(b.error,250)||"Falha no Gmail",id,lock).run();
    return updated.meta?.changes===1?reply({ok:true}):fail("Confirmação expirada.",409);
  }
  return fail("Método inválido.",405);
}
