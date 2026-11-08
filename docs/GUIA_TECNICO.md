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

**Contas e recuperação (nov/2026):** cadastro exige e-mail exclusivo (comparação sem distinção entre maiúsculas/minúsculas); a migração `0022_seguranca_contas_email_recuperacao.sql` acrescenta gatilhos que protegem novos cadastros e alterações sem modificar e-mails repetidos eventualmente existentes. A senha pode ser livremente escolhida (1–2.048 caracteres), com indicação fraca/média/forte e confirmação consciente da senha fraca, sem 2FA obrigatório. Ao entrar, a janela de login fecha e a pessoa volta ao catálogo, sem abrir automaticamente Minha conta. O cargo é retornado pela API de login e sincronizado com `GET /api/identity/me` ao voltar à guia; o botão manual de atualizar cargo foi removido de ambos os modelos de perfil. Só o Admin altera o cargo. Contas com senha temporária devem concluir a troca obrigatória antes de editar o nome, além de continuar sem permissão para retiradas. A alteração do e-mail exige a senha atual, encerra sessões anteriores e avisa o endereço antigo. A sessão pessoal nova vale 30 dias; o acesso Admin é independente.

**Recuperação por e-mail:** `POST /api/identity/recover` recebe `{email}` e responde sempre a mesma mensagem, exista ou não uma conta; pedidos para a mesma conta têm intervalo de 15 minutos e IP limitado. A API cria segredo aleatório de 256 bits, armazena seu SHA-256 em `identity_recovery_tokens` e enfileira link no `identity_mail_queue` usando Apps Script já configurado (`processarFilaPET`). Expira em 30 minutos, é consumido uma única vez por `POST /api/identity/reset-by-email`, revoga sessões e avisa a conta. A fila de identidade usa IDs `conta-*`, separados de `mail_queue` das cobranças. Links expirados são descartados; conteúdo do e-mail é limpo após confirmação. A página de redefinição usa fragmento `#redefinir=...` retirado da URL antes de completar o pedido. Nunca logar ou publicar esse segredo. Sem integração Gmail operacional, o usuário deve pedir redefinição ao Admin, e a equipe deve investigar a fila.

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
  identity-ui.js                   Conta, cargo, retiradas e devoluções
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

**Disponibilidade:** `MAX(0, quantidade - em_uso)`, descontadas as reservas aprovadas que incidam sobre as datas consultadas, conforme regra específica da API.

**Permissões:** `visivel_visitante` é só consulta/visibilidade. `permitir_petianos` e `permitir_visitantes` autorizam retirada/reserva; precisam ser `1` em **categoria e componente**. O seletor oferece somente **PETianes** (restrito) e **Visitantes** (todos, inclusive PETianes); não vincule a autorização à visibilidade. Não use o campo legado `permitir_emprestimos` isoladamente como substituto dos dois campos de perfil.

**Filamentos:** cada `filamentos.id` aponta para `filamentos.componente_id`, cujo registro `componentes.import_key` é `FILAMENTO-<id>`. Isso permite que todas as rotas de empréstimo e devolução operem sobre um único estoque por cor. Preserve o material espelho e não o duplique pelo editor comum.

**Arquivo/exclusão:** arquivar um material não apaga seu histórico. Excluir categoria tem confirmação textual, gera backup no navegador e remove seus materiais conforme lógica administrativa. Não suponha que deletar uma categoria possa ser desfeito sem o JSON guardado.

### Reorganização do catálogo (07/11/2026)
A migration `migrations/0018_reorganizar_robotica_equipamentos.sql` renomeia **Eletrônica** para **Robótica** e transfere os notebooks e tablets (incluindo os registros originalmente nas categorias **Tablets** e **Notebooks**) para a categoria **Equipamentos**, já existente. A migração conserva o identificador dos materiais, patrimônio, identificações, quantidade total, em uso, defeitos, reservas e permissões individuais. As categorias que ficaram vazias são **arquivadas**, não excluídas, e a ação é registrada no histórico administrativo. Não criar uma nova categoria Eletrônica nem duplicar tablets/notebooks. O catálogo também restaura o filtro “Todos” quando um filtro persistido se referir a uma categoria que deixou de aparecer.

### Materiais: cadastro, fotos e visibilidade
O editor `itemEditor` de `public/app.js` é exclusivo para **materiais**. Mantém nome, categoria, quantidades, unidades, identificação, patrimônio, empréstimos e visibilidade; salva fotos somente nesta área. O campo **Possui vínculo?** é informativo (Sim/Não), derivado de `grupo_variacoes`. Não há seletor de vínculos ou botão para alterá-los no formulário. A API `POST /api/admin/item` ignora o campo `grupo_variacoes` fornecido pelo editor: ao editar preserva o grupo salvo, ao cadastrar usa vazio; apenas os endpoints de vínculos alteram esse campo.

