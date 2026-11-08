-- A solicitação do visitante não altera status 'retirada' ou estoque.
-- A confirmação física pelo Admin transforma em 'devolvida' e libera o material.
ALTER TABLE reservas ADD COLUMN devolucao_solicitada_em TEXT;
ALTER TABLE reservas ADD COLUMN devolucao_solicitada_observacao TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_reservas_devolucao_solicitada ON reservas(devolucao_solicitada_em) WHERE devolucao_solicitada_em IS NOT NULL;
