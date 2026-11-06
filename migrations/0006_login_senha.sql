-- Acesso por login e senha sem perder usuarios, IDs, tags ou retiradas.
ALTER TABLE usuarios ADD COLUMN login TEXT;
ALTER TABLE usuarios ADD COLUMN password_hash TEXT;
ALTER TABLE usuarios ADD COLUMN password_salt TEXT;
ALTER TABLE usuarios ADD COLUMN password_iterations INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login) WHERE login IS NOT NULL;
