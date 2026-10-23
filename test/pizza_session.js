// Regression test for the pizza "whole session" question raised on issue #1 / PR #2, and minutes per pizza (issue #3):
// does the planner's unavailable-window check cover the WHOLE pizza session (every ball, stone reheat between
// pizzas), not just "first pizza in"? Run: TZ=Asia/Qatar node test/pizza_session.js  (also TZ=Europe/London)
const {load,defaults}=require("./harness");
const H=load();const R=c=>H.run(c),J=c=>JSON.parse(R(`JSON.stringify(${c})`));
let pass=0,fail=0;const fails=[];
function ok(name,cond,info){if(cond)pass++;else{fail++;fails.push(name+": "+(info||""))}}
const QATAR=/Qatar|Riyadh|\+03/.test(process.env.TZ||"")||new Date(2026,9,23).getTimezoneOffset()===-180;
// independent check: walk every attended minute and test it against 23:00–06:00 local
const inWin=ms=>{const d=new Date(ms),m=d.getHours()*60+d.getMinutes();return m>=23*60||m<6*60};
function session(c,cold){return J(`(()=>{const p=currentPlan("pizza",{cold:${cold}});const t=timeline("pizza",{...${JSON.stringify(c)},p});
  return {ok:t.ok,conf:t.conflictMin,ev:t.ev.map(e=>({t:e.t,k:e.k,d:e.d,a:attendMin(e),t0:t.dt(e.st).getTime()}))}})()`)}
const clashes=s=>s.ev.reduce((n,e)=>{for(let k=0;k<e.a;k++)if(inWin(e.t0+k*60000))n++;return n},0);
const lastStep=s=>s.ev[s.ev.length-1];

/* 1. the bake step is the whole session: minutes per pizza × balls (open, top, launch, 60–90 s bake, stone recovery), all attended.
      Default 6 min per pizza (issue #3); the setting runs 3–10 min. */
ok("session: default is 6 min per pizza",J(`pizzaMin()`)===6,J(`pizzaMin()`));
for(const pm of [undefined,3,6,10,1,99])for(let n=1;n<=12;n++){const st=defaults();st.scale.pizza.balls=n;if(pm!==undefined)st.pizzaMin=pm;H.reset(st);H.setNow(new Date(2026,10,2,8,0).getTime());
  const want=(pm===undefined?6:Math.min(10,Math.max(3,pm)))*n;
  const steps=J(`currentPlan("pizza").steps`),b=steps[steps.length-1];
  ok("session: last step is the pizza bake, oven kind",/Bake the pizzas/.test(b.t)&&b.k==="oven",JSON.stringify(b));
  ok("session: bake step lasts minutes-per-pizza (clamped 3–10, default 6) × number of balls",b.d===want,`pm=${pm} n=${n} d=${b.d}`);
  ok("session: every minute of the bake step counts as attended",J(`attendMin(currentPlan("pizza").steps.slice(-1)[0])`)===b.d,`n=${n}`)}

