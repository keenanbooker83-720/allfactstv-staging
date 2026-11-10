// Keep the production Pages catalog dynamic. Apply exact user-curated assignments
// to upstream JSON responses until Pages background publication catches up.
const FILM_PROFILE_TARGETS={
 "steve-cokely--2pac-biggie-with-khalid":"/lecturers/khalid-abdul-muhammad/#steve-cokely-2pac-biggie-with-khalid",
 "iso--message-to-the-black-man-1973-d3e122925":"/lecturers/min-elijah-muhammad/#iso-message-to-the-black-man-1973-d3e122925"
};
function alteredResponse(body,origin,contentType){
 const headers=new Headers(origin?.headers||{});
 headers.set("Content-Type",contentType);
 headers.set("Cache-Control","no-store");
 headers.delete("Content-Length");
 headers.delete("Content-Encoding");
 headers.delete("ETag");
 return new Response(body,{status:origin?.status||200,headers});
}
async function curatedJson(request,path){
 const result=await fetch(request);
 if(!result.ok)return result;
 let obj;
 try{obj=await result.json()}catch{return new Response("Upstream data unavailable",{status:502})}
 if(path==="/category-taxonomy.json"){
  if(!obj||typeof obj.categories!=="object")return alteredResponse(JSON.stringify(obj),result,"application/json; charset=utf-8");
  for(const [id,fix] of Object.entries(CURATIONS)){
   for(const cat of fix.remove||[]){
    if(Array.isArray(obj.categories[cat]))obj.categories[cat]=obj.categories[cat].filter(x=>x!==id);
   }
   for(const cat of fix.add||[]){
    if(!Array.isArray(obj.categories[cat]))obj.categories[cat]=[];
    if(!obj.categories[cat].includes(id))obj.categories[cat].push(id);
   }
  }
  for(const id of SUPPRESSED_IDS)for(const cat of Object.keys(obj.categories)){
   if(Array.isArray(obj.categories[cat]))obj.categories[cat]=obj.categories[cat].filter(x=>x!==id);
  }
  obj.categories=Object.fromEntries([
   ...GROUP_ORDER.map(name=>[name,obj.categories[name]||[]]),
   ...Object.entries(obj.categories).filter(([name])=>!GROUP_ORDER.includes(name))
  ]);
 }else{
  const films=Array.isArray(obj)?obj:Array.isArray(obj?.films)?obj.films:[];
  if(Array.isArray(obj))obj=obj.filter(f=>!SUPPRESSED_IDS.includes(f?.id));
  else if(Array.isArray(obj?.films))obj.films=obj.films.filter(f=>!SUPPRESSED_IDS.includes(f?.id));
  for(const f of films){
   const fix=CURATIONS[f?.id];
   if(fix?.scholar){
    f.scholar=fix.scholar;
    if(path==="/catalog-search.json"&&FILM_PROFILE_TARGETS[f.id])f.profile=FILM_PROFILE_TARGETS[f.id];
   }
  }
 }
 return alteredResponse(JSON.stringify(obj),result,"application/json; charset=utf-8");
}
async function correctedLecturerPage(request,path){
 const result=await fetch(request);
 if(!result.ok)return result;
 const upstream=await result.text();
 const correction=PROFILE_PAGES[path];
 if(!correction)return alteredResponse(upstream,result,"text/html; charset=utf-8");
 const hasMarker=upstream.includes(correction.marker);
 // Prefer the source site once the canonical Pages version is corrected.
 if(hasMarker===correction.wantMarker)return alteredResponse(upstream,result,"text/html; charset=utf-8");
 return alteredResponse(correction.html,result,"text/html; charset=utf-8");
}
export default {async fetch(request){
 const u=new URL(request.url);
 const p=u.pathname;
 if(request.method==="GET"&&p===SHAKA_BUNDLE_PATH)return new Response(SHAKA_BUNDLE_CODE,{headers:{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff"}});
 if((p.startsWith("/watch/")&&p.split("/")[2]&&SUPPRESSED_IDS.includes(decodeURIComponent(p.split("/")[2])))||(p==="/watch/"&&SUPPRESSED_IDS.includes(u.searchParams.get("film_id"))))return new Response("Film not found",{status:404,headers:{"Cache-Control":"no-store"}});
 if(p==="/"||p==="/audio-lectures/"||p==="/audio-lectures"){
  return new Response(PAGE,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-cache, no-store, must-revalidate","X-Content-Type-Options":"nosniff","Referrer-Policy":"strict-origin-when-cross-origin"}});
 }
 if(request.method==="GET"){
  if(p==="/category-taxonomy.json"||p==="/catalog-search.json"||p==="/film-library.json")return curatedJson(request,p);
  const canonical=p.endsWith("/")?p:p+"/";
  if(Object.prototype.hasOwnProperty.call(PROFILE_PAGES,canonical))return correctedLecturerPage(request,canonical);
 }
 return fetch(request);
}};