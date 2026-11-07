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
7. **Materiais e Vínculos separados.** Fotos, nome, categoria, patrimônio, estoque, defeitos, permissões e exibição são editados só em Materiais. O formulário individual exibe `Possui vínculo? Sim/Não` derivado do banco, sem ações de gerenciamento. O endpoint de item preserva o vínculo na edição e cria novos componentes avulsos. Só a central **Vínculos**, botão ao lado de Novo material, cria/renomeia/exclui grupos (até vazios) e associa/desassocia componentes por busca e seleção. Um componente pertence a no máximo um vínculo; excluir um vínculo nunca exclui os componentes, fotos, estoques, empréstimos ou histórico. `migrations/0020_central_vinculos.sql` guarda grupos vazios e migra os nomes antigos.
8. **Grupos são apenas apresentação.** Cards agrupados mostram nome do grupo, soma de quantidades/uso/defeitos e **Ver variações** mesmo com um único modelo. Reservas e retiradas sempre exigem escolher o componente específico; os dados individuais nunca se fundem. Grupos vazios não aparecem no catálogo, mas permanecem na central. Busca por grupo/componente no catálogo e no Admin deve mostrar o grupo com todos os vinculados e, separadamente, componentes avulsos compatíveis; sem duplicar. A–Z segue o título do card e ESP32/ESP 32 devem coincidir. Visibilidade tem apenas uma busca e um seletor dinâmico de categorias, independente de empréstimo. Ao selecionar semelhantes (também em Vínculos), todos os marcados devem subir ao topo e permanecer visíveis com filtros ativos; contador acima da lista deve acompanhar as marcações.
8a. **Fotos, filamentos e Excel.** Foto é alterada somente em Materiais, por `public/photo-editor.js` com rotação, arraste, zoom, recorte opcional e saída 4:3, padrão sem cortar. Filamentos continuam no controle próprio, com registro espelhado e empréstimos preservados; não duplicar. O Excel é exportado por `public/excel-export.js` em seis abas via `GET /api/admin/export`, sem CDN nem dados de autenticação. Excel é relatório; backup/restauração continuam usando JSON. A seção Arquivados foi removida; não recriar. Exclusão de categoria requer confirmação e oferece download de backup **opcional** (checkbox desmarcado por padrão), assim como exclusão individual de material e reset de reservas. Não iniciar downloads sem escolha expressa. Se o administrador optar por baixar e o backup falhar, não executar a exclusão.
9. Em Configurações, a limpeza por prazo remove **apenas registros concluídos** (`devolvida`, `recusada`, `cancelada`). A opção explícita de apagar **todas** as reservas tem confirmação escrita, backup anterior e proteção: bloqueie se houver retirada/aprovação ativa, que deve ser encerrada antes. Nunca apague empréstimos ativos em limpeza automática.
10. Notificações internas da conta NÃO são e-mails. Gmail serve para lembretes de devolução e cobrança manual, respeitando situação `retirada`, prazo, e-mail, perfil e autorização individual. A janela “E-mails pendentes” só mostra `pendente`/`processando`; envios confirmados permanecem na base, mas não na janela.
11. A sessão Admin é diferente da conta pessoal PETiane/Visitante. A API `/api/admin/*` exige sessão administrativa autenticada.
12. Não remova, reinicialize ou sobrescreva dados reais de produção para testar interface. Não altere registros de usuários, empréstimos, histórico ou configurações sem pedido claro.
13. Commit no GitHub ≠ site publicado. Confirme que o workflow de deploy da `main` terminou **success** para o mesmo SHA antes de dizer que foi publicado.
14. Ordene cards no catálogo por **título exibido**, após agrupar as variações, para respeitar A–Z/Z–A (ex.: Arduino antes de Pilha Alcalina). Busca de materiais no catálogo e Admin deve aceitar `ESP32` mesmo se o nome salvo for `ESP 32`, ignorando separadores, acentos e caixa. A busca por modelo deve preservar o grupo completo.
15. Alterou fluxo ou infraestrutura? Atualize a Ajuda, o guia técnico e os testes correspondentes na mesma PR.

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
