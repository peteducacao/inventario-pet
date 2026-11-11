import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
for(const p of ["public/index.html","public/admin/index.html","public/emprestimos/index.html"]){
 const html=read(p);
 assert.match(html,/rel="manifest" href="\/site\.webmanifest/);
 assert.match(html,/src="\/pwa-install\.js\?v=/);
 assert.doesNotMatch(html,/<script>(?:.|\n)*?<\/script>/i);
}
const manifest=JSON.parse(read("public/site.webmanifest"));
assert.equal(manifest.display,"standalone");assert.equal(manifest.start_url,"/");
for(const size of [192,512]){
 const name="public/icons/inventory-"+size+".png";
 assert.ok(existsSync(name));
 const buffer=readFileSync(name);
 assert.equal(buffer.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
 assert.equal(buffer.readUInt32BE(16),size);assert.equal(buffer.readUInt32BE(20),size);
 assert.ok(manifest.icons.some(i=>i.sizes===size+"x"+size));
}
const app=read("public/pwa-install.js"),sw=read("public/sw.js"),
 accounts=read("public/identity-ui.js"),final=read("public/final.js");
for(const term of ["beforeinstallprompt","appinstalled","serviceWorker.register","Baixar aplicativo"])assert.ok(app.includes(term));
assert.match(accounts,/petAppInstallCard\(\)/);assert.match(accounts,/wirePetAppInstall\(\)/);
assert.match(final,/petAppInstallCard\(\)/);assert.match(final,/wirePetAppInstall\(\)/);
assert.match(sw,/url\.pathname\.startsWith\("\/api\/"/);
assert.match(sw,/STATIC_FILES\.includes\(url\.pathname\)/);
assert.equal((final.match(/const status=free===0\?"Sem estoque":"Disponível";/g)||[]).length,2);
assert.doesNotMatch(final,/used>free\?"Em uso"/);
assert.match(final,/stock\(selected\)===0/);
assert.match(final,/free===0\?"empty":""/);
assert.match(final,/data-start-reservation="1".*free===0/);
console.log("PWA E ESTOQUE OK: app instalável, sem status azul e bloqueio de estoque zero.");
