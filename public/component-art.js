/* Ilustrações locais do Inventário PET. Sem fotografias genéricas externas. */
(function(){
  "use strict";
  const c={
    ink:"#263e50",edge:"#263d4f",shade:"#e5eff4",metal:"#a9bcca",
    mint:"#13b798",light:"#e4faf2",blue:"#3991d0",yellow:"#f2c751",
    red:"#e06160",dark:"#152c3e",white:"#fff"
  };
  const r=(x,y,w,h,fill,rx=7,extra="")=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" fill="'+fill+'" '+extra+'/>';
  const line=(x1,y1,x2,y2,col=c.edge,width=5)=>'<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" fill="none" stroke="'+col+'" stroke-width="'+width+'" stroke-linecap="round"/>';
  const circ=(x,y,rad,fill,stroke="",sw=2)=>'<circle cx="'+x+'" cy="'+y+'" r="'+rad+'" fill="'+fill+'" '+(stroke?'stroke="'+stroke+'" stroke-width="'+sw+'"':"")+'/>';
  const pins=(x,y,w,count=8,vertical=false)=>Array.from({length:count},(_,i)=>vertical?r(x-7,y+i*15,11,7,c.metal,2):r(x+i*(w/(count-1))-3,y-7,7,12,c.metal,2)).join("");
  const hole=(x,y)=>circ(x,y,4,"#dce8ef","#56758d",2);
  const t=(label)=>'<text x="200" y="239" text-anchor="middle" fill="#567084" font-family="Arial,Helvetica,sans-serif" font-size="15" font-weight="700" letter-spacing="1">'+label+'</text>';
  const plate=(fill="#14394d")=>'<g transform="rotate(-8 200 120)">'+r(102,57,196,136,fill,15,'stroke="#356a80" stroke-width="3"')+pins(123,57,156,10)+pins(123,193,156,10)+[hole(118,73),hole(282,73),hole(118,177),hole(282,177)].join("")+r(153,94,72,62,"#253b4a",8,'stroke="#65828f" stroke-width="3"')+Array.from({length:5},(_,i)=>r(241,95+i*15,29,8,i%2?"#2e9c8b":"#1b6579",2)).join("")+'</g>';
  const battery=(mini=false)=>'<g transform="rotate(-16 200 125)">'+r(116,87,172,80,"#c5d3db",19,'stroke="#627b89" stroke-width="4"')+r(132,87,60,80,c.yellow,6)+r(190,87,85,80,"#fbf9f2",3)+r(288,112,13,30,"#a9b7c5",2)+line(222,120,244,120,"#265e80",6)+line(233,108,233,132,"#265e80",5)+'</g>';
  const builtin={
    lcd:()=>r(69,49,262,155,"#244760",13,'stroke="#1b3044" stroke-width="5"')+
      r(95,70,210,107,"#8ac5ba",4,'stroke="#b4e6cd" stroke-width="3"')+
      Array.from({length:2},(_,j)=>Array.from({length:10},(_,i)=>r(108+i*18,91+j*37,12,19,"#286d6a",2)).join("")).join("")+
      Array.from({length:12},(_,i)=>r(103+i*18,204,7,15,c.yellow,2)).join("")+t("LCD"),
    capacitor:()=>[0,1,2].map((i)=>'<g transform="translate('+(i*62)+',0)">'+r(81,90-i*10,54,97+i*10,["#1d455b","#285f76","#26374c"][i],10)+
      '<ellipse cx="108" cy="'+(90-i*10)+'" rx="27" ry="9" fill="#bdcbd3" stroke="#8ba9b6" stroke-width="3"/>'+
      line(95,187,95,211,c.metal,4)+line(120,187,120,211,c.metal,4)+'</g>').join("")+t("CAPACITOR"),
    led:()=>[0,1,2].map((i)=>'<g transform="translate('+(i*65)+',0)">'+
      '<path d="M92 160V113a29 29 0 0 1 58 0v47Z" fill="'+["#f05766","#41bd7c","#f3c34d"][i]+'" stroke="#546a7a" stroke-width="3" opacity=".89"/>'+
      r(87,154,67,10,"#b6c5cf",4)+line(103,165,103,202,"#8398a6",5)+line(139,165,139,216,"#8398a6",5)+'</g>').join("")+t("LED"),
    switch:()=>r(105,82,190,113,"#2d4150",17,'stroke="#718696" stroke-width="5"')+
      r(123,98,154,80,"#4b6577",12)+
      '<path d="M160 113h79l24 48h-79z" fill="#ecf1f3" stroke="#6c8696" stroke-width="4"/>'+t("INTERRUPTOR"),
    button:()=>r(105,113,190,78,"#263c4d",18)+
      '<ellipse cx="200" cy="115" rx="79" ry="42" fill="#aebeca" stroke="#688093" stroke-width="4"/>'+
      '<ellipse cx="200" cy="106" rx="61" ry="32" fill="#df6567"/>'+t("BOTÃO"),
    proto:()=>'<g transform="rotate(-10 200 130)">'+r(69,50,262,169,"#f8fbfc",12,'stroke="#b4c9d2" stroke-width="5"')+
      Array.from({length:11},(_,i)=>Array.from({length:7},(_,j)=>circ(96+i*20,80+j*19,3,j===0?"#d46d6d":"#647d88")).join("")).join("")+
      r(86,129,228,8,"#dce8ee",3)+'</g>'+t("PROTOBOARD"),
    jumper:()=>[0,1,2,3,4].map((i)=>'<path d="M'+(91+i*16)+' 79C'+(130+i*17)+' 140 '+(230-i*10)+' 105 '+(295-i*13)+' 183" fill="none" stroke="'+["#2ea887","#f0ba4d","#e16f65","#3f9ad2","#7387cd"][i]+'" stroke-width="8" stroke-linecap="round"/>').join("")+t("JUMPER"),
    battery:()=>battery()+t("PILHA"),
    holder:()=>r(79,74,242,137,"#263c4f",16)+[0,1].map((i)=>r(95,88+i*57,205,43,"#495d6b",21,'stroke="#9aaeb9" stroke-width="3"')+r(113,90+i*57,104,39,i? "#ebd36b":"#e5eff4",16)).join("")+t("SUPORTE"),
    sd:()=>'<path d="M145 56h112l22 29v122H123V81Z" fill="#263b4e" stroke="#68869a" stroke-width="5"/>'+
      r(147,79,95,61,"#238d90",4)+Array.from({length:7},(_,i)=>r(144+i*16,173,12,33,"#eac45e",3)).join("")+t("CARTÃO"),
    resistor:()=>line(65,128,130,128,"#99acbc",7)+r(126,110,149,36,"#dfc38c",18,'stroke="#c59f5c" stroke-width="4"')+
      [153,177,201,238].map((x,i)=>r(x,111,11,34,["#6d4a38","#a14949","#e1b04a","#7c5d64"][i],1)).join("")+
      line(275,128,335,128,"#99acbc",7)+t("RESISTOR"),
    sensor:()=>plate("#176076")+circ(172,126,35,"#c0d2db","#7897a7",5)+circ(172,126,15,"#566e7c")+
      circ(242,126,35,"#c0d2db","#7897a7",5)+circ(242,126,15,"#566e7c")+t("SENSOR"),
    servo:()=>r(114,69,174,136,"#396c9d",15,'stroke="#295980" stroke-width="4"')+
      r(95,87,211,27,"#2e6897",5)+circ(200,80,42,"#dbe3e8","#a1afb8",7)+circ(200,80,18,"#a4b6c2")+
      r(165,43,74,10,"#cbd7de",4)+r(173,181,60,26,"#344f6c",4)+t("MICRO SERVO"),
    relay:()=>plate("#16747e")+r(135,90,129,96,"#356eb9",9,'stroke="#78abdf" stroke-width="4"')+
      line(146,119,251,119,"#d8e7f1",4)+t("RELÉ"),
    joystick:()=>plate("#145c6a")+circ(200,120,49,"#263b4f","#7599aa",8)+
      line(200,110,200,64,"#b3c6ce",14)+circ(200,62,28,"#273d50") +t("JOYSTICK"),
    buzzer:()=>plate("#187077")+circ(198,124,54,"#263c4a","#788d9c",7)+circ(198,124,17,"#101c2c")+t("BUZZER"),
    wheel:()=>circ(200,133,94,"#2b3d4e","#142735",11)+
      Array.from({length:10},(_,i)=>'<g transform="rotate('+(i*36)+' 200 133)">'+r(192,32,16,30,"#59727e",5)+'</g>').join("")+
      circ(200,133,53,"#899eac","#c5d3da",9)+circ(200,133,17,"#405766")+t("RODA"),
    fan:()=>circ(200,128,81,"#ecf4f7","#567b91",4)+
      Array.from({length:4},(_,i)=>'<path d="M200 125C200 82 263 65 261 100S231 139 200 125" transform="rotate('+(i*90)+' 200 128)" fill="#329a9c"/>').join("")+circ(200,128,17,"#c6dbe3")+t("HÉLICE"),
    power:()=>r(103,71,194,138,"#293e50",22,'stroke="#6f8798" stroke-width="4"')+
      r(140,97,120,70,"#e5ebed",8)+circ(186,132,18,"#aabfc8","#8093a0",4)+
      Array.from({length:4},(_,i)=>r(132+i*45,209,11,23,"#b8cad4",2)).join("")+t("FONTE"),
    usb:()=>r(127,100,150,77,"#f1f4f6",13,'stroke="#9badb9" stroke-width="5"')+
      r(105,108,32,60,"#d4dde3",4)+r(72,117,35,42,"#566b7a",3)+
      line(275,139,332,139,"#394e63",13)+t("USB"),
    paper:()=>[0,1,2].map((i)=>'<g transform="translate('+(i*14)+','+(-i*10)+')">'+r(123,75,148,146,"#fefefe",5,'stroke="#bcccd4" stroke-width="3"')+
      [116,136,156,176].map(y=>line(149,y,242,y,"#bed4de",4)).join("")+'</g>').join("")+t("PAPEL"),
    cloth:()=>'<path d="M98 75Q153 46 202 73t106 0L291 206Q231 189 194 219t-102-13Z" fill="#aac2d7" stroke="#7693a6" stroke-width="5"/>'+
      '<path d="M105 134Q156 110 202 136t93-2" stroke="#e5f0f5" stroke-width="6" fill="none"/>'+t("TECIDO"),
    scissors:()=>circ(130,182,27,"none","#7795a4",11)+circ(196,182,27,"none","#7795a4",11)+
      line(150,161,282,57,"#8aa2b0",11)+line(186,159,282,171,"#b7c8d2",11)+circ(173,143,7,"#405e70")+t("TESOURA"),
    tape:()=>circ(200,128,79,"#ede8cf","#d9c594",7)+circ(200,128,39,"#fff","#a9a9a0",7)+
      '<path d="M200 49 A79 79 0 0 1 277 124" fill="none" stroke="#ebca79" stroke-width="18"/>'+t("FITA"),
    glue:()=>r(157,89,85,118,"#f4f3ed",12,'stroke="#9eb0bb" stroke-width="4"')+
      r(173,67,53,26,"#4c8fb1",5)+r(165,122,69,42,"#62b8ae",5)+t("COLA"),
    vial:()=>r(151,93,98,115,"#bfdbe8",20,'stroke="#6a95a9" stroke-width="4"')+r(175,66,50,28,"#4c849e",5)+
      '<path d="M161 167q39-16 78 0v29h-78Z" fill="#5cbdb0" opacity=".7"/>'+t("LÍQUIDO"),
    ruler:()=>'<g transform="rotate(-14 200 128)">'+r(78,97,244,62,"#f5d481",10,'stroke="#caa453" stroke-width="4"')+
      Array.from({length:17},(_,i)=>line(95+i*13,98,95+i*13,i%5?112:126,"#99744d",2)).join("")+'</g>'+t("RÉGUA"),
    mic:()=>r(165,63,70,110,"#4b6d83",34,'stroke="#7792a2" stroke-width="5"')+
      line(200,173,200,214,"#667f8d",9)+line(154,214,247,214,"#667f8d",8)+
      Array.from({length:4},(_,i)=>line(179,88+i*17,222,88+i*17,"#bacbd3",3)).join("")+t("MICROFONE"),
    camera:()=>r(95,84,212,126,"#253c4e",18)+r(137,70,90,19,"#314f66",5)+
      circ(200,145,53,"#b7cdd7","#7a91a2",5)+circ(200,145,29,"#395b80","#17364d",5)+t("CÂMERA"),
    projector:()=>r(91,97,221,109,"#e9eef1",20,'stroke="#a7bac5" stroke-width="5"')+
      circ(247,149,42,"#344b62","#9caebc",8)+circ(247,149,26,"#4298be")+
      Array.from({length:3},(_,i)=>r(118,121+i*20,70,7,"#8fa8b8",4)).join("")+t("PROJETOR"),
    nuts:()=>[0,1,2].map((i)=>'<g transform="translate('+(i*77)+',0)">'+
      '<path d="M91 113l20-29 35 0 20 29-20 29h-35z" fill="#a3b3bf" stroke="#678298" stroke-width="5"/>'+
      circ(129,113,16,"#f7fafc","#718fa0",4)+'</g>').join("")+t("FIXAÇÃO"),
    trans:()=>plate("#2b6271")+[135,190,245].map((x,i)=>r(x,106,34,44,"#182e3b",3)+pins(x+6,103,22,3)).join("")+t("MÓDULO"),
    sharpener:()=>'<g transform="rotate(-14 200 135)">'+r(125,78,151,126,"#e6ad62",24,'stroke="#ab7b42" stroke-width="5"')+r(177,95,63,92,"#bccdd5",9,'stroke="#8299a6" stroke-width="4"')+r(202,102,12,75,"#425d70",2)+circ(206,143,6,"#f8fafa","#647e91",3)+r(109,109,30,65,"#f2d393",9)+'</g>'+t("APONTADOR"),
    cutter:()=>'<g transform="rotate(-13 200 135)">'+r(94,102,212,57,"#428da9",12)+r(144,113,120,35,"#254359",6)+r(245,117,22,27,"#c7d8de",4)+'<path d="M304 108l56 23-56 27z" fill="#cad5dc" stroke="#708796" stroke-width="4"/></g>'+t("ESTILETE"),
    ceramic:()=>[0,1,2].map(i=>'<g transform="translate('+(i*62)+',0)">'+circ(105,119,31,"#d5af77","#ab864d",4)+line(96,148,89,214,"#a1b4bf",5)+line(115,148,122,214,"#a1b4bf",5)+'</g>').join("")+t("CERÂMICO"),
    alkaline9:()=>r(128,66,143,150,"#263b4d",16)+r(129,118,141,75,"#ddb958",3)+r(153,49,27,20,"#dbe5eb",6)+r(218,54,30,13,"#aebec7",4)+t("BATERIA 9V"),
    coin:()=>'<ellipse cx="200" cy="150" rx="99" ry="62" fill="#869ca9"/><ellipse cx="200" cy="135" rx="99" ry="62" fill="#dce7ed" stroke="#829ba9" stroke-width="5"/>'+circ(200,135,39,"none","#a7bcc7",5)+line(182,135,218,135,"#809aaa",6)+line(200,117,200,153,"#809aaa",6)+t("BATERIA BOTÃO"),
    clipbattery:()=>'<path d="M99 76q14 68 58 99" stroke="#d95e59" fill="none" stroke-width="8"/><path d="M105 76q-16 62 58 115" stroke="#384d5c" fill="none" stroke-width="8"/>'+r(146,133,145,80,"#263846",15)+r(164,158,110,28,"#4b616d",6)+r(82,63,40,28,"#bacbd4",5)+t("CLIP BATERIA"),
    charger:()=>r(103,70,194,152,"#394d5c",16)+[0,1].map(i=>r(118+i*86,93,73,103,"#627b8a",21)+r(132+i*85,109,47,72,i?"#91c1aa":"#edc963",14)).join("")+t("CARREGADOR"),
    stand:()=>r(99,92,201,116,"#c4d2db",16,'stroke="#849dac" stroke-width="4"')+[0,1,2,3].map(i=>circ(127+i*49,117,9,"#f8fafb","#819ba8",4)).join("")+t("SUPORTE"),
    tin:()=>circ(200,136,86,"#90a4af","#5c7689",5)+circ(200,136,63,"#e4eaf0","#9bb1bc",5)+circ(200,136,29,"#879da8")+'<path d="M119 140q79-54 159-8" stroke="#edf4f6" fill="none" stroke-width="6"/>'+t("ESTANHO"),
    nozzle:()=>[0,1,2].map(i=>'<g transform="translate('+(i*73)+',0)">'+r(90,82,43,48,"#c59b5b",5)+'<path d="M84 132h54l-17 65H101Z" fill="#e3b766" stroke="#a97f42" stroke-width="4"/>'+circ(111,192,5,"#8b693e")+'</g>').join("")+t("BICOS 3D"),
    sandpaper:()=>[0,1,2].map(i=>'<g transform="rotate('+(i*8-10)+' 200 137)">'+r(130+i*12,82,120,145,["#ba865f","#c6a17e","#e0bd93"][i],5)+'</g>').join("")+t("LIXAS"),
    solder:()=>plate("#287684")+r(136,99,132,81,"#203b4d",7)+[0,1,2,3,4].map(i=>r(136+i*30,184,13,20,"#edca65",2)).join("")+t("PLACA"),
    hbridge:()=>plate("#186b80")+r(161,91,76,71,"#243b4d",5)+[0,1,2,3].map(i=>r(131+i*38,165,27,17,"#a1b7c1",3)).join("")+t("PONTE H"),
    bluetooth:()=>plate("#246c81")+r(153,85,97,79,"#a1bbc7",6)+'<path d="M200 90v65l28-17-45-28 45 25-28 20" fill="none" stroke="white" stroke-width="5"/>'+t("BLUETOOTH"),
    fuse:()=>line(75,130,122,130,"#9daeb8",8)+r(120,107,161,53,"#dce7ec",13,'stroke="#8ca7b6" stroke-width="5"')+line(137,130,263,130,"#b77c53",5)+line(281,130,328,130,"#9daeb8",8)+t("FUSÍVEL"),
    transistor:()=>r(157,87,89,103,"#263b4c",12)+[0,1,2].map(i=>r(166+i*27,189,9,39,"#a6bac6",2)).join("")+t("TRANSISTOR"),
    stepper:()=>r(117,82,165,137,"#57717f",27,'stroke="#364e60" stroke-width="5"')+circ(199,143,60,"#9db0bb","#cddae0",6)+circ(199,143,31,"#4e6c80","#7e9eae",5)+line(199,141,199,59,"#aebec7",12)+t("MOTOR DE PASSO"),
    caster:()=>r(149,69,104,100,"#9eb1bd",16)+r(183,161,39,29,"#c7d4d9",5)+circ(203,195,41,"#263847","#132d3f",6)+circ(203,195,16,"#9caeb8")+t("RODA BOBA"),
    potentiometer:()=>plate("#1a6b74")+circ(201,123,46,"#b0c5d0","#e3edf0",7)+circ(201,123,27,"#708c9e")+line(201,123,223,104,"#304c61",7)+t("POTENCIÔMETRO"),
    ldr:()=>circ(201,121,65,"#dbb58a","#b18854",6)+'<path d="M164 117h17V96h42v22h16v18h-58v20h42" stroke="#77563d" fill="none" stroke-width="9"/>'+line(177,182,174,220,"#90a6b3",5)+line(223,182,226,220,"#90a6b3",5)+t("LDR"),
    infrared:()=>plate("#196c7e")+r(164,85,70,99,"#263849",8)+[176,222].map(x=>circ(x,131,13,"#b3c4cc")).join("")+'<path d="M270 94q24 32 0 65M293 82q38 42 0 91" stroke="#edc074" fill="none" stroke-width="5"/>'+t("INFRAVERMELHO"),
    vibration:()=>plate("#1e6978")+r(170,88,61,90,"#b4cad3",11)+[0,1,2,3].map(i=>line(139+i*40,71,129+i*40,58,"#e8ba69",5)).join("")+t("VIBRAÇÃO"),
    sound:()=>plate("#196b7c")+circ(199,129,46,"#9cb5c2","#d4e2e8",6)+circ(199,129,11,"#344e60")+t("SOM"),
    temp:()=>plate("#196f7c")+r(186,82,30,94,"#c6dce4",15)+circ(201,183,30,"#95bccc","#5f8093",5)+r(195,117,12,69,"#e46f66",6)+circ(201,183,18,"#e46f66")+t("TEMPERATURA"),
    water:()=>plate("#176d7e")+'<path d="M200 65q56 74 56 99a56 56 0 0 1-112 0q0-26 56-99Z" fill="#7bc6d2" stroke="#b5e1e5" stroke-width="5"/>'+t("ÁGUA"),
    hotgun:()=>r(100,98,210,64,"#367fa0",18)+'<path d="M170 154h79l-23 70h-61Z" fill="#2c6f91"/>'+r(87,115,29,28,"#bfcfd7",5)+line(307,128,348,128,"#d0dce1",8)+t("PISTOLA DE COLA"),
    hotstick:()=>[0,1,2].map(i=>'<g transform="rotate('+(i*6-10)+' 200 140)">'+r(100,106+i*23,211,19,"#e5f1eb",9,'stroke="#a5c3c1" stroke-width="3"')+'</g>').join("")+t("COLA QUENTE"),
    gluestick:()=>r(164,91,77,126,"#eff0eb",8,'stroke="#b0bfc6" stroke-width="4"')+r(161,82,84,38,"#408eb5",5)+r(171,151,63,35,"#c9e1e9",4)+t("COLA BASTÃO"),
    clips:()=>'<path d="M145 184V105a29 29 0 0 1 58 0v78a18 18 0 0 1-36 0v-70a8 8 0 0 1 16 0v42" stroke="#93a9b6" stroke-width="10" fill="none" stroke-linecap="round"/>'+t("CLIPE"),
    pushpin:()=>r(172,103,57,25,"#de7067",8)+r(186,76,31,31,"#e6aaa1",8)+line(200,128,200,218,"#9eacb6",7)+t("PERCEVEJO"),
    washers:()=>[0,1,2].map(i=>'<g transform="translate('+(i*75)+',0)">'+circ(126,139,49,"#a5b8c1","#708999",5)+circ(126,139,24,"#fafcfc","#748f9b",4)+'</g>').join("")+t("ARRUELAS"),
    napkin:()=>[0,1,2].map(i=>r(130+i*12,79-i*9,149,133,"#fafdfd",4,'stroke="#c1d0d7" stroke-width="3"')).join("")+t("GUARDANAPO"),
    generic:()=>plate()+t("COMPONENTE")
  };
  const normalize=name=>String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function categoryFor(name){
    const n=normalize(name);
    if(/esp\s*32|esp32/.test(n))return "esp32";
    if(/tablet/.test(n))return "tablet";
    if(/notebook|laptop/.test(n))return "notebook";
    if(/micro\s*servo|servo/.test(n))return "servo";
    if(/motor\s*dc|mini motor|motor de passo|motor de posso/.test(n))return "motor";
    if(/arduino/.test(n))return "arduino";
    if(/visor|display|lcd/.test(n))return "lcd";
    if(/capacitor/.test(n))return "capacitor";
    if(/\bled\b|led\s/.test(n))return "led";
    if(/sensor ultra|ultrasson|ultrason/.test(n))return "sensor";
    if(/interruptor|gangorra/.test(n))return "switch";
    if(/botao|botoes|teclado/.test(n))return "button";
    if(/jumper|fio eletrico|cabo jumper/.test(n))return "jumper";
    if(/protoboard/.test(n))return "proto";
    if(/rele/.test(n))return "relay";
    if(/adaptador de cartao|leitor de cartao/.test(n))return "sd";
    if(/adaptador de bateria|suporte.*bateria|suporte.*pilha/.test(n))return "holder";
    if(/pilha|bateria|recarregavel/.test(n))return "battery";
    if(/resistor/.test(n))return "resistor";
    if(/sensor|ldr|infravermelh|vibracao|temperatura|luminosidade|medidor de agua/.test(n))return "sensor";
    if(/joystick|joystique|potenciometro/.test(n))return "joystick";
    if(/buzzer/.test(n))return "buzzer";
    if(/roda|rodinha/.test(n))return "wheel";
    if(/helice/.test(n))return "fan";
    if(/microfone/.test(n))return "mic";
    if(/projetor/.test(n))return "projector";
    if(/gravacao|camera|filmagem/.test(n))return "camera";
    if(/fusivel|transistor|ponte h|placa|modulo|driver/.test(n))return "trans";
    if(/fonte|carregador|regulador|alimentacao/.test(n))return "power";
    if(/usb|tipo c|v8/.test(n))return "usb";
    if(/papel|resma|folha|cartolina|guardanapo/.test(n))return "paper";
    if(/toalha|tecido|renda|passadeira/.test(n))return "cloth";
    if(/tesoura|estilete|apontador/.test(n))return "scissors";
    if(/fita|durex/.test(n))return "tape";
    if(/cola|bastao|pistola/.test(n))return "glue";
    if(/alcool/.test(n))return "vial";
    if(/regua|lixa/.test(n))return "ruler";
    if(/porca|ruelo|parafuso|clipe|percevejo/.test(n))return "nuts";
    return "generic";
  }
  const path={
    esp32:"/img/reference-board.svg",arduino:"/img/reference-board.svg",
    motor:"/img/reference-motor.svg",tablet:"/img/reference-tablet.svg",
    notebook:"/img/reference-notebook.svg"
  };
  const cache=new Map();
  function componentArt(name){
    const kind=categoryFor(name);
    if(path[kind])return path[kind];
    if(cache.has(kind))return cache.get(kind);
    const figure=(builtin[kind]||builtin.generic)();
    const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" role="img" aria-label="Ilustração de componente">'+
      '<defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbfefe"/><stop offset="1" stop-color="#eef7f6"/></linearGradient></defs>'+
      r(13,9,374,240,"url(#base)",20)+
      '<ellipse cx="200" cy="214" rx="106" ry="12" fill="#abc6cb" opacity=".18"/>'+figure+'</svg>';
    const uri="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
    cache.set(kind,uri);
    return uri;
  }
  // Fotografias externas genéricas não serão mais utilizadas.
  // Imagens próprias enviadas no cadastro (data URI) são preservadas.
  function imageForPETItem(item){
    const chosen=String(item?.imagem||"").trim();
    if(/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);/i.test(chosen))return chosen;
    return componentArt(item?.nome);
  }
  window.componentArt=componentArt;
  window.imageForPETItem=imageForPETItem;
})();
