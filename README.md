# Inventário PET Educação

Sistema web para gestão de materiais, equipamentos e filamentos do PET Educação, com catálogo, contas pessoais, reservas, retiradas, devoluções, estoque, painel administrativo, notificações e lembretes por Gmail.

**Site em produção:** https://inventario-pet.pet-educacao.workers.dev  
**Central de Ajuda (inclui impressão/salvar PDF):** https://inventario-pet.pet-educacao.workers.dev/ajuda/

## Instalar como aplicativo

Abra o site, entre em **Minha conta** e escolha **Baixar aplicativo**. É um PWA instalável no Android e em computadores compatíveis (Chrome ou Edge), e pode ser adicionado à tela inicial pelo Safari no iPhone. Não instala APK/EXE separado e as reservas continuam dependentes da conexão à internet. O cache guarda somente arquivos estáticos públicos; dados pessoais e APIs não são armazenados.

No catálogo, o selo é **Disponível** se há alguma unidade livre e **Sem estoque** quando esgotado; os contadores Quantidade, Em uso e Disponível permanecem. Sem estoque, não é possível reservar nem retirar.

## Documentação

- **[Central de Ajuda](public/ajuda/index.html)** — manual de uso e administração, telas, reservas, devoluções, filamentos, Gmail, backup, Cloudflare e dúvidas frequentes. Abra `/ajuda/` no site para imprimir ou salvar em PDF. Também pode ser consultado na aba **Ajuda** do Admin.
- **[Guia técnico detalhado](docs/GUIA_TECNICO.md)** — arquitetura, modelo de dados, arquivos, Cloudflare Workers/D1, regras de API, GitHub Actions, Gmail/Apps Script, testes, diagnóstico e rotina segura de manutenção.
- **[Instruções obrigatórias para IAs e colaboradores](AGENTS.md)** — regras para futuras alterações, segurança de dados, permissões, estoque, Gmail, deploy e limpeza.
- **[Apps Script do Gmail](integracoes/AppsScript_Codigo.gs)** — código da ponte de envio; configurar os segredos exclusivamente no ambiente privado da conta Google e do Worker.

> **Quem for transferir o projeto a outra pessoa ou IA:** comece com `AGENTS.md`, depois `docs/GUIA_TECNICO.md`, `wrangler.jsonc`, `src/`, `public/`, `migrations/` e `tests/`. Nunca compartilhe segredos ou backups com dados pessoais em canais públicos.

## Infraestrutura

- **Cloudflare Workers** hospeda a API e os arquivos da interface.
- **Cloudflare D1** guarda o inventário, usuários, reservas, histórico e fila de e-mails.
- **GitHub** gerencia código e versões. `.github/workflows/verify.yml` valida PRs sem publicação; `.github/workflows/deploy.yml` publica alterações integradas à branch `main`, após testes e migrações.
- **Google Apps Script + Gmail** envia e-mails enfileirados pela API, conforme os prazos e preferências. A criação da reserva e as mudanças de estado usam principalmente notificações internas; não espere e-mail para todas as operações.

## Regras que precisam ser preservadas

- **Consultar não é emprestar**: visibilidade e autorização de reserva/retirada são controles separados.
- **Visitantes reservam**, e o Admin aprova ou recusa. **Aprovar já registra a retirada** e atualiza o estoque.
- **PETianes retiram e devolvem diretamente**; o titular de uma retirada também pode registrar devolução pela própria conta.
- Filamentos são itens emprestáveis por cor, com estoque próprio e material de inventário vinculado.
- Limpeza automática remove só **reservas concluídas** dentro do prazo definido. O reset manual **apaga todos os registros**, exige backup e confirmação, e **não funciona enquanto houver empréstimos ativos**, para proteger o estoque.
- A janela “E-mails pendentes” só exibe mensagens não enviadas; o histórico técnico de mensagens enviadas permanece no banco.

## Segurança

Senhas administrativas, tokens do Gmail, chaves da Cloudflare e cookies de sessão **não devem ser adicionados a arquivos do repositório nem expostos em PDFs, prints ou logs**. Não reinicialize o banco remoto para corrigir um bug de interface e não anuncie publicação sem confirmar o resultado do GitHub Actions.