A foto escolhida no formulário abre o editor em `public/photo-editor.js`, carregado antes de `app.js`. Permite girar, arrastar, ampliar/reduzir e escolher a apresentação completa ou com recorte. A saída padronizada é 4:3 (padrão 720×540, redimensionada/comprimida progressivamente se necessário), com fundo branco, preservando a proporção. Modo inicial: foto inteira sem corte. A prévia no editor usa `object-fit: contain`, assim como o catálogo; somente após clicar **Usar esta foto** a imagem é colocada no formulário, e a API só recebe a imagem ao **Salvar alterações**. O editor nunca muda fotos em Vínculos. A compressão mantém o limite de foto do D1/API; validar na rede móvel e em imagens verticais.

A janela **Visibilidade** tem uma única busca e um único filtro de categoria, que recebe todas as categorias ativas automaticamente. Seus checkboxes selecionam apenas os materiais que serão alterados; a etiqueta informa a visibilidade já salva, independentemente do checkbox. Após usar **Selecionar semelhantes**, os materiais marcados sobem ao topo, continuam visíveis mesmo quando se altera a busca/filtro e aparecem destacados com o total selecionado acima da lista; o contador também muda ao marcar/desmarcar manualmente. **Selecionar resultados** marca itens da busca atual; **Desmarcar todos** limpa a seleção. A permissão de empréstimo continua separada da visibilidade.

### Central exclusiva de Vínculos
Na aba **Materiais**, o botão **Vínculos** aparece ao lado de **Novo material**. Abre `openLinksHub` em `public/admin-stage.js`, com busca e CRUD de grupos. `migrations/0020_central_vinculos.sql` cria `grupos_variacoes` para persistir inclusive grupos **vazios** e migra nomes antigos presentes em `componentes.grupo_variacoes` sem tocar nos materiais. A central consulta `GET /api/admin/state`, que inclui `grupos_variacoes`. `POST /api/admin/variation-groups` aceita `acao=criar|renomear|excluir`: excluir grupo retira os vínculos de seus componentes, nunca exclui os componentes, fotos, quantidades, empréstimos ou reservas. O endpoint antigo de renomeação continua compatível.

Ao abrir um grupo, `openVariantLinker` mostra a lista **Já vinculados** (botão **Retirar**) e a lista **Adicionar componentes** (pesquisa, **Sugerir semelhantes**, **Selecionar resultados**, **Desmarcar todos**, **Vincular selecionados**). Depois de **Selecionar semelhantes** (ou marcar manualmente), todos os candidatos selecionados sobem para o início da lista, ficam destacados e o contador **N materiais selecionados** é atualizado em tempo real, mesmo com busca ativa. Nenhum candidato marcado fica oculto pelo limite de resultados. Não cadastra material, não altera fotos, patrimônio, estoque ou qualquer outro campo além do vínculo. Cada material pode pertencer a um grupo apenas (a coluna string `grupo_variacoes` evita dupla contagem); mover um item de outro grupo exige confirmação. `POST /api/admin/variations` vincula/desvincula os IDs indicados sem alterar qualquer estoque.

Somente o catálogo público (`public/final.js`) agrupa os membros vinculados em um card cujo título é o nome do grupo, **inclusive com um único componente**. A aba **Materiais do Admin não agrupa**: mostra todos os componentes em uma única lista individual, inclusive os vinculados, com botões próprios de ver, editar, excluir e controle de empréstimos. A pesquisa no Admin é por nome/identificação/patrimônio do componente, sem grupos e sem o botão **Ver variações**. **Ver variações** permite identificar e selecionar o modelo exato para reservar ou retirar; o agrupamento só soma os indicadores visuais. Componentes não vinculados aparecem como materiais individuais. Grupo vazio existe em Vínculos, mas não cria card no catálogo. No catálogo público, buscar `Arduino` exibe o card do grupo Arduino com os vinculados e, separadamente, quaisquer outros Arduinos não vinculados; nunca duplica um componente. No Admin, a mesma busca exibe Arduino Uno, Nano etc. **diretamente como linhas editáveis**, tenham vínculo ou não. A ordem A–Z compara o título dos cards exibidos.

