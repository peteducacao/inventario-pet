/**
 * Inventário PET Educação — Gmail (Google Apps Script)
 * Nenhuma senha é escrita neste arquivo.
 *
 * Em Configurações do projeto > Propriedades do script, adicionar:
 * PET_SITE_URL = https://inventario-pet.pet-educacao.workers.dev
 * PET_MAIL_TOKEN = mesmo valor secreto de MAIL_BRIDGE_TOKEN no Cloudflare
 */
// Execute uma única vez, copie o token do registro de execução e guarde-o
// também como segredo MAIL_BRIDGE_TOKEN no Cloudflare. Não compartilhe o token.
function gerarTokenPET() {
  const props=PropertiesService.getScriptProperties();
  let token=props.getProperty("PET_MAIL_TOKEN");
  if(!token){
    token=Utilities.getUuid().replace(/-/g,"")+Utilities.getUuid().replace(/-/g,"");
    props.setProperty("PET_MAIL_TOKEN",token);
  }
  Logger.log("Copie esta chave para MAIL_BRIDGE_TOKEN no Cloudflare: "+token);
  return "Chave salva nas propriedades do script.";
}

function configuracaoPET_() {
  const props = PropertiesService.getScriptProperties();
  const url = (props.getProperty("PET_SITE_URL") || "").replace(/\/+$/, "");
  const token = props.getProperty("PET_MAIL_TOKEN") || "";
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(url) || token.length < 32) {
    throw new Error("Preencha PET_SITE_URL e PET_MAIL_TOKEN nas propriedades do script.");
  }
  return { url: url, token: token };
}

function chamadaPET_(caminho, dados) {
  const c = configuracaoPET_();
  const opcoes = {
    method: dados === undefined ? "get" : "post",
    muteHttpExceptions: true,
    headers: { Authorization: "Bearer " + c.token },
    contentType: "application/json"
  };
  if (dados !== undefined) opcoes.payload = JSON.stringify(dados);
  const resposta = UrlFetchApp.fetch(c.url + caminho, opcoes);
  const texto = resposta.getContentText();
  let obj;
  try { obj = JSON.parse(texto); } catch (e) {
    throw new Error("Resposta inesperada do Inventário: HTTP " + resposta.getResponseCode());
  }
  if (resposta.getResponseCode() < 200 || resposta.getResponseCode() >= 300) {
    throw new Error("Inventário HTTP " + resposta.getResponseCode() + ": " + (obj.error || "erro"));
  }
  return obj;
}

function testarConexaoPET() {
  const status = chamadaPET_("/api/mail/status");
  Logger.log("Conexão autenticada: " + JSON.stringify(status));
  return status;
}

function processarFilaPET() {
  const mutex = LockService.getScriptLock();
  if (!mutex.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    for (let i = 0; i < 10; i++) {
      const retorno = chamadaPET_("/api/mail/next");
      const item = retorno.item;
      if (!item) break;
      const chave = "enviado_" + item.id;
      try {
        if (props.getProperty(chave) !== "sim") {
          if (MailApp.getRemainingDailyQuota() < 1) {
            Logger.log("Limite diário de Gmail atingido. Nova tentativa no próximo acionamento.");
            break; // A reserva expira após 15 minutos; ainda não enviamos.
          }
          MailApp.sendEmail({
            to: item.to,
            subject: item.subject,
            body: item.body,
            name: "PET Educação - Inventário"
          });
          // Evita reenviar se o reconhecimento ao Worker falhar.
          props.setProperty(chave, "sim");
        }
        chamadaPET_("/api/mail/ack", { id: item.id, lock: item.lock, ok: true });
        props.deleteProperty(chave);
        Logger.log("E-mail #" + item.id + " enviado e confirmado.");
      } catch (erro) {
        Logger.log("Falha no e-mail #" + item.id + ": " + String(erro));
        if (props.getProperty(chave) !== "sim") {
          try {
            chamadaPET_("/api/mail/ack", {
              id: item.id, lock: item.lock, ok: false, error: String(erro).slice(0, 200)
            });
          } catch (falhaAck) {
            Logger.log("Falha ao registrar erro: " + String(falhaAck));
          }
        }
        break;
      }
    }
  } finally {
    mutex.releaseLock();
  }
}

function instalarGatilhoPET() {
  testarConexaoPET();
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === "processarFilaPET"; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("processarFilaPET").timeBased().everyMinutes(5).create();
  Logger.log("Gatilho de 5 em 5 minutos instalado.");
}
