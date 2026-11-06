-- Filamentos cadastrados por cor e quantidade, sem emprestimos ou patrimonio.
CREATE TABLE IF NOT EXISTS filamentos (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 cor TEXT NOT NULL COLLATE NOCASE UNIQUE,
 hexadecimal TEXT NOT NULL CHECK (length(hexadecimal)=7 AND substr(hexadecimal,1,1)='#'),
 quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0 AND quantidade <= 1000000),
 ordem INTEGER NOT NULL DEFAULT 0,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_filamentos_ordem ON filamentos(ordem,cor);
