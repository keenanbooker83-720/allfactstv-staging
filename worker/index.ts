const ENDPOINTS: Record<string,string> = {
  '/api/catalog': 'https://allfactstv.com/catalog-search.json',
  '/api/free': 'https://allfactstv.com/assets/firetv-free-catalog.json',
};
export default {
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if(path === '/api/health') {
      return Response.json({service:'All Facts TV staging',status:'ok',source:'live read-only feeds'});
    }
    const upstream = ENDPOINTS[path];
    if(!upstream) return new Response('Not found',{status:404});
    try {
      const reply = await fetch(upstream, {headers:{'Accept':'application/json','User-Agent':'AllFactsTV-Staging/1.0'}, signal:AbortSignal.timeout(12000)});
      if(!reply.ok) return Response.json({error:'upstream-unavailable'}, {status:502});
      return new Response(reply.body, {status:200,headers:{
        'Content-Type':'application/json; charset=utf-8',
        'Cache-Control':'public, max-age=180, stale-while-revalidate=600',
        'X-Content-Type-Options':'nosniff'
      }});
    } catch {
      return Response.json({error:'upstream-timeout'},{status:503});
    }
  }
} satisfies ExportedHandler<Env>;
