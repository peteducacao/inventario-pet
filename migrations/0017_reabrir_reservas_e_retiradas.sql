-- Reativar reservas de visitantes e retiradas diretas de PETianes em todo o acervo ativo.
-- Nao altera estoque, emprestimos, datas, visibilidade ou historico.
-- Filamentos e seus componentes vinculados recebem as mesmas permissoes.

UPDATE categorias
SET permitir_emprestimos=1, permitir_petianos=1, permitir_visitantes=1
WHERE arquivada=0;

UPDATE componentes
SET permitir_emprestimos=1, permitir_petianos=1, permitir_visitantes=1
WHERE arquivado=0
  AND categoria_id IN (SELECT id FROM categorias WHERE arquivada=0);

UPDATE filamentos
SET permitir_emprestimos=1, permitir_petianos=1, permitir_visitantes=1
WHERE componente_id IN (SELECT id FROM componentes WHERE arquivado=0);
