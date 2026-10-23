# Smoke test: walk every screen once and fail on any console error. Run: python3 test/smoke.py [base-url]
import asyncio,sys,os
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else "http://127.0.0.1:8801/bake-k7q2/"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("CHROME","/usr/bin/google-chrome"),args=["--no-sandbox"])
    c=await b.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=2,service_workers="block")
    pg=await c.new_page();errs=[]
    pg.on("console",lambda m: errs.append(m.text) if m.type=="error" else None);pg.on("pageerror",lambda e: errs.append(str(e)))
    await pg.goto(URL);await pg.wait_for_timeout(500)
    for js in ['ACT.open("loaf")','ACT.seg("method")','ACT.open("sandwich")','ACT.variant("chill")','ACT.seg("method")','ACT.tab("plan")','ACT.prid("sandwich")','ACT.prid("pizza")','ACT.ptarget("serve")','ACT.tab("timer")','ACT.tstart(0)','ACT.tab("ref")','ACT.tab("starter")']:
      await pg.evaluate(js);await pg.wait_for_timeout(150)
    print("errors",errs)
    print(len(errs),"console errors")
    await b.close()
    return errs
sys.exit(1 if asyncio.run(main()) else 0)
