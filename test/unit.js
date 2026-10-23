// Node unit tests for core.js: scaling consistency, planner intervals, interpolation, DDT.
// Run: TZ=Asia/Qatar node test/unit.js   (and TZ=Europe/London for the DST pass)
const {load,defaults}=require("./harness");
const H=load();const R=c=>H.run(c);
let pass=0,fail=0;const fails=[];const counts={};
function ok(name,cond,info){counts[name]=(counts[name]||0)+1;if(cond)pass++;else{fail++;if(fails.filter(f=>f.startsWith(name)).length<5)fails.push(name+": "+(info||""))}}
const TZ=process.env.TZ||"(system)";
const set=(path,val)=>R(`${path}=${JSON.stringify(val)}`);

/* ---------- 1. one authoritative formula ---------- */
function gramFigures(text){const out=[];
  const re=/(\d[\d,]*(?:\.\d+)?)(?:\s*–\s*(\d[\d,]*(?:\.\d+)?))?\s*g\b/g;let m;
  while((m=re.exec(text))){out.push({v:m[1],ctx:text.slice(Math.max(0,m.index-60),m.index+60)});if(m[2])out.push({v:m[2],ctx:text.slice(Math.max(0,m.index-60),m.index+60)})}
  return out}
const PER_PIZZA=new Set(["70","80","90"]);
function checkConsistency(rid,label){
  const c=JSON.parse(R(`JSON.stringify(calc("${rid}"))`));
  const allowed=new Set();const addv=x=>{if(typeof x==="number"){allowed.add(R(`gnum(${x})`));allowed.add(R(`g1(${x})`))}};
  Object.values(c.q).forEach(addv);if(c.rows)c.rows.forEach(r=>addv(r.g));if(c.groups)c.groups.forEach(g=>g.rows.forEach(r=>addv(r.g)));
  if(c.build)["m","f","w","t","use"].forEach(k=>addv(c.build[k]));
  const texts=[];
  JSON.parse(R(`JSON.stringify(methodFor("${rid}"))`)).forEach(([t,d])=>texts.push(["method",t+" "+d]));
  JSON.parse(R(`JSON.stringify(currentPlan("${rid}").steps)`)).forEach(s=>texts.push(["step",s.t+" "+s.detail]));
  (c.extras||[]).forEach(([a,v])=>texts.push(["extras",a+" "+v]));
  let n=0;
  for(const [where,t] of texts)for(const f of gramFigures(t)){n++;
    if(rid==="pizza"&&PER_PIZZA.has(f.v)&&/per pizza/i.test(f.ctx))continue;
    ok("scaling: every gram figure in method/planner/timer text is a computed value",allowed.has(f.v),`${rid} ${label} ${where}: "${f.v} g" not in table · …${f.ctx}…`)}
  // targeted: the lines that were hard-coded in v2
  const steps=JSON.parse(R(`JSON.stringify(currentPlan("${rid}").steps)`)),meth=JSON.parse(R(`JSON.stringify(methodFor("${rid}"))`)).map(x=>x[1]).join("\n");
  const g=x=>R(`gt(${x})`);
  if(c.build){const b=c.build,line=`${g(b.m)} mother + ${g(b.f)} flour + ${g(b.w)} water`;
    ok("scaling: levain build line identical in table, method and planner",meth.includes(line)&&steps[0].detail.includes(line),`${rid} ${label} ${line}`);
    ok("scaling: levain build makes at least what the dough uses",b.t>=b.use-1e-9,`${rid} ${label}`);
    const q=c.q;ok("scaling: reserved water and salt in method = table",meth.includes(`${g(q.salt)} `)&&meth.includes(`${g(q.reserve)} reserved water`)&&steps.some(s=>s.detail.includes(`${g(q.salt)} salt`))&&steps.some(s=>s.detail.includes(`${g(q.reserve)} reserved water`)),`${rid} ${label}`);
    ok("scaling: table rows sum to the total",Math.abs(c.rows.reduce((a,r)=>a+r.g,0)-c.total)<1e-6,`${rid} ${label}`);}
  else{const q=c.q;const line=`${g(q.seed)} starter + ${g(q.shoney)} honey + ${g(q.swater)} water + ${g(q.sflour)} flour`;
    ok("scaling: sandwich stiff starter identical in table, method and planner",meth.includes(line)&&steps[0].detail.includes(line),`${label} ${line}`);
    const tz=`${g(q.tflour)} flour + ${g(q.milk)} milk`;ok("scaling: sandwich tangzhong identical in table, method and planner",meth.includes(tz)&&steps[0].detail.includes(tz),label);}
  return n}
