#!/usr/bin/env python3
"""AllFactsTV independent video pipeline tools. No cloud writes or purchases."""
import argparse, datetime, hashlib, json, os, re, shutil, subprocess, sys, tempfile, urllib.request
from pathlib import Path

DEFAULT_CATALOG = Path(r"C:\Users\strea\Desktop\allfactstv-media\stream-gateway\src\catalog.json")
DEFAULT_IMPORTS = Path(r"D:\Conscious-Films-Migration\allfactstv-g-importer-state.json")
ROOT = Path(__file__).resolve().parent
QUALITY = [(480, 1200000, 96000), (720, 2600000, 128000), (1080, 4800000, 160000)]

def timestamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def sha256(path):
    h=hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''):
            h.update(b)
    return h.hexdigest()

def load_json(path):
    with open(path, encoding='utf-8-sig') as f:
        return json.load(f)

def write_json_atomic(path, obj):
    path=Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix='.staging-', suffix='.json', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(obj, f, indent=2, ensure_ascii=False)
            f.write('\n')
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def media_probe(path):
    ffprobe=shutil.which('ffprobe')
    if not ffprobe: raise RuntimeError('FFprobe missing. Install FFmpeg before encoding.')
    proc=subprocess.run([ffprobe,'-v','error','-show_entries',
         'format=duration:stream=codec_type,width,height,codec_name','-of','json',str(path)],
         capture_output=True,text=True,check=True,timeout=90)
    data=json.loads(proc.stdout)
    videos=[s for s in data.get('streams',[]) if s.get('codec_type')=='video']
    if not videos: raise ValueError('No video stream found')
    v=videos[0]
    return dict(width=int(v['width']),height=int(v['height']),
                duration=float(data.get('format',{}).get('duration') or 0),
                audio=any(s.get('codec_type')=='audio' for s in data.get('streams',[])),
                codec=v.get('codec_name','unknown'))

def audit(args):
    items=load_json(Path(args.catalog))
    if not isinstance(items,dict): raise ValueError('Catalog must be a JSON object')
    counts=dict(catalog=len(items), master_linked=0, preview_referenced=0,
                checkout_linked=0, metadata_ready=0, missing_master=0,
                missing_preview=0, missing_checkout=0, marked_ready=0)
    problems=[]
    for key,v in items.items():
        if not isinstance(v,dict): continue
        master=bool(v.get('full_r2_key'))
        preview=(v.get('preview_r2_key')=='previews/'+key+'.mp4' and
                 int(v.get('preview_clip_seconds') or 0)>=120)
        payment=bool(v.get('payment_link_url') and v.get('payment_link_id'))
        ready=master and preview and payment and bool(v.get('stream_ready'))
        counts['master_linked']+=master
        counts['preview_referenced']+=bool(v.get('preview_r2_key'))
        counts['checkout_linked']+=bool(v.get('payment_link_url'))
        counts['marked_ready']+=bool(v.get('stream_ready'))
        counts['metadata_ready']+=ready
        if master and not ready:
            missing=[]
            if not preview: counts['missing_preview']+=1; missing.append('preview')
            if not payment: counts['missing_checkout']+=1; missing.append('checkout')
            if missing: problems.append(dict(id=key,missing=missing))
        if not master: counts['missing_master']+=1
    imports={}
    p=Path(args.imports)
    if p.is_file():
        q=load_json(p)
        for v in q.values():
            if isinstance(v,dict):
                s=str(v.get('status','unknown'))
                imports[s]=imports.get(s,0)+1
    result=dict(audited_utc=timestamp(),counts=counts,import_status=imports,
                incomplete_master_linked=problems, note='Metadata only; does NOT independently verify R2 object existence, playable previews or valid Stripe sessions.')
    if args.report:write_json_atomic(args.report,result)
    print(json.dumps({k:v for k,v in result.items() if k!='incomplete_master_linked'},indent=2))
    print('INCOMPLETE_MASTER_LINKED',len(problems))
    return result

