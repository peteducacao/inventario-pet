/* Editor de fotos do catálogo. A imagem é tratada apenas no navegador.
 * Saída padrão 4:3 (720 × 540), com enquadramento sem cortes.
 * Não envia o arquivo ao servidor até o administrador salvar o material. */
async function editPETCatalogPhoto(fileOrData) {
  let srcURL="",temporary=false;
  if(fileOrData instanceof File){
    if(!["image/png","image/jpeg","image/webp"].includes(fileOrData.type))throw Error("Escolha PNG, JPG ou WebP.");
    if(fileOrData.size>14*1024*1024)throw Error("A foto deve ter no máximo 14 MB.");
    srcURL=URL.createObjectURL(fileOrData);temporary=true;
  }else srcURL=String(fileOrData||"");
  const image=new Image();
  try {
    image.src=srcURL;
    await image.decode();
    if(!image.naturalWidth||!image.naturalHeight)throw Error("Não foi possível abrir essa fotografia.");
    return await new Promise(resolve=>{
      const host=document.getElementById("modal-root");
      if(!host){resolve(null);return;}
      const overlay=document.createElement("div");
      overlay.className="modal-overlay pet-crop-overlay";
      overlay.innerHTML='<section class="modal pet-photo-modal" role="dialog" aria-modal="true" aria-label="Ajustar foto do material">'+
        '<header class="modal-header"><h2>Ajustar foto</h2><p>A foto será adaptada para o catálogo no formato 4:3, sem cortar o material.</p></header>'+
        '<div class="pet-photo-content"><canvas id="pet-photo-canvas" width="720" height="540" aria-label="Prévia da foto no catálogo"></canvas>'+
        '<p class="pet-photo-help">Arraste a foto para centralizar. O material inteiro aparece por padrão.</p>'+
        '<div class="pet-photo-toolbar">'+
        '<button class="outline-button" type="button" data-photo-rotate="-90">↺ Girar</button>'+
        '<button class="outline-button" type="button" data-photo-rotate="90">↻ Girar</button>'+
        '<button class="outline-button" type="button" id="pet-photo-reset">Reajustar</button></div>'+
        '<div class="field"><label for="pet-photo-zoom">Tamanho da foto</label>'+
        '<input id="pet-photo-zoom" type="range" min="70" max="240" step="1" value="100">'+
        '<small id="pet-photo-zoom-value">100% · sem cortes</small></div>'+
        '<div class="field"><label for="pet-photo-fit">Enquadramento</label>'+
        '<select id="pet-photo-fit"><option value="contain">Mostrar foto inteira (recomendado)</option>'+
        '<option value="cover">Preencher espaço (pode cortar as bordas)</option></select></div>'+
        '</div><div class="modal-footer pet-photo-footer">'+
        '<button id="pet-photo-cancel" type="button" class="secondary-button">Cancelar</button>'+
        '<button id="pet-photo-apply" type="button" class="primary-button">Usar esta foto</button></div></section>';
      host.appendChild(overlay);
      const canvas=overlay.querySelector("canvas"),ctx=canvas.getContext("2d");
      const zoomInput=overlay.querySelector("#pet-photo-zoom");
      const fitInput=overlay.querySelector("#pet-photo-fit");
      let angle=0,zoom=1,offsetX=0,offsetY=0,dragging=false,oldX=0,oldY=0;
      const close=value=>{overlay.remove();resolve(value);};
      const paint=()=>{
        const width=canvas.width,height=canvas.height;
        ctx.clearRect(0,0,width,height);
        ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
        const rotated=angle%180!==0, iw=rotated?image.naturalHeight:image.naturalWidth,
          ih=rotated?image.naturalWidth:image.naturalHeight;
        const base=(fitInput.value==="cover"?Math.max:Math.min)(width/iw,height/ih);
        const factor=base*zoom;
        ctx.save();ctx.translate(width/2+offsetX,height/2+offsetY);
        ctx.rotate(angle*Math.PI/180);
        ctx.drawImage(image,-image.naturalWidth*factor/2,-image.naturalHeight*factor/2,
          image.naturalWidth*factor,image.naturalHeight*factor);
        ctx.restore();
        overlay.querySelector("#pet-photo-zoom-value").textContent=Math.round(zoom*100)+"%"+
          (fitInput.value==="contain"&&zoom===1?" · sem cortes":" · ajuste manual");
      };
      const reset=()=>{
        zoom=1;offsetX=0;offsetY=0;
        zoomInput.value="100";fitInput.value="contain";paint();
      };
      overlay.querySelectorAll("[data-photo-rotate]").forEach(btn=>btn.onclick=()=>{
        angle=(angle+Number(btn.dataset.photoRotate)+360)%360;
        reset();
      });
      overlay.querySelector("#pet-photo-reset").onclick=()=>{
        angle=0;reset();
      };
      zoomInput.oninput=()=>{zoom=Number(zoomInput.value)/100;paint();};
      fitInput.onchange=()=>{zoom=1;zoomInput.value="100";offsetX=0;offsetY=0;paint();};
      canvas.onpointerdown=e=>{
        dragging=true;oldX=e.clientX;oldY=e.clientY;
        canvas.setPointerCapture(e.pointerId);
      };
      canvas.onpointermove=e=>{
        if(!dragging)return;
        const bounds=canvas.getBoundingClientRect();
        offsetX+=(e.clientX-oldX)*canvas.width/bounds.width;
        offsetY+=(e.clientY-oldY)*canvas.height/bounds.height;
        oldX=e.clientX;oldY=e.clientY;paint();
      };
      canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;};
      overlay.querySelector("#pet-photo-cancel").onclick=()=>close(null);
      overlay.onclick=e=>{if(e.target===overlay)close(null);};
      overlay.querySelector("#pet-photo-apply").onclick=()=>{
        // Resolução e compressão progressivas respeitam o limite atual de D1/API.
        let result="";
        const sizes=[720,640,560,480,400];
        for(const width of sizes) {
          const target=document.createElement("canvas");
          target.width=width;target.height=width*3/4;
          target.getContext("2d").drawImage(canvas,0,0,width,target.height);
          for(const quality of [.83,.72,.6,.48,.36]){
            result=target.toDataURL("image/webp",quality);
            if(!result.startsWith("data:image/webp"))result=target.toDataURL("image/jpeg",quality);
            if(result.length<=106000)break;
          }
          if(result.length<=106000)break;
        }
        if(result.length>106000) {
          const warning=overlay.querySelector(".pet-photo-help");
          warning.textContent="Imagem muito grande. Tente recortar o fundo ou escolher outra foto.";
          return;
        }
        close(result);
      };
      paint();
    });
  } finally {if(temporary)URL.revokeObjectURL(srcURL);}
}
