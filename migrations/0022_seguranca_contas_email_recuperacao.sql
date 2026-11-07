-- Cadastro, recuperação por e-mail e avisos de segurança para contas pessoais.
-- Não modificar, excluir nem mesclar cadastros antigos com e-mails duplicados.
-- Os gatilhos impedem novos conflitos, mesmo que existam duplicações legadas.
CREATE INDEX IF NOT EXISTS idx_usuarios_email_normalizado ON usuarios(lower(trim(email))) WHERE trim(email)<>'';
CREATE TRIGGER IF NOT EXISTS trg_usuarios_email_unico_insert
BEFORE INSERT ON usuarios
WHEN trim(NEW.email)<>'' AND EXISTS(
  SELECT 1 FROM usuarios WHERE lower(trim(email))=lower(trim(NEW.email))
)
BEGIN SELECT RAISE(ABORT,'EMAIL_JA_CADASTRADO'); END;
CREATE TRIGGER IF NOT EXISTS trg_usuarios_email_unico_update
BEFORE UPDATE OF email ON usuarios
WHEN trim(NEW.email)<>'' AND lower(trim(NEW.email))<>lower(trim(OLD.email))
AND EXISTS(SELECT 1 FROM usuarios WHERE id<>OLD.id AND lower(trim(email))=lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT,'EMAIL_JA_CADASTRADO'); END;

CREATE TABLE IF NOT EXISTS identity_recovery_tokens (
 hash TEXT PRIMARY KEY,
 usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 criado_em TEXT NOT NULL,
 expira_em TEXT NOT NULL,
 usado_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_identity_recovery_user ON identity_recovery_tokens(usuario_id,criado_em DESC);

CREATE TABLE IF NOT EXISTS identity_mail_queue (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
 tipo TEXT NOT NULL CHECK(tipo IN ('recuperacao','aviso')),
 recovery_hash TEXT,
 destinatario TEXT NOT NULL,
 assunto TEXT NOT NULL,
 mensagem TEXT NOT NULL,
 situacao TEXT NOT NULL DEFAULT 'pendente' CHECK(situacao IN ('pendente','processando','enviado','erro','cancelado')),
 criado_em TEXT NOT NULL,
 processado_em TEXT,
 enviado_em TEXT,
 tentativa INTEGER NOT NULL DEFAULT 0,
 token_reserva TEXT,
 ultimo_erro TEXT
);
CREATE INDEX IF NOT EXISTS idx_identity_mail_queue_status ON identity_mail_queue(situacao,criado_em);
