ALTER TABLE reservas ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE reservas ADD COLUMN aviso_atraso_em TEXT;
INSERT OR IGNORE INTO configuracoes (chave,valor) VALUES ('avisos_email','nao');
INSERT OR IGNORE INTO configuracoes (chave,valor) VALUES ('modo_demo','sim');