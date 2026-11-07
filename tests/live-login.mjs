// Executa um teste real de login no Workers.dev e remove a conta de teste.
import assert from "node:assert/strict";
import {randomBytes} from "node:crypto";
const root="https://inventario-pet.pet-educacao.workers.dev";
const newLogin="teste"+Date.now().toString(36);
const password="Teste!"+randomBytes(14).toString("hex");
const nextPassword="Nova!"+randomBytes(14).toString("hex");
const send=async(path,body=null,cookie="")=>{
  const response=await fetch(root+path,{
    method:body===null?"GET":"POST",
    headers:{...(body===null?{}:{"content-type":"application/json"}),...(cookie?{cookie}:{})},
    ...(body===null?{}:{body:JSON.stringify(body)})
  });
  let data;
  try{data=await response.json();}
  catch{throw Error(path+" retornou status HTTP "+response.status+" sem JSON. Verifique CPU/limites do Cloudflare.");}
  return {status:response.status,data,cookie:response.headers.get("set-cookie")?.split(";")[0]||""};
};
if(!process.env.ADMIN_PASSWORD)throw Error("Senha administrativa ausente no ambiente de teste");
const admin=await send("/api/login",{senha:process.env.ADMIN_PASSWORD});
assert.equal(admin.status,200,"Login admin indisponível");
let profile=null;
try{
  const signup=await send("/api/identity/register",{nome:"TESTE AUTOMATICO - excluir",email:newLogin+"@example.com",login:newLogin,senha:password});
  assert.equal(signup.status,201,"Cadastro público falhou: "+JSON.stringify(signup.data));
  profile=signup.data.usuario;
  assert.equal(profile.login,newLogin);
  assert.equal(profile.tag,"visitante");
  const who=await send("/api/identity/me",null,signup.cookie);
  assert.equal(who.data.usuario?.id,profile.id);
  const bad=await send("/api/identity/login",{login:newLogin,senha:"senha-incorreta"});
  assert.equal(bad.status,401);
  const signed=await send("/api/identity/login",{login:newLogin,senha:password});
  assert.equal(signed.status,200,"Login não funcionou");
  assert.equal(signed.data.usuario.id,profile.id);
  const reset=await send("/api/admin/users/password",{id:profile.id,login:newLogin},admin.cookie);
  assert.equal(reset.status,200,"Reset admin falhou");
  assert.ok(reset.data.senha_temporaria);
  const revoked=await send("/api/identity/me",null,signed.cookie);
  assert.equal(revoked.data.usuario,null,"Reset não invalidou sessão antiga");
  const temp=await send("/api/identity/login",{login:newLogin,senha:reset.data.senha_temporaria});
  assert.equal(temp.status,200);
  assert.equal(temp.data.usuario.trocar_senha,true);
  const changed=await send("/api/identity/password",{nova_senha:nextPassword},temp.cookie);
  assert.equal(changed.status,200);
  assert.equal(changed.data.usuario.trocar_senha,false);
  const final=await send("/api/identity/login",{login:newLogin,senha:nextPassword});
  assert.equal(final.status,200);
  console.log("LOGIN REAL OK: cadastro, sessão, autenticação, reset de senha e troca obrigatória.");
}finally{
  if(profile){
    const deleted=await send("/api/admin/users/delete",{id:profile.id},admin.cookie);
    assert.equal(deleted.status,200,"Não conseguiu excluir usuário técnico: "+JSON.stringify(deleted.data));
    console.log("Conta técnica de teste excluída do D1.");
  }
}