/* 2. the reported case: 23 °C, 28 h fridge, viewed Fri 23 Oct 2026 17:40. With 3 min per pizza the app offered first pizza in
      Sun 25 Oct 22:45 (session to 22:57). At 6 min the 4-ball session runs to 23:09, so 22:45 must be rejected, and the
      alternatives should prefer the recipe's 12:00–21:00 window. */
{const st=defaults();st.temp=23;st.cold.pizza=28;H.reset(st);H.setNow(new Date(2026,9,23,17,40).getTime());
  const fp=J(`findPlan("pizza")`);
  R(`S.plan.day.pizza=${JSON.stringify(fp.c.date)};S.plan.anchor.pizza=${JSON.stringify(fp.c.at)}`);
  const alts=J(`alternatives("pizza")`);ok("case: alternatives are offered",fp.ok||alts.length>0,"none");
  const s2245=session({date:"2026-10-25",at:"22:45"},28),b=lastStep(s2245),end=new Date(b.t0+b.d*60000);
  const bakeClash=x=>{const e=lastStep(x);let n=0;for(let k=0;k<e.a;k++)if(inWin(e.t0+k*60000))n++;return n};
  const bakeConf=J(`(()=>{const t=timeline("pizza",{date:"2026-10-25",at:"22:45",p:currentPlan("pizza",{cold:28})});const c=t.conflicts.find(c=>/Bake the pizzas/.test(c.t));return c?c.min:0})()`);
  if(QATAR){ok("case (Qatar): 4 balls × 6 min from 22:45 ends at 23:09",end.getHours()===23&&end.getMinutes()===9,end.toString());
    ok("case (Qatar): first pizza in at 22:45 with 4 balls at 6 min is rejected; the bake session has 9 min in the window",!s2245.ok&&bakeConf===9,JSON.stringify(bakeConf));
    ok("case (Qatar): the independent walk agrees (9 min of the bake session)",bakeClash(s2245)===9,bakeClash(s2245));
    ok("case (Qatar): 22:45 is no longer offered",!alts.some(a=>/22:45/.test(a.desc)),JSON.stringify(alts.map(a=>a.desc)))}
  for(const a of alts){const s=session({date:a.date,at:a.at},a.cold||28);
    ok("case: every alternative is compliant by the app's own check",s.ok&&s.conf===0,a.desc);
    ok("case: no attended minute of any alternative (incl. every pizza) is in 23:00–06:00 (independent minute walk)",clashes(s)===0,`${a.desc} clashes=${clashes(s)}`);
    const fpz=s.ev.find(e=>/Bake the pizzas/.test(e.t)),m=new Date(fpz.t0).getHours()*60+new Date(fpz.t0).getMinutes();
    if(m<12*60||m>21*60){// out of the dinner window is only allowed when no dinner-window time fits within 4 days for that fridge option
      const anc=new Date(2026,9,23,17,40).getTime();let found=null;
      for(let i=-4*96;i<=8*96&&!found;i++){const d=new Date(Math.ceil(anc/9e5)*9e5+i*9e5),mm=d.getHours()*60+d.getMinutes();if(mm<12*60||mm>21*60)continue;
        const x=J(`(()=>{const t=timeline("pizza",{date:"${R(`isoDate(new Date(${d.getTime()}))`)}",at:"${R(`clockOf(new Date(${d.getTime()}))`)}",p:currentPlan("pizza",{cold:${a.cold||28}})});return t.ok&&!t.past})()`);if(x)found=d.toString()}
      ok("case: an alternative outside 12:00–21:00 is offered only when no dinner-window plan fits",!found,`${a.desc} but ${found} fits`)}
    else ok("case: alternative's first pizza is in the 12:00–21:00 dinner window",true)}
  ok("case: at least one alternative is in the dinner window",alts.some(a=>{const s=session({date:a.date,at:a.at},a.cold||28),f=s.ev.find(e=>/Bake the pizzas/.test(e.t)),m=new Date(f.t0).getHours()*60+new Date(f.t0).getMinutes();return m>=12*60&&m<=21*60}),JSON.stringify(alts.map(a=>a.desc)))
  // a 3-min-per-pizza cook can still use the late slot, and the check still works at the setting's edge
  R(`S.pizzaMin=3`);const fast=session({date:"2026-10-25",at:"22:45"},28);ok("control: at 3 min per pizza, the 4-ball session from 22:45 ends 22:57 with no bake minute in the window",bakeClash(fast)===0&&lastStep(fast).d===12,JSON.stringify(lastStep(fast)));R(`delete S.pizzaMin`)}

/* 3. sweep: every alternative the app offers for pizza, 2–8 balls, all temperatures and fridge stages, never has a pizza in the window */
let altsChecked=0;
for(const n of [2,4,6,8])for(const T of [22,23,24.5,25,26,27.5,28,29,31])for(const cold of J(`COLD_OPTS.pizza`))for(const hr of [9,18]){
  const st=defaults();st.temp=T;st.cold.pizza=cold;st.scale.pizza.balls=n;H.reset(st);H.setNow(new Date(2026,10,2,hr,0).getTime());
  const fp=J(`findPlan("pizza")`);if(fp.c)R(`S.plan.day.pizza=${JSON.stringify(fp.c.date)};S.plan.anchor.pizza=${JSON.stringify(fp.c.at)}`);
  if(fp.ok)ok("sweep: the default plan's whole pizza session (all balls) is outside 23:00–06:00",clashes(session(fp.c,cold))===0,`n${n} T${T} c${cold}`);
  for(const tgt of ["oven","serve"]){R(`S.plan.target.pizza="${tgt}"`);
    for(const a of J(`alternatives("pizza")`)){altsChecked++;const s=J(`(()=>{const p=currentPlan("pizza",{cold:${a.cold||cold}});const t=timeline("pizza",{date:${JSON.stringify(a.date)},at:${JSON.stringify(a.at)},p});
      return {ok:t.ok,ev:t.ev.map(e=>({a:attendMin(e),t0:t.dt(e.st).getTime(),d:e.d}))}})()`);
      ok("sweep: every offered pizza alternative keeps the whole session (all balls) outside 23:00–06:00",s.ok&&clashes(s)===0,`n${n} T${T} c${cold} ${tgt} ${a.desc}`)}}}
console.log(`TZ=${process.env.TZ||"(system)"} · ${altsChecked} pizza alternatives checked`);
if(fails.length)console.log(fails.slice(0,20).join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);process.exit(fail?1:0);
