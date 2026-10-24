# v2.1 accessibility audit: axe-core (serious/critical = fail) + every visible control >= 44x44 CSS px, light + dark, 390x844.
import sys,json
from playwright.sync_api import sync_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8801/bake-k7q2/"
import os
AXE_PATH=os.path.join(os.path.dirname(os.path.abspath(__file__)),"vendor","axe.min.js")
if not os.path.exists(AXE_PATH): sys.exit("test/vendor/axe.min.js is missing: run sh test/fetch_axe.sh first")
AXE=open(AXE_PATH).read()
SMALL="""()=>{const out=[];document.querySelectorAll('button,[data-act],input:not([type=file]):not([type=hidden]),a,select,[role=button]').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width||!r.height)return;const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none')return;if(e.closest('[inert]'))return;
 if(r.width<44||r.height<44)out.push((e.dataset.act||e.id||e.tagName)+':'+(e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,22)+' '+Math.round(r.width)+'x'+Math.round(r.height))});return [...new Set(out)]}"""
P=F=0;ROWS=[]
def ok(n,c,d=""):
  global P,F
  if c:P+=1;ROWS.append("PASS "+n)
  else:F+=1;ROWS.append("FAIL "+n+"  "+str(d)[:400])
with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get("CHROME","/usr/bin/google-chrome"),args=["--no-sandbox"])
  for scheme in ["light","dark"]:
    ctx=b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,color_scheme=scheme,timezone_id="Asia/Qatar",service_workers="block")
    pg=ctx.new_page();pg.goto(URL);pg.evaluate("localStorage.clear()");pg.reload();pg.wait_for_timeout(500)
    def ev(js):r=pg.evaluate(js);pg.wait_for_timeout(250);return r
    def audit(name):
      pg.wait_for_timeout(400)
      if not pg.evaluate("!!window.axe"):pg.add_script_tag(content=AXE)
      v=pg.evaluate("async()=>{const r=await axe.run(document,{resultTypes:['violations']});return r.violations.filter(v=>v.impact==='serious'||v.impact==='critical').map(v=>v.id+'('+v.nodes.length+'): '+v.nodes.slice(0,2).map(n=>n.target.join(' ')).join(' ; '))}")
      ok(f"a11y {scheme} {name}: no serious/critical axe violations",not v,v)
      sm=pg.evaluate(SMALL);ok(f"targets {scheme} {name}: every visible control >= 44x44",not sm,sm)
    screens=[("home","1"),("loaf ingredients","ACT.open('loaf')"),("loaf method","ACT.seg('method')"),
      ("sandwich ingredients + variant","ACT.tab('recipes');S.detail=null;ACT.open('sandwich')"),("pizza ingredients","ACT.tab('recipes');S.detail=null;ACT.open('pizza')"),
      ("focaccia ingredients","ACT.tab('recipes');S.detail=null;ACT.open('focaccia')"),
      ("plan (compliant)","ACT.planthis('loaf')"),("plan at 26 °C","S.temp=26;render()"),("plan at 28 °C","S.temp=28;render()"),("plan at 30 °C","S.temp=30;render()"),
      ("plan no-compliant-plan","S.temp=23;S.cold.pizza=28;ACT.planthis('pizza')"),
      ("plan hand-picked conflict","S.temp=25;ACT.prid('loaf');S.plan.custom.loaf=true;S.plan.mode='finish';S.plan.anchor.loaf='03:00';S.plan.day.loaf=isoDate(new Date(Date.now()+2*864e5));render()"),
      ("timer start","ACT.tab('timer');ACT.trid('loaf')"),("timer running","ACT.tstart(0)"),
      ("timer readiness check","S.session.endsAt=Date.now()+200"),
      ("guide sheet (dialog)","ACT.tguide()"),
      ("end-bake sheet (dialog)","closeSheet();ACT.tend&&ACT.tend()"),
      ("timer dough-temp mismatch notice","closeSheet();ACT.tab('timer');ACT.trid('loaf');ACT.tstart(0);tGo(2,true);setDoughT(29);render()"),
      ("starter","closeSheet();ACT.tab('starter')"),("reference + DDT","ACT.tab('ref')"),
      ("reset sheet (dialog)","ACT.resetall()")]
    for name,js in screens:
      try:ev(js)
      except Exception as e:ok(f"{scheme} {name}: screen reachable",False,e);continue
      if name=="timer readiness check":pg.wait_for_timeout(1500);ok(f"{scheme} readiness box present",pg.locator("[data-test=readiness]").count()==1)
      if "dialog" in name:
        ok(f"{scheme} {name}: role=dialog + aria-modal + label",pg.locator(".sheet[role=dialog][aria-modal=true]").count()==1 and ev("!!document.getElementById(document.querySelector('.sheet').getAttribute('aria-labelledby'))"),pg.locator(".sheet").count())
      audit(name)
    ctx.close()
  b.close()
print("\n".join(ROWS));print(f"\n{P} passed, {F} failed");sys.exit(1 if F else 0)
