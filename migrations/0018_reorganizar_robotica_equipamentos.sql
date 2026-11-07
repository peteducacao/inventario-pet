-- Reorganização do catálogo PET Educação (07/11/2026).
-- Eletrônica -> Robótica; notebooks e tablets -> categoria Equipamentos já existente.
-- Preserve os IDs e TODOS os campos de estoque, reserva, patrimônio e autorizações.
-- Não excluir categorias do D1: apenas arquivar as que ficaram vazias.

-- Registrar a mudança nominal antes da troca de nome.
INSERT INTO historico_admin(responsavel,acao,tipo,registro_id,descricao)
SELECT 'Organização do inventário','Reorganizou categoria','categoria',id,
       'Eletrônica passa a ser Robótica; notebooks e tablets passam para Equipamentos'
FROM categorias WHERE nome='Eletrônica' AND arquivada=0;

-- Normalmente o nome Robótica ainda não existe e podemos preservar o ID da categoria.
UPDATE categorias SET nome='Robótica'
WHERE nome='Eletrônica'
  AND NOT EXISTS(SELECT 1 FROM categorias WHERE nome='Robótica');

-- Se alguém já criou Robótica manualmente, reunimos nela os demais materiais
-- de Eletrônica, preservando o ID de cada material e seus empréstimos.
UPDATE componentes
SET categoria_id=(SELECT id FROM categorias WHERE nome='Robótica'),
    ultima_alteracao=CURRENT_TIMESTAMP,
    ultimo_responsavel='Organização do inventário',
    detalhes_alteracao='Categoria: Eletrônica → Robótica'
WHERE categoria_id IN(SELECT id FROM categorias WHERE nome='Eletrônica')
  AND EXISTS(SELECT 1 FROM categorias WHERE nome='Robótica');

-- A categoria de destino já consta da importação oficial, não criar uma segunda.
-- Registrar o total da reclassificação sem incluir nomes ou dados pessoais.
INSERT INTO historico_admin(responsavel,acao,tipo,registro_id,descricao)
SELECT 'Organização do inventário','Reclassificou materiais','categoria',
       (SELECT id FROM categorias WHERE nome='Equipamentos'),
       'Notebooks e tablets reorganizados em Equipamentos ('||COUNT(*)||' itens)'
FROM componentes
WHERE categoria_id IN(SELECT id FROM categorias WHERE nome IN('Tablets','Notebooks'))
   OR (LOWER(nome) LIKE 'tablet%' OR LOWER(nome) LIKE 'notebook%')
     AND categoria_id != (SELECT id FROM categorias WHERE nome='Equipamentos');

-- Reaproveitar os cadastros originais para não perder patrimônio, identificação,
-- imagens, quantidades, unidades com defeito, em uso ou reservas relacionadas.
UPDATE componentes
SET categoria_id=(SELECT id FROM categorias WHERE nome='Equipamentos'),
    ultima_alteracao=CURRENT_TIMESTAMP,
    ultimo_responsavel='Organização do inventário',
    detalhes_alteracao='Categoria: Notebooks/Tablets → Equipamentos'
WHERE categoria_id != (SELECT id FROM categorias WHERE nome='Equipamentos')
  AND (categoria_id IN(SELECT id FROM categorias WHERE nome IN('Tablets','Notebooks'))
       OR LOWER(nome) LIKE 'tablet%'
       OR LOWER(nome) LIKE 'notebook%');

-- As categorias antigas ficam armazenadas no banco para eventual auditoria/backup,
-- mas não aparecem como filtros vazios no catálogo ou no painel de categorias ativas.
UPDATE categorias SET arquivada=1
WHERE nome IN('Tablets','Notebooks','Eletrônica')
  AND NOT EXISTS(SELECT 1 FROM componentes WHERE componentes.categoria_id=categorias.id);
