-- Integração Gmail: fila auditável e preferências de avisos por tag.
-- A reserva sem prazo mantém a data de retirada como valor técnico para respeitar
-- o CHECK legado, mas sem_prazo=1 impede considerar essa data um vencimento.
ALTER TABLE reservas ADD COLUMN sem_prazo INTEGER NOT NULL DEFAULT 0 CHECK(sem_prazo IN (0,1));
ALTER TABLE usuarios ADD COLUMN notificar_email INTEGER NOT NULL DEFAULT 1 CHECK(notificar_email IN (0,1));
INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES('notificacoes_petianos','nao');
INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES('notificacoes_visitantes','sim');

CREATE TABLE IF NOT EXISTS mail_queue (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reserva_id INTEGER REFERENCES reservas(id) ON DELETE SET NULL,
 evento TEXT NOT NULL,
 chave_unica TEXT NOT NULL UNIQUE,
 destinatario TEXT NOT NULL,
 assunto TEXT NOT NULL,
 mensagem TEXT NOT NULL,
 prazo_referencia TEXT NOT NULL DEFAULT '',
 origem TEXT NOT NULL DEFAULT 'automatica' CHECK(origem IN ('automatica','manual')),
 situacao TEXT NOT NULL DEFAULT 'pendente' CHECK(situacao IN ('pendente','processando','enviado','erro','cancelado')),
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 processado_em TEXT,
 enviado_em TEXT,
 tentativa INTEGER NOT NULL DEFAULT 0,
 token_reserva TEXT,
 ultimo_erro TEXT
);
CREATE INDEX IF NOT EXISTS idx_mail_queue_status ON mail_queue(situacao,criado_em);
CREATE INDEX IF NOT EXISTS idx_mail_queue_reserva ON mail_queue(reserva_id,id DESC);