let figs=0,combos=0;
const HY=r=>{const L=JSON.parse(R(`JSON.stringify(LEAN.${r})`));return[L.Hmin,L.H0,L.Hmax]};
for(const h of HY("loaf")){set("S.hyd.loaf",h);
  for(const n of [1,2,3,8]){set("S.scale.loaf",{mode:"loaves",n,w:1415});figs+=checkConsistency("loaf",`${n} loaves ${h}%`);combos++}
  for(const w of [300,777,1415,12000]){set("S.scale.loaf",{mode:"weight",n:1,w});figs+=checkConsistency("loaf",`${w} g ${h}%`);combos++;
    ok("mass: loaf weight mode total = requested weight (±1 g)",Math.abs(R(`calc("loaf").total`)-w)<=1,`${w}`)}}
set("S.hyd.loaf",69.7);set("S.scale.loaf",{mode:"loaves",n:1,w:1415});
ok("mass: default loaf = booklet 1,415 g (±1 g)",Math.abs(R(`calc("loaf").total`)-1415)<=1,R(`calc("loaf").total`));
const trays=JSON.parse(R(`JSON.stringify(TRAYS.map(t=>t.id))`));
for(const h of HY("focaccia")){set("S.hyd.focaccia",h);
  for(const t of trays){const dims=t==="custom"?[[10,10],[23,33],[80,80]]:[[23,33]];for(const [cw,cl] of dims){set("S.scale.focaccia",{tray:t,cw,cl});figs+=checkConsistency("focaccia",`${t} ${cw}x${cl} ${h}%`);combos++}}}
set("S.hyd.focaccia",80);set("S.scale.focaccia",{tray:"30x40",cw:23,cl:33});
{const b=JSON.parse(R(`JSON.stringify(calc("focaccia").build)`));ok("scaling: 30×40 focaccia uses the booklet 25 + 75 + 75 build",b.m===25&&b.f===75&&b.w===75&&b.booklet,JSON.stringify(b));}
set("S.scale.focaccia",{tray:"23x33",cw:23,cl:33});
{const b=JSON.parse(R(`JSON.stringify(calc("focaccia").build)`));ok("scaling: 23×33 focaccia uses the booklet 20 + 50 + 50 build",b.m===20&&b.f===50&&b.w===50,JSON.stringify(b));}
for(const h of HY("pizza")){set("S.hyd.pizza",h);
  for(const balls of [1,4,7,24])for(const bw of [150,250,276.5,280,400]){set("S.scale.pizza",{balls,bw});figs+=checkConsistency("pizza",`${balls}×${bw} ${h}%`);combos++;
    const tot=R(`calc("pizza").total`);ok("mass: pizza balls × ball weight = total dough (±1 g)",Math.abs(tot-balls*bw)<=1,`${balls}×${bw}=${balls*bw} vs ${tot}`)}}
