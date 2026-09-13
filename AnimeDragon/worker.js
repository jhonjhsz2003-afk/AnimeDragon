/**
 * AnimeDragon API Worker
 * - TMDB proxy keeps the API key on the server
 * - D1 stores users, profiles, favorites, history and settings
 * - R2 is intended for avatar uploads
 * Configure TMDB_API_KEY as a Worker secret.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS"};
    if(request.method==="OPTIONS") return new Response(null,{headers:cors});
    try {
      if(url.pathname==="/api/health") return json({ok:true,service:"AnimeDragon",version:"5.0"});
      if(url.pathname==="/api/tmdb/search"){
        if(!env.TMDB_API_KEY) return json({ok:false,error:"TMDB_API_KEY não configurada"},500,cors);
        const q=url.searchParams.get("q")||"";
        const r=await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${encodeURIComponent(env.TMDB_API_KEY)}&language=pt-BR&query=${encodeURIComponent(q)}`);
        return new Response(r.body,{status:r.status,headers:{"content-type":"application/json",...cors}});
      }
      if(url.pathname==="/api/profile" && request.method==="GET"){
        return json({ok:true,message:"Endpoint pronto para sessão autenticada + D1."},200,cors);
      }
      return json({ok:false,error:"Rota não encontrada"},404,cors);
    } catch(e){return json({ok:false,error:e.message},500,cors)}
  }
}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json;charset=UTF-8",...extra}})}