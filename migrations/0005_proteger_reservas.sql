DROP TRIGGER IF EXISTS trg_retirada_direta_estoque;
CREATE TRIGGER IF NOT EXISTS trg_retirada_direta_estoque
BEFORE INSERT ON reservas
WHEN NEW.tipo='retirada_direta' AND (
 NEW.usuario_id IS NULL
 OR NEW.status!='retirada'
 OR (SELECT quantidade - em_uso - com_defeito FROM componentes WHERE id=NEW.componente_id)
    - (SELECT COALESCE(SUM(r.quantidade),0) FROM reservas r
       WHERE r.componente_id=NEW.componente_id AND r.status='aprovada'
       AND r.data_inicio<=NEW.data_devolucao AND r.data_devolucao>=NEW.data_inicio)
    < NEW.quantidade
)
BEGIN
 SELECT RAISE(ABORT,'Material indisponivel para retirada direta');
END;