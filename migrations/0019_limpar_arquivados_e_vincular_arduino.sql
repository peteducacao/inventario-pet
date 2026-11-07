-- 0019: limpeza solicitada dos materiais arquivados e correção explícita do grupo Arduino.
-- IMPORTANTE: preservar um retrato dos registros removidos DENTRO do D1 (sem publicar
-- dados pessoais no GitHub nem expor o backup em páginas públicas).
-- Um guardião impede a exclusão se houver empréstimo ativo ou filamento ainda vinculado.

CREATE TABLE IF NOT EXISTS limpeza_arquivados_componentes_20261107 AS SELECT * FROM componentes WHERE 0;
CREATE TABLE IF NOT EXISTS limpeza_arquivados_reservas_20261107 AS SELECT * FROM reservas WHERE 0;
CREATE TABLE IF NOT EXISTS limpeza_arquivados_guard_20261107 (quantidade INTEGER NOT NULL CHECK(quantidade=0));

-- Parar antes de qualquer exclusão se o arquivo contiver algo em uso ou referenciado
-- por filamentos ativos. Não apagar histórico de uma retirada ainda aberta.
INSERT INTO limpeza_arquivados_guard_20261107(quantidade)
SELECT COUNT(*) FROM componentes c WHERE c.arquivado=1 AND
  (c.em_uso>0
   OR EXISTS(SELECT 1 FROM reservas r WHERE r.componente_id=c.id AND r.status IN('pendente','aprovada','retirada'))
   OR EXISTS(SELECT 1 FROM filamentos f WHERE f.componente_id=c.id));

-- Cópia reversível de componentes arquivados e de reservas antigas ligadas a eles.
INSERT INTO limpeza_arquivados_componentes_20261107 SELECT * FROM componentes WHERE arquivado=1;
INSERT INTO limpeza_arquivados_reservas_20261107
SELECT r.* FROM reservas r JOIN componentes c ON c.id=r.componente_id WHERE c.arquivado=1;

INSERT INTO historico_admin(responsavel,acao,tipo,descricao)
SELECT 'Organização do inventário','Excluiu materiais arquivados','sistema',
  'Remoção definitiva da lista de arquivados: '||COUNT(*)||
  ' materiais (retratos de recuperação mantidos em tabelas privadas do D1).'
FROM componentes WHERE arquivado=1;

-- Não enviar cobranças associadas a empréstimos que estão sendo retirados.
UPDATE mail_queue SET situacao='cancelado',token_reserva=NULL,
  ultimo_erro='Material arquivado excluído da base'
WHERE reserva_id IN(
  SELECT r.id FROM reservas r JOIN componentes c ON c.id=r.componente_id WHERE c.arquivado=1
) AND situacao IN('pendente','processando');

-- FKs para notificações e e-mails enviados usam ON DELETE SET NULL.
DELETE FROM reservas WHERE componente_id IN (SELECT id FROM componentes WHERE arquivado=1);
DELETE FROM componentes WHERE arquivado=1;
DROP TABLE limpeza_arquivados_guard_20261107;

-- A foto informada indica que Arduino Uno já existe como modelo do grupo Arduino,
-- mas outra ficha Arduino Uno ficou avulsa. Conectar SOMENTE essa ficha explícita,
-- na mesma categoria Robótica e se esse grupo já existir. Estoques continuam distintos.
INSERT INTO historico_admin(responsavel,acao,tipo,descricao)
SELECT 'Organização do inventário','Regularizou vínculo','material',
  'Arduino Uno avulso vinculado ao grupo Arduino: '||COUNT(*)||' material(is)'
FROM componentes c WHERE c.arquivado=0 AND LOWER(TRIM(c.nome))='arduino uno'
  AND TRIM(c.grupo_variacoes)=''
  AND c.categoria_id IN (SELECT id FROM categorias WHERE nome='Robótica')
  AND EXISTS(SELECT 1 FROM componentes x WHERE x.arquivado=0
    AND LOWER(TRIM(x.grupo_variacoes))='arduino' AND LOWER(TRIM(x.nome))='arduino uno');

UPDATE componentes SET grupo_variacoes='Arduino',
  ultima_alteracao=CURRENT_TIMESTAMP,
  ultimo_responsavel='Organização do inventário',
  detalhes_alteracao='Vinculado ao grupo Arduino sem alterar estoque'
WHERE arquivado=0 AND LOWER(TRIM(nome))='arduino uno' AND TRIM(grupo_variacoes)=''
  AND categoria_id IN (SELECT id FROM categorias WHERE nome='Robótica')
  AND EXISTS(SELECT 1 FROM componentes x WHERE x.arquivado=0
    AND LOWER(TRIM(x.grupo_variacoes))='arduino' AND LOWER(TRIM(x.nome))='arduino uno');
