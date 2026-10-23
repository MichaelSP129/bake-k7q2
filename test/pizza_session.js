// Regression test for the pizza "whole session" question raised on issue #1 / PR #2:
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

/* 1. the bake step is the whole session: 3 min per ball (60–90 s bake + launch/top + stone reheat), all of it attended */
for(let n=1;n<=12;n++){const st=defaults();st.scale.pizza.balls=n;H.reset(st);H.setNow(new Date(2026,10,2,8,0).getTime());
  const steps=J(`currentPlan("pizza").steps`),b=steps[steps.length-1];
  ok("session: last step is the pizza bake, oven kind",/Bake the pizzas/.test(b.t)&&b.k==="oven",JSON.stringify(b));
  ok("session: bake step lasts 3 min × number of balls",b.d===3*n,`n=${n} d=${b.d}`);
  ok("session: every minute of the bake step counts as attended",J(`attendMin(currentPlan("pizza").steps.slice(-1)[0])`)===b.d,`n=${n}`)}

/* 2. the reported case: 23 °C, 28 h fridge, viewed Fri 23 Oct 2026 17:40 → alternatives with first pizza in Sun 25 Oct 22:45 */
{const st=defaults();st.temp=23;st.cold.pizza=28;H.reset(st);H.setNow(new Date(2026,9,23,17,40).getTime());
  const fp=J(`findPlan("pizza")`);ok("case: 23 °C + 28 h fridge has no compliant plan",fp.ok===false,JSON.stringify(fp));
  R(`S.plan.day.pizza=${JSON.stringify(fp.c.date)};S.plan.anchor.pizza=${JSON.stringify(fp.c.at)}`);
  const alts=J(`alternatives("pizza")`);ok("case: alternatives are offered",alts.length>0,"none");
  for(const a of alts){const s=session({date:a.date,at:a.at},a.cold||28),b=lastStep(s),end=new Date(b.t0+b.d*60000);
    ok("case: every alternative is compliant by the app's own check",s.ok&&s.conf===0,a.desc);
    ok("case: no attended minute of any alternative (incl. every pizza) is in 23:00–06:00 (independent minute walk)",clashes(s)===0,`${a.desc} clashes=${clashes(s)}`);
    if(QATAR&&/22:45/.test(a.desc)){
      ok("case (Qatar): the 22:45 alternative's bake session for 4 balls ends at 22:57, before 23:00",end.getHours()===22&&end.getMinutes()===57,end.toString());
      // negative controls: the same check must reject a session that runs past 23:00
      const later=session({date:a.date,at:"23:00"},a.cold||28);
      ok("control: first pizza in at 23:00 is rejected",!later.ok&&later.conf>0,JSON.stringify(later.conf));
      R(`S.scale.pizza.balls=6`);const six=session({date:a.date,at:"22:45"},a.cold||28);
      ok("control: 6 balls with first pizza in at 22:45 (session ends 23:03) is rejected, 3 min in the window",!six.ok&&six.conf===3,JSON.stringify(six.conf));
      ok("control: the independent walk agrees (3 min)",clashes(six)===3,clashes(six));R(`S.scale.pizza.balls=4`)}}
  if(QATAR)ok("case (Qatar): the reported 22:45 alternative is reproduced",alts.some(a=>/Sun 25 Oct, 22:45/.test(a.desc)),JSON.stringify(alts.map(a=>a.desc)))}

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
