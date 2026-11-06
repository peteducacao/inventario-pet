-- Notificações discretas, persistidas apenas para o titular da conta.
CREATE TABLE IF NOT EXISTS notificacoes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 reserva_id INTEGER REFERENCES reservas(id) ON DELETE SET NULL,
 titulo TEXT NOT NULL,
 mensagem TEXT NOT NULL DEFAULT '',
 tipo TEXT NOT NULL DEFAULT 'info',
 criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 lida_em TEXT
);
CREATE INDEX IF NOT EXISTS idx_notificacoes_user ON notificacoes(usuario_id,criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_unread ON notificacoes(usuario_id,lida_em);
