import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './App.css';

type Free = { id: string; title: string; poster?: string; category?: string; video?: string; url?: string };
type Catalog = { id: string; title: string; scholar?: string; poster?: string; profile?: string; buy?: boolean };
type Film = { key: string; id: string; title: string; poster: string; category: string; scholar: string; video: string; page: string; free: boolean };
const HOME = 'https://allfactstv.com';
const SUBJECTS = ['All films', 'Free to View', 'History & Society', 'Science & Technology', 'Education & Life Skills', 'Industry & Energy', 'Religion & Belief', 'Space & UAP', 'Lectures'];
function poster(value?: string) { return !value ? '' : value.startsWith('/') ? HOME + value : value.startsWith('https://') ? value : ''; }
function normalizeFree(f: Free): Film { return { key: 'f'+f.id, id:f.id, title:f.title, poster:poster(f.poster), category:f.category || 'Free to View', scholar:'', video:f.video || '', page:f.url || '', free:true }; }
function normalizeCatalog(f: Catalog): Film { return { key:'c'+f.id, id:f.id, title:f.title, poster:poster(f.poster), category:'Documentaries & Lectures', scholar:f.scholar || '', video:'', page: f.profile?.startsWith('/') ? HOME+f.profile : HOME, free:false }; }
function Icon({name,size=20}:{name:string,size?:number}) {
  const body:Record<string,ReactNode> = {
    play:<path d="m8 5 11 7-11 7V5Z"/>,
    search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    film:<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/></>,
    right:<path d="m9 18 6-6-6-6"/>,
    left:<path d="m15 18-6-6 6-6"/>,
    x:<path d="M18 6 6 18M6 6l12 12"/>,
    menu:<path d="M4 7h16M4 12h16M4 17h16"/>,
    arrow:<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    globe:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    external:<><path d="M14 4h6v6M20 4l-9 9"/><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/></>,
  };
  return <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{body[name]}</svg>;
}
function Cover({film}:{film:Film}) {
  const [bad,setBad]=useState(false);
  return <div className="cover">{film.poster && !bad ? <img src={film.poster} loading="lazy" alt="" onError={()=>setBad(true)}/> : <div className="cover-fallback"><span>ALL FACTS</span><Icon name="film" size={30}/></div>}</div>;
}
function Shelf({title,kicker,items,onPick}:{title:string,kicker:string,items:Film[],onPick:(f:Film)=>void}) {
  const track=useRef<HTMLDivElement>(null);
  if(items.length===0)return null;
  return <section className="shelf"><div className="shelf-heading"><div><span className="shelf-kicker">{kicker}</span><h2>{title}</h2></div><div className="shelf-buttons"><button aria-label="Previous" onClick={()=>track.current?.scrollBy({left:-700,behavior:'smooth'})}><Icon name="left"/></button><button aria-label="Next" onClick={()=>track.current?.scrollBy({left:700,behavior:'smooth'})}><Icon name="right"/></button></div></div>
    <div className="shelf-track" ref={track}>{items.slice(0,36).map(f=><button className="film-card" onClick={()=>onPick(f)} key={f.key} title={f.title}><Cover film={f}/><span className="card-action"><Icon name="play" size={23}/></span><span className="card-title">{f.title}</span><span className="card-sub">{f.free?'FREE TO VIEW':f.scholar||'DOCUMENTARY'}</span></button>)}</div>
  </section>;
}
function FilmModal({film,onClose}:{film:Film,onClose:()=>void}) {
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',fn);document.body.style.overflow='hidden';return ()=>{window.removeEventListener('keydown',fn);document.body.style.overflow=''}},[onClose]);
  const canPlay=film.free && film.video.startsWith('https://');
  return <div className="modal-screen" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="film-modal" role="dialog" aria-modal="true" aria-label={film.title}><button aria-label="Close" className="close-modal" onClick={onClose}><Icon name="x"/></button>
    {playing && canPlay ? <div className="film-player"><video src={film.video} poster={film.poster} controls autoPlay playsInline preload="metadata"/></div> :
    <div className="modal-art"><Cover film={film}/></div>}
    <div className="modal-copy"><div className="modal-kicker"><span className="green-dot"/> {film.free?'FREE TO VIEW':'ALL FACTS ARCHIVE'}</div><h2>{film.title}</h2><p>{film.scholar || film.category}</p><div className="modal-actions">{canPlay?<button className="primary-btn" onClick={()=>setPlaying(true)}><Icon name="play" size={18}/> Watch now</button>:<a className="primary-btn" href={film.page} target="_blank" rel="noreferrer"><Icon name="external" size={18}/> Film details</a>}<button className="outline-btn" onClick={onClose}>Back to browsing</button></div><small>{film.free?'Playback remains in All Facts TV. The source must remain available.':'Previews and any checkout stay on the existing AllFactsTV.com until independently tested.'}</small></div>
  </div></div>;
}
export default function App(){
  const [free,setFree]=useState<Film[]>([]);
  const [catalog,setCatalog]=useState<Film[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('All films');
  const [selected,setSelected]=useState<Film|null>(null);
  const [menu,setMenu]=useState(false);
  useEffect(()=>{
    const ctrl=new AbortController();
    Promise.all([fetch('/api/free',{signal:ctrl.signal}),fetch('/api/catalog',{signal:ctrl.signal})]).then(async ([fr,cr])=>{
      if(!fr.ok||!cr.ok)throw Error('Catalog fetch failed');
      const f=await fr.json();const c=await cr.json();
      const list=(Array.isArray(f.films)?f.films:[]).map(normalizeFree).filter((x:Film)=>x.video.startsWith('https://'));
      const all=(Array.isArray(c)?c:[]).map(normalizeCatalog);
      setFree(list);setCatalog(all);setLoaded(true);if(!list.length&&!all.length)setError('Catalog is temporarily unavailable.');
    }).catch(e=>{if(e.name!=='AbortError'){setError('Unable to load the live catalog. Please refresh.');setLoaded(true)}});
    return ()=>ctrl.abort();
  },[]);
  const go=(c:string)=>{setCategory(c);setQuery('');setMenu(false);window.scrollTo({top:0,behavior:'smooth'})};
  const hero=useMemo(()=>free.find(f=>f.poster&&/space|science|history|earth|ocean|future/i.test(f.title))||free.find(f=>f.poster)||free[0],[free]);
  const hits=useMemo(()=>{
    const text=query.trim().toLowerCase();
    const matches=(f:Film)=> (!text||[f.title,f.scholar,f.category].join(' ').toLowerCase().includes(text)) && (category==='All films'||(category==='Free to View'&&f.free)||(category==='Lectures'&&!f.free&&!!f.scholar)||(f.free&&category===f.category));
    return {free:free.filter(matches),catalog:catalog.filter(matches)};
  },[free,catalog,query,category]);
  return <div className="layout">
    <aside className={'sidebar '+(menu?'sidebar-open':'')}>
      <button className="brand" onClick={()=>go('All films')} aria-label="All Facts TV home"><span className="brand-mark">AF<span>.</span></span><span className="brand-name">ALL FACTS <b>TV</b><small>EXPLORE EVERYTHING.</small></span></button>
      <div className="sidebar-label">DISCOVER</div>
      <nav aria-label="Discover"><button className={category==='All films'?'active':''} onClick={()=>go('All films')}><Icon name="film" size={18}/> Home</button><button className={category==='Free to View'?'active':''} onClick={()=>go('Free to View')}><Icon name="play" size={18}/> Free to View</button><button className={category==='Lectures'?'active':''} onClick={()=>go('Lectures')}><Icon name="globe" size={18}/> Scholars & Lectures</button></nav>
      <div className="sidebar-label secondary-label">BROWSE SUBJECTS</div><nav aria-label="Subjects">{SUBJECTS.slice(2,-1).map(c=><button className={category===c?'active':''} onClick={()=>go(c)} key={c}><i className="nav-dot"/>{c}</button>)}</nav>
      <div className="sidebar-foot"><b>THE FACTS ARE OUT THERE.</b><p>Independent film. History. Science. Ideas.</p><span>STAGING PREVIEW · 2026</span></div>
    </aside>
    {menu&&<button className="sidebar-scrim" onClick={()=>setMenu(false)} aria-label="Close navigation"/>}
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMenu(true)} aria-label="Open navigation"><Icon name="menu"/></button><div className="mobile-brand">ALL FACTS <b>TV</b></div><label className="search"><Icon name="search"/><input placeholder="Search films, subjects, lecturers..." value={query} onChange={e=>{setQuery(e.target.value);setCategory('All films')}} aria-label="Search films"/>{query&&<button onClick={()=>setQuery('')} aria-label="Clear search"><Icon name="x" size={16}/></button>}</label><div className="top-right"><span className="online"><span className="green-dot"/>LIBRARY ONLINE</span><a href={HOME} target="_blank" rel="noreferrer">MAIN SITE <Icon name="external" size={14}/></a></div></header>
      {!query&&category==='All films'&&<section className="hero"><div className="hero-glow"/>{hero?.poster&&<img className="hero-poster" src={hero.poster} alt="" />}<div className="hero-shade"/><div className="hero-inner"><div className="eyebrow"><span/> THE ALL FACTS COLLECTION</div><h1>WATCH BEYOND<br/><em>THE ORDINARY.</em></h1><p>Documentaries, rare lectures and stories behind the world we live in. Explore the archive. Follow the evidence. Decide for yourself.</p><div className="hero-buttons"><button className="primary-btn" onClick={()=>go('Free to View')}><Icon name="play"/> Start watching free</button><button className="link-btn" onClick={()=>go('Lectures')}>Explore the archive <Icon name="arrow"/></button></div><div className="hero-stats"><div><b>{loaded?catalog.length.toLocaleString():'—'}</b><span>CATALOG TITLES</span></div><div><b>{loaded?free.length.toLocaleString():'—'}</b><span>FREE FILMS</span></div><div><b>24/7</b><span>ON-DEMAND ACCESS</span></div></div></div></section>}
      <div className="body-content"><div className="intro-row"><div><div className="eyebrow eyebrow-dark"><span/> CURATED FOR THE CURIOUS</div><h2>{query?'Search the archive':category==='All films'?'The collection':category}</h2><p>{query?'Results for "'+query+'"':category==='All films'?'Find something worth watching. Go beyond the usual.':'Browse the All Facts TV film archive.'}</p></div><div className="library-stamp"><Icon name="globe" size={22}/><span><b>ONE LIBRARY.</b><small>EVERY PERSPECTIVE.</small></span></div></div>
        <div className="filters" aria-label="Filter films">{SUBJECTS.map(c=><button className={category===c?'filter-active':''} key={c} onClick={()=>go(c)}>{c}</button>)}</div>
        {!loaded&&<div className="loading"><span className="spinner"/> Loading the live All Facts TV library...</div>}
        {error&&<div className="error">{error} <button onClick={()=>window.location.reload()}>Try again</button></div>}
        {loaded&&!error&&<>
          {hits.free.length===0&&hits.catalog.length===0&&<div className="empty"><Icon name="search" size={40}/><h3>No titles found</h3><p>Try another film or subject.</p><button className="outline-btn" onClick={()=>go('All films')}>View all</button></div>}
          <Shelf title={query?'Free films matching your search':'Free to View'} kicker="01 / WATCH INSTANTLY" items={hits.free} onPick={setSelected}/>
          {!query&&category==='All films'&&<>
            <div className="interlude"><span>01 / A DIFFERENT PERSPECTIVE</span><h2>MORE THAN ENTERTAINMENT.<br/><em>A DIFFERENT WAY TO SEE.</em></h2></div>
            <Shelf title="History & Society" kicker="02 / EXPLORE THE PAST" items={free.filter(f=>f.category==='History & Society')} onPick={setSelected}/>
            <Shelf title="Science & Technology" kicker="03 / THE WORLD EXPLAINED" items={free.filter(f=>f.category==='Science & Technology')} onPick={setSelected}/>
            <Shelf title="Education & Life Skills" kicker="04 / KEEP LEARNING" items={free.filter(f=>f.category==='Education & Life Skills')} onPick={setSelected}/>
            <Shelf title="Industry & Energy" kicker="05 / ENGINEERING & PROGRESS" items={free.filter(f=>f.category==='Industry & Energy')} onPick={setSelected}/>
            <Shelf title="Space & UAP" kicker="06 / BEYOND THE HORIZON" items={free.filter(f=>f.category==='Space & UAP')} onPick={setSelected}/>
            <Shelf title="Religion & Belief" kicker="07 / QUESTIONS OF FAITH" items={free.filter(f=>f.category==='Religion & Belief')} onPick={setSelected}/>
          </>}
          <Shelf title={query?'More titles matching your search':category==='Lectures'?'Scholars & Lectures':'Explore the archive'} kicker="08 / THE COMPLETE CATALOG" items={hits.catalog} onPick={setSelected}/>
          {!query&&category==='All films'&&<div className="cta"><div><span>ALL FACTS TV · THE ARCHIVE</span><h2>KEEP LOOKING.<br/>KEEP LEARNING.</h2><p>Hundreds of films to watch now. Thousands of titles to discover.</p></div><button onClick={()=>go('Lectures')}>Browse the archive <Icon name="arrow"/></button></div>}
        </>}
      </div>
      <footer><b>ALL FACTS <span>TV</span></b><span>STAGING PREVIEW — LIVE SITE UNCHANGED</span><a href={HOME} target="_blank" rel="noreferrer">ALLFACTSTV.COM <Icon name="external" size={13}/></a></footer>
    </main>
    {selected&&<FilmModal key={selected.key} film={selected} onClose={()=>setSelected(null)}/>}
  </div>;
}
