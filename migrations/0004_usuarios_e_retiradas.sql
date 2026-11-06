-- Identidade leve, com IDs publicos e sessoes privadas hashadas.
CREATE TABLE IF NOT EXISTS usuarios (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 public_id TEXT NOT NULL UNIQUE,
 nome TEXT NOT NULL,
 papel TEXT NOT NULL DEFAULT 'visitante' CHECK (papel IN ('visitante','petiano')),
 ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
 recovery_hash TEXT NOT NULL,
 criado_em TEXT NOT NULL,
 atualizado_em TEXT NOT NULL,
 ultimo_acesso TEXT
);
CREATE TABLE IF NOT EXISTS usuario_sessoes (
 hash TEXT PRIMARY KEY,
 usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 expira_em TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usuarios_nome ON usuarios(nome);
CREATE INDEX IF NOT EXISTS idx_usuarios_papel ON usuarios(papel,ativo);
CREATE INDEX IF NOT EXISTS idx_usuario_sessoes_owner ON usuario_sessoes(usuario_id,expira_em);
ALTER TABLE reservas ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id);
ALTER TABLE reservas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'reserva' CHECK (tipo IN ('reserva','retirada_direta'));
CREATE INDEX IF NOT EXISTS idx_reservas_usuario ON reservas(usuario_id,status);
-- Nao permitir retiradas sem estoque suficiente mesmo em acessos simultaneos.
CREATE TRIGGER IF NOT EXISTS trg_retirada_direta_estoque
BEFORE INSERT ON reservas
WHEN NEW.tipo='retirada_direta' AND
 (SELECT quantidade - em_uso - com_defeito FROM componentes WHERE id=NEW.componente_id) < NEW.quantidade
BEGIN SELECT RAISE(ABORT,'Estoque insuficiente para retirada'); END;