### Exportar todo o inventário em Excel
A Ajuda aparece como aba do painel Admin, e não no menu público do inventário. A página `/ajuda/` permanece um recurso estático acessível por URL direta, portanto não é uma barreira de autenticação.\n\nA aba Materiais tem botão **Baixar inventário em Excel (.xlsx)**. `GET /api/admin/export` exige sessão Admin e retorna todas as reservas/movimentações (sem limite de 1500), categorias, componentes, grupos e filamentos, sem contas/senhas/sessões. `public/excel-export.js` constrói XLSX Office Open XML no navegador **sem CDN** e sem subir os dados para terceiros, com seis abas: **Resumo, Materiais, Vínculos, Categorias, Estoque e Movimentações**. Os textos são exportados como texto (sem interpretação como fórmulas), colunas têm larguras apropriadas, cabeçalhos coloridos, filtros e primeira linha congelada. Para backup de restauração, usar o JSON de Configurações: Excel é relatório, não substitui o backup.

### Proteção do saldo contra empréstimos em aberto
Ao editar um material existente, o servidor consulta a soma de `reservas.quantidade` dos registros em status `retirada`. Se o campo `Em uso` informado for menor, bloqueia a alteração com HTTP 409 e mantém os dados anteriores. Isso evita que a devolução fique impossível após alguém reduzir manualmente o estoque ocupado. O editor mantém a possibilidade de cadastrar quantidades em uso pré-existentes não vinculadas a contas.

### Exclusão e proteção do inventário
A seção Arquivados não é apresentada. Excluir materiais permanece uma ação separada, com confirmação e **opção** de baixar backup JSON antes da exclusão, e empréstimos ativos bloqueiam a exclusão. A opção de backup inicia desmarcada; sem selecioná-la, nenhuma janela força um download. O mesmo vale para exclusão de categoria com seus materiais e para apagar todas as reservas (que continua exigindo confirmação escrita). Quando o administrador opta pelo backup e não é possível prepará-lo, a exclusão não é executada. Excluir um grupo de vínculo é diferente: nunca apaga o material. Nenhum fluxo de visibilidade, vínculo ou edição fotográfica altera quantidades, usuários, reservas, devoluções, permissões ou registros de cobrança.

### Busca e ordenação do catálogo
O catálogo público (`public/final.js`) agrupa os materiais por `grupo_variacoes` **antes da ordenação A–Z ou Z–A**. A função `orderedCatalogGroups` compara o título **mostrado no card** (`grupo_variacoes`, ou `nome` do item avulso), preservando a paginação e a escolha do modelo. A pesquisa utiliza `matchesCatalogSearch`, que ignora diacríticos, diferenças entre maiúsculas/minúsculas e separadores (por exemplo `ESP32`, `ESP 32`, `ESP-32`). A mesma normalização é usada na busca da aba Materiais do Admin (`public/admin-stage.js`), mas o Admin **não exibe famílias/grupos**: filtra e mostra componentes individuais para edição. No catálogo público, pesquisar um modelo não pode desmontar uma família nem omitir seus irmãos vinculados.

## 4. Fluxos reais de empréstimo e devolução

### Visitante
1. Registra conta própria com e-mail válido, login e senha, ou entra em conta existente.
2. Solicita em `POST /api/reservations`, que verifica identidade, disponibilidade, perfil, categoria e item.
3. `reservas.status = pendente`, aguardando intervenção administrativa.
4. Admin usa `POST /api/admin/reservation` `acao=aprovar` ou `acao=recusar`.
5. **Aprovar e entregar** converte direto para `retirada`, registra datas, responsável e aumenta `componentes.em_uso`. É proibido forçar uma segunda operação de retirada em reservas novas.
6. Visitantes solicitam devolução pelo `POST /api/my/return`; o empréstimo e o estoque permanecem ativos até o Admin confirmar pela rota `/api/admin/reservation` (`acao=devolver`). O Admin também pode indicar não recebimento (`acao=cancelar_solicitacao_devolucao`) para permitir nova solicitação. Na interface de confirmação administrativa, a decisão é apenas **Recebido** ou **Não recebido**, sem campo de descarte ou observações. O POST de confirmação envia somente `acao=devolver` e usa zero descartes como padrão; a API conserva compatibilidade técnica com clientes antigos. `com_defeito` permanece coluna técnica legada zerada.

### PETiane
1. Cargo `petiano` é atribuído pelo Admin em `Usuários`. Sessão pessoal e e-mail devem estar válidos.
2. `POST /api/member/withdraw` registra `tipo=retirada_direta` e status `retirada` imediatamente, sem aprovação.
3. PETianes usam `POST /api/my/return` ou `/api/member/return` para concluir a própria devolução diretamente, sem segunda aprovação.

