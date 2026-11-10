#!/usr/bin/env python3
"""Offline-first emergency control console; Python 3.9+ standard library only.

No Cloudflare, Roku, Amazon, GitHub SDK, admin password, Stripe API key or
server-side API credentials are embedded in this software. No live deployment.
"""
from __future__ import annotations
import argparse
import csv
import datetime as dt
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
SITE = ROOT / 'site'
CATALOG = SITE / 'data' / 'catalog.json'
SNAPSHOTS = ROOT / 'snapshots'
DIST = ROOT / 'dist'
ID = re.compile(r'^[a-z0-9][a-z0-9-]{1,99}$')
DATE = re.compile(r'^\d{4}-\d\d-\d\d')
ALLOWED = {'free', 'paid'}
URL_FIELDS = ('posterUrl', 'previewUrl', 'backupPreviewUrl', 'freeVideoUrl', 'backupFreeVideoUrl', 'purchaseUrl')

def https(url):
    if not isinstance(url, str) or not url: return False
    try:
        u = urlsplit(url)
        return u.scheme == 'https' and bool(u.netloc) and not u.username and not u.password
    except ValueError: return False

def checkout(url):
    return https(url) and (urlsplit(url).hostname or '').lower() in {'buy.stripe.com', 'checkout.stripe.com'}

def load(path=CATALOG):
    return json.loads(Path(path).read_text(encoding='utf-8'))

def validate(data):
    errors = []
    if not isinstance(data, dict) or data.get('schemaVersion') != 1 or not isinstance(data.get('products'), list):
        return ['Catalog must have schemaVersion=1 and products as an array.']
    seen = set()
    for i, film in enumerate(data['products']):
        prefix = f'products[{i}]'
        if not isinstance(film, dict): errors.append(prefix + ' must be an object'); continue
        fid = film.get('id')
        if not isinstance(fid, str) or not ID.fullmatch(fid): errors.append(prefix + ' invalid id')
        if fid in seen: errors.append(prefix + ' duplicate id')
        seen.add(fid)
        if not isinstance(film.get('title'), str) or not film['title'].strip(): errors.append(prefix + ' missing title')
        if film.get('type') not in ALLOWED: errors.append(prefix + ' type must be free or paid')
        if not isinstance(film.get('category', ''), str): errors.append(prefix + ' category must be a string')
        for key in URL_FIELDS:
            value = film.get(key)
            if value is not None and value != '' and not https(value): errors.append(prefix + ' ' + key + ' must use HTTPS')
        for key in ('checkoutReady', 'independentPlaybackReady'):
            if key in film and not isinstance(film[key], bool): errors.append(prefix + ' ' + key + ' must be boolean')
        if any(key in film for key in ('fullR2Key','full_r2_key','masterUrl','master_r2_key','stripeSecret','apiKey')):
            errors.append(prefix + ' contains a private master key or secret field')
        if film.get('type') == 'free' and film.get('checkoutReady'):
            errors.append(prefix + ' free films cannot have paid checkoutReady')
        if film.get('checkoutReady'):
            if not checkout(film.get('purchaseUrl')): errors.append(prefix + ' checkoutReady requires Stripe HTTPS Payment Link')
            if not https(film.get('previewUrl')): errors.append(prefix + ' checkoutReady requires hosted HTTPS preview')
            if not DATE.match(str(film.get('verifiedAt', ''))): errors.append(prefix + ' checkoutReady requires verifiedAt date')
        if film.get('independentPlaybackReady') and film.get('type') == 'paid' and not film.get('checkoutReady'):
            errors.append(prefix + ' independentPlaybackReady requires checkoutReady for paid films')
    return errors

def save(data, path=CATALOG):
    errors = validate(data)
    if errors: raise ValueError('\n'.join(errors))
    path = Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    tmp.replace(path)

def snapshot():
    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    path = SNAPSHOTS / f'catalog-{stamp}.json'
    i = 1
    while path.exists():
        path = SNAPSHOTS / f'catalog-{stamp}-{i}.json'; i += 1
    shutil.copy2(CATALOG, path)
    print('SNAPSHOT', path)
    return path

