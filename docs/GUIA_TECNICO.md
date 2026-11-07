# Guia técnico e operacional — Inventário PET Educação
**Revisão:** 07/11/2026  
**Destinatários:** gestão do PET Educação, colaboradores, desenvolvedores e agentes de IA  
**Produção:** https://inventario-pet.pet-educacao.workers.dev  
**Código:** https://github.com/peteducacao/inventario-pet

> Este documento descreve a arquitetura verificada no repositório. Para instruções simplificadas e versão imprimível/PDF, visite [/ajuda/](https://inventario-pet.pet-educacao.workers.dev/ajuda/). Para restrições obrigatórias a IAs, leia [../AGENTS.md](../AGENTS.md) antes de qualquer alteração.

## 1. Componentes e responsabilidades

| Componente | Responsabilidade | Onde conferir |
|---|---|---|
| GitHub `peteducacao/inventario-pet` | Código, branches, PRs, histórico e GitHub Actions | `.github/workflows/` |
| Cloudflare Workers | Hospeda API e conteúdo web; executa cron de manutenção e agendamento de avisos | `src/index.js`, `wrangler.jsonc` |
| Cloudflare D1 | Dados de categorias, materiais, filamentos, reservas, usuários, sessões, logs e fila Gmail | `migrations/`, binding `DB` |
| Assets estáticos | Catálogo, painel Admin, telas de login e Ajuda | `public/` |
| Google Apps Script | Consulta fila autenticada e envia pelo Gmail usando `MailApp.sendEmail` | `integracoes/AppsScript_Codigo.gs` |
| GitHub Actions | Verificação pré-merge e deploy em `main`, migrações e testes de produção | `verify.yml`, `deploy.yml` |

O projeto usa JavaScript sem framework para o navegador. `src/index.js` exporta as entradas `fetch` e `scheduled` do Worker. URLs fora de `/api/` são entregues pelos assets do Cloudflare. URLs de API são processadas pela aplicação, sob autenticação conforme o caso.

### 1.1 Configuração `wrangler.jsonc`
- `name`: `inventario-pet`, `main`: `src/index.js`.
- `assets.directory`: `./public`; `assets.binding`: `ASSETS`; `run_worker_first`: `/api/*`.
- `d1_databases`: binding `DB`, database `inventario-pet`, `migrations_dir`: `migrations`.
- Crons: `* * * * *` (limpeza rápida quando o teste de 1 minuto está ativo) e `0 12 * * *` (rotina de avisos/limpeza). O agendamento é executado pela infraestrutura Cloudflare, em UTC; a lógica de datas de devolução usa `America/Sao_Paulo`. Cron que prepara e-mail **não é** o gatilho do Apps Script que realmente envia.

**Arquivos fundamentais da API:** `src/index.js` (roteamento e inventário), `src/identity.js` (contas, sessão, retiradas e devoluções) e `src/mail-bridge.js` (Gmail, filas, preferências e modelos de e-mail).

## 2. Mapa de arquivos

```text
AGENTS.md                         Regras permanentes para IAs e contribuidores
README.md                         Visão inicial e links para os manuais
wrangler.jsonc                     Worker, assets, D1 e cron
.github/workflows/deploy.yml       Build/testes/migrations/publicação no Cloudflare
.github/workflows/verify.yml       Verificação de PR sem mutações no D1 de produção
public/
  index.html                       Catálogo público
  admin/index.html                 Rota direta do Admin
  emprestimos/index.html           Área de empréstimos do usuário
  app.js                           Estado comum, fetch, modais e UI base
  final.js                         Catálogo moderno, menu e cards
  admin-stage.js                   Abas, controles e operações administrativas
  identity-ui.js                   Conta, tag, retiradas e devoluções
  component-art.js                 Ilustrações dos materiais
  final.css                        Layout responsivo
  ajuda/index.html                 Manual para consulta e impressão/PDF
  ajuda/ajuda.css                  Layout da ajuda e estilos @media print
src/
  index.js                         API e regras do inventário / Admin / agendamento
  identity.js                      Cadastro, login, PETianes, notificações e devolução
  mail-bridge.js                   Fila, regras e endpoints Gmail
migrations/                        Evolução incremental do schema D1
integracoes/AppsScript_Codigo.gs   Programa do Google Apps Script, sem credenciais
tests/                             Testes de estoque, permissões, fluxo, UI, Gmail e ajuda
docs/GUIA_TECNICO.md               Este guia
```

## 3. Modelo de dados e invariantes

| Tabela | Responsabilidade |
|---|---|
| `categorias` | Nome, ordenação, visibilidade e permissões por perfil |
| `componentes` | Materiais, fotos, família, quantidade, `em_uso`, `com_defeito`, permissões |
| `filamentos` | Cor, hexadecimal, rolos, permissões e vínculo com `componentes` |
| `reservas` | Reserva visitante ou retirada direta, datas, quantidade, status, vínculo à conta |
| `usuarios` / `usuario_sessoes` | Conta e sessão de usuário; papel `visitante` ou `petiano` |
| `admin_sessions` | Sessões administrativas independentes da conta do usuário |
| `notificacoes` | Avisos internos visíveis no sino e em Meus empréstimos |
| `mail_queue` | Fila e histórico técnico das mensagens Gmail, com status e confirmação |
| `configuracoes` | Preferências, prazo de limpeza e avisos |
| `historico_admin` | Rastreabilidade das ações administrativas |

**Disponibilidade:** `MAX(0, quantidade - em_uso - com_defeito)`, descontadas as reservas aprovadas que incidam sobre as datas consultadas, conforme regra específica da API.

**Permissões:** `visivel_visitante` é só consulta/visibilidade. `permitir_petianos` e `permitir_visitantes` autorizam retirada/reserva; precisam ser `1` em **categoria e componente**. O seletor oferece PETianes, Visitantes, Todos e Ninguém; não vincule a autorização à visibilidade. Não use o campo legado `permitir_emprestimos` isoladamente como substituto dos dois campos de perfil.

**Filamentos:** cada `filamentos.id` aponta para `filamentos.componente_id`, cujo registro `componentes.import_key` é `FILAMENTO-<id>`. Isso permite que todas as rotas de empréstimo e devolução operem sobre um único estoque por cor. Preserve o material espelho e não o duplique pelo editor comum.

**Arquivo/exclusão:** arquivar um material não apaga seu histórico. Excluir categoria tem confirmação textual, gera backup no navegador e remove seus materiais conforme lógica administrativa. Não suponha que deletar uma categoria possa ser desfeito sem o JSON guardado.

### Reorganização do catálogo (07/11/2026)
A migration `migrations/0018_reorganizar_robotica_equipamentos.sql` renomeia **Eletrônica** para **Robótica** e transfere os notebooks e tablets (incluindo os registros originalmente nas categorias **Tablets** e **Notebooks**) para a categoria **Equipamentos**, já existente. A migração conserva o identificador dos materiais, patrimônio, identificações, quantidade total, em uso, defeitos, reservas e permissões individuais. As categorias que ficaram vazias são **arquivadas**, não excluídas, e a ação é registrada no histórico administrativo. Não criar uma nova categoria Eletrônica nem duplicar tablets/notebooks. O catálogo também restaura o filtro “Todos” quando um filtro persistido se referir a uma categoria que deixou de aparecer.

### Materiais: cadastro, fotos e visibilidade
O editor `itemEditor` de `public/app.js` é exclusivo para **materiais**. Mantém nome, categoria, quantidades, unidades, identificação, patrimônio, defeitos, empréstimos e visibilidade; salva fotos somente nesta área. O campo **Possui vínculo?** é informativo (Sim/Não), derivado de `grupo_variacoes`. Não há seletor de vínculos ou botão para alterá-los no formulário. A API `POST /api/admin/item` ignora o campo `grupo_variacoes` fornecido pelo editor: ao editar preserva o grupo salvo, ao cadastrar usa vazio; apenas os endpoints de vínculos alteram esse campo.

A foto escolhida no formulário abre o editor em `public/photo-editor.js`, carregado antes de `app.js`. Permite girar, arrastar, ampliar/reduzir e escolher a apresentação completa ou com recorte. A saída padronizada é 4:3 (padrão 720×540, redimensionada/comprimida progressivamente se necessário), com fundo branco, preservando a proporção. Modo inicial: foto inteira sem corte. A prévia no editor usa `object-fit: contain`, assim como o catálogo; somente após clicar **Usar esta foto** a imagem é colocada no formulário, e a API só recebe a imagem ao **Salvar alterações**. O editor nunca muda fotos em Vínculos. A compressão mantém o limite de foto do D1/API; validar na rede móvel e em imagens verticais.

A janela **Visibilidade** tem uma única busca e um único filtro de categoria, que recebe todas as categorias ativas automaticamente. Seus checkboxes selecionam apenas os materiais que serão alterados; a etiqueta informa a visibilidade já salva, independentemente do checkbox. **Selecionar resultados** marca itens da busca atual; **Desmarcar todos** limpa a seleção. A permissão de empréstimo continua separada da visibilidade.

### Central exclusiva de Vínculos
Na aba **Materiais**, o botão **Vínculos** aparece ao lado de **Novo material**. Abre `openLinksHub` em `public/admin-stage.js`, com busca e CRUD de grupos. `migrations/0020_central_vinculos.sql` cria `grupos_variacoes` para persistir inclusive grupos **vazios** e migra nomes antigos presentes em `componentes.grupo_variacoes` sem tocar nos materiais. A central consulta `GET /api/admin/state`, que inclui `grupos_variacoes`. `POST /api/admin/variation-groups` aceita `acao=criar|renomear|excluir`: excluir grupo retira os vínculos de seus componentes, nunca exclui os componentes, fotos, quantidades, empréstimos ou reservas. O endpoint antigo de renomeação continua compatível.

Ao abrir um grupo, `openVariantLinker` mostra a lista **Já vinculados** (botão **Retirar**) e a lista **Adicionar componentes** (pesquisa, **Sugerir semelhantes**, **Selecionar resultados**, **Desmarcar todos**, **Vincular selecionados**). Não cadastra material, não altera fotos, patrimônio, estoque ou qualquer outro campo além do vínculo. Cada material pode pertencer a um grupo apenas (a coluna string `grupo_variacoes` evita dupla contagem); mover um item de outro grupo exige confirmação. `POST /api/admin/variations` vincula/desvincula os IDs indicados sem alterar qualquer estoque.

O catálogo (`public/final.js`) e o painel agrupam os membros vinculados em um card cujo título é o nome do grupo, **inclusive com um único componente**. **Ver variações** permite identificar e selecionar o modelo exato para reservar ou retirar; o agrupamento só soma os indicadores visuais. Componentes não vinculados aparecem como materiais individuais. Grupo vazio existe em Vínculos, mas não cria card no catálogo. Busca por `Arduino` exibe o card do grupo Arduino com os vinculados e, separadamente, quaisquer outros Arduinos não vinculados; nunca duplica um componente. A ordem A–Z compara o título dos cards exibidos.

### Exportar todo o inventário em Excel
A aba Materiais tem botão **Baixar inventário em Excel (.xlsx)**. `GET /api/admin/export` exige sessão Admin e retorna todas as reservas/movimentações (sem limite de 1500), categorias, componentes, grupos e filamentos, sem contas/senhas/sessões. `public/excel-export.js` constrói XLSX Office Open XML no navegador **sem CDN** e sem subir os dados para terceiros, com seis abas: **Resumo, Materiais, Vínculos, Categorias, Estoque e Movimentações**. Os textos são exportados como texto (sem interpretação como fórmulas), colunas têm larguras apropriadas, cabeçalhos coloridos, filtros e primeira linha congelada. Para backup de restauração, usar o JSON de Configurações: Excel é relatório, não substitui o backup.

### Exclusão e proteção do inventário
A seção Arquivados não é apresentada. Excluir materiais permanece uma ação separada, com confirmação e backup JSON antes da exclusão, e empréstimos ativos bloqueiam a exclusão. Excluir um grupo de vínculo é diferente: nunca apaga o material. Nenhum fluxo de visibilidade, vínculo ou edição fotográfica altera quantidades, usuários, reservas, devoluções, permissões ou registros de cobrança.

### Busca e ordenação do catálogo
O catálogo público (`public/final.js`) agrupa os materiais por `grupo_variacoes` **antes da ordenação A–Z ou Z–A**. A função `orderedCatalogGroups` compara o título **mostrado no card** (`grupo_variacoes`, ou `nome` do item avulso), preservando a paginação e a escolha do modelo. A pesquisa utiliza `matchesCatalogSearch`, que ignora diacríticos, diferenças entre maiúsculas/minúsculas e separadores (por exemplo `ESP32`, `ESP 32`, `ESP-32`). A mesma normalização é usada na busca da aba Materiais do Admin (`public/admin-stage.js`). Pesquisar um modelo não pode desmontar uma família nem omitir seus irmãos vinculados.

## 4. Fluxos reais de empréstimo e devolução

### Visitante
1. Registra conta própria com e-mail válido, login e senha, ou entra em conta existente.
2. Solicita em `POST /api/reservations`, que verifica identidade, disponibilidade, perfil, categoria e item.
3. `reservas.status = pendente`, aguardando intervenção administrativa.
4. Admin usa `POST /api/admin/reservation` `acao=aprovar` ou `acao=recusar`.
5. **Aprovar e entregar** converte direto para `retirada`, registra datas, responsável e aumenta `componentes.em_uso`. É proibido forçar uma segunda operação de retirada em reservas novas.
6. A própria conta pode devolver pelo `POST /api/my/return`; Admin também pode devolver. Registrar defeitos ajusta `com_defeito`.

### PETiane
1. Tag `petiano` é atribuída pelo Admin em `Usuários`. Sessão pessoal e e-mail devem estar válidos.
2. `POST /api/member/withdraw` registra `tipo=retirada_direta` e status `retirada` imediatamente, sem aprovação.
3. `POST /api/my/return` ou `/api/member/return` registra devolução do titular, sem segunda aprovação.

### Estados e abas
- `pendente` → Pendentes.
- `retirada` → Ativas, ou Atrasadas se vencida com prazo.
- `devolvida`, `recusada`, `cancelada` → Concluídas.
- Todas é **filtro combinado**; não é uma tabela independente. A exclusão de um registro concluído faz ele sumir de Concluídas e também de Todas.
- `aprovada` é estado legado que pode ser regularizado e não deve ser criado por aprovações novas.

## 5. Administração e principais APIs

**Entradas**: `/admin/` (página independente), `/api/login` (sessão Admin), `/api/logout`. Todas as rotas `/api/admin/*` exigem sessão válida; a sessão pessoal é outra.

**Catálogo e estoque**: `GET /api/catalog`, `GET /api/availability`, `GET /api/filaments`; Admin: `/api/admin/state`, `/api/admin/item`, `/api/admin/category`, `/api/admin/filaments`, `/api/admin/visibility`, `/api/admin/item/loans`, `/api/admin/variations`.

**Aba Usuários:** a API `/api/admin/users` devolve `usuarios` e os totais `totais.todos`, `totais.petiano`, `totais.visitante`, calculados no D1. O painel possui três cartões contadores clicáveis; PETianes e Visitantes são separados por títulos numa única lista vertical, preservando busca e ações individuais. Alterações de tag e exclusões devem atualizar esses totais na próxima consulta.

**Contas, movimentações e avisos**: `/api/identity/register`, `/api/identity/login`, `/api/identity/me`, `/api/my/loans`, `/api/notifications`, `/api/member/withdraw`, `/api/my/return`; `/api/admin/users`, `/api/admin/reservation`.

**Limpeza**:
- `POST /api/admin/settings`: configura `limpeza_reservas` (nunca, 1 minuto para teste ou N dias).
- `POST /api/admin/cleanup`: elimina somente **concluídas** que alcançaram o prazo: devolvidas (pela data de devolução, com fallback), recusadas/canceladas (por data de solicitação, pois o schema atual não guarda o timestamp próprio de recusa); preserva ativas e pendentes.
- `POST /api/admin/reservations/reset`: ação explícita de **apagar todos os registros de reservas**, com confirmação textual no Admin, backup JSON anterior no navegador. A API **recusa a limpeza total se existir `retirada` ou `aprovada` ativa**; primeiro registre a devolução/regularize a situação. Ela cancela avisos em fila associados, desvincula os registros de e-mails enviados (preservando seu histórico), remove notificações relacionadas e depois apaga reservas, sem mexer no estoque de empréstimos ativos.
- Não confundir limpeza de `reservas` com a retenção do `historico_admin`, configurada separadamente.

**Backup**: `GET /api/admin/backup` produz JSON `inventario-pet-v2` com categorias, materiais, filamentos, reservas, configurações, histórico e conciliações. **Não exporta senhas nem contas completas**, que permanecem no banco. `POST /api/admin/restore` pode substituir dados de inventário e deve ser tratado como operação sensível.

## 6. Gmail: arquitetura, regras e diagnóstico

### Fluxo
```text
Cloudflare cron de avisos → src/mail-bridge.js (validação)
  → D1: mail_queue (pendente)
  → Apps Script processarFilaPET (gatilho de 5 em 5 minutos, configurado pelo responsável)
  → GET /api/mail/next (Bearer token)
  → MailApp.sendEmail no Google
  → POST /api/mail/ack (sucesso ou erro)
  → D1: mail_queue.enviado / erro
```

**Eventos previstos:** `antes` (véspera), `hoje` (dia), `atraso2`, `atraso7`, `manual`. O fluxo exige status `retirada`, e-mail válido, devolução com prazo, permissão de usuário e da tag, e configuração do evento. Visitantes são elegíveis por padrão; PETianes ficam desabilitados por padrão. A condição geral `avisos_email` regula a geração automática. Para manual é necessário autorização do evento manual.

**Modelos editáveis:** `GET/POST /api/admin/mail/templates`; variáveis `{nome}`, `{material}`, `{quantidade}`, `{prazo}`, `{registro}`, `{link}`. A prévia `GET /api/admin/mail/preview?id=<id>` não envia nada. O admin edita o texto de cobrança antes de `POST /api/admin/mail/queue`; há controle de duplicidade diária.

**Fila de pendentes:** `GET /api/admin/mail/log` retorna somente status `pendente` e `processando` para a janela, embora os enviados permaneçam em `mail_queue` no D1. O Apps Script consulta `/api/mail/next` e confirma com `/api/mail/ack`; mensagens deixam de ser válidas se o empréstimo já foi devolvido, mudou a data ou perdeu autorização. Mensagens concluídas continuam no banco para rastreabilidade.

**Notificações internas:** aprovação, recusa e devolução administrativas podem criar avisos para a conta vinculada. **Exceção:** a devolução realizada pelo próprio PETiane em `/api/my/return` ou `/api/member/return` não cria notificação de confirmação, pois a ação já foi confirmada na interface. O endpoint `/api/notifications` também oculta de contas PETianes as antigas mensagens de auto-devolução com o título e texto originais, sem excluir registros do banco ou esconder mensagens de administração. O Gmail, no código atual, **não** envia automaticamente confirmações transacionais de reserva, aprovação, recusa ou devolução.

### Configurar ou reparar sem vazar segredos
1. Cloudflare Worker: verifique a existência de `MAIL_BRIDGE_TOKEN` nos secrets do Worker e de `ADMIN_PASSWORD`, sem ler/copiar os valores para tickets.
2. Google Apps Script: projeto com código de `integracoes/AppsScript_Codigo.gs`, propriedades `PET_SITE_URL` (URL HTTPS do Worker) e `PET_MAIL_TOKEN` (mesmo segredo do Worker), nunca compartilhadas.
3. Execute `testarConexaoPET` e confira o log sem divulgar tokens.
4. Execute `instalarGatilhoPET` **uma vez quando necessário**; a função remove gatilhos anteriores da mesma função e cria um a cada 5 minutos.
5. Confira as execuções do Apps Script, a quota diária e as permissões de `MailApp`, além da configuração no Admin e do status `retirada` com data.
6. `GET /api/mail/status` requer Bearer secreto e serve para diagnóstico; **não o exponha numa página pública**.

## 7. Publicação, migração e segurança

### Fluxo seguro de mudanças
1. Crie branch a partir da `main` atual.
2. Implemente a menor alteração possível e teste sem dados reais.
3. Para mudanças no D1, adicione nova migration em `migrations/`. **Não altere uma migração aplicada** para esperar que ela rode de novo.
4. Abra PR; `.github/workflows/verify.yml` roda testes e não publica nem aplica alterações ao banco remoto.
5. Integre à `main` somente com testes revisados; `deploy.yml` instala Wrangler, testa, aplica migrations ao D1 remoto e publica.
6. Verifique que o workflow completo finalizou `success` e corresponde ao SHA da `main`. Um arquivo alterado no GitHub pode não estar publicado se o deploy falhar.
7. Valide no site a rota e o fluxo afetados. Para Ajuda, teste `/ajuda/`, menu Admin e impressão do navegador.

### Segredos e dados pessoais
- Credenciais e tokens ficam nos Secrets do Cloudflare, propriedades privadas do Apps Script e Secrets do GitHub Actions quando aplicável.
- Nunca os coloque em `public/`, no README, em issues/PRs, em logs de teste ou PDFs.
- Sessão administrativa e sessão pessoal usam cookies independentes, seguros, HttpOnly.
- Nunca publique backup de produção: pode conter nomes, e-mails de reservas e observações.
- Não execute comandos de limpeza/destruição em D1 remoto sem pedido explícito, backup confirmado e plano de recuperação.
- Para interagir com sistemas externos, respeite permissões e necessidade de confirmação do responsável.

## 8. Testes e manutenção

Scripts de teste em `tests/` cobrem identidades, reservas, permissões, estoque de filamentos, Gmail, backup e interface. Com Node 22, dependências de teste e repositório acessível, execute conforme o workflow `verify.yml`.

Exemplos:
```bash
node --check src/index.js
node --check public/admin-stage.js
node --disable-warning=ExperimentalWarning tests/loans-permissions.test.mjs
node --disable-warning=ExperimentalWarning tests/identity.test.mjs
node --disable-warning=ExperimentalWarning tests/gmail.test.mjs
node --disable-warning=ExperimentalWarning tests/access.test.mjs
node tests/final-ui.test.mjs
node tests/help.test.mjs
```

Os testes que usam `jsdom` requerem essa dependência no ambiente. Não teste exclusões ou disparos reais de Gmail em produção. Se precisar de smoke test ao vivo, os dados temporários devem ser removidos ao final e o processo deve checar isso explicitamente.

## 9. Problemas comuns

| Sintoma | Verificação sugerida |
|---|---|
| Material visível, botão indisponível | Autorização por **categoria + material + perfil**, não visibilidade |
| Reserva pendente não aparece | Login pessoal, e-mail, API `/api/reservations` e filtro Pendentes |
| Aprovação não baixa estoque | Fluxo `/api/admin/reservation` `aprovar` precisa transicionar direto para `retirada` |
| PETiane não consegue retirar | Tag ativa, senha definitiva, e-mail, estoque, permissão do item e categoria |
| Filamento tem estoque duplicado | Conferir vínculo `FILAMENTO-<id>` entre `filamentos` e `componentes` |
| “Todas” ainda lista registros concluídos | “Todas” inclui os mesmos registros de Concluídas; verifique prazo/status e execução da limpeza |
| E-mail não chegou | Tipo de evento, tag, data, fila, trigger Apps Script, quota Gmail, logs |
| E-mail enviado ainda aparece como pendente | Checar ACK `/api/mail/ack` e a API `/api/admin/mail/log` |
| Admin pede login fora de contexto | Verifique cookie e rota `/admin/`, sem substituir identidade pessoal |
| Alteração no Git não refletiu | Confirmar deploy completo do SHA da `main`, conferir cache e assets |
| PDF fica com menus/botões | Use `/ajuda/` → Imprimir / salvar PDF; `@media print` esconde navegação |

## 10. Como entregar o projeto a outra pessoa ou IA
Compartilhe o repositório (não credenciais). Peça que leia **AGENTS.md → este guia → código e migrations pertinentes → testes**; registre o problema, limite o escopo e exija teste antes de publicar. A operação do Cloudflare e do Google depende de contas e permissões reais: não presuma que ter acesso ao GitHub dá acesso ao D1 remoto ou ao Gmail. Antes de qualquer mudança potencialmente destrutiva, peça backup e aprovação.

**Manutenção da documentação:** manter este arquivo, `AGENTS.md` e a Central de Ajuda sincronizados com mudanças funcionais.
