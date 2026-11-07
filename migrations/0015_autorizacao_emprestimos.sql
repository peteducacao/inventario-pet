-- Uma única autorização de empréstimo por categoria e por material.
-- A categoria Filamentos integra o catálogo sem misturar ou zerar o estoque existente.
ALTER TABLE categorias ADD COLUMN permitir_emprestimos INTEGER NOT NULL DEFAULT 1 CHECK(permitir_emprestimos IN (0,1));
ALTER TABLE componentes ADD COLUMN permitir_emprestimos INTEGER NOT NULL DEFAULT 1 CHECK(permitir_emprestimos IN (0,1));
ALTER TABLE filamentos ADD COLUMN permitir_emprestimos INTEGER NOT NULL DEFAULT 0 CHECK(permitir_emprestimos IN (0,1));
ALTER TABLE filamentos ADD COLUMN componente_id INTEGER REFERENCES componentes(id);

INSERT OR IGNORE INTO categorias(nome,ordem,visivel_visitante,arquivada,permitir_emprestimos)
 SELECT 'Filamentos',COALESCE(MAX(ordem),0)+1,1,0,0 FROM categorias;
UPDATE categorias SET permitir_emprestimos=0 WHERE nome='Filamentos';

-- Reservas e retiradas continuam usando componentes.id, permitindo reutilizar
-- a segurança de disponibilidade, o histórico, a devolução e a fila de e-mail.
INSERT OR IGNORE INTO componentes(
 categoria_id,nome,imagem,patrimonio,identificacao,quantidade,em_uso,com_defeito,
 mostrar_quantidade,mostrar_em_uso,mostrar_defeito,descricao_defeito,
 ultima_alteracao,ultimo_responsavel,detalhes_alteracao,arquivado,import_key,
 observacoes,unidade,visivel_visitante,grupo_variacoes,permitir_emprestimos)
 SELECT cat.id,'Filamento - '||f.cor,'','','',f.quantidade,0,0,
 1,1,0,'',f.atualizado_em,'Inventário PET','Vínculo de filamento existente',
 0,'FILAMENTO-'||f.id,'','rolos',f.visivel_visitante,'',0
 FROM filamentos f CROSS JOIN categorias cat WHERE cat.nome='Filamentos';
UPDATE filamentos
 SET componente_id=(SELECT c.id FROM componentes c WHERE c.import_key='FILAMENTO-'||filamentos.id)
 WHERE componente_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_filamentos_componentes ON filamentos(componente_id)
 WHERE componente_id IS NOT NULL;
