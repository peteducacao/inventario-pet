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

    sharpener:()=>'<g transform="rotate(-14 200 122)">'+
      '<path d="M135 65h130l18 26v104l-18 18H135l-18-18V84Z" fill="#2c9db2" stroke="#295d70" stroke-width="5"/>'+
      r(146,87,109,82,"#d9e3e8",9,'stroke="#9daeb7" stroke-width="4"')+
      '<path d="M154 107l94-6-12 42-88 7Z" fill="#abbec9" stroke="#718d9f" stroke-width="3"/>'+
      circ(200,123,9,"#536d7e","#dfe6e8",3)+
      '<ellipse cx="120" cy="137" rx="17" ry="25" fill="#192e40" stroke="#9eb5c2" stroke-width="5"/>'+
      '</g>'+t("APONTADOR"),
    utilityKnife:()=>'<g transform="rotate(-22 200 125)">'+
      r(92,107,215,54,"#edbe4c",14,'stroke="#ae7d37" stroke-width="4"')+
      r(127,119,141,28,"#364c5d",10)+r(187,117,34,30,"#a4bac8",4)+
      '<path d="M307 113h46l24 21-24 22h-46Z" fill="#cad6dc" stroke="#899ca8" stroke-width="3"/>'+
      '<path d="M327 115v40" stroke="#8b9fa9" stroke-width="3"/></g>'+t("ESTILETE"),
    sanding:()=>'<g transform="rotate(-14 200 125)">'+
      r(98,75,203,112,"#ba9361",9,'stroke="#8a714e" stroke-width="5"')+
      r(117,89,165,82,"#d7b27c",6)+
      Array.from({length:40},(_,i)=>circ(123+(i%10)*17,95+Math.floor(i/10)*21,2,"#9a7b55")).join("")+
      '</g>'+t("LIXA"),
    clips:()=>[0,1,2].map((i)=>'<g transform="translate('+(i*78)+',0) rotate(-10 105 137)">'+
      '<path d="M130 86v86a24 24 0 0 1-48 0V109a12 12 0 0 1 24 0v59" stroke="'+["#809baa","#438a9b","#bd9d70"][i]+'" stroke-width="8" fill="none" stroke-linecap="round"/></g>').join("")+t("CLIPE"),
    pin:()=>[0,1,2].map((i)=>'<g transform="translate('+(i*78)+',0)">'+
      '<path d="M94 90h54l-8 55H103Z" fill="'+["#e16e68","#4c9aab","#e7c465"][i]+'" stroke="#58778b" stroke-width="3"/>'+
      line(121,145,121,195,"#9caeb9",6)+circ(121,86,27,["#e16e68","#4c9aab","#e7c465"][i])+'</g>').join("")+t("PERCEVEJO"),
    solder:()=>'<g>'+circ(200,130,74,"#d1dbe1","#667d8b",7)+
      circ(200,130,50,"#9cadb9","#607d8f",7)+circ(200,130,24,"#e5f0f5","#879eab",5)+
      '<path d="M138 87q-25 38-9 79M152 75q-30 42-16 91M251 78q30 42 16 91" fill="none" stroke="#8c9dad" stroke-width="7"/>'+
      '<path d="M263 175C303 208 319 187 331 197" stroke="#8c9dad" stroke-width="6" fill="none"/></g>'+t("ESTANHO"),
    nozzle:()=>'<g>'+r(161,51,78,50,"#deb35e",9,'stroke="#ac8247" stroke-width="4"')+
      r(178,42,44,18,"#b5843e",3)+
      '<path d="M162 102h76l-9 51-25 46h-8l-25-46Z" fill="#cda14d" stroke="#956b30" stroke-width="5"/>'+
      '<path d="M194 183h12v16h-12z" fill="#9a6f34"/></g>'+t("BICO 3D"),
    stepper:()=>'<g>'+r(116,80,165,131,"#879eaa",16,'stroke="#526a7a" stroke-width="5"')+
      Array.from({length:4},(_,i)=>line(124,99+i*27,267,99+i*27,"#aabdc8",6)).join("")+
      circ(199,135,61,"#b8c8d0","#567387",6)+circ(199,135,32,"#7c94a1")+
      circ(199,135,14,"#d5e0e5")+
      line(199,75,199,39,"#879ea9",12)+'</g>'+t("MOTOR DE PASSO"),
    pot:()=>'<g>'+r(129,102,142,98,"#3399ac",13,'stroke="#26758b" stroke-width="4"')+
      circ(200,108,53,"#d2dce0","#8a9fae",7)+circ(200,108,22,"#9eb6c3","#628196",4)+
      line(200,108,200,65,"#647f91",9)+[155,200,245].map(x=>line(x,197,x,223,"#ac9c70",7)).join("")+'</g>'+t("POTENCIÔMETRO"),
    charger:()=>'<g>'+r(131,68,142,152,"#263b4d",18,'stroke="#647e8d" stroke-width="4"')+
      r(149,81,106,83,"#364f61",12)+[0,1].map(i=>r(162+i*48,92,34,61,"#c5d1d9",17)+
      r(165+i*48,100,28,44,"#dcbf63",12)).join("")+r(170,175,66,18,"#4bb79a",6)+
      line(269,187,310,196,"#344b5c",8)+'</g>'+t("CARREGADOR"),
    connector:()=>'<g>'+r(104,98,147,85,"#2a3f51",9)+
      r(120,111,116,58,"#4e6272",5)+
      [134,160,186,212].map(x=>r(x,124,10,32,"#b3c3cb",2)).join("")+
      '<path d="M250 140C285 127 282 175 320 155" fill="none" stroke="#cf5852" stroke-width="8"/>'+
      '<path d="M251 158C275 173 285 204 320 196" fill="none" stroke="#202e3d" stroke-width="8"/></g>'+t("CONECTOR"),
    lightSensor:()=>plate("#21687a")+circ(200,119,45,"#d0b56a","#8e8045",5)+
      Array.from({length:6},(_,i)=>line(173+i*10,87,178+i*10,148,"#826e37",3)).join("")+t("LDR"),
    temperatureSensor:()=>plate("#2b677b")+
      r(165,77,70,106,"#c4d2d8",9,'stroke="#6e8795" stroke-width="4"')+
      '<path d="M200 91v61" stroke="#d75f61" stroke-width="9" stroke-linecap="round"/>'+
      circ(200,162,16,"#d75f61")+t("TEMPERATURA"),
    soundSensor:()=>plate("#236778")+circ(197,123,55,"#353d48","#8ca5af",6)+
      Array.from({length:6},(_,i)=>circ(174+(i%3)*22,107+Math.floor(i/3)*26,5,"#9faeb8")).join("")+t("SOM"),
    waterSensor:()=>plate("#20747b")+
      '<path d="M201 70C169 116 149 137 149 163a51 51 0 0 0 102 0c0-26-21-47-50-93Z" fill="#78c7e0" stroke="#3a96b7" stroke-width="5"/>'+
      '<path d="M168 171q28 24 60-1" stroke="#e1f8fc" stroke-width="8" fill="none"/>'+t("ÁGUA"),
    keyMatrix:()=>plate("#255879")+
      Array.from({length:12},(_,i)=>r(144+(i%3)*37,83+Math.floor(i/3)*28,27,20,"#dde8ef",4,'stroke="#7f9aa9" stroke-width="2"')).join("")+
      t("TECLADO"),
    glueGun:()=>'<g><path d="M112 97h178v45h-61l-21 64h-51l13-64h-58Z" fill="#43a3aa" stroke="#286878" stroke-width="5"/>'+
      r(280,110,40,15,"#b5c6d0",3)+r(133,112,85,17,"#d8e6e9",4)+
      '<path d="M186 152l-20 33" stroke="#2b7781" stroke-width="7"/>'+
      '<path d="M190 204q45 10 50 29" fill="none" stroke="#536f82" stroke-width="7"/></g>'+t("PISTOLA DE COLA"),
    adhesiveStick:()=>'<g>'+r(158,91,84,113,"#e4edf0",10,'stroke="#a2b5c0" stroke-width="5"')+
      r(165,140,70,53,"#4fbba5",5)+r(173,75,54,17,"#f3e5ae",4)+
      r(162,59,76,19,"#bbd6e0",5)+'</g>'+t("COLA BASTÃO"),
    tripod:()=>'<g>'+r(150,49,103,73,"#273c4f",12)+circ(201,85,22,"#6aaabf")+
      line(202,120,202,156,"#8198a5",9)+
      line(202,156,128,215,"#8198a5",8)+line(202,156,271,215,"#8198a5",8)+
      line(202,156,202,215,"#8198a5",8)+'</g>'+t("KIT DE GRAVAÇÃO"),
    stand:()=>'<g>'+r(115,176,172,24,"#8098a6",8)+line(200,175,200,86,"#9aafbc",12)+
      r(162,69,76,35,"#4b6b80",8)+r(169,75,62,21,"#9ac6d1",3)+'</g>'+t("SUPORTE"),
        generic:()=>plate()+t("COMPONENTE")
  };
  const normalize=name=>String(name||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function categoryFor(name){
    const n=normalize(name);
    // Ordem de prioridade importa: "Fonte de Arduino" é fonte, não placa Arduino.
    if(/apontador/.test(n))return "sharpener";
    if(/estilete/.test(n))return "utilityKnife";
    if(/tesoura/.test(n))return "scissors";
    if(/lixa|polimento/.test(n))return "sanding";
    if(/percevejo/.test(n))return "pin";
    if(/\bclipe\b|\bclips\b/.test(n))return "clips";
    if(/rolos? de estanho|solda|estanho/.test(n))return "solder";
    if(/bico.*impressora|bico.*3d/.test(n))return "nozzle";
    if(/pistola.*cola/.test(n))return "glueGun";
    if(/bastao.*cola|cola bastao/.test(n))return "adhesiveStick";
    if(/kit de gravacao/.test(n))return "tripod";
    if(/teclado/.test(n))return "keyMatrix";
    if(/sensor.*(?:temperatura|termometro)|temperatura/.test(n))return "temperatureSensor";
    if(/sensor.*(?:luminosidade|ldr)|\bldr\b/.test(n))return "lightSensor";
    if(/sensor.*som/.test(n))return "soundSensor";
    if(/medidor de agua|mistura de agua|deteccao.*agua/.test(n))return "waterSensor";
    if(/motor de passo|motor de posso|motor passo/.test(n))return "stepper";
    if(/potenciometro/.test(n))return "pot";
    if(/carregador.*pilha|carregador.*bateria|carregador.*usb|carregadores? usb|fonte de carregador/.test(n))return "charger";
    if(/conector.*(?:clip|bateria)|clip de bateria/.test(n))return "connector";
    if(/suporte.*arduino/.test(n))return "stand";
    if(/adaptador de bateria|suporte.*bateria|suporte.*pilha/.test(n))return "holder";
    if(/fonte|regulador|alimentacao/.test(n))return "power";
    if(/esp[\s-]*32/.test(n))return "esp32";
    if(/\btablet\b/.test(n))return "tablet";
    if(/notebook|laptop/.test(n))return "notebook";
    if(/arduino/.test(n))return "arduino";
    if(/micro\s*servo|servo/.test(n))return "servo";
    if(/motor\s*dc|mini motor/.test(n))return "motor";
    if(/visor|display|lcd/.test(n))return "lcd";
    if(/capacitor/.test(n))return "capacitor";
    if(/\bled\b/.test(n))return "led";
    if(/sensor ultra|ultrasson|ultrason/.test(n))return "sensor";
    if(/interruptor|gangorra/.test(n))return "switch";
    if(/botao|botoes/.test(n))return "button";
    if(/jumper|fio eletrico|cabo jumper/.test(n))return "jumper";
    if(/protoboard/.test(n))return "proto";
    if(/rele/.test(n))return "relay";
    if(/adaptador de cartao|leitor de cartao/.test(n))return "sd";
    if(/pilha|bateria|recarregavel/.test(n))return "battery";
    if(/resistor/.test(n))return "resistor";
    if(/sensor|infravermelh|vibracao/.test(n))return "sensor";
    if(/joystick|joystique/.test(n))return "joystick";
    if(/buzzer/.test(n))return "buzzer";
    if(/roda|rodinha/.test(n))return "wheel";
    if(/helice/.test(n))return "fan";
    if(/microfone/.test(n))return "mic";
    if(/projetor/.test(n))return "projector";
    if(/camera|filmagem/.test(n))return "camera";
    if(/fusivel|transistor|ponte h|placa|plaquinha|modulo|driver/.test(n))return "trans";
    if(/usb|tipo c|\bv8\b/.test(n))return "usb";
    if(/papel|resma|folha|cartolina|guardanapo/.test(n))return "paper";
    if(/toalha|tecido|renda|passadeira/.test(n))return "cloth";
    if(/fita|durex/.test(n))return "tape";
    if(/cola/.test(n))return "glue";
    if(/alcool/.test(n))return "vial";
    if(/regua/.test(n))return "ruler";
    if(/porca|ruelo|parafuso/.test(n))return "nuts";
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
  window.componentArtKind=categoryFor;
  window.imageForPETItem=imageForPETItem;
})();