### Robustez de operações simultâneas
Confirmações do Admin podem ocorrer com outra guia aberta ou o mesmo botão acionado em dois dispositivos. Os `UPDATE` da reserva e do componente são executados no mesmo `DB.batch` transacional e vinculados a `status` e `changes()=1`: um segundo envio com informação desatualizada retorna **409** sem duplicar `Em uso`, sem devolver material de outro empréstimo, sem subtrair filamento e sem notificar novamente. A recusa também verifica o status atual. A devolução direta de PETiane preserva o mesmo bloqueio, inclusive ao descartar rolos. O teste adversarial em `tests/loans-permissions.test.mjs` simula uma leitura antiga da reserva antes da decisão.

### Estados e abas
- `pendente` → Pendentes.
- `retirada` → Ativas, ou Atrasadas se vencida com prazo.
- `devolvida`, `recusada`, `cancelada` → Concluídas.
- Todas é **filtro combinado**; não é uma tabela independente. A exclusão de um registro concluído faz ele sumir de Concluídas e também de Todas.
- `aprovada` é estado legado que pode ser regularizado e não deve ser criado por aprovações novas.

**Histórico e empréstimos abertos:** o Admin mantém todas as reservas com status diferente de `devolvida`, `recusada` e `cancelada`, e até 1.500 concluídas recentes. `GET /api/my/loans` e `GET /api/member/history` também preservam todos os empréstimos abertos, limitando apenas os concluídos mais recentes (250 e 300, respectivamente). Assim, o histórico volumoso nunca oculta uma retirada que ainda precisa de devolução. Há teste de regressão com 1.510 conclusões fictícias em D1 local.

## 5. Administração e principais APIs

**Entradas**: `/admin/` (página independente), `/api/login` (sessão Admin), `/api/logout`. Todas as rotas `/api/admin/*` exigem sessão válida; a sessão pessoal é outra.

**Sessão Admin ao fechar o navegador:** a API emite `__Host_pet_session` com `Secure`, `HttpOnly` e `SameSite=Strict`, sem `Max-Age` ou `Expires`, para que ele seja eliminado quando a sessão do navegador terminar. Ao consultar `/api/admin/state`, cookies antigos também são convertidos para esse formato, sem ampliar seu limite de 12 horas no D1. Fechar apenas uma aba não encerra a sessão, e navegadores com restauração de abas podem também restaurar cookies de sessão; o botão Sair da administração revoga o token no servidor imediatamente. A conta pessoal mantém sua autenticação independente.

**Catálogo e estoque**: `GET /api/catalog`, `GET /api/availability`, `GET /api/filaments`; Admin: `/api/admin/state`, `/api/admin/item`, `/api/admin/category`, `/api/admin/filaments`, `/api/admin/visibility`, `/api/admin/item/loans`, `/api/admin/variations`.

**Aba Usuários:** a API `/api/admin/users` devolve `usuarios` e os totais `totais.todos`, `totais.petiano`, `totais.visitante`, calculados no D1. O painel possui três cartões contadores clicáveis; PETianes e Visitantes são separados por títulos numa única lista vertical, preservando busca e ações individuais. O campo `retiradas_ativas` inclui **todos os empréstimos em status `retirada`**, tanto retiradas diretas de PETianes quanto reservas de visitantes aprovadas pelo Admin. Alterações de cargo e exclusões devem atualizar os indicadores na próxima consulta.

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

**Fila e histórico:** `GET /api/admin/mail/log` mantém a resposta padrão só para `pendente`/`processando`; `GET /api/admin/mail/log?historico=1` inclui os mais recentes `enviado`, `erro`, `cancelado` para diagnóstico. o envio diagnóstico `POST /api/admin/mail/test` permanece disponível tecnicamente para manutenção autorizada, mas não possui mais botão no painel; `POST /api/admin/mail/prepare` prepara lembretes ao comando do administrador. `POST /api/admin/mail/retry` reabre somente e-mails em situação `erro` para nova tentativa controlada, sem criar segunda mensagem; a consulta `/api/mail/next` revalida as condições de entrega e pode cancelar caso a reserva tenha mudado. O Apps Script consulta `/api/mail/next` e confirma com `/api/mail/ack`; mensagens deixam de ser válidas se o empréstimo já foi devolvido, mudou a data ou perdeu autorização. Mensagens concluídas continuam no banco para rastreabilidade.

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