def import_csv(source, replace=False):
    data = load()
    if validate(data): raise ValueError('Existing catalog invalid; refusing import')
    old = {x['id']: x for x in data['products']}
    with Path(source).open('r', encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        required = {'id', 'title', 'type'}
        if not required.issubset(set(reader.fieldnames or [])):
            raise ValueError('CSV must contain id,title,type columns')
        received = list(reader)
    changes = 0
    for row in received:
        fid = (row.get('id') or '').strip().lower()
        if not ID.fullmatch(fid): raise ValueError(f'Invalid id {fid!r}')
        item = {'id': fid, 'title': (row.get('title') or '').strip(), 'type': (row.get('type') or '').strip().lower()}
        for key in ('category', 'scholar', 'synopsis', *URL_FIELDS, 'verifiedAt'):
            if (row.get(key) or '').strip(): item[key] = row[key].strip()
        for key in ('checkoutReady', 'independentPlaybackReady'):
            item[key] = (row.get(key) or '').lower().strip() == 'true'
        if fid not in old or replace:
            old[fid] = item; changes += 1
    data['products'] = list(old.values())
    data['updatedAt'] = dt.datetime.now(dt.timezone.utc).date().isoformat()
    errors = validate(data)
    if errors: raise ValueError('Import rejected without changes:\n' + '\n'.join(errors[:25]))
    if changes: snapshot(); save(data)
    print('IMPORTED', changes, 'TOTAL', len(data['products']), 'SKIPPED_EXISTING', len(received)-changes)

def release():
    data = load()
    errors = validate(data)
    if errors: raise ValueError('\n'.join(errors))
    if DIST.exists(): shutil.rmtree(DIST)
    shutil.copytree(SITE, DIST)
    digests = {}
    for f in DIST.rglob('*'):
        if f.is_file(): digests[str(f.relative_to(DIST)).replace('\\', '/')] = hashlib.sha256(f.read_bytes()).hexdigest()
    release_info = {
        'buildTimeUtc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'version': '1.0.0', 'catalogProducts': len(data['products']),
        'freePlayable': sum(x.get('type') == 'free' and https(x.get('freeVideoUrl')) for x in data['products']),
        'purchasesEnabled': sum(x.get('type') == 'paid' and x.get('checkoutReady') is True and x.get('independentPlaybackReady') is True and checkout(x.get('purchaseUrl')) and https(x.get('previewUrl')) for x in data['products']),
        'checksumsSha256': digests,
    }
    (DIST/'release.json').write_text(json.dumps(release_info,indent=2)+'\n', encoding='utf-8')
    print('RELEASE_READY', DIST, 'FILES',len(digests),'CATALOG',len(data['products']))

def main(argv=None):
    parser = argparse.ArgumentParser(description='AllFactsTV standalone emergency catalog control')
    sub = parser.add_subparsers(dest='cmd', required=True)
    val = sub.add_parser('validate'); val.add_argument('file', nargs='?', default=str(CATALOG))
    sub.add_parser('status'); sub.add_parser('snapshot'); sub.add_parser('build')
    imp = sub.add_parser('import-csv'); imp.add_argument('file'); imp.add_argument('--replace', action='store_true')
    restore = sub.add_parser('restore'); restore.add_argument('file'); restore.add_argument('--apply', action='store_true')
    args = parser.parse_args(argv)
    try:
        if args.cmd == 'validate':
            errs = validate(load(args.file))
            if errs:
                print('INVALID', *errs, sep='\n'); return 1
            print('VALID',len(load(args.file)['products']),'PRODUCTS')
        elif args.cmd == 'status':
            data = load(); print('CATALOG',len(data['products']), 'FREE',sum(x['type']=='free' for x in data['products']), 'PAID',sum(x['type']=='paid' for x in data['products']),'VALIDATION_ERRORS',len(validate(data)))
        elif args.cmd == 'snapshot': snapshot()
        elif args.cmd == 'build': release()
        elif args.cmd == 'import-csv': import_csv(args.file, args.replace)
        elif args.cmd == 'restore':
            path = Path(args.file).resolve()
            if SNAPSHOTS.resolve() not in path.parents: raise ValueError('Restore only from local snapshots/ directory')
            data = load(path); errs = validate(data)
            if errs: raise ValueError('\n'.join(errs))
            if args.apply:
                snapshot(); save(data); print('RESTORED',len(data['products']),'PRODUCTS')
            else: print('DRY_RUN_OK',len(data['products']),'PRODUCTS; use --apply to restore')
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print('FAILED',str(exc),file=sys.stderr); return 1

if __name__ == '__main__': raise SystemExit(main())