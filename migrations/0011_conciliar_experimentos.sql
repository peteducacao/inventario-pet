-- Conciliação auditável do estoque importado em Experimentos.
-- A regra aprovada é Total=Disponível+Em uso+Defeito; estoque dos experimentos conta como Em uso.
-- NÃO apaga registros originais: guarda snapshot e arquiva duplicatas após somar.
-- Se houver reservas/retiradas ativas no registro de origem, não o altera.
CREATE TABLE IF NOT EXISTS conciliacao_experimentos_backup (
  material_id INTEGER PRIMARY KEY,
  snapshot TEXT NOT NULL,
  registrado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS conciliacao_experimentos_vinculos (
  origem_id INTEGER PRIMARY KEY,
  destino_id INTEGER NOT NULL,
  quantidade_transferida INTEGER NOT NULL,
  defeitos_transferidos INTEGER NOT NULL,
  operacao TEXT NOT NULL CHECK (operacao IN ('unir','mover')),
  registrado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- A fonte reconhecida é a categoria Experimentos e nunca um agrupamento inventado.
-- Os dois lotes de suporte são correspondentes ao mesmo material da Eletrônica.
INSERT OR IGNORE INTO conciliacao_experimentos_vinculos
(origem_id,destino_id,quantidade_transferida,defeitos_transferidos,operacao)
SELECT src.id,COALESCE(dest.id,src.id),src.quantidade,src.com_defeito,
       CASE WHEN dest.id IS NULL THEN 'mover' ELSE 'unir' END
FROM componentes src
JOIN categorias exp ON exp.id=src.categoria_id AND exp.nome='Experimentos'
LEFT JOIN componentes dest
 ON dest.categoria_id=(SELECT id FROM categorias WHERE nome='Eletrônica' AND arquivada=0 LIMIT 1)
 AND dest.arquivado=0
 AND dest.nome=CASE WHEN instr(src.nome,' · lote')>0
              THEN substr(src.nome,1,instr(src.nome,' · lote')-1)
              ELSE src.nome END
WHERE src.arquivado=0
  AND src.import_key LIKE 'IMPORT20261030-M1-%'
  AND NOT EXISTS(
    SELECT 1 FROM reservas r WHERE r.componente_id=src.id
    AND r.status IN ('pendente','aprovada','retirada')
  )
  AND (dest.id IS NULL OR (SELECT COUNT(*) FROM componentes match
       WHERE match.categoria_id=dest.categoria_id AND match.nome=dest.nome
       AND match.arquivado=0)=1);
-- Guardar dados originais de TODOS os registros envolvidos antes de qualquer atualização.
INSERT OR IGNORE INTO conciliacao_experimentos_backup(material_id,snapshot)
SELECT c.id,json_object(
 'id',c.id,'categoria_id',c.categoria_id,'nome',c.nome,
 'quantidade',c.quantidade,'em_uso',c.em_uso,'com_defeito',c.com_defeito,
 'arquivado',c.arquivado,'import_key',c.import_key,
 'patrimonio',c.patrimonio,'identificacao',c.identificacao,
 'ultimo_responsavel',c.ultimo_responsavel,'ultima_alteracao',c.ultima_alteracao,
 'detalhes_alteracao',c.detalhes_alteracao)
FROM componentes c WHERE c.id IN (
  SELECT origem_id FROM conciliacao_experimentos_vinculos
  UNION SELECT destino_id FROM conciliacao_experimentos_vinculos
);
-- Somar cada lote importado ao material já existente em Eletrônica.
UPDATE componentes
SET quantidade=quantidade+(SELECT SUM(v.quantidade_transferida)
  FROM conciliacao_experimentos_vinculos v WHERE v.destino_id=componentes.id AND v.operacao='unir'),
    em_uso=em_uso+(SELECT SUM(v.quantidade_transferida-v.defeitos_transferidos)
  FROM conciliacao_experimentos_vinculos v WHERE v.destino_id=componentes.id AND v.operacao='unir'),
    com_defeito=com_defeito+(SELECT SUM(v.defeitos_transferidos)
  FROM conciliacao_experimentos_vinculos v WHERE v.destino_id=componentes.id AND v.operacao='unir'),
    ultima_alteracao=CURRENT_TIMESTAMP,
    ultimo_responsavel='Conciliação Experimentos',
    detalhes_alteracao='Unificadas quantidades de Experimentos; estoque originário contabilizado em uso'
WHERE id IN (SELECT destino_id FROM conciliacao_experimentos_vinculos WHERE operacao='unir');
-- Material sem correspondente exato: mover para Eletrônica e marcar seu próprio estoque em uso.
UPDATE componentes
SET categoria_id=(SELECT id FROM categorias WHERE nome='Eletrônica' AND arquivada=0 LIMIT 1),
    em_uso=quantidade-com_defeito,
    ultima_alteracao=CURRENT_TIMESTAMP,
    ultimo_responsavel='Conciliação Experimentos',
    detalhes_alteracao='Transferido de Experimentos para Eletrônica; quantidade contabilizada em uso'
WHERE id IN (SELECT origem_id FROM conciliacao_experimentos_vinculos WHERE operacao='mover');
-- Arquivar apenas as origens já somadas, preservando suas referências e o backup.
UPDATE componentes
SET arquivado=1,
    ultima_alteracao=CURRENT_TIMESTAMP,
    ultimo_responsavel='Conciliação Experimentos',
    detalhes_alteracao='Registro de origem preservado e consolidado no estoque de Eletrônica'
WHERE id IN (SELECT origem_id FROM conciliacao_experimentos_vinculos WHERE operacao='unir');
-- Ocultar a categoria só quando nenhum registro ativo ficou pendente de análise.
UPDATE categorias SET arquivada=1,visivel_visitante=0
WHERE nome='Experimentos' AND NOT EXISTS (
 SELECT 1 FROM componentes c WHERE c.categoria_id=categorias.id AND c.arquivado=0
);
INSERT INTO historico_admin(criado_em,responsavel,acao,tipo,descricao)
SELECT CURRENT_TIMESTAMP,'Sistema','Conciliação inicial','sistema',
'Experimentos incorporados ao total e contabilizados em uso; '
|| (SELECT COUNT(*) FROM conciliacao_experimentos_vinculos) || ' registros de origem auditáveis.'
WHERE EXISTS(SELECT 1 FROM conciliacao_experimentos_vinculos);
