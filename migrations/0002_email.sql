ALTER TABLE reservas ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE reservas ADD COLUMN aviso_atraso_em TEXT;
INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES ('avisos_email','nao');
INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES ('modo_demo','sim');
CREATE INDEX IF NOT EXISTS idx_reserva_atraso ON reservas(status,data_devolucao,aviso_atraso_em);
