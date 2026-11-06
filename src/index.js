const reply = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
export default {
 async fetch(request, env) {
   const {pathname} = new URL(request.url);
   if (pathname === "/api/health") {
     try {
       const result = await env.DB.prepare("SELECT COUNT(*) AS n FROM categorias").first();
       return reply({ok:true,service:"Inventário PET",database:"connected",categories:result?.n ?? 0});
     } catch (error) {
       return reply({ok:false,service:"Inventário PET",database:"error",detail:String(error.message||error).slice(0,160)},503);
     }
   }
   if (pathname.startsWith("/api/")) return reply({error:"Rota ainda não disponível."},404);
   return env.ASSETS.fetch(request);
 },
 async scheduled(_event, env) {
   await env.DB.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").bind(new Date().toISOString()).run();
 }
};