-- Grupos de apresentação independentes dos materiais.
-- Não altera quantidade, IDs, reservas, fotos nem histórico dos componentes.
CREATE TABLE IF NOT EXISTS grupos_variacoes (
  nome TEXT PRIMARY KEY COLLATE NOCASE,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preserva todos os grupos anteriormente definidos em componentes.
INSERT OR IGNORE INTO grupos_variacoes(nome)
SELECT DISTINCT TRIM(grupo_variacoes)
FROM componentes
WHERE grupo_variacoes IS NOT NULL AND TRIM(grupo_variacoes) <> '';
