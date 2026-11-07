import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root="https://inventario-pet.pet-educacao.workers.dev";
async function get(path,shouldInclude=[]){
  let response,text="";
  for(let attempt=0;attempt<6;attempt++){
    response=await fetch(root+path,{headers:{"Cache-Control":"no-cache"}});
    text=await response.text();
    if(response.ok&&shouldInclude.every(s=>text.includes(s)))break;
    if(attempt<5)await new Promise(r=>setTimeout(r,1300));
  }
  assert.ok(response.ok,path+": resposta HTTP "+response.status);
  for(const token of shouldInclude)assert.ok(text.includes(token),path+" não publicou "+token);
  return text;
}
const localHtml=readFileSync("public/index.html","utf8");
const currentArtPath=localHtml.match(/\\/component-art\\.js\\?v=[^"]+/)?.[0];
const currentFinalPath=localHtml.match(/\\/final\\.js\\?v=[^"]+/)?.[0];
assert.ok(currentArtPath&&currentFinalPath,"Arquivos versionados devem existir no HTML local.");
const html=await get("/",[currentArtPath,currentFinalPath]);
await get("/final.js",["page-total","Última página","data-page"]);

const code=await get("/component-art.js",["sharpener:()=>","cutter:()=>","ceramic:()=>","potentiometer:()=>","stand:()=>","function categoryFor"]);
const window={};(new Function("window",code))(window);
const src=window.componentArt("Apontador"),scissors=window.componentArt("Tesoura");
assert.notEqual(src,scissors,"Apontador e tesoura aparecem com a mesma imagem.");
assert.ok(decodeURIComponent(src).includes("APONTADOR"),"Desenho incorreto do apontador.");
console.log("ILUSTRAÇÕES PUBLICADAS OK: apontador, estilete e classificação revisada presentes no site.");
