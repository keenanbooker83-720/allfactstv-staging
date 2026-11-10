#!/usr/bin/env python3
"""Netflix VMAF quality comparison for AllFactsTV. Local, read-only, no cloud costs."""
import argparse, json, shutil, subprocess, tempfile
from pathlib import Path
import allfacts_control as ctl

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',required=True,help='Original high-quality video file')
    p.add_argument('--encoded',required=True,help='Encoded MP4, HLS variant playlist, or supported video')
    p.add_argument('--seconds',type=int,default=30,help='Maximum number of seconds to compare')
    p.add_argument('--start',type=float,default=0)
    p.add_argument('--out',default='',help='Optional final JSON report file')
    a=p.parse_args()
    if a.seconds<1 or a.seconds>600 or a.start<0: p.error('Use 1 to 600 seconds; start must be >=0')
    original=Path(a.source).resolve();encoded=Path(a.encoded).resolve()
    if not original.is_file() or not encoded.is_file(): p.error('Both video paths must exist')
    m0=ctl.media_probe(original);m1=ctl.media_probe(encoded)
    if (m0['width'],m0['height'])!=(m1['width'],m1['height']):
        p.error('The source and encoded copy must have the same resolution; compare matching-resolution samples or rescale a COPY.')
    if a.start >= m0['duration'] or a.start >= m1['duration']: p.error('Start exceeds available duration')
    tool=shutil.which('ffmpeg')
    if not tool: p.error('FFmpeg is unavailable')
    outdir=Path(__file__).resolve().parent/'reports'
    outdir.mkdir(exist_ok=True)
    # Local temporary files; avoid Windows drive-letter colons in the FFmpeg filter parser.
    with tempfile.TemporaryDirectory(prefix='vmaf-',dir=outdir) as td:
        graph='[0:v]setpts=PTS-STARTPTS[dist];[1:v]setpts=PTS-STARTPTS[ref];[dist][ref]libvmaf=log_fmt=json:log_path=quality.json'
        cmd=[tool,'-nostdin','-hide_banner','-loglevel','error',
             '-ss',str(a.start),'-t',str(a.seconds),'-i',str(encoded),
             '-ss',str(a.start),'-t',str(a.seconds),'-i',str(original),
             '-lavfi',graph,'-an','-f','null','NUL']
        run=subprocess.run(cmd,cwd=td,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=600)
        q=Path(td)/'quality.json'
        if run.returncode!=0 or not q.is_file():
            raise RuntimeError('VMAF failed: '+run.stderr[-2500:])
        result=json.loads(q.read_text(encoding='utf-8'))
        score=float(result['pooled_metrics']['vmaf']['mean'])
        frames=len(result.get('frames',[]))
        report={'generated_utc':ctl.timestamp(),'source':str(original),'encoded':str(encoded),
                'duration_compared_seconds':a.seconds,'start_seconds':a.start,
                'resolution':f"{m0['width']}x{m0['height']}",'frames':frames,
                'vmaf_mean':round(score,3),
                'interpretation':('high fidelity' if score>=93 else 'review' if score>=80 else 'low fidelity'),
                'note':'Netflix VMAF metric. Relative to original sample only; subjective review still required.'}
        target=Path(a.out) if a.out else outdir/('vmaf-'+encoded.stem+'-'+ctl.timestamp().replace(':','-')[:19]+'.json')
        ctl.write_json_atomic(target,report)
        print(json.dumps(report,indent=2))
        print('REPORT',target)
if __name__=='__main__':
    main()
