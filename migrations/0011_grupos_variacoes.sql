-- Agrupamentos opcionais de modelos/valores sem mesclar os estoques existentes.
CREATE TABLE IF NOT EXISTS grupos_variacoes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 nome TEXT NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 100),
 descricao TEXT NOT NULL DEFAULT '',
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE componentes ADD COLUMN grupo_variacao_id INTEGER REFERENCES grupos_variacoes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_componentes_grupo_variacao ON componentes(grupo_variacao_id);
-- Nenhum componente é agrupado automaticamente: a vinculação exige confirmação no Admin.
