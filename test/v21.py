# v2.1 end-to-end tests (Playwright, real Chrome, mobile emulation). Run: python3 test/v21.py [base-url]
import sys,json,re,time,datetime,os,tempfile
from playwright.sync_api import sync_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8801/bake-k7q2/"
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","shots");os.makedirs(OUT,exist_ok=True)
SIZES=[(390,844),(375,667),(430,932)]
P=0;F=0;FAILS=[];LOG=[]
def ok(name,cond,info=""):
  global P,F
  if cond: P+=1
  else: F+=1;FAILS.append(f"{name}: {info}")
  LOG.append(("PASS" if cond else "FAIL")+" "+name+(f"  [{info}]" if info and not cond else ""))
WL="""(()=>{const W={requests:0,active:null,fail:false};window.__wl=W;
 class Sentinel extends EventTarget{constructor(){super();this.released=false;this.type="screen"}release(){if(this.released)return Promise.resolve();this.released=true;this.dispatchEvent(new Event("release"));return Promise.resolve()}}
 Object.defineProperty(navigator,"wakeLock",{configurable:true,value:{request:async()=>{W.requests++;if(W.fail)throw new DOMException("denied","NotAllowedError");const s=new Sentinel();W.active=s;return s}}});
 W.systemRelease=()=>{const s=W.active;W.active=null;s&&s.release()};})()"""
def new(b,w=390,h=844,scheme="light",wl=True,sw="block"):
  ctx=b.new_context(viewport={"width":w,"height":h},device_scale_factor=2,is_mobile=True,has_touch=True,color_scheme=scheme,timezone_id="Asia/Qatar",service_workers=sw,accept_downloads=True)
  if wl: ctx.add_init_script(WL)
  return ctx
def page(ctx,errs):
  pg=ctx.new_page()
  # The only filtered message is Playwright's own notice when a test context blocks service workers (sw="block"); SW is tested separately with sw="allow".
  pg.on("console",lambda m: errs.append(f"console.{m.type}: {m.text}") if m.type in("error","warning") and "blocked by Playwright" not in m.text else None)
  pg.on("pageerror",lambda e: errs.append(f"pageerror: {e}"))
  return pg
def fresh(pg):
  pg.goto(BASE);pg.evaluate("localStorage.clear()");pg.reload();pg.wait_for_timeout(500)
def ev(pg,js): r=pg.evaluate(js);pg.wait_for_timeout(120);return r
def shot(pg,name): pg.wait_for_timeout(350);pg.screenshot(path=f"{OUT}/v21-{name}.png")
def scroll_to(pg,sel): pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');if(e)e.scrollIntoView({{block:'start'}});document.querySelector('#view').scrollBy(0,-70)}})()");pg.wait_for_timeout(200)
def overflow(pg):
  # wait for finite animations (e.g. the 380 ms pushIn on ACT.open) so the check measures settled layout; infinite ones (badge, done-pulse) are skipped (issue #8)
  pg.evaluate("Promise.all(document.getAnimations().filter(a=>a.effect&&a.effect.getComputedTiming().endTime!==Infinity).map(a=>a.finished.catch(()=>{})))")
  return pg.evaluate("(()=>{const v=document.querySelector('#view');if(document.documentElement.scrollWidth>innerWidth+1||v.scrollWidth>v.clientWidth+1)return 'page scrolls sideways';const bad=[...v.querySelectorAll('*')].filter(e=>{if(e.closest('svg'))return false;const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+2&&getComputedStyle(e).position!=='fixed'&&!e.closest('.pillrow,.rpick,.scards,.overview,.seg.sticky,.tbl')});return bad.length?bad.slice(0,3).map(e=>e.tagName+'.'+e.className).join(','):false})()")

