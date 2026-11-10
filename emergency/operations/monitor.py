#!/usr/bin/env python3
"""Independent, read-only, no-popup AllFactsTV heartbeat. Does not publish or charge."""
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from types import SimpleNamespace
import datetime, json, sys, urllib.request
import allfacts_control as ctl

ROOT=Path(__file__).resolve().parent
def main():
    audit_stdout=StringIO()
    with redirect_stdout(audit_stdout):
        audit=ctl.audit(SimpleNamespace(catalog=str(ctl.DEFAULT_CATALOG),
                                      imports=str(ctl.DEFAULT_IMPORTS),report=''))
    checks=[]
    for url in ('https://allfactstv.com/streaming/',
                'https://allfactstv-stream-gateway.keenanbooker83.workers.dev/health'):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'AllFactsTV-Independent-Monitor/1.0'})
            with urllib.request.urlopen(req,timeout=15) as r:
                row=dict(url=url,status=r.status,ok=(r.status==200))
                if url.endswith('/health'):
                    try:
                        row['gateway_ready_films']=int(json.load(r).get('ready_films',0))
                    except (ValueError,KeyError,TypeError):
                        row['ok']=False;row['error']='Unparseable gateway status'
                checks.append(row)
        except Exception as e:
            checks.append(dict(url=url,ok=False,error=str(e)[:180]))
    metadata_ready=audit['counts']['metadata_ready']
    gateway=next((v.get('gateway_ready_films') for v in checks if 'gateway_ready_films' in v),None)
    result=dict(checked_utc=ctl.timestamp(),site_healthy=all(v.get('ok') for v in checks),
                gateway_ready_films=gateway,metadata_ready=metadata_ready,
                catalog_records=audit['counts']['catalog'],
                discrepancy=(gateway is None or gateway!=metadata_ready),
                services=checks,import_status=audit['import_status'],
                note='Read-only health, does not test every video object.')
    out=ROOT/'reports'
    out.mkdir(exist_ok=True)
    ctl.write_json_atomic(out/'latest.json',result)
    log=out/'history.jsonl'
    if log.exists() and log.stat().st_size>3_000_000:
        log.rename(out/('history-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'.jsonl'))
    with open(log,'a',encoding='utf-8') as f:
        f.write(json.dumps(result,ensure_ascii=False)+'\n')
    print(json.dumps(result,indent=2))
    return 0 if result['site_healthy'] and not result['discrepancy'] else 2
if __name__=='__main__':
    try:sys.exit(main())
    except Exception as e:
        ROOT.joinpath('reports').mkdir(exist_ok=True)
        (ROOT/'reports'/'last-error.txt').write_text(ctl.timestamp()+' '+repr(e),encoding='utf-8')
        sys.exit(3)