def snapshot(args):
    src=Path(args.catalog)
    if not src.is_file(): raise FileNotFoundError(src)
    target=ROOT/'snapshots'
    target.mkdir(exist_ok=True)
    name='catalog-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')+'.json'
    out=target/name
    shutil.copy2(src,out)
    digest=sha256(out)
    (target/(name+'.sha256')).write_text(digest+'  '+name+'\n',encoding='utf-8')
    print(json.dumps(dict(backup=str(out),bytes=out.stat().st_size,sha256=digest),indent=2))

def encode(args):
    src=Path(args.source)
    if not src.is_file(): raise FileNotFoundError(src)
    name=args.film_id or re.sub('[^a-z0-9]+','-',src.stem.lower()).strip('-')
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,119}',name):
        raise ValueError('Film ID must be a safe lowercase ASCII slug')
    meta=media_probe(src)
    heights=[x for x in QUALITY if x[0]<=meta['height']]
    if not heights:
        h=max(2,meta['height']-(meta['height']%2))
        heights=[(h,700000,64000)]
    if args.only_height:
        heights=[x for x in heights if x[0]==args.only_height]
        if not heights:raise ValueError('Requested rendition exceeds original source resolution')
    destination=Path(args.output).resolve()/name
    if destination.exists():raise FileExistsError('Output already exists; refusing overwrite: '+str(destination))
    plan=dict(source=str(src),input=meta,destination=str(destination),
              renditions=[dict(height=h,video_bps=b,audio_bps=a) for h,b,a in heights],
              planned_utc=timestamp(),run=bool(args.run),
              security='Local staging only. Do not publish paid segments without per-segment entitlement checks.')
    print(json.dumps(plan,indent=2))
    if not args.run:return
    ffmpeg=shutil.which('ffmpeg')
    if not ffmpeg: raise RuntimeError('FFmpeg missing')
    staging=Path(args.output).resolve()/('.building-'+name)
    if staging.exists():raise FileExistsError('Partial directory exists; manual inspection required: '+str(staging))
    staging.mkdir(parents=True)
    streams=[]
    try:
        for h,vb,ab in heights:
            sub=staging/(str(h)+'p')
            sub.mkdir()
            playlist=sub/'index.m3u8'
            cmd=[ffmpeg,'-hide_banner','-loglevel','error','-nostdin','-y','-i',str(src),
                '-map','0:v:0','-vf',f'scale=-2:{h}',
                '-c:v','libx264','-preset','veryfast','-pix_fmt','yuv420p',
                '-b:v',str(vb),'-maxrate',str(int(vb*1.10)),'-bufsize',str(vb*2),
                '-force_key_frames','expr:gte(t,n_forced*6)']
            if meta['audio']:
                cmd+=['-map','0:a:0','-c:a','aac','-b:a',str(ab),'-ac','2']
            else:
                cmd+=['-an']
            cmd+=['-hls_time','6','-hls_playlist_type','vod',
                  '-hls_flags','independent_segments','-hls_segment_filename',
                  str(sub/'segment_%06d.ts'),str(playlist)]
            subprocess.run(cmd,check=True)
            contents=playlist.read_text(encoding='utf-8')
            segments=[x for x in contents.splitlines() if x and not x.startswith('#')]
            if '#EXT-X-ENDLIST' not in contents or not segments or not all((sub/x).is_file() for x in segments):
                raise RuntimeError('HLS playlist failed segment validation: '+str(playlist))
            dimensions=media_probe(next(sub.glob('segment_*.ts')))
            streams.append(dict(path=f'{h}p/index.m3u8',
                     bandwidth=int((vb+(ab if meta['audio'] else 0))*1.25),
                     resolution=f"{dimensions['width']}x{dimensions['height']}",
                     segments=len(segments)))
        master=['#EXTM3U','#EXT-X-VERSION:3']
        for s in streams:
            master.append(f"#EXT-X-STREAM-INF:BANDWIDTH={s['bandwidth']},RESOLUTION={s['resolution']}")
            master.append(s['path'])
        (staging/'master.m3u8').write_text('\n'.join(master)+'\n',encoding='utf-8')
        write_json_atomic(staging/'build-report.json',dict(**plan,streams=streams,completed_utc=timestamp()))
        staging.rename(destination)
        print(json.dumps(dict(success=True,output=str(destination),streams=streams),indent=2))
    except Exception:
        print('ENCODE FAILED: partial output preserved for inspection at '+str(staging),file=sys.stderr)
        raise

