import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM} from "jsdom";
const source=readFileSync("public/component-art.js","utf8");
const w={};new Function("window",source)(w);
const cases=[
 ["Led Vermelho","#ee4754","LED VERMELHO"],
 ["Led Verde Grande","#3ec883","LED VERDE GRANDE"],
 ["Led Verde Pequeno","#3ec883","LED VERDE PEQUENO"],
 ["Led Amarelo","#f0c33f","LED AMARELO"],
 ["Led Azul","#389bed","LED AZUL"],
 ["Led Branco","#f6fbfa","LED BRANCO"],
 ["Led Transparente","#d6e6e9","LED TRANSPARENTE"],
 ["Led transparente 4 pinos","#d6e6e9","LED RGB 4 PINOS"],
 ["Led com soquete verde","#3ec883","LED VERDE"]
];
const xml=new JSDOM("").window.DOMParser;
const parser=new xml();
const urls=[];
for(const [name,color,caption] of cases){
 const url=w.componentArt(name);
 assert.ok(url.startsWith("data:image/svg+xml;"),name+" não foi gerado em SVG.");
 const svg=decodeURIComponent(url.slice(url.indexOf(",")+1));
 assert.ok(svg.includes(color),name+" deveria usar a cor "+color);
 assert.ok(svg.includes(">"+caption+"</text>"),name+" deveria ser identificado individualmente.");
 assert.equal(parser.parseFromString(svg,"image/svg+xml").querySelectorAll("parsererror").length,0,name+" SVG inválido.");
 urls.push(url);
}
assert.equal(new Set(urls).size,cases.length,"Cada variação deve ter ilustração própria.");
assert.equal(w.componentArt("Led Azul"),w.componentArt("Led Azul"),"Cache da mesma variação deveria reutilizar arte.");
assert.notEqual(w.componentArt("Led Verde Grande"),w.componentArt("Led Verde Pequeno"),"Tamanhos diferentes não devem usar arte idêntica.");
const custom="data:image/webp;base64,"+Buffer.from("custom").toString("base64");
assert.equal(w.imageForPETItem({nome:"Led Azul",imagem:custom}),custom,"Foto enviada para uma variação deve prevalecer.");
assert.notEqual(w.imageForPETItem({nome:"Led Vermelho",imagem:""}),custom,"Fotos de uma variação não devem aparecer nas outras.");
console.log("LEDS OK: 9 ilustrações individuais com cor/tamanho/pinos/soquete e fotos específicas preservadas.");
