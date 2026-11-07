# AGENTS.md — Instruções para IAs e mantenedores

> Leia este arquivo antes de editar o projeto. Revisão: 07/11/2026.
> Manual completo: [docs/GUIA_TECNICO.md](docs/GUIA_TECNICO.md). Ajuda para pessoas usuárias: [public/ajuda/index.html](public/ajuda/index.html).

## Projeto e localização
- Inventário PET Educação em produção: https://inventario-pet.pet-educacao.workers.dev
- Repositório: `peteducacao/inventario-pet`; branch publicada: `main`.
- Aplicação sem framework; HTML/CSS/JS estáticos em `public/`, API no Cloudflare Worker (`src/index.js`), dados no Cloudflare D1 (binding `DB`).
- Identidades e autorização: `src/identity.js`; interface: `public/identity-ui.js`.
- Catálogo: `public/index.html`, `public/app.js`, `public/final.js`; Admin: `public/admin-stage.js`; CSS: `public/final.css`.
- Gmail: `src/mail-bridge.js` e `integracoes/AppsScript_Codigo.gs` (Google Apps Script + MailApp).
- Configuração do Worker, D1 e cron: `wrangler.jsonc`; alterações de schema: `migrations/`.
- Deploy: `.github/workflows/deploy.yml`; testes de PR: `.github/workflows/verify.yml`.
- Ajuda: `/ajuda/`, fonte `public/ajuda/index.html` e `public/ajuda/ajuda.css`. O Admin oferece acesso direto e impressão/PDF.

## REGRAS INEGOCIÁVEIS DO PRODUTO
1. **Consultar não é emprestar.** A visibilidade do catálogo (`visivel_visitante`) é distinta da autorização de empréstimo. Bloquear empréstimos NÃO deve esconder automaticamente itens da consulta.
2. O catálogo mantém a ação **Reservar** para Visitantes e **Retirar** para PETianes; a API deve negar uma ação não autorizada. Os seletores de autorização aceitam PETianes, Visitantes, Todos ou Ninguém.
3. A permissão efetiva do perfil depende da **categoria E do item**, campos `permitir_petianos`/`permitir_visitantes`.
4. Visitantes fazem reserva `pendente`; o Admin aprova/recusa. **Aprovar = entregar:** transição direta `pendente -> retirada` e incremento de `em_uso`; nunca exija segunda aprovação/retirada para pedidos novos.
5. PETianes com tag `petiano` registram `retirada_direta` sem aprovação. Titular pode registrar **devolução sem aprovação** pela própria conta, e o Admin também pode fazê-lo. Não permitir devolução duplicada. **Não notificar PETianes no sino sobre a própria devolução**; avisos redundantes antigos de auto-devolução devem ficar ocultos, sem esconder notificações administrativas.
6. Estoque: disponível = `quantidade - em_uso - com_defeito`. Jamais deixe estoque negativo/inconsistente.
7. Filamentos: cada cor tem registro em `filamentos` ligado a `componentes` pela chave `FILAMENTO-<id>`. Preserve vínculo, quantidades e devoluções; não duplique os cadastros. Para renomear o título de uma família de variações (ex.: Alcalina), use `POST /api/admin/variations/rename`, que deve alterar todos os vínculos do grupo sem mudar nomes, fotos, quantidades nem empréstimos individuais; não edite cada material separadamente para renomear apenas o grupo.
8. Exclusão de categoria exige confirmação e backup JSON; a categoria sai da lista ativa, o histórico administrativo registra a exclusão. **Organização do catálogo:** Eletrônica foi renomeada para Robótica; notebooks e tablets pertencem a Equipamentos. Migração 0018 preserva IDs e estoques e arquiva antigas categorias vazias, não as exclui. Não reimportar dados antigos nem recriar essas categorias automaticamente.
9. Em Configurações, a limpeza por prazo remove **apenas registros concluídos** (`devolvida`, `recusada`, `cancelada`). A opção explícita de apagar **todas** as reservas tem confirmação escrita, backup anterior e proteção: bloqueie se houver retirada/aprovação ativa, que deve ser encerrada antes. Nunca apague empréstimos ativos em limpeza automática.
10. Notificações internas da conta NÃO são e-mails. Gmail serve para lembretes de devolução e cobrança manual, respeitando situação `retirada`, prazo, e-mail, perfil e autorização individual. A janela “E-mails pendentes” só mostra `pendente`/`processando`; envios confirmados permanecem na base, mas não na janela.
11. A sessão Admin é diferente da conta pessoal PETiane/Visitante. A API `/api/admin/*` exige sessão administrativa autenticada.
12. Não remova, reinicialize ou sobrescreva dados reais de produção para testar interface. Não altere registros de usuários, empréstimos, histórico ou configurações sem pedido claro.
13. Commit no GitHub ≠ site publicado. Confirme que o workflow de deploy da `main` terminou **success** para o mesmo SHA antes de dizer que foi publicado.
14. Alterou fluxo ou infraestrutura? Atualize a Ajuda, o guia técnico e os testes correspondentes na mesma PR.

## Como modificar com segurança
1. Consulte `AGENTS.md`, `docs/GUIA_TECNICO.md`, o código do recurso, migrações e testes antes de editar.
2. Crie branch e PR; prefira mudanças pequenas. Execute os testes automáticos locais e o workflow de verificação (sem publicar). Depois integre à `main`.
3. Testes principais: `tests/loans-permissions.test.mjs`, `tests/access.test.mjs`, `tests/identity.test.mjs`, `tests/gmail.test.mjs`, `tests/final-ui.test.mjs`, `tests/backup-v2.test.mjs`, `tests/help.test.mjs`.
4. Em alterações do schema, adicione migration incremental em `migrations/`; nunca edite retrospectivamente uma migration já aplicada.
5. Nunca coloque segredos no Git: `ADMIN_PASSWORD`, `MAIL_BRIDGE_TOKEN`, `PET_MAIL_TOKEN`, tokens Cloudflare e cookies. Não inclua dados de usuários ou backups em logs, screenshots ou PDFs públicos.
6. Para testes de e-mail, use mocks, nunca dispare e-mails reais desnecessários. Para testes ao vivo, use dados temporários e verifique que foram eliminados, inclusive reservas.
7. Atenção às rotas protegidas, transações do D1 e estoque. Evite remoção sem backup. Distinguir testes locais, verificação de PR e implantação efetiva.
8. Instruções existentes no código podem ficar obsoletas; quando houver conflito entre texto/documentação e API atual, inspecione a implementação e avise o responsável antes de mudar uma regra.

## Matriz mínima de regressão
- Visitante: conta → reservar → pendente → aprovar/recusar no Admin → retirada imediata na aprovação → devolver no perfil.
- PETiane: tag Admin → retirada direta → devolução no perfil sem Admin.
- Filamento: categoria e cor habilitadas → reservar/retirar → atualizar rolos corretamente.
- Gmail: evento e permissões → fila → Apps Script → ACK → e-mail enviado some dos pendentes, sem apagar registro.
- Reservas: limpeza automática só das concluídas; reset total protegido contra empréstimos ativos e com backup.
- Login Admin protegido na navegação direta; Ajuda pública em `/ajuda/` e menu Ajuda do painel.
