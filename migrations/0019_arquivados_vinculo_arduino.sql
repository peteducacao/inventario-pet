-- Reorganização final de famílias e remoção definitiva da seção Arquivados.
-- NÃO remover materiais com empréstimos/reservas ativos ou filamentos ainda cadastrados.
-- Preserve IDs, quantidades, patrimônios e estoques dos materiais restantes.
-- A migration D1 é executada uma única vez no deploy.

-- Itens arquivados ainda referenciados por empréstimos ativos ou cores de filamento
-- deixam o arquivo e permanecem íntegros para permitir devolver o empréstimo.
UPDATE componentes SET arquivado=0
WHERE arquivado=1 AND (
  em_uso>0
  OR EXISTS(SELECT 1 FROM reservas r WHERE r.componente_id=componentes.id
    AND r.status IN ('pendente','aprovada','retirada'))
  OR EXISTS(SELECT 1 FROM filamentos f WHERE f.componente_id=componentes.id)
);

-- Auditoria sem expor dados pessoais.
INSERT INTO historico_admin(responsavel,acao,tipo,registro_id,descricao)
SELECT 'Organização do inventário','Limpou materiais arquivados','sistema',NULL,
       'Excluiu '||COUNT(*)||' material(is) arquivado(s) sem reservas ativas. Itens com empréstimos ativos foram preservados.'
FROM componentes WHERE arquivado=1
HAVING COUNT(*)>0;

-- Cancelar cobranças ainda pendentes de registros que deixarão de existir.
UPDATE mail_queue SET situacao='cancelado',token_reserva=NULL,
  ultimo_erro='Material arquivado removido do inventário'
WHERE situacao IN ('pendente','processando') AND reserva_id IN(
  SELECT r.id FROM reservas r JOIN componentes c ON c.id=r.componente_id
  WHERE c.arquivado=1
);

-- Eliminar exclusivamente reservas já encerradas ligadas aos itens arquivados.
-- Historico administrativo fica no banco; notificações e e-mails enviados
-- conservam o texto e perdem somente o vínculo (FK ON DELETE SET NULL).
DELETE FROM reservas WHERE componente_id IN (SELECT id FROM componentes WHERE arquivado=1);
DELETE FROM componentes WHERE arquivado=1;

-- Correção pontual do vínculo relatado na interface:
-- se o grupo Arduino já existe e um Arduino Uno foi criado sem família,
-- agregá-lo ao grupo SEM fundir IDs, estoques ou empréstimos.
INSERT INTO historico_admin(responsavel,acao,tipo,registro_id,descricao)
SELECT 'Organização do inventário','Corrigiu vínculo de grupo','material',c.id,
       'Arduino Uno → grupo Arduino; patrimônio e estoque individuais preservados'
FROM componentes c
WHERE c.arquivado=0 AND LOWER(TRIM(c.nome))='arduino uno'
  AND (c.grupo_variacoes IS NULL OR TRIM(c.grupo_variacoes)='')
  AND EXISTS(SELECT 1 FROM componentes x WHERE x.arquivado=0
    AND LOWER(TRIM(x.grupo_variacoes))='arduino');

UPDATE componentes SET grupo_variacoes='Arduino',
  ultima_alteracao=CURRENT_TIMESTAMP,
  ultimo_responsavel='Organização do inventário',
  detalhes_alteracao='Vínculo ao grupo Arduino corrigido'
WHERE arquivado=0 AND LOWER(TRIM(nome))='arduino uno'
  AND (grupo_variacoes IS NULL OR TRIM(grupo_variacoes)='')
  AND EXISTS(SELECT 1 FROM componentes x WHERE x.arquivado=0
    AND LOWER(TRIM(x.grupo_variacoes))='arduino');
