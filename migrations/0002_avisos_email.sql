-- Os campos de e-mail já existem no banco de destino; não recriar colunas.
INSERT OR IGNORE INTO configuracoes (chave,valor) VALUES ('avisos_email','nao');
INSERT OR IGNORE INTO configuracoes (chave,valor) VALUES ('modo_demo','sim');
