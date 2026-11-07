-- E-mail obrigatório em novos cadastros, reutilizado nos empréstimos.
-- Contas antigas continuam íntegras e podem completar o e-mail em Minha conta.
ALTER TABLE usuarios ADD COLUMN email TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
