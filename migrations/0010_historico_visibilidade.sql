-- Controle de acesso do catálogo e histórico administrativo.
-- Valores existentes continuam públicos até que o administrador escolha ocultá-los.
ALTER TABLE categorias ADD COLUMN visivel_visitante INTEGER NOT NULL DEFAULT 1 CHECK(visivel_visitante IN (0,1));
ALTER TABLE componentes ADD COLUMN visivel_visitante INTEGER NOT NULL DEFAULT 1 CHECK(visivel_visitante IN (0,1));
ALTER TABLE filamentos ADD COLUMN visivel_visitante INTEGER NOT NULL DEFAULT 1 CHECK(visivel_visitante IN (0,1));
ALTER TABLE componentes ADD COLUMN grupo_variacoes TEXT NOT NULL DEFAULT '';
ALTER TABLE categorias ADD COLUMN arquivada INTEGER NOT NULL DEFAULT 0 CHECK(arquivada IN (0,1));

CREATE TABLE IF NOT EXISTS historico_admin (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 responsavel TEXT NOT NULL DEFAULT 'Admin',
 acao TEXT NOT NULL,
 tipo TEXT NOT NULL,
 registro_id INTEGER,
 descricao TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_historico_admin_data ON historico_admin(criado_em DESC,id DESC);
INSERT OR IGNORE INTO configuracoes(chave,valor) VALUES('limpeza_historico','nunca');

-- Sem reclassificar itens nem misturar seus estoques.
-- A aba Experimentos pode ser renomeada manualmente se a equipe decidir.
