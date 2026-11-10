import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JSDOM} from "jsdom";

// O histórico oficial contém os 213 nomes originais, inclusive lotes/duplicatas.
// Este teste não consulta nem altera o banco de dados remoto.
const source=readFileSync("public/component-art.js","utf8");
const migration=readFileSync("migrations/0007_inventario_oficial.sql","utf8");
const exposed={};
(new Function("window",source))(exposed);
const names=[...migration.matchAll(/SELECT id,'((?:''|[^'])*)','/g)]
  .map(m=>m[1].replace(/''/g,"'"));
assert.equal(names.length,213,"Auditoria de arte deve cobrir as 213 entradas oficiais.");
const parser=new JSDOM("").window.DOMParser;
const xml=new parser();
function illustration(name){
  const src=exposed.componentArt(name);
  assert.ok(src.startsWith("/img/")||src.startsWith("data:image/svg+xml;charset=utf-8,"),name+": ilustração inválida");
  assert.ok(!src.includes("commons.wikimedia.org")&&!/^https?:\/\//.test(src),name+": imagem externa");
  if(src.startsWith("data:")){
    const svg=decodeURIComponent(src.slice(src.indexOf(",")+1));
    const document=xml.parseFromString(svg,"image/svg+xml");
    assert.equal(document.querySelectorAll("parsererror").length,0,name+": SVG malformado");
    assert.ok(document.querySelector("svg"),name+": SVG ausente");
    const captions=[...document.querySelectorAll("text")].map(node=>node.textContent.trim()).filter(label=>label!=="UNO");
    assert.deepEqual(captions,[],name+": ilustração padrão não deve incluir texto de legenda");
    return svg;
  }
  assert.ok(readFileSync("public"+src,"utf8").includes("<svg"),name+": arquivo SVG local ausente");
  return readFileSync("public"+src,"utf8");
}
for(const name of names)illustration(name);
const scenarios=[
  ["Apontador","APONTADOR"],
  ["Tesoura","TESOURA"],
  ["Estiletes","ESTILETE"],
  ["Potenciômetro","POTENCIÔMETRO"],
  ["Sensor de Luminosidade LDR","LDR"],
  ["Sensor de Vibração SW 420","VIBRAÇÃO"],
  ["Sensor Infravermelho","INFRAVERMELHO"],
  ["Sensor de som","SOM"],
  ["Sensor de temperatura","TEMPERATURA"],
  ["Sensor Ultrasônico","SENSOR"],
  ["Módulo driver","PONTE H"],
  ["Ponte H","PONTE H"],
  ["Carregadores de pilhas","CARREGADOR"],
  ["Fonte de Arduino","FONTE"],
  ["Suporte Arduino","SUPORTE"],
  ["Arduino Uno","ARDUINO UNO"],
  ["Placa de teclado","TECLADO"],
  ["Joystique duplo","JOYSTICK DUPLO"],
  ["Capacitor Cerâmico 103","CERÂMICO"],
  ["Motor de passo","MOTOR DE PASSO"],
  ["Roda boba","RODA BOBA"],
  ["Esp 32 doit","ESP32"],
  ["Alcalina 9V","BATERIA 9V"],
  ["Conector clip de bateria","CLIP BATERIA"],
  ["Módulo de Alimentação","ALIMENTAÇÃO"],
  ["Módulo Bluetooth","BLUETOOTH"],
  ["Kit de lixas para polimento","LIXAS"],
  ["Rolos de estanho","ESTANHO"],
  ["Bicos impressora 3D","BICOS 3D"],
  ["Pistolas de cola quente","PISTOLA DE COLA"],
  ["Bastâo de cola quente","COLA QUENTE"],
  ["Cola Bastão","COLA BASTÃO"],
  ["Barras polidas dupla face","BARRAS POLIDAS"]
];
for(const [name,expected] of scenarios){
  const svg=illustration(name);
  assert.notEqual(svg,illustration("Material totalmente desconhecido"),name+": deve manter sua ilustração específica sem legenda");
}
assert.notEqual(exposed.componentArt("Apontador"),exposed.componentArt("Tesoura"));
assert.notEqual(exposed.componentArt("Tesoura"),exposed.componentArt("Estiletes"));
assert.notEqual(exposed.componentArt("Arduino Uno"),exposed.componentArt("Esp 32 doit"));
assert.equal(exposed.imageForPETItem({nome:"Apontador",imagem:""}),exposed.componentArt("Apontador"));
const ownPhoto="data:image/png;base64,aGVsbG8=";
assert.equal(exposed.imageForPETItem({nome:"Apontador",imagem:ownPhoto}),ownPhoto,"Foto própria deve permanecer intacta");
for(const name of ["Teste 11","LED vermelho","LED verde grande","LED RGB 4 pinos"]){
  assert.ok(!illustration(name).includes("<text"),name+": arte automática sem legenda inferior");
}
console.log("ILUSTRAÇÕES OK: 213 registros, SVGs válidos, artes sem legenda, desenhos específicos e fotos próprias preservadas.");