def health(args):
    urls=['https://allfactstv.com/streaming/',
          'https://allfactstv-stream-gateway.keenanbooker83.workers.dev/health']
    result=[]
    for url in urls:
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'AllFactsTV-Health-ReadOnly/1.0'})
            with urllib.request.urlopen(req,timeout=12) as r:
                raw=r.read(2048)
                response={'url':url,'status':r.status,'content_bytes_sampled':len(raw)}
                if url.endswith('/health'):
                    try: response['payload']=json.loads(raw)
                    except (ValueError,UnicodeDecodeError):pass
                result.append(response)
        except Exception as e:result.append(dict(url=url,error=str(e)))
    print(json.dumps(dict(checked_utc=timestamp(),services=result),indent=2))

def costs(args):
    gb=float(args.gb); viewers=int(args.viewers);mbps=float(args.mbps);hours=float(args.hours)
    if min(gb,viewers,mbps,hours)<0: raise ValueError('Values must be nonnegative')
    storage=max(0,gb-10)*0.015
    gb_per_month=viewers*mbps*0.45*hours*30
    print(json.dumps(dict(r2_gb=gb,r2_storage_estimate_usd_month=round(storage,2),
        r2_egress_estimate_usd=0,concurrent_gbps=round(viewers*mbps/1000,2),
        delivery_tb_month=round(gb_per_month/1000,2),
        exclusions='R2 operations, Workers, CDN/WAF, encoding CPU, backup provider, payment processing and taxes excluded'),indent=2))

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    sub=ap.add_subparsers(dest='command',required=True)
    a=sub.add_parser('audit',help='Read-only gateway catalog/import readiness summary')
    a.add_argument('--catalog',default=str(DEFAULT_CATALOG))
    a.add_argument('--imports',default=str(DEFAULT_IMPORTS))
    a.add_argument('--report',default='')
    a.set_defaults(func=audit)
    a=sub.add_parser('snapshot',help='Make checksummed independent backup of catalog')
    a.add_argument('--catalog',default=str(DEFAULT_CATALOG))
    a.set_defaults(func=snapshot)
    a=sub.add_parser('encode',help='Create local adaptive HLS variants; defaults to dry-run')
    a.add_argument('source');a.add_argument('--film-id',default='')
    a.add_argument('--output',default=str(ROOT/'hls-output'))
    a.add_argument('--only-height',type=int,default=0)
    a.add_argument('--run',action='store_true',help='Actually encode locally. Never uploads or publishes.')
    a.set_defaults(func=encode)
    a=sub.add_parser('health',help='Read-only health check of public services')
    a.set_defaults(func=health)
    a=sub.add_parser('costs',help='Illustrative monthly storage and data delivery costs')
    a.add_argument('--gb',type=float,default=1000)
    a.add_argument('--viewers',type=int,default=2000)
    a.add_argument('--mbps',type=float,default=5)
    a.add_argument('--hours',type=float,default=2)
    a.set_defaults(func=costs)
    args=ap.parse_args()
    try:args.func(args)
    except Exception as e:
        print(type(e).__name__+': '+str(e),file=sys.stderr)
        sys.exit(1)

if __name__=='__main__': main()