set("S.hyd.pizza",66.4);
/* Michael, 23 Oct 2026: 280 g balls. 4 × 280 = 1,120 g, every gram from the one formula (same percentages as the booklet's 360/240/350/30/110/16) */
{const d=defaults();ok("pizza 280: harness default is 4 × 280 g",d.scale.pizza.balls===4&&d.scale.pizza.bw===280,JSON.stringify(d.scale.pizza));}
set("S.scale.pizza",{balls:4,bw:280});
{const c=JSON.parse(R(`JSON.stringify(calc("pizza"))`)),r=c.rows,q=c.q,gn=x=>R(`gnum(${x})`);
 ok("pizza 280: 4 × 280 g = 1,120 g total (±0.01 g)",Math.abs(c.total-1120)<0.01,c.total);
 ok("pizza 280: flours 364.6 g Tipo 00 + 243.1 g bread (60/40), shown 365 g + 243 g",Math.abs(r[0].g-364.58)<0.01&&Math.abs(r[1].g-243.06)<0.01&&gn(r[0].g)==="365"&&gn(r[1].g)==="243",r.map(x=>x.g).join("/"));
 ok("pizza 280: water 354 g + 30 g reserved (384.8 g total)",gn(q.water1)==="354"&&gn(q.reserve)==="30"&&Math.abs(q.water1+q.reserve-384.76)<0.01,`${q.water1}+${q.reserve}`);
 ok("pizza 280: levain 111 g and salt 16 g follow the formula (110/600 and 16/600 of flour)",Math.abs(q.lev-q.flour*110/600)<1e-9&&Math.abs(q.salt-q.flour*16/600)<1e-9&&gn(q.lev)==="111"&&gn(q.salt)==="16",`${q.lev} ${q.salt}`);
 ok("pizza 280: same percentages as the booklet formula (scale factor 1,120 / 1,105.9)",Math.abs(q.flour/600-1120/1105.92)<1e-4,q.flour/600);
 ok("pizza 280: levain build scales from the booklet 20 + 55 + 55 → 20 + 56 + 56 (makes 132 g, uses 111 g)",!c.build.booklet&&gn(c.build.m)==="20"&&gn(c.build.f)==="56"&&gn(c.build.w)==="56"&&gn(c.build.t)==="132"&&c.build.t>=c.build.use,JSON.stringify(c.build));
 const lt=JSON.parse(R(`JSON.stringify(LEVAIN_TABLE.find(x=>/^Pizza/.test(x[0])))`));
 ok("pizza 280: reference levain card matches the default batch's build",lt[1]===`${gn(c.build.m)} + ${gn(c.build.f)} + ${gn(c.build.w)}`&&lt[2]===`${gn(c.build.t)} / ${gn(c.build.use)} g`,JSON.stringify(lt));
 const meth=JSON.parse(R(`JSON.stringify(methodFor("pizza"))`)).map(x=>x.join(" ")).join("\n"),st=JSON.parse(R(`JSON.stringify(currentPlan("pizza").steps)`)).map(s=>s.detail).join("\n");
 ok("pizza 280: method and planner say 4 balls of 280 g, and no 276 / 1,106 anywhere",meth.includes("4 equal balls of 280 g")&&st.includes("4 balls of 280 g")&&!/276|1,106/.test(meth+st),"");}
set("S.scale.pizza",{balls:4,bw:280});
for(const tin of ["large","std"])for(const n of [1,2,3,6])for(const v of ["std","warm","chill"]){set("S.scale.sandwich",{tin,n});set("S.variant.sandwich",v);figs+=checkConsistency("sandwich",`${tin}×${n} ${v}`);combos++;
  const f=(tin==="large"?1:.75)*n,q=JSON.parse(R(`JSON.stringify(calc("sandwich").q)`));
  ok("scaling: sandwich starter = (15|8 seed) + 15 + 30 + 60 and tangzhong 35 + 175, × tin factor",Math.abs(q.seed-(v==="warm"?8:15)*f)<1e-9&&Math.abs(q.shoney-15*f)<1e-9&&Math.abs(q.swater-30*f)<1e-9&&Math.abs(q.sflour-60*f)<1e-9&&Math.abs(q.tflour-35*f)<1e-9&&Math.abs(q.milk-175*f)<1e-9,`${tin}×${n} ${v}`);
  const st=JSON.parse(R(`JSON.stringify(currentPlan("sandwich").steps.map(s=>s.k+":"+s.t))`));
  ok("variant: chill adds a fridge stage for the starter; std/warm don't",v==="chill"?st[1]==="cold:Starter in the fridge":!st.some(x=>x.startsWith("cold:Starter")),st.join(","))}
set("S.scale.sandwich",{tin:"large",n:1});set("S.variant.sandwich","std");
/* sandwich chill: the user picks 8–12 h in the fridge (default 8 h); the planner and timer use it */
set("S.variant.sandwich","chill");
for(const h of [8,9,10,11,12]){set("S.variant.chillH",h);const st=JSON.parse(R(`JSON.stringify(currentPlan("sandwich").steps)`)),m=JSON.parse(R(`JSON.stringify(methodFor("sandwich"))`))[0][1];
  ok("chill: fridge stage = chosen hours × 60 min (8–12 h)",st[1].t==="Starter in the fridge"&&st[1].d===h*60&&st[1].k==="cold",`${h} h → ${st[1].d}`);
  ok("chill: step and method text say the chosen hours",st[1].detail.includes(`${h} h until you mix`)&&m.includes(`${h} h in the fridge`),st[1].detail+" | "+m);
  const sig=R(`planSig("sandwich")`);ok("chill: the accepted-plan signature includes the hours (changing them asks again)",sig.split("|").includes(String(h)),sig)}
{const d=defaults();ok("chill: default is 8 h",d.variant.chillH===8&&R(`CHILL_H.def`)===8);}
set("S.variant.chillH",8);{const a=R(`currentPlan("sandwich").steps[1].d`);set("S.variant.chillH",12);const b=R(`currentPlan("sandwich").steps[1].d`);set("S.variant.chillH",8);
  ok("chill: total plan grows by exactly 4 h from 8 h to 12 h",b-a===240,`${a} → ${b}`)}
