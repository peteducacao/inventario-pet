-- Permissões independentes para retiradas diretas (PETianes) e solicitações
-- de retirada (visitantes). Preserva os bloqueios existentes no deploy.
ALTER TABLE categorias ADD COLUMN permitir_petianos INTEGER NOT NULL DEFAULT 1 CHECK(permitir_petianos IN (0,1));
ALTER TABLE categorias ADD COLUMN permitir_visitantes INTEGER NOT NULL DEFAULT 1 CHECK(permitir_visitantes IN (0,1));
ALTER TABLE componentes ADD COLUMN permitir_petianos INTEGER NOT NULL DEFAULT 1 CHECK(permitir_petianos IN (0,1));
ALTER TABLE componentes ADD COLUMN permitir_visitantes INTEGER NOT NULL DEFAULT 1 CHECK(permitir_visitantes IN (0,1));
ALTER TABLE filamentos ADD COLUMN permitir_petianos INTEGER NOT NULL DEFAULT 0 CHECK(permitir_petianos IN (0,1));
ALTER TABLE filamentos ADD COLUMN permitir_visitantes INTEGER NOT NULL DEFAULT 0 CHECK(permitir_visitantes IN (0,1));
UPDATE categorias SET permitir_petianos=permitir_emprestimos,permitir_visitantes=permitir_emprestimos;
UPDATE componentes SET permitir_petianos=permitir_emprestimos,permitir_visitantes=permitir_emprestimos;
UPDATE filamentos SET permitir_petianos=permitir_emprestimos,permitir_visitantes=permitir_emprestimos;