with sync_playwright() as p:
  b=p.chromium.launch(executable_path=os.environ.get("CHROME","/usr/bin/google-chrome"),args=["--no-sandbox","--autoplay-policy=no-user-gesture-required"])

  # ---------- A. every screen at 3 viewports × light/dark: no console errors, no sideways overflow ----------
  for (w,h) in SIZES:
    for scheme in ["light","dark"]:
      errs=[];ctx=new(b,w,h,scheme);pg=page(ctx,errs);fresh(pg);tag=f"{w}-{scheme}"
      seq=[("home","ACT.tab('recipes')"),("loaf","ACT.open('loaf')"),("loaf-method","ACT.seg('method')"),("pizza","ACT.open('pizza')"),
           ("sandwich","ACT.open('sandwich');ACT.variant('chill')"),("sandwich-method","ACT.seg('method')"),
           ("plan","ACT.tab('plan');ACT.prid('loaf')"),("plan-serve","ACT.ptarget('serve')"),
           ("plan-none","S.temp=23;S.cold.pizza=28;ACT.prid('pizza')"),
           ("plan-conflict","S.cold.pizza=24;S.temp=25;ACT.prid('loaf');S.plan.custom.loaf=true;S.plan.anchor.loaf='03:00';render()"),
           ("timer-start","ACT.tab('timer');ACT.trid('loaf')"),("timer-run","ACT.tstart(0)"),
           ("timer-ready","S.session.endsAt=Date.now()-500"),("starter","ACT.tab('starter')"),("ref","ACT.tab('ref')")]
      for name,js in seq:
        ev(pg,js);pg.wait_for_timeout(450 if name=="timer-ready" else 150)
        o=overflow(pg);ok(f"layout: no sideways overflow at {w}x{h} {scheme} on {name}",not o,f"{name}: {o}")
      if w==390:
        ev(pg,"ACT.tab('timer')");pg.wait_for_timeout(300);shot(pg,f"{scheme}-readiness")
      ok(f"console: no errors or warnings at {w}x{h} {scheme}",not errs,"; ".join(errs[:3]))
      ctx.close()

  # ---------- B. planner (390, light; and dark screenshots) ----------
  for scheme in ["light","dark"]:
    errs=[];ctx=new(b,390,844,scheme);pg=page(ctx,errs);fresh(pg)
    ev(pg,"S.temp=23;S.cold.pizza=28;S.tab='plan';S.rid='pizza';render()")
    none=pg.locator("[data-test=plan-none]")
    if scheme=="light":
      ok("planner: pizza at 23 °C with a 28 h fridge stage shows the explicit no-compliant-plan state",none.count()==1 and "No plan fits" in none.inner_text(),pg.locator(".wrap").inner_text()[:200])
      ok("planner: the no-plan state lists the clashing steps",pg.locator("[data-test=plan-none] ul.clash li").count()>=1)
      ok("planner: the no-plan state marks clashing steps in the timeline",pg.locator(".ev.clash").count()>=1)
      alts=pg.locator("[data-test=plan-none] .alt").all_inner_texts()
      ok("planner: the no-plan state offers a compliant alternative (another fridge option)",any("fridge stage instead" in a for a in alts),alts)
    scroll_to(pg,"[data-test=plan-none]");shot(pg,f"{scheme}-plan-none")
    if scheme=="light":
      pg.locator("[data-act=paccept]").click();pg.wait_for_timeout(200)
      ok("planner: 'Keep this plan anyway' keeps it, with the clashes still shown",pg.locator("[data-test=plan-accepted]").count()==1 and pg.locator(".ev.clash").count()>=1)
      sig=ev(pg,"S.plan.accept.pizza===planSig('pizza')");ok("planner: acceptance is tied to this exact plan",sig)
      ev(pg,"ACT.ptime(15)");ok("planner: changing the plan drops the acceptance and shows the warning again",pg.locator("[data-test=plan-conflict]").count()==1)
      pg.locator("[data-test=plan-conflict] .alt").first.click();pg.wait_for_timeout(200)
      ok("planner: choosing an alternative gives a compliant plan",pg.locator("[data-test=plan-ok]").count()==1 and ev(pg,"timeline('pizza').conflicts.length")==0)
      # custom conflict for the loaf
      ev(pg,"S.temp=25;ACT.prid('loaf');S.plan.custom.loaf=true;S.plan.mode='finish';S.plan.anchor.loaf='03:00';S.plan.day.loaf=isoDate(new Date(Date.now()+2*864e5));render()")
      box=pg.locator("[data-test=plan-conflict]")
      ok("planner: a hand-picked 03:00 loaf is flagged, never silently moved",box.count()==1 and ev(pg,"S.plan.anchor.loaf")=="03:00")
      at=[x for x in pg.locator("[data-test=plan-conflict] .alt b").all_inner_texts()]
      ok("planner: a 03:00 finish offers a later compliant option (earlier/another-day only appear when they exist and are compliant)",any("Later" in a for a in at),at)
      pg.locator("[data-test=plan-conflict] .alt").first.click();pg.wait_for_timeout(200)
      ok("planner: the offered loaf alternative is compliant once chosen",pg.locator("[data-test=plan-ok]").count()==1 and ev(pg,"timeline('loaf').conflicts.length")==0)
      ev(pg,"S.plan.custom.loaf=true;S.plan.anchor.loaf='03:00';S.plan.day.loaf=isoDate(new Date(Date.now()+2*864e5));render()")
    scroll_to(pg,"[data-test=plan-conflict]") if scheme=="light" else None
    if scheme=="light": shot(pg,"light-plan-conflict")
    # out of the oven vs ready to slice
    ev(pg,"S.temp=25;ACT.prid('loaf');S.plan.custom.loaf=true;S.plan.mode='finish';S.plan.target.loaf='oven';S.plan.anchor.loaf='12:00';S.plan.day.loaf=isoDate(new Date(Date.now()+2*864e5));render()")
    s1=ev(pg,"timeline('loaf').startD.getTime()")
    ev(pg,"ACT.ptarget('serve')");s2=ev(pg,"timeline('loaf').startD.getTime()")
    if scheme=="light":
      ok("planner: 'Ready to slice 12:00' starts 2½ h (cooling) earlier than 'Out of the oven 12:00'",round((s1-s2)/60000)==150,(s1-s2)/60000)
      lab=pg.locator(".sum").inner_text();ok("planner: summary names the chosen target",("ready to slice" in lab.lower()) and "12:00" in lab,lab)
      ok("planner: timeline shows both 'Out of the oven' and 'Ready to slice' marks",pg.locator(".ev.anchor").count()==2 and pg.locator(".ev.anchor.target").count()==1)
      ev(pg,"ACT.prid('pizza');S.plan.custom.pizza=true;render()");labs=pg.locator("[data-act=ptarget]").all_inner_texts()
      ok("planner: pizza targets are 'First pizza in' / 'All pizzas done'",labs==["First pizza in","All pizzas done"],labs)
      ev(pg,"ACT.prid('loaf')")
    scroll_to(pg,"[data-act=ptarget]");shot(pg,f"{scheme}-plan-target")
    scroll_to(pg,".ev.anchor");shot(pg,f"{scheme}-plan-oven-vs-slice")
    if scheme=="light":
      # unavailable window persists
      pg.fill("#pawayf","22:00");pg.dispatch_event("#pawayf","change");pg.wait_for_timeout(300);pg.reload();pg.wait_for_timeout(500)
      ok("planner: unavailable hours are saved and restored",ev(pg,"S.plan.away.from")=="22:00" and pg.input_value("#pawayf")=="22:00")
      ev(pg,"ACT.pawayon('0')");ok("planner: switching the window off says so",pg.locator(".notebar").filter(has_text="No unavailable hours").count()==1)
      ev(pg,"ACT.pawayon('1')")
    ok(f"console: no errors in planner tests ({scheme})",not errs,"; ".join(errs[:3]))
    ctx.close()

  # ---------- C. timer: readiness, no auto-advance, reloads, wake lock, dough temp ----------
  errs=[];ctx=new(b);pg=page(ctx,errs);fresh(pg)
  ev(pg,"ACT.tab('timer');ACT.trid('loaf');ACT.tstart(0)");pg.wait_for_timeout(1200)
  ok("wake lock: requested when the timer starts",ev(pg,"__wl.requests")==1)
  ok("wake lock: button shows the lock is actually held",pg.locator("#wakebtn[data-held=true]").count()==1 and "Screen kept on" in pg.locator("#wakebtn").inner_text())
  ok("timer: backup Clock-alarm tip shown with the end time",pg.locator("[data-test=alarmtip]").count()==1 and re.search(r"\d\d:\d\d",pg.locator("[data-test=alarmtip]").inner_text()) is not None)
  shot(pg,"light-timer-running")
  ev(pg,"__wl.systemRelease()");pg.wait_for_timeout(150)
  ok("wake lock: a system release is shown immediately",pg.locator("#wakebtn[data-held=false]").count()==1)
  pg.wait_for_timeout(1300)
  ok("wake lock: re-acquired after a system release",ev(pg,"__wl.requests")==2 and pg.locator("#wakebtn[data-held=true]").count()==1)
  # reload while running
  before=ev(pg,"S.session.endsAt");pg.reload();pg.wait_for_timeout(1200)
  ok("timer: reload while running keeps the same end time",ev(pg,"S.session.running&&S.session.endsAt")==before)
  ok("wake lock: re-acquired on reload / session restore",ev(pg,"__wl.requests")>=1 and pg.locator("#wakebtn[data-held=true]").count()==1)
  # reload while paused
  ev(pg,"ACT.tplay()");rem=ev(pg,"S.session.remaining");pg.wait_for_timeout(1500);pg.reload();pg.wait_for_timeout(700)
  ok("timer: reload while paused keeps the remaining time",ev(pg,"!S.session.running&&Math.abs(S.session.remaining-%f)<0.01"%rem))
  ok("wake lock: released when paused",pg.locator("#wakebtn[data-held=false]").count()==1)
  # step finishes: check step → readiness check, no auto-advance
  ev(pg,"ACT.tplay()");ev(pg,"S.session.endsAt=Date.now()+300");pg.wait_for_timeout(2500)
  ok("timer: at the end of the levain build the readiness check appears",pg.locator("[data-test=readiness]").count()==1)
  ok("timer: nothing auto-starts after a fermentation step (2.5 s later still step 1, stopped)",ev(pg,"S.session.idx===0&&!S.session.running"))
  bt=pg.locator("[data-test=readiness] button").all_inner_texts()
  ok("timer: readiness offers +15/+30/+60, Ready and Unsure",bt[:3]==["+15 min","+30 min","+60 min"] and any(x.startswith("Ready: start") for x in bt) and any(x.startswith("Unsure") for x in bt),bt)
  scroll_to(pg,"[data-test=readiness]");shot(pg,"light-readiness-check")
  pg.locator("[data-act=tmore][data-arg='30']").click();pg.wait_for_timeout(300)
  ok("timer: 'Not ready +30 min' runs the same step for 30 more minutes",ev(pg,"S.session.idx===0&&S.session.running&&Math.abs(remNow()-1800)<5"))
  ev(pg,"S.session.endsAt=Date.now()+200");pg.wait_for_timeout(900)
  pg.locator("[data-act=tguide]").focus();pg.locator("[data-act=tguide]").click();pg.wait_for_timeout(300)
  dlg=pg.locator(".sheet[role=dialog][aria-modal=true]")
  ok("sheet: guide opens as a labelled modal dialog",dlg.count()==1 and ev(pg,"!!document.getElementById(document.querySelector('.sheet').getAttribute('aria-labelledby'))"))
  ok("sheet: focus moves into the dialog",ev(pg,"document.querySelector('.sheet').contains(document.activeElement)"))
  ok("sheet: background is inert while open",ev(pg,"document.getElementById('app').inert===true"))
  shot(pg,"light-guide-sheet")
  for _ in range(4): pg.keyboard.press("Tab")
  ok("sheet: Tab stays trapped inside the dialog",ev(pg,"document.querySelector('.sheet').contains(document.activeElement)"))
  pg.keyboard.press("Shift+Tab");pg.keyboard.press("Shift+Tab")
  ok("sheet: Shift+Tab stays trapped too",ev(pg,"document.querySelector('.sheet').contains(document.activeElement)"))
  pg.keyboard.press("Escape");pg.wait_for_timeout(200)
  ok("sheet: Escape closes it",pg.locator(".sheet").count()==0)
  ok("sheet: focus returns to the button that opened it",ev(pg,"document.activeElement&&document.activeElement.dataset.act")=="tguide")
  pg.locator("[data-test=readiness] [data-act=tnext]").click();pg.wait_for_timeout(300)
  ok("timer: 'Ready: proceed' is the deliberate tap that starts step 2",ev(pg,"S.session.idx===1&&S.session.running"))
  # procedural step: ends with a "Start next" button, still no auto-start
  ev(pg,"tGo(2,true);render()");pg.wait_for_timeout(200)
  ok("timer: dough-temperature field offered from 'Add levain'",pg.locator("#dtin").count()==1)
  d0=ev(pg,"S.session.steps.find(x=>x.key==='bulk').d");pg.fill("#dtin","28");pg.dispatch_event("#dtin","change");pg.wait_for_timeout(300)
  d1=ev(pg,"S.session.steps.find(x=>x.key==='bulk').d")
  ok("timer: entering 28 °C dough shortens the bulk estimate",ev(pg,"S.session.doughT")==28 and d1<d0,f"{d0}->{d1}")
  pg.reload();pg.wait_for_timeout(600);ok("timer: measured dough temp is stored in the session",ev(pg,"S.session.doughT")==28 and pg.input_value("#dtin")=="28")
  scroll_to(pg,".dtemp");shot(pg,"light-dough-temp")
  ev(pg,"S.session.endsAt=Date.now()+200");pg.wait_for_timeout(2300)
  ok("timer: a hands-on step ends with 'Start next', not an automatic start",pg.locator(".nextbtn").count()==1 and ev(pg,"S.session.idx===2&&!S.session.running"))
  # just finished while closed
  ev(pg,"tGo(5,true)");pg.evaluate("(()=>{const hi=setTimeout(()=>{},0);for(let i=1;i<=hi;i++){clearTimeout(i);clearInterval(i)}const T=JSON.parse(JSON.stringify(S));T.session.endsAt=Date.now()-60000;T.session.running=true;T.session.alerted=false;localStorage.setItem(KEY,JSON.stringify(T));location.reload()})()");pg.wait_for_load_state();pg.wait_for_timeout(1200)  # stop the old page's tick/save and write a copy, so nothing can mark the step ended before the reload commits (issue #8)
  ok("timer: reload after a step ended while closed shows the readiness check, not the next step",pg.locator("[data-test=readiness]").count()==1 and ev(pg,"S.session.idx")==5)
  ok("timer: …and says when it finished, persistently in the readiness box",re.search(r"Timer ended at \d\d:\d\d.* while the app was closed",pg.locator("[data-test=ended-at]").inner_text()) is not None,pg.locator("[data-test=readiness]").inner_text()[:200])
  # wake lock refused
  ev(pg,"__wl.fail=true;wakeLock&&wakeLock.release();wakeLock=null;tMore(15);render()");pg.wait_for_timeout(500)
  ok("wake lock: a refused lock is shown honestly",pg.locator("#wakebtn.warn").count()==1 and "not held" in pg.locator("#wakebtn").inner_text())
  ok("console: no errors in timer tests",not errs,"; ".join(errs[:3]))
  ctx.close()

  # midnight and clock changes (fake clock)
  errs=[];ctx=new(b);pg=page(ctx,errs)
  pg.clock.install(time=datetime.datetime(2026,11,3,23,50,tzinfo=datetime.timezone(datetime.timedelta(hours=3))))
  fresh(pg);ev(pg,"ACT.tab('timer');ACT.trid('loaf');ACT.tstart(2)")  # 'Add levain', 20 min
  ok("midnight: end time before midnight is labelled 'tomorrow'",pg.locator("[data-test=alarmtip]").inner_text().find("00:10 tomorrow")>=0,pg.locator("[data-test=alarmtip]").inner_text())
  pg.clock.run_for("21:00");pg.wait_for_timeout(300)
  ok("midnight: a step running across midnight finishes on time",ev(pg,"S.session.alerted&&!S.session.running&&S.session.idx===2"))
  ev(pg,"ACT.tnext()");pg.clock.set_system_time(datetime.datetime(2026,11,4,3,0,tzinfo=datetime.timezone(datetime.timedelta(hours=3))));pg.clock.run_for(1000);pg.wait_for_timeout(300)
  ok("clock change: jumping the clock 3 h forward ends the running step (wall-clock end time)",ev(pg,"S.session.alerted&&S.session.idx===3"))
  ev(pg,"tGo(3,true)");pg.clock.set_system_time(datetime.datetime(2026,11,4,1,0,tzinfo=datetime.timezone(datetime.timedelta(hours=3))));pg.clock.run_for(1000);pg.wait_for_timeout(300)
  ok("clock change: setting the clock back doesn't break the timer (still running, finite)",ev(pg,"S.session.running&&Number.isFinite(remNow())&&remNow()>0"))
  ok("console: no errors in clock tests",not errs,"; ".join(errs[:3]))
  ctx.close()

  # ---------- D. storage: two tabs, reset, stale sessions ----------
  errs=[];ctx=new(b);A=page(ctx,errs);fresh(A);Bp=page(ctx,errs);Bp.goto(BASE);Bp.wait_for_timeout(500)
  ev(A,"ACT.temp(3)");A.wait_for_timeout(500)
  ok("tabs: a change in tab A shows in tab B",ev(Bp,"S.temp")==28)
  ev(A,"ACT.tab('timer');ACT.tstart(0)");A.wait_for_timeout(400)
  ok("tabs: tab B sees tab A's running bake",ev(Bp,"!!S.session&&S.session.running"))
  ev(Bp,"ACT.resetall()");Bp.locator("[data-act=resetok]").click();A.wait_for_timeout(600)
  ok("tabs: reset in tab B resets tab A (temp and running bake)",ev(A,"S.temp===25&&S.session===null"))
  ok("tabs: tab A says why",("reset" in A.locator("#toast").inner_text().lower()))
  ev(A,"ACT.temp(1)");A.wait_for_timeout(500)
  st=json.loads(A.evaluate("localStorage.getItem(KEY)"))
  ok("tabs: after a reset, tab A's next save doesn't bring the old data back",st["temp"]==26 and st["session"] is None and st["epoch"]==ev(Bp,"S.epoch"))
  ev(Bp,"localStorage.removeItem(KEY)");A.wait_for_timeout(600)
  ok("tabs: storage cleared in another tab resets this tab without writing back",ev(A,"S.temp")==25 and A.evaluate("localStorage.getItem(KEY)") is None)
  A.wait_for_timeout(500);ok("tabs: …and still nothing written back after a moment",A.evaluate("localStorage.getItem(KEY)") is None)
  # stale session: storage moves on without an event reaching this tab
  fresh(A);ev(A,"ACT.tab('timer');ACT.tstart(0)")
  A.evaluate("(()=>{const o=JSON.parse(localStorage.getItem(KEY));o.rev=o.rev+5;o.session.idx=3;o.session.running=false;localStorage.setItem(KEY,JSON.stringify(o))})()")
  ev(A,"ACT.tab('ref');ACT.theme('dark')");A.wait_for_timeout(400)
  st=json.loads(A.evaluate("localStorage.getItem(KEY)"))
  ok("storage: a newer session in storage is not overwritten by this tab's stale copy",st["session"]["idx"]==3 and st["theme"]=="dark",st["session"]["idx"])
  A.evaluate("(()=>{const o=JSON.parse(localStorage.getItem(KEY));o.epoch='replaced-elsewhere';o.temp=33;localStorage.setItem(KEY,JSON.stringify(o))})()")
  ev(A,"ACT.theme('light')");A.wait_for_timeout(400)
  st=json.loads(A.evaluate("localStorage.getItem(KEY)"))
  ok("storage: data replaced elsewhere (new epoch) is adopted, not overwritten",st["temp"]==33 and st["epoch"]=="replaced-elsewhere" and ev(A,"S.temp")==33)
  ok("storage: saved state carries a revision and an epoch id",isinstance(st.get("rev"),int) and st["rev"]>0 and bool(st.get("epoch")))
  ok("console: no errors in storage tests",not errs,"; ".join(errs[:3]))
  ctx.close()

  # ---------- E. export / import ----------
  errs=[];ctx=new(b);pg=page(ctx,errs);fresh(pg);ev(pg,"S.temp=27;S.scale.pizza.balls=6;S.plan.away.from='22:30';ACT.tab('ref')")
  with pg.expect_download() as dl: pg.locator("[data-act=export]").click()
  path=dl.value.path();data=json.load(open(path))
  ok("export: documented format header",data.get("format")=="michaels-baking-export" and data.get("version")==1 and "exportedAt" in data and isinstance(data.get("data"),dict))
  ok("export: contains the settings, not the running timer",data["data"]["temp"]==27 and data["data"]["scale"]["pizza"]["balls"]==6 and "session" not in data["data"])
  data["data"]["temp"]=24;data["data"]["scale"]["pizza"]["balls"]=8
  f=tempfile.NamedTemporaryFile("w",suffix=".json",delete=False);json.dump(data,f);f.close()
  pg.set_input_files("#impfile",f.name);pg.wait_for_timeout(500)
  ok("import: shows a preview before replacing anything",pg.locator(".sheet").count()==1 and "24 °C" in pg.locator(".sheet").inner_text() and ev(pg,"S.temp")==27)
  shot(pg,"light-import-preview")
  pg.locator("[data-act=importok]").click();pg.wait_for_timeout(300)
  ok("import: 'Replace' applies the file",ev(pg,"S.temp")==24 and ev(pg,"S.scale.pizza.balls")==8)
  bad=tempfile.NamedTemporaryFile("w",suffix=".json",delete=False);bad.write('{"hello":1}');bad.close()
  pg.set_input_files("#impfile",bad.name);pg.wait_for_timeout(400)
  ok("import: a foreign file is refused and nothing changes","Can't import" in pg.locator(".sheet").inner_text() and ev(pg,"S.temp")==24)
  ev(pg,"closeSheet()")
  data["data"]["temp"]=999;data["data"]["scale"]["pizza"]["bw"]="abc";data["data"]["plan"]["away"]["from"]="25:99"
  f2=tempfile.NamedTemporaryFile("w",suffix=".json",delete=False);json.dump(data,f2);f2.close()
  pg.set_input_files("#impfile",f2.name);pg.wait_for_timeout(400);pg.locator("[data-act=importok]").click();pg.wait_for_timeout(300)
  ok("import: out-of-range values are clamped/repaired, not trusted",ev(pg,"S.temp")==40 and ev(pg,"S.scale.pizza.bw")==280 and ev(pg,"S.plan.away.from")=="23:00")
  t=pg.evaluate("parseImport('not json').ok===false&&parseImport(JSON.stringify({format:'michaels-baking-export',version:2,data:{}})).ok===false")
  ok("import: invalid JSON and unknown versions are rejected",t)
  # DDT
  fresh(pg);ev(pg,"S.temp=30;ACT.tab('ref')");scroll_to(pg,"[data-test=ddt]")
  ok("ddt: 25 °C target in a 30 °C kitchen → 100 − 30 − 30 − 30 − 2 = 8 °C water",pg.locator("[data-test=ddt-water]").inner_text()=="8 °C")
  pg.fill("[data-inp=ddtX]","5");pg.dispatch_event("[data-inp=ddtX]","change");pg.wait_for_timeout(200);scroll_to(pg,"[data-test=ddt]")
  ok("ddt: friction factor is editable and used",pg.locator("[data-test=ddt-water]").inner_text()=="5 °C")
  shot(pg,"light-ddt")
  ok("console: no errors in export/import/DDT tests",not errs,"; ".join(errs[:3]))
  ctx.close()

  # ---------- F. one formula on every screen ----------
  errs=[];ctx=new(b);pg=page(ctx,errs);fresh(pg)
  ok("hydration: a fresh start keeps the booklet values (loaf 69.7 %, pizza 66.4 %), not the nearest 0.5 % step",ev(pg,"JSON.stringify(S.hyd)")=='{"loaf":69.7,"focaccia":80,"pizza":66.4}',ev(pg,"JSON.stringify(S.hyd)"))
  pg.reload();pg.wait_for_timeout(500)
  ok("hydration: …and still after a reload",ev(pg,"JSON.stringify(S.hyd)")=='{"loaf":69.7,"focaccia":80,"pizza":66.4}',ev(pg,"JSON.stringify(S.hyd)"))
  ok("hydration: other values still snap to 0.5 % steps",ev(pg,"(()=>{const t=sanitize(Object.assign(JSON.parse(JSON.stringify(DEFAULT)),{hyd:{loaf:70.2,focaccia:80,pizza:66.6}}));return t.hyd.loaf===70&&t.hyd.pizza===66.5})()"))
  ev(pg,"ACT.open('sandwich');ACT.variant('warm')")
  ok("variant: warm shows an 8 g starter in the table",pg.locator(".ing").filter(has_text="Active starter").inner_text().split("\n")[1].strip().startswith("8"))
  ev(pg,"ACT.seg('method')");ok("variant: warm shows 8 g in the method",pg.locator(".steps").inner_text().find("8 g starter + 15 g honey")>=0)
  ev(pg,"ACT.planthis('sandwich')");ok("variant: warm shows 8 g in the planner",pg.locator(".tl").inner_text().find("8 g starter + 15 g honey")>=0)
  ev(pg,"ACT.variant('chill')");ok("variant: chill adds the fridge stage in the planner",pg.locator(".tl").inner_text().find("Starter in the fridge")>=0)
  ev(pg,"ACT.tab('timer');ACT.trid('sandwich')");ok("variant: chill adds the fridge stage in the timer",pg.locator(".slist").inner_text().find("Starter in the fridge")>=0)
  ev(pg,"ACT.tstart(0)");ok("variant: timer step text shows the chosen quantities",pg.locator(".tstep").inner_text().find("15 g starter + 15 g honey + 30 g water + 60 g flour")>=0)
  ev(pg,"ACT.tendok();S.scale.sandwich={tin:'std',n:2};S.variant.sandwich='std';S.tab='recipes';ACT.open('sandwich');ACT.seg('ing')")
  ib=pg.locator("#ingbox").inner_text();ok("scaling: 2 × 2 lb tins (1.5×) → computed 22.5 g starter / 52.5 g tangzhong flour, shown as 23 g / 53 g (same whole-gram rounding everywhere)",ev(pg,"calc('sandwich').q.seed")==22.5 and ev(pg,"calc('sandwich').q.tflour")==52.5 and "Active starter\n23g" in ib and "Bread flour\n53g" in ib,ib[:300])
  ev(pg,"ACT.seg('method')");ok("scaling: …and the method says the same",pg.locator(".steps").inner_text().find("23 g starter + 23 g honey + 45 g water + 90 g flour")>=0 and pg.locator(".steps").inner_text().find("52.5 g flour + 262.5 g milk")<0 and pg.locator(".steps").inner_text().find("53 g flour + 263 g milk")>=0)
  ev(pg,"ACT.open('pizza');ACT.seg('ing')")
  ok("pizza: ball weight shows 280 g and the total is 1,120 g",pg.input_value("[data-inp=bw]")=="280" and "1,120" in pg.locator(".ing.total").inner_text())
  ib=pg.locator("#ingbox").inner_text()
  ok("pizza: the 280 g table shows 365 g + 243 g flour, 354 g + 30 g water, 111 g levain, 16 g salt",all(x in ib for x in ["365g","243g","354g","30g","111g","16g"]),ib.replace("\n"," | ")[:300])
  ok("pizza: the levain build on screen is 20 + 56 + 56",[x.strip() for x in pg.locator(".build .b b").all_inner_texts()]==["20","56","56"])
  ev(pg,"ACT.seg('method')");ok("pizza: the method says 4 balls of 280 g",pg.locator(".steps").inner_text().find("4 equal balls of 280 g")>=0)
  # migration: a saved 276 or 276.5 (the old defaults) becomes 280; any other weight is kept
  for old,want in [(276,280),(276.5,280),(250,250)]:
    pg.evaluate(f"(()=>{{const s=JSON.parse(localStorage.getItem(KEY));s.v=3;s.scale.pizza.bw={old};localStorage.setItem(KEY,JSON.stringify(s))}})()");pg.reload();pg.wait_for_timeout(400)
    ok(f"migration: a saved {old} g ball weight loads as {want} g",ev(pg,"S.scale.pizza.bw")==want and ev(pg,"S.v")==4)
  # sandwich chill hours: picker on the recipe and the planner; the planner and timer use it
  ev(pg,"localStorage.clear()");pg.reload();pg.wait_for_timeout(400)
  ev(pg,"ACT.open('sandwich');ACT.seg('ing');ACT.variant('std')")
  ok("chill: no fridge-hours picker unless Chill is chosen",pg.locator("[data-test=chillh]").count()==0)
  ev(pg,"ACT.variant('chill')")
  ok("chill: picker shows 8 h by default",pg.locator("[data-test=chillh] .val").inner_text().replace("\n","").strip()=="8h")
  pg.locator("[data-test=chillh] button[aria-label='Increase Hours in the fridge']").click();pg.wait_for_timeout(150)
  pg.locator("[data-test=chillh] button[aria-label='Increase Hours in the fridge']").click();pg.wait_for_timeout(150)
  ok("chill: tapping + twice sets 10 h",ev(pg,"S.variant.chillH")==10)
  for _ in range(5): pg.locator("[data-test=chillh] button[aria-label='Increase Hours in the fridge']").click(force=True);pg.wait_for_timeout(100)
  ok("chill: + stops at 12 h and is disabled there",ev(pg,"S.variant.chillH")==12 and pg.locator("[data-test=chillh] button[aria-label='Increase Hours in the fridge']").is_disabled())
  ev(pg,"S.variant.chillH=10;render()")
  ev(pg,"ACT.seg('method')");ok("chill: method says 10 h in the fridge",pg.locator(".steps").inner_text().find("10 h in the fridge")>=0)
  shot(pg,"light-sandwich-chill-hours")
  ev(pg,"ACT.planthis('sandwich')")
  ok("chill: the planner shows the picker too",pg.locator("[data-test=chillh]").count()==1)
  ok("chill: the planner's fridge step is 10 h",ev(pg,"currentPlan('sandwich').steps[1].d")==600 and pg.locator(".tl").inner_text().find("10 h until you mix")>=0)
  ev(pg,"ACT.tab('timer');ACT.trid('sandwich');ACT.tstart(0)")
  ok("chill: the timer session snapshots 10 h",ev(pg,"S.session.chillH")==10 and ev(pg,"S.session.steps[1].d")==600)
  ev(pg,"S.variant.chillH=8;render()");ok("chill: changing the setting mid-bake doesn't change the running timer",ev(pg,"S.session.steps[1].d")==600)
  ev(pg,"ACT.tendok()")
  ev(pg,"S.variant={sandwich:'chill',chillH:99};sanitize(S)");ok("chill: an out-of-range saved/imported value is clamped to 12 h",ev(pg,"S.variant.chillH")==12)
  ev(pg,"localStorage.clear()");pg.reload();pg.wait_for_timeout(400)
  ev(pg,"S.scale.focaccia.tray='30x40';ACT.open('focaccia');ACT.seg('ing')")
  ok("focaccia: 30×40 tray uses the booklet 25 + 75 + 75 build on screen",[x.strip() for x in pg.locator(".build .b b").all_inner_texts()]==["25","75","75"])
  ev(pg,"ACT.seg('method')");ok("focaccia: …and in the method",pg.locator(".steps").inner_text().find("25 g mother + 75 g flour + 75 g water")>=0)
  ok("console: no errors in formula tests",not errs,"; ".join(errs[:3]))
  ctx.close()
  b.close()

print("\n".join(LOG))
print(f"\n{P} passed, {F} failed")
for x in FAILS: print("  FAIL",x)
sys.exit(1 if F else 0)