**Gatilho imediato de recuperação:** ao solicitar senha, a API sempre enfileira o link com validade de 30 minutos. Se o segredo opcional `PET_MAIL_WEBHOOK_URL` apontar para o URL `/exec` do Google Apps Script publicado como Aplicativo da Web, o Worker aciona `doPost` em segundo plano autenticado com `MAIL_BRIDGE_TOKEN`; o script lê exclusivamente a fila de recuperação e confirma o envio com o ACK padrão. É necessário atualizar o código do Apps Script, publicar uma implantação acessível por HTTPS e cadastrar `PET_MAIL_WEBHOOK_URL` como segredo no Cloudflare. Sem isso, ou se houver falha, a recuperação permanece na fila que o gatilho periódico do Apps Script consulta a cada 5 minutos. Não confundir resposta de solicitação recebida com e-mail efetivamente entregue.

**Agendamento de lembretes:** com `avisos_email=sim`, o Worker prepara eventos em um cron a cada 15 minutos (além do cron diário de manutenção) e na aprovação/retirada realizada na data relevante. O evento do dia só existe para empréstimo já em `retirada`, com e-mail e permissões habilitadas; reservar algo para hoje sem aprovação não gera e-mail. Novas tentativas do mesmo evento usam a chave única e não duplicam a fila. Visitas com devolução solicitada, mas ainda não confirmada, permanecem com estoque em uso e não recebem cobrança automática até a decisão administrativa.

**Vocabulário da devolução:** visitantes usam **Devolvido** para informar a entrega, com situação **Devolvido · aguardando conferência** até o Admin dar o veredito final; internamente permanece `status=retirada` e `devolucao_solicitada_em` preenchido. A confirmação Admin é a única operação que libera o estoque. Os PETianes concluem diretamente.

**Migração 0023:** acrescenta `devolucao_solicitada_em` e `devolucao_solicitada_observacao` a `reservas`, sem alterar status de empréstimos ativos nem reclassificar devoluções históricas. O backup v2 salva/restaura esses dois campos nos registros abertos. O Admin apresenta filtro separado **Devoluções a confirmar**, sem confundi-lo com reservas ainda não aprovadas.

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
| PETiane não consegue retirar | Cargo ativo, senha definitiva, e-mail, estoque, permissão do item e categoria |
| Filamento tem estoque duplicado | Conferir vínculo `FILAMENTO-<id>` entre `filamentos` e `componentes` |
| “Todas” ainda lista registros concluídos | “Todas” inclui os mesmos registros de Concluídas; verifique prazo/status e execução da limpeza |
| E-mail não chegou | Tipo de evento, cargo, data, fila, trigger Apps Script, quota Gmail, logs |
| E-mail enviado ainda aparece como pendente | Checar ACK `/api/mail/ack` e a API `/api/admin/mail/log` |
| Admin pede login fora de contexto | Verifique cookie e rota `/admin/`, sem substituir identidade pessoal |
| Alteração no Git não refletiu | Confirmar deploy completo do SHA da `main`, conferir cache e assets |
| PDF fica com menus/botões | Use `/ajuda/` → Imprimir / salvar PDF; `@media print` esconde navegação |

## 10. Como entregar o projeto a outra pessoa ou IA
Compartilhe o repositório (não credenciais). Peça que leia **AGENTS.md → este guia → código e migrations pertinentes → testes**; registre o problema, limite o escopo e exija teste antes de publicar. A operação do Cloudflare e do Google depende de contas e permissões reais: não presuma que ter acesso ao GitHub dá acesso ao D1 remoto ou ao Gmail. Antes de qualquer mudança potencialmente destrutiva, peça backup e aprovação.

**Manutenção da documentação:** manter este arquivo, `AGENTS.md` e a Central de Ajuda sincronizados com mudanças funcionais.

### Estoque sem defeitos (migração 0021)

`migrations/0021_estoque_sem_defeitos.sql` baixa do total as unidades anteriormente marcadas com defeito, registra a conversão em `baixas_estoque` e zera o campo legado `com_defeito`, preservando unidades efetivamente em uso. O frontend mostra **Quantidade, Em uso e Disponível** e o servidor usa a mesma subtração, validando solicitações de reserva, aprovação e retirada direta. Ao devolver, `descartados` é opcional, limitado à quantidade retirada: reduz o total (também em `filamentos` quando for rolo) sem gerar estoque defeituoso. Backups antigos que continham `com_defeito` passam por conversão no restore. Na confirmação de recebimento pelo Admin, não se solicita número de descartes. Na interface, o antigo rótulo Tag virou **Cargo**, sem mudar a chave técnica `tag` nem os papéis da API.
