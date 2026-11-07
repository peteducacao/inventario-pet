-- 0021: Inventário sem estado "com defeito".
-- Uma peça descartada sai da quantidade total, nunca entra em Disponível.
-- Histórico de descartes separado, preservando a rastreabilidade.
CREATE TABLE IF NOT EXISTS baixas_estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  componente_id INTEGER NOT NULL,
  quantidade INTEGER NOT NULL CHECK(quantidade > 0),
  origem TEXT NOT NULL,
  registrado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_baixas_estoque_componente ON baixas_estoque(componente_id);

-- Unidades que já estavam marcadas como defeituosas deixam o acervo ativo.
INSERT INTO baixas_estoque(componente_id,quantidade,origem)
SELECT id, com_defeito, 'Conversão do estoque legado (unidades com defeito retiradas do total)'
FROM componentes WHERE com_defeito > 0;
UPDATE componentes
SET quantidade=MAX(em_uso,quantidade-com_defeito),
    com_defeito=0, mostrar_defeito=0, descricao_defeito=''
WHERE com_defeito > 0 OR mostrar_defeito <> 0 OR descricao_defeito <> '';

-- O estoque da cor e o seu componente espelhado devem permanecer idênticos.
UPDATE filamentos
SET quantidade=(SELECT c.quantidade FROM componentes c WHERE c.id=filamentos.componente_id)
WHERE EXISTS(SELECT 1 FROM componentes c WHERE c.id=filamentos.componente_id);

-- "Visitantes" cobre todos os perfis; PETianes é a opção restrita.
-- Estados legados "Ninguém" e "Somente visitantes" viram PETianes ou
-- Visitantes, respectivamente, sem abrir acesso de visitante inesperadamente.
UPDATE categorias
SET permitir_petianos=1,
    permitir_emprestimos=1
WHERE arquivada=0;
UPDATE componentes
SET permitir_petianos=1,
    permitir_emprestimos=1
WHERE arquivado=0;
UPDATE filamentos
SET permitir_petianos=1,
    permitir_emprestimos=1;