for(const [v,want] of [[3,8],[20,12],[9.6,10],["x",8],[null,8]]){set("S.variant.chillH",v);ok("chill: out-of-range or bad hours are clamped (8–12) or default to 8",R(`currentPlan("sandwich").steps[1].d`)===want*60,`${v} → ${R(`currentPlan("sandwich").steps[1].d`)}`)}
{set("S.variant.chillH",12);const p=R(`buildPlan("sandwich",25,12,calc("sandwich"),{variant:"chill",chillH:9}).steps[1].d`);ok("chill: an explicit chillH (a running timer's snapshot) wins over the current setting",p===540,p)}
set("S.variant.chillH",8);set("S.variant.sandwich","std");

/* ---------- 2. interpolation ---------- */
for(const tab of ["LEV","LEV_FAST","LOAF_BULK","FOC_WARM","PIZ_BULK","PIZ_WARM","SW_BULK","SW_PROOF"]){
  const ref=JSON.parse(R(`JSON.stringify(${tab})`));
  [23,24.5,26,27.5,29].forEach((T,i)=>ok("temp: interpolation equals the booklet value at each band's reference temperature",Math.abs(R(`interp(${tab},${T}).m`)-Math.round(ref[i].m/5)*5)<=0,`${tab} ${T}`));
  let prev=null;for(let T=20;T<=33.001;T+=0.1){const w=JSON.parse(R(`JSON.stringify(interp(${tab},${T.toFixed(2)}))`));
    ok("temp: window lo ≤ estimate ≤ hi",w.lo<=w.m&&w.m<=w.hi,`${tab} ${T}`);
    if(prev){ok("temp: continuous (≤ 10 min change per 0.1 °C)",Math.abs(w.m-prev.m)<=10,`${tab} ${T.toFixed(1)} ${prev.m}->${w.m}`);ok("temp: warmer is never slower",w.m<=prev.m,`${tab} ${T.toFixed(1)}`)}prev=w}}
ok("temp: windows are formatted as ranges",R(`fmtWin(interp(LOAF_BULK,25))`).startsWith("≈ ")&&R(`fmtWin(interp(LOAF_BULK,25))`).includes("–"),R(`fmtWin(interp(LOAF_BULK,25))`));
ok("temp: measured dough temp changes the bulk step only",(()=>{const a=JSON.parse(R(`JSON.stringify(buildPlan("loaf",25,14,calc("loaf"),{bulkT:28}).steps.map(s=>s.d))`)),b=JSON.parse(R(`JSON.stringify(buildPlan("loaf",25,14,calc("loaf"),{}).steps.map(s=>s.d))`));return a.filter((x,i)=>x!==b[i]).length===1&&a[5]<b[5]})());

/* ---------- 3. DDT ---------- */
ok("ddt: water = 4×DDT − room − flour − levain − friction",R(`ddtWater({target:25,flour:null,lev:null,fric:2},25)`)===23);
ok("ddt: measured flour/levain temps are used",R(`ddtWater({target:26,flour:20,lev:28,fric:3},30)`)===4*26-30-20-28-3);

/* ---------- 4. planner: unavailable-window intervals ---------- */
// independent check: walk every attended minute and test its local wall-clock time
function inWindow(ms,f,t){const d=new Date(ms),m=d.getHours()*60+d.getMinutes();return f<t?(m>=f&&m<t):(m>=f||m<t)}
function independentClashes(rid,c,away){const tl=JSON.parse(R(`(()=>{const t=timeline("${rid}",${JSON.stringify(c)});return JSON.stringify(t.ev.map(e=>({t0:t.dt(e.st).getTime(),a:attendMin(e)})))})()`));
  let n=0;if(!away)return 0;for(const e of tl)for(let k=0;k<e.a;k++)if(inWindow(e.t0+k*60000,away.f,away.t))n++;return n}
