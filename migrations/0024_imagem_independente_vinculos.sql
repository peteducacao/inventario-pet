-- Foto de apresentação própria do vínculo, independente dos materiais.
-- Por padrão, grupos não herdam a foto de nenhum componente.
ALTER TABLE grupos_variacoes ADD COLUMN imagem TEXT NOT NULL DEFAULT '';
ALTER TABLE grupos_variacoes ADD COLUMN imagem_componente_id INTEGER;
