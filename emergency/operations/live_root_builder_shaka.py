from pathlib import Path
import json,datetime
root=Path(r"G:\AllFactsTV-Development")
out=root/"Web-Production-Root"
out.mkdir(exist_ok=True)
client=root/"Web-Staging"/"dist"/"client"
html=(client/"index.html").read_text(encoding="utf-8")
css=next((client/"assets").glob("index-*.css")).read_text(encoding="utf-8")
js=next((client/"assets").glob("index-*.js")).read_text(encoding="utf-8")
# Shaka is lazy-loaded. Supply the hashed JS chunk on the live Worker domain,
# rather than shipping a broken /assets/ URL that was only valid in staging.
shaka_assets=list((client/"assets").glob("shaka-player.compiled-*.js"))
assert len(shaka_assets)==1, "Expected one Shaka adaptive-player chunk"
shaka_asset=shaka_assets[0]
shaka_code=shaka_asset.read_text(encoding="utf-8")
# The Vite chunk was referenced relatively to /assets/index-*.js.
# Because the production root inlines the entry script into /, rewrite
# that import to an absolute /assets/ path before embedding it.
relative_shaka='import("./'+shaka_asset.name+'")'
absolute_shaka='import("/assets/'+shaka_asset.name+'")'
assert js.count(relative_shaka)==1, "Adaptive chunk import was not found exactly once"
js=js.replace(relative_shaka,absolute_shaka)
assert "brand-facts-logo" in js and "/assets/firetv-free-catalog.json" in js
assert "import " not in js[:1500] and "</script" not in js.lower()
assert "index-" in html
import re
html=re.sub(r'<script type="module" crossorigin src="/assets/index-[^"]+\.js"></script>',"",html,count=1)
html=re.sub(r'<link rel="stylesheet" crossorigin href="/assets/index-[^"]+\.css">',"",html,count=1)
assert '<div id="root"></div>' in html
html=html.replace('href="/favicon.svg"','href="/assets/facts-logo.svg"').replace('content="#070a09"','content="#000000"')
html=html.replace('</head>','<style>'+css+'</style></head>')
html=html.replace('</body>','<script type="module">'+js+'</script></body>')
assert 'index-CqL3MVRg.js' not in html
assert 'brand-facts-logo' in html and len(html)>200000
# Route both the homepage and the migrated Audio Lectures page to the new React design.
# Other existing film, ebook, video, product and Cloudflare Pages paths are preserved.
# Dynamic curation overlay avoids a full 5,830-file Pages redeploy for data edits,
# without freezing future upstream catalog updates.
_curation_all=json.loads((root/"Inventory"/"film-category-curation-overrides.json").read_text(encoding="utf-8"))
_curations=_curation_all["overrides"]
_site=Path.home()/"Desktop"/"allfactstv-media"/"site-staging"
_profile_settings={
 "/lecturers/steve-cokely/":("steve-cokely","steve-cokely-2pac-biggie-with-khalid",False),
 "/lecturers/khalid-abdul-muhammad/":("khalid-abdul-muhammad","steve-cokely-2pac-biggie-with-khalid",True),
 "/lecturers/dr-khalid-muhammad/":("dr-khalid-muhammad","iso-message-to-the-black-man-1973-d3e122925",False),
 "/lecturers/min-elijah-muhammad/":("min-elijah-muhammad","iso-message-to-the-black-man-1973-d3e122925",True),
 "/lecturers/bro-bobby-hemmitt/":("bro-bobby-hemmitt","bro-bobby-hemmitt--aiwass-the-methods-of-the-cosmos-2-discs",False)
}
_profile_pages={path:{"html":(_site/"lecturers"/slug/"index.html").read_text(encoding="utf-8"),"marker":marker,"wantMarker":want} for path,(slug,marker,want) in _profile_settings.items()}
_overlay=(out/"metadata_overlay_template.js").read_text(encoding="utf-8")
_hidden=_curation_all.get("hidden_ids",[])
_group_order=list(json.loads((_site/"category-taxonomy.json").read_text(encoding="utf-8"))["categories"])
(out/"worker.js").write_text("const SHAKA_BUNDLE_PATH="+json.dumps("/assets/"+shaka_asset.name)+";\nconst SHAKA_BUNDLE_CODE="+json.dumps(shaka_code)+";\nconst PAGE="+json.dumps(html,ensure_ascii=False)+";\nconst CURATIONS="+json.dumps(_curations,ensure_ascii=False,separators=(",",":"))+";\nconst PROFILE_PAGES="+json.dumps(_profile_pages,ensure_ascii=False,separators=(",",":"))+";\nconst GROUP_ORDER="+json.dumps(_group_order,ensure_ascii=False)+";\nconst SUPPRESSED_IDS="+json.dumps(_hidden)+";\n"+_overlay,encoding="utf-8")
config={
 "$schema":"https://json.schemastore.org/wrangler.json",
 "name":"allfactstv-react-home",
 "main":"worker.js",
 "compatibility_date":"2026-11-07",
 "workers_dev":False,
 "routes":[{"pattern":"allfactstv.com/*","zone_name":"allfactstv.com"},{"pattern":"www.allfactstv.com/*","zone_name":"allfactstv.com"}]
}
(out/"wrangler.json").write_text(json.dumps(config,indent=2),encoding="utf-8")
print("PRODUCTION_ROOT_WORKER_READY","HTML_BYTES",len(html),"WORKER_BYTES",(out/"worker.js").stat().st_size,"CONFIG",out/"wrangler.json",flush=True)