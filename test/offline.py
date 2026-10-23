# Service worker + offline check: install, cache named after the build version, reload offline, maths and planner still work.
import sys
from playwright.sync_api import sync_playwright
import os
U=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8801/bake-k7q2/"
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..");P=F=0
def ok(n,c,d=""):
  global P,F
  print(("PASS " if c else "FAIL ")+n,"" if c else d);P+=bool(c);F+=not c
with sync_playwright() as p:
  b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
  ctx=b.new_context(viewport={"width":390,"height":844},timezone_id="Asia/Qatar",service_workers="allow")
  pg=ctx.new_page();errs=[];pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None)
  pg.goto(U)
  pg.evaluate("navigator.serviceWorker.ready");pg.reload();pg.wait_for_timeout(1500)
  ok("sw: controls the page after install",pg.evaluate("!!navigator.serviceWorker.controller"))
  ver=open(os.path.join(ROOT,"sw.js")).read();import re;v=re.search(r"VERSION=\"([0-9a-f]+)\"",ver)
  keys=pg.evaluate("caches.keys()");ok("sw: cache is named after this build's version",v and any(v.group(1) in k for k in keys),(keys,v and v.group(0)))
  ctx.set_offline(True);pg.reload();pg.wait_for_timeout(1500)
  ok("offline: app renders after reload with no network",pg.locator(".tabbar").count()==1)
  pg.evaluate("ACT.open('pizza')");pg.wait_for_timeout(300)
  ok("offline: maths works (4 × 276.5 g = 1,106 g)","1,106" in pg.locator(".ing.total").inner_text())
  pg.evaluate("ACT.planthis('loaf')");pg.wait_for_timeout(300)
  ok("offline: planner renders a compliant plan",pg.locator("[data-test=plan-ok]").count()==1)
  ok("offline: no console errors",not errs,errs[:3])
  b.close()
print(P,"passed",F,"failed");sys.exit(1 if F else 0)
