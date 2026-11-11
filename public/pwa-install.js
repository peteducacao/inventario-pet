/* Instalação oficial como PWA: sem APK/EXE e sem dados privados em cache. */
(()=>{
 let installEvent=null,installedNow=false;
 const standalone=()=>installedNow||Boolean(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
 const instructions=()=>{
  const agent=navigator.userAgent||"";
  if(/iPad|iPhone|iPod/i.test(agent))return "No iPhone ou iPad, abra o Inventário no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início.";
  if(/Android/i.test(agent))return "No Android, abra o Inventário no Chrome, toque no menu ⋮ e selecione Instalar aplicativo ou Adicionar à tela inicial.";
  return "No PC, abra o Inventário no Chrome ou Microsoft Edge e use Instalar aplicativo no menu ⋮ ou no ícone de instalação da barra de endereços.";
 };
 window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installEvent=event;});
 window.addEventListener("appinstalled",()=>{
  installedNow=true;installEvent=null;
  const button=document.getElementById("pet-pwa-install");
  if(button){button.textContent="Aplicativo instalado";button.disabled=true;}
  const help=document.getElementById("pet-pwa-help");
  if(help){help.hidden=false;help.textContent="O Inventário PET foi instalado neste dispositivo.";}
 });
 window.petAppInstallCard=()=>{
  const installed=standalone();
  return '<section class="pet-pwa-card" aria-label="Instalar o aplicativo Inventário PET">'+
   '<div class="pet-pwa-heading"><span class="pet-pwa-icon" aria-hidden="true">↓</span>'+
   '<span class="pet-pwa-copy"><strong>Aplicativo Inventário PET</strong>'+
   '<small>Instale no celular ou computador para abrir pelo ícone do aplicativo. O inventário continua sincronizado pela internet.</small></span></div>'+
   '<button type="button" class="primary-button" id="pet-pwa-install"'+(installed?' disabled':'')+'>'+
   (installed?'✓ Aplicativo instalado':'↓ Baixar aplicativo')+'</button>'+
   '<p class="pet-pwa-help" id="pet-pwa-help" role="status" aria-live="polite" hidden></p></section>';
 };
 window.wirePetAppInstall=()=>{
  const button=document.getElementById("pet-pwa-install");if(!button)return;
  button.addEventListener("click",async()=>{
   const help=document.getElementById("pet-pwa-help");
   if(standalone()){if(help){help.textContent="Você já está usando o aplicativo instalado.";help.hidden=false;}return;}
   if(installEvent){
    const prompt=installEvent;installEvent=null;
    try{
     await prompt.prompt();
     const outcome=await prompt.userChoice;
     if(outcome&&outcome.outcome==="accepted"){
      if(help){help.textContent="Instalação solicitada. Confira o ícone no seu dispositivo.";help.hidden=false;}
     }else if(help){help.textContent=instructions();help.hidden=false;}
    }catch(error){if(help){help.textContent=instructions();help.hidden=false;}}
   }else if(help){help.textContent=instructions();help.hidden=false;}
  });
 };
 if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
   navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(error=>{
    console.warn("Instalação do aplicativo indisponível:",error.message);
   });
  });
 }
})();
