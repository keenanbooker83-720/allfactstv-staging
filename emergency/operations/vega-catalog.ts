/**
 * Read-only AllFactsTV catalog adapter for Amazon Vega React Native.
 * No payment bypass, private master URLs, DRM keys or hardcoded credentials.
 */
export const FACTS_SITE = 'https://allfactstv.com';
export const FACTS_GATEWAY = 'https://allfactstv-stream-gateway.keenanbooker83.workers.dev';

export type VegaFilm = {
  id: string;
  title: string;
  scholar: string;
  category: string;
  poster: string;
  previewUrl: string | null;
  free: boolean;
};
type FeedItem = {id?: string; title?: string; category?: string; scholar?: string; poster?: string; video?: string; preview?: string};
const isHttps = (url: unknown): url is string =>
  typeof url === 'string' && url.startsWith('https://');

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {headers:{Accept:'application/json'}});
  if(!response.ok) throw new Error('Catalog request failed: HTTP '+response.status);
  return response.json();
}

export async function fetchAllFactsFilms(): Promise<{free: VegaFilm[]; previews: VegaFilm[]}> {
  // These exact endpoints are already consumed by the existing Fire OS app.
  const [freeData, previewData] = await Promise.all([
    getJson(FACTS_SITE+'/assets/firetv-free-catalog.json'),
    getJson(FACTS_GATEWAY+'/api/tv-catalog')
  ]);
  const extract = (data: unknown): FeedItem[] => {
    if(!data || typeof data!=='object' || !('films' in data)) return [];
    const films=(data as {films?:unknown}).films;
    return Array.isArray(films)?films as FeedItem[]:[];
  };
  const free = extract(freeData).filter(f=>f.id && isHttps(f.video))
    .map((f):VegaFilm=>({
      id:String(f.id),title:String(f.title||'Untitled'),
      scholar:String(f.scholar||''),category:String(f.category||'Free to View'),
      poster:isHttps(f.poster)?f.poster:'',
      previewUrl:f.video||null,free:true
    }));
  const previews = extract(previewData).filter(f=>f.id && isHttps(f.preview))
    .map((f):VegaFilm=>({
      id:String(f.id),title:String(f.title||'Untitled'),
      scholar:String(f.scholar||''),category:String(f.category||'Documentary Previews'),
      poster:isHttps(f.poster)?f.poster:'',
      previewUrl:f.preview||null,free:false
    }));
  return {free,previews};
}

export async function fetchFilmPreview(id:string): Promise<string|null> {
  if(!/^[a-z0-9-]{1,180}$/.test(id)) throw new Error('Invalid film ID');
  const response=await getJson(FACTS_GATEWAY+'/api/film?id='+encodeURIComponent(id));
  if(!response || typeof response!=='object') return null;
  const preview=(response as {preview?:unknown}).preview;
  return isHttps(preview)?preview:null;
}