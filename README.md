# Inventário PET Educação

Projeto do inventário de materiais do PET Educação.

## Infraestrutura
- Interface e API hospedadas em Cloudflare Workers.
- Banco de dados Cloudflare D1 (`inventario-pet`).
- Publicação automática acionada por alterações na branch `main` do GitHub.

## Situação
A página atual é um teste técnico de publicação e conexão ao D1. O inventário completo, o painel e as reservas ainda estão em desenvolvimento.

## Segurança
As credenciais do Cloudflare e do painel são guardadas nos GitHub Actions Secrets e não devem ser publicadas nos arquivos do repositório.