const TEMPS=[22,23,24.5,25,26,27.5,28,29,31];
const BASE=new Date(2026,10,2,0,0,0,0).getTime(); // a Monday, local time
let sweep=0,none=0,okPlans=0;
const sweepRun=(rid,T,cold,variant,target,mode,nowMs)=>{const st=defaults();st.temp=T;st.cold[rid]=cold;st.variant.sandwich=variant;st.plan.target[rid]=target;st.plan.mode=mode;H.reset(st);H.setNow(nowMs);
  const r=JSON.parse(R(`JSON.stringify(findPlan("${rid}"))`));sweep++;
  if(r.ok){okPlans++;const cl=independentClashes(rid,r.c,{f:23*60,t:6*60});
    const tl=JSON.parse(R(`(()=>{const t=timeline("${rid}",${JSON.stringify(r.c)});return JSON.stringify({n:t.conflicts.length,past:t.past,s:t.startD.getTime()})})()`));
    ok("planner sweep: chosen plan has no hands-on/oven minute in 23:00–06:00 (independent minute walk)",cl===0,`${rid} T${T} cold${cold} ${variant} ${target} ${mode} now=${new Date(nowMs).toString().slice(0,21)} → ${JSON.stringify(r.c)} clashes=${cl}`);
    ok("planner sweep: chosen plan agrees with the app's own conflict check",tl.n===0,`${rid}`);
    ok("planner sweep: chosen plan starts in the future",!tl.past&&tl.s>=nowMs,`${rid} ${JSON.stringify(r.c)}`)}
  else{none++;ok("planner sweep: a no-compliant-plan result still offers the closest plan, with its conflicts",!!r.c&&r.min>0,`${rid} ${JSON.stringify(r)}`)}};
for(const rid of ["loaf","focaccia","pizza","sandwich"]){const colds=JSON.parse(R(`JSON.stringify(COLD_OPTS.${rid})`));
  for(const T of TEMPS)for(const cold of colds)for(const variant of rid==="sandwich"?["std","warm","chill"]:["std"])
    for(let q=0;q<96;q++)sweepRun(rid,T,cold,variant,"oven","finish",BASE+q*15*60000)}
const sweepFinish=sweep;
// "ready to slice / all pizzas done" targets and "start at" mode: every hour of the day
for(const rid of ["loaf","focaccia","pizza","sandwich"])for(const T of [23,26,29])for(let h=0;h<24;h++){sweepRun(rid,T,JSON.parse(R(`JSON.stringify(COLD_OPTS.${rid})`))[0],"std","serve","finish",BASE+h*3600000);sweepRun(rid,T,JSON.parse(R(`JSON.stringify(COLD_OPTS.${rid})`))[0],"std","oven","start",BASE+h*3600000+7*60000)}

/* edge cases around 23:00, 06:00 and midnight: a 1-minute shift of a hands-on step in or out of the window */
H.reset(defaults());H.setNow(BASE);
function edge(name,expect,stepStartClock,dur,kind,hands,from,to,on){const fromC=from||"23:00",toC=to||"06:00";
  const code=`(()=>{S.plan.away={on:${on!==false},from:"${fromC}",to:"${toC}"};const p={anchor:0,steps:[{t:"X",d:${dur},k:"${kind}",detail:"",hands:${hands||0}},{t:"Y",d:1,k:"rest",detail:""}]};
    return timeline("loaf",{mode:"start",date:"2026-11-03",at:"${stepStartClock}",p}).conflicts.reduce((a,c)=>a+c.min,0)})()`;
  const got=R(code);ok("edges: "+name,Math.abs(got-expect)<1e-9,`expected ${expect} min, got ${got}`)}
