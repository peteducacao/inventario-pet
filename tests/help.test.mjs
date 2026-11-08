import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const staticHeaders=readFileSync("public/_headers","utf8");
const wrangler=readFileSync("wrangler.jsonc","utf8");
assert.match(staticHeaders,/^\/\*$/m,"A regra global de assets precisa alcançar todas as páginas estáticas.");
for(const rule of ["Content-Security-Policy: default-src 'self'","script-src 'self'","script-src-attr 'none'","frame-ancestors 'self'","frame-src 'self'","X-Frame-Options: SAMEORIGIN","X-Content-Type-Options: nosniff","Referrer-Policy: no-referrer","Permissions-Policy: camera=()"]){
  assert.ok(staticHeaders.includes(rule),"CSP/header faltando em public/_headers: "+rule);
}
assert.match(wrangler,/"run_worker_first"\s*:\s*\[\s*"\/api\/\*"/,
  "Os assets são entregues diretamente pelo Cloudflare; _headers deve permanecer ativo.");
const html=readFileSync("public/ajuda/index.html","utf8");
const css=readFileSync("public/ajuda/ajuda.css","utf8");
const admin=readFileSync("public/admin-stage.js","utf8");
const publicHtml=readFileSync("public/index.html","utf8");
const adminHtml=readFileSync("public/admin/index.html","utf8");
const agents=readFileSync("AGENTS.md","utf8");
const guide=readFileSync("docs/GUIA_TECNICO.md","utf8");
const readme=readFileSync("README.md","utf8");

const topics=["visao-geral","contas","reserva","devolucao","materiais","filamentos","administracao","gmail","cloudflare","backup","problemas","ia"];
for(const id of topics)assert.ok(html.includes('id="'+id+'"'),"Seção obrigatória ausente: "+id);
assert.equal((html.match(/class="help-topic"/g)||[]).length,topics.length,"Central de Ajuda deve incluir todas as áreas");
const helpJS=readFileSync("public/ajuda/ajuda.js","utf8");
assert.match(html,/src="\/ajuda\/ajuda\.js\?v=/,"Ajuda precisa carregar o script externo sob CSP.");
assert.match(helpJS,/window\.print\(\)/,"O botão de impressão/PDF precisa executar a impressão");
assert.doesNotMatch(html,/<script>(.|\n)*?<\/script>/i,"Scripts inline não são permitidos pela política CSP.");
assert.match(css,/@media print/,"Arquivo não possui estilo para impressão");
assert.match(css,/@page\s*\{size:A4/,"Impressão precisa preparar páginas A4");
assert.match(css,/\.no-print/,"Navegação não pode sair no PDF");
assert.ok(admin.includes('["ajuda","box","Ajuda"]'),"Ajuda deve aparecer nas abas do Admin");
assert.ok(admin.includes('if(UI.adminTab==="ajuda")return adminHelp(content);'),"Ajuda precisa abrir no próprio Admin");
assert.match(admin,/function adminHelp\(root\)/,"Tela interna Ajuda ausente");
assert.match(admin,/src="\/ajuda\/\?embed=1"/,"Manual não aparece no painel");
assert.match(admin,/href="\/ajuda\/\?print=1"/,"Botão de PDF ausente");
assert.match(helpJS,/help-embed/,"Modo embutido de Ajuda precisa continuar funcionando.");
for(const file of [publicHtml,adminHtml])assert.doesNotMatch(file,/href="\/ajuda\/" data-public-action="help"/,"Ajuda deve aparecer somente dentro do painel administrativo autenticado");
for(const s of ["Cloudflare","Gmail","D1","AGENTS.md","GitHub"])assert.ok(html.includes(s),s+" não aparece na ajuda");
for(const s of ["src/index.js","src/identity.js","src/mail-bridge.js","wrangler.jsonc","integracoes/AppsScript_Codigo.gs","GitHub Actions"])assert.ok(guide.includes(s),"Falta documentação de "+s);
assert.match(agents,/APAGAR TODOS OS REGISTROS|apagar \*\*todas\*\*/i,"A IA precisa receber instruções sobre limpeza total");
assert.match(readme,/Central de Ajuda|Guia técnico/i,"README precisa apontar a documentação");
assert.doesNotMatch(html,/PET_MAIL_TOKEN\s*=\s*[a-z0-9_-]{32,}/i,"Manual jamais deve conter token real");
console.log("AJUDA OK: 12 assuntos, Ajuda exclusiva do menu Admin, impressão A4/PDF e documentação para IA.");