edge("prep ending exactly 23:00 is fine",0,"22:30",30,"prep");
edge("prep ending 23:01 clashes 1 min",1,"22:31",30,"prep");
edge("prep starting exactly 06:00 is fine",0,"06:00",30,"prep");
edge("prep starting 05:59 clashes 1 min",1,"05:59",30,"prep");
edge("oven step across midnight clashes in full",60,"23:30",60,"oven");
edge("oven step 23:00–06:00 exactly clashes 420 min",420,"23:00",420,"oven");
edge("passive rise through the night is fine",0,"21:00",600,"wait");
edge("fridge stage through the night is fine",0,"20:00",720,"cold");
edge("cooling through the night is fine",0,"22:00",180,"rest");
edge("levain build at 22:50 (15 min hands-on) clashes 5 min",5,"22:50",400,"wait",15);
edge("levain build at 22:45 (15 min hands-on) is fine",0,"22:45",400,"wait",15);
edge("sandwich starter + tangzhong at 05:50 (20 min hands-on) clashes 10 min",10,"05:50",600,"wait",20);
edge("22:00–07:00 window: prep at 06:30 clashes 30 min",30,"06:30",60,"prep",0,"22:00","07:00");
edge("09:00–17:00 (daytime, non-wrapping) window: prep 08:30–09:30 clashes 30 min",30,"08:30",60,"prep",0,"09:00","17:00");
edge("09:00–17:00 window: night prep is fine",0,"02:00",60,"prep",0,"09:00","17:00");
edge("window switched off: nothing clashes",0,"02:00",60,"prep",0,"23:00","06:00",false);
edge("from = to means no window",0,"02:00",60,"prep",0,"23:00","23:00");
edge("hands-on spanning two nights counts both",840,"23:00",1860,"prep");

/* alternatives offered for a conflicting plan all comply */
{let alts=0;for(const rid of ["loaf","focaccia","pizza","sandwich"])for(const at of ["03:00","23:30","05:45","00:00"]){const st=defaults();st.plan.custom[rid]=true;st.plan.day[rid]="2026-11-04";st.plan.anchor[rid]=at;H.reset(st);H.setNow(BASE);
  const tl=JSON.parse(R(`JSON.stringify({n:timeline("${rid}").conflicts.length})`));if(!tl.n)continue;
  const list=JSON.parse(R(`JSON.stringify(alternatives("${rid}"))`));ok("alternatives: a conflicting plan gets at least one compliant alternative",list.length>0,`${rid} ${at}`);
  for(const a of list){alts++;const c={mode:"finish",date:a.date,at:a.at,cold:a.cold||undefined};
    const cl=a.cold?R(`(()=>{S.cold["${rid}"]=${a.cold};const n=timeline("${rid}",{mode:"finish",date:"${a.date}",at:"${a.at}"}).conflicts.length;S.cold["${rid}"]=${st.cold[rid]};return n})()`):independentClashes(rid,{mode:"finish",date:a.date,at:a.at},{f:1380,t:360});
    ok("alternatives: every offered alternative complies",cl===0,`${rid} ${at} → ${JSON.stringify(a)}`)}}
 counts["(alternatives checked)"]=alts}

/* a window so wide nothing can comply: explicit no-plan state, never a silent fallback */
{const st=defaults();st.plan.away={on:true,from:"06:00",to:"05:00"};H.reset(st);H.setNow(BASE);const r=JSON.parse(R(`JSON.stringify(findPlan("loaf"))`));
 ok("no-plan: 23 h unavailable window gives ok:false with a least-conflict plan",r.ok===false&&r.c&&r.min>0,JSON.stringify(r))}
{const st=defaults();st.plan.away={on:true,from:"08:00",to:"07:00"};H.reset(st);H.setNow(BASE);const r=JSON.parse(R(`JSON.stringify(findPlan("pizza"))`));
 ok("no-plan: pizza with only 07:00–08:00 free has no compliant plan",r.ok===false,JSON.stringify(r))}

/* DST: the window is local wall-clock time on every day */
{const st=defaults();H.reset(st);H.setNow(new Date(2026,9,24,12,0).getTime());   // UK clocks go back 25 Oct 2026
 const t=R(`(()=>{const p={anchor:0,steps:[{t:"X",d:60,k:"prep",detail:""},{t:"Y",d:1,k:"rest",detail:""}]};return timeline("loaf",{mode:"start",date:"2026-10-25",at:"05:30",p}).conflicts.reduce((a,c)=>a+c.min,0)})()`);
 ok("dst: 05:30–06:30 local on a clock-change day clashes 30 min",Math.abs(t-30)<1e-9,`${t} (TZ=${TZ})`)}

console.log(`TZ=${TZ}`);
console.log(`scaling: ${combos} recipe/scale/option combinations, ${figs} gram figures extracted from method + planner/timer text`);
console.log(`planner sweep: ${sweep} plans (${sweepFinish} ready-at sweeps every 15 min) → ${okPlans} compliant, ${none} explicit no-compliant-plan`);
for(const [k,v] of Object.entries(counts))console.log(`  ${String(v).padStart(6)}  ${k}`);
console.log(`\n${pass} passed, ${fail} failed`);fails.forEach(f=>console.log("  FAIL "+f));
process.exit(fail?1:0);
