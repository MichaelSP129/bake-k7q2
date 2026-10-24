"use strict";
/* =====================================================================
   core.js: pure logic (no DOM). Formulas, method text, timings, planner.
   Everything here reads the global state S and the clock through NOW(),
   so the Node test-suite can load it with a fake state and a fake clock.
   ===================================================================== */
let NOW=()=>Date.now();
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
/* one number formatter for every gram figure in the app (tables, method, planner, timer) */
function gnum(x){if(x>=1000)return Math.round(x).toLocaleString("en-GB");if(x>=20)return String(Math.round(x));return String(Math.round(x*2)/2)}
const gt=x=>`${gnum(x)} g`;
const g1=x=>{const r=Math.round(x*10)/10;return Number.isInteger(r)?String(r):r.toFixed(1)}; // ball weight keeps its .5
const pc=x=>`${(x*100).toFixed(1)}%`;
function fmtDur(min){const m=Math.max(0,Math.round(min)),h=Math.floor(m/60),r=m%60;if(!h)return`${r} min`;return r?`${h} h ${r} min`:`${h} h`}
function fmtHM(min){const m=Math.max(0,Math.round(min)),h=Math.floor(m/60),r=m%60;if(!h)return`${r} min`;return r?`${h} h ${r}`:`${h} h`}
function fmtClock(min){const m=((Math.round(min)%1440)+1440)%1440;return`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`}
const clockOf=d=>fmtClock(d.getHours()*60+d.getMinutes());
function parseClock(s){const m=String(s||"").trim().match(/^(\d{1,2})[:.]?(\d{2})$/);if(!m)return null;const h=+m[1],mi=+m[2];if(h>23||mi>59)return null;return h*60+mi}
function isoDate(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function fromIso(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
const DOW=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dayName(d){return`${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`}
function relDay(d){const t=new Date(NOW());t.setHours(0,0,0,0);const x=new Date(d);x.setHours(0,0,0,0);const diff=Math.round((x-t)/864e5);return diff===0?"Today":diff===1?"Tomorrow":diff===-1?"Yesterday":diff>1?`In ${diff} days`:`${-diff} days ago`}
function tomorrowIso(){const d=new Date(NOW());d.setDate(d.getDate()+1);return isoDate(d)}
function waterPct(L,H){return H/100*(1+L.L/2)-L.L/2}

/* ---------- temperature → timing, continuous ----------
   The booklet tables give a range per kitchen band. Each band is pinned to a reference
   temperature and values are interpolated linearly between neighbours, so 25 °C and 26 °C no
   longer jump. Outside 23–29 °C the end values are held (the UI warns below 18 / above 32). */
const BAND_T=[23,24.5,26,27.5,29];
const hrs=x=>parseFloat(String(x).replace("½",".5").replace("¼",".25").replace("¾",".75"));
function rng(r){const p=r.replace(/\s*h$/,"").split("–");return[hrs(p[0])*60,hrs(p[1]??p[0])*60]}
function interp(tab,T){const t=clamp(+T,BAND_T[0],BAND_T[4]);let i=0;while(i<3&&t>BAND_T[i+1])i++;
  const f=(t-BAND_T[i])/(BAND_T[i+1]-BAND_T[i]),a=tab[i],b=tab[i+1],[al,ah]=rng(a.r),[bl,bh]=rng(b.r),L=(x,y)=>x+(y-x)*f,r5=x=>Math.round(x/5)*5;
  return{lo:r5(L(al,bl)),hi:r5(L(ah,bh)),m:r5(L(a.m,b.m))}}
const fmtWin=w=>`≈ ${fmtHM(w.lo)}–${fmtHM(w.hi)}`;

/* ---------- one authoritative formula per recipe ---------- */
const SANDWICH_VARIANTS={
  std:{label:"Standard",sub:"15 g seed · 8–10 h",seed:15},
  warm:{label:"Warm kitchen",sub:"8 g seed · 8–10 h",seed:8},
  chill:{label:"Chill",sub:"15 g · 3–4 h, then fridge",seed:15}
};
// levain builds printed in the booklet; any other batch scales the nearest one in proportion
const BUILDS={loaf:[{use:150,b:[20,70,70]}],focaccia:[{use:100,b:[20,50,50]},{use:158,b:[25,75,75]}],pizza:[{use:110,b:[20,55,55]}]};
function levainBuild(rid,use){const opts=BUILDS[rid];
  const exact=opts.find(o=>Math.abs(use-o.use)/o.use<0.01);if(exact){const [m,f,w]=exact.b;return{m,f,w,t:m+f+w,use,booklet:true}}
  const base=opts[0],k=use/base.use,[m,f,w]=base.b.map(x=>x*k);return{m,f,w,t:m+f+w,use,booklet:false}}
function sandwichFactor(st){return(st.tin==="large"?1:.75)*clamp(st.n,1,6)}
function calc(rid,st){
  st=st||S.scale[rid];
  if(rid==="sandwich"){
    const n=clamp(st.n,1,6),f=sandwichFactor(st),v=SANDWICH_VARIANTS[S.variant&&S.variant.sandwich]||SANDWICH_VARIANTS.std;
    const base=SANDWICH.map(x=>x.name==="Active starter"?{...x,g:v.seed}:x),flour0=base.filter(x=>/flour/i.test(x.name)).reduce((a,x)=>a+x.g,0),sum0=base.reduce((a,x)=>a+x.g,0);
    const q={};base.forEach(x=>{q[x.key]=x.g*f});q.butter=15*f;q.flourAll=flour0*f;q.starterTotal=(v.seed+15+30+60)*f;
    return{rid,f,n,q,groups:["Stiff starter","Tangzhong","Main dough"].map(g=>({g,rows:base.filter(s=>s.group===g).map(s=>({name:s.name,g:s.g*f,p:s.g/flour0,key:s.key}))})),
      total:sum0*f,totalPct:sum0/flour0,variant:v,
      stats:[[gt(flour0*f),"Total flour"],["≈62%","Effective hydration"],[gt(sum0*f/n),"Per tin"],[gt(15*f),"Butter to brush"]],
      build:null,extras:[],summary:`${n} ${st.tin==="large"?"large":"2 lb"} tin${n>1?"s":""} · ${gt(sum0*f)}`}
  }
  const L=LEAN[rid],H=S.hyd[rid],w=waterPct(L,H),sum=1+w+L.L+L.salt+L.oil;
  let F=L.baseFlour,units=1,unit="Per loaf",perUnit=null;
  if(rid==="loaf"){if(st.mode==="loaves"){units=clamp(st.n,1,8);F=750*units}else{F=clamp(st.w,300,12000)/sum;unit="Dough"}}
  else if(rid==="focaccia"){const t=TRAYS.find(x=>x.id===st.tray)||TRAYS[0];const area=st.tray==="custom"?clamp(st.cw,10,80)*clamp(st.cl,10,80):t.area;F=500*area/759;unit="Per tray"}
  else{units=clamp(st.balls,1,24);perUnit=clamp(st.bw,150,400);F=units*perUnit/sum;unit="Per ball"}   // mass from the formula: balls × weight = total
  const water=w*F,reserve=Math.min(L.reserve*F,water),lev=L.L*F,salt=L.salt*F,oil=L.oil*F,total=F+water+lev+salt+oil;
  const rows=L.flours.map(fl=>({name:fl.name,sub:fl.note,g:F*fl.pct,p:fl.pct,key:"flour"}));
  rows.push({name:"Water",sub:"Initial mix",g:water-reserve,p:(water-reserve)/F,key:"water1"});
  rows.push({name:"Water",sub:"Reserved, added with the salt",g:reserve,p:reserve/F,key:"reserve"});
  rows.push({name:"Levain",sub:"100% hydration, at peak",g:lev,p:L.L,key:"lev"});
  rows.push({name:"Fine salt",sub:"",g:salt,p:L.salt,key:"salt"});
  if(oil>0)rows.push({name:"Extra-virgin olive oil",sub:"In the dough",g:oil,p:L.oil,key:"oil"});
  const build=levainBuild(rid,lev),tf=F+lev/2,tw=water+lev/2,a=F/500,extras=[];
  const q={flour:F,water1:water-reserve,reserve,lev,salt,oil,total,bm:build.m,bf:build.f,bw:build.w,bt:build.t};
  if(rid==="focaccia"){Object.assign(q,{tray0:25*a,tray1:30*a,top0:15*a,top1:20*a,brine:20*a,large:F>=700});
    extras.push(["Tray oil",`${gnum(q.tray0)}–${gt(q.tray1)}`],["Top oil",`${gnum(q.top0)}–${gt(q.top1)}`],["Optional brine",`${gt(q.brine)} water + ${gt(q.brine)} olive oil + pinch of salt`],["To finish","Flaky salt and rosemary"])}
  if(rid==="pizza"){Object.assign(q,{n:units,ball:perUnit,tom:100*units,tomSalt:units,mz0:70*units,mz1:90*units});
    extras.push(["Sauce, uncooked",`${gt(q.tom)} canned tomatoes + ${gt(q.tomSalt)} salt · 70–80 g per pizza`],["Mozzarella, drained",`${gnum(q.mz0)}–${gt(q.mz1)} · 70–90 g per pizza`],["To finish","Basil and a little olive oil"])}
  let summary;
  if(rid==="loaf")summary=st.mode==="loaves"?`${units} loa${units>1?"ves":"f"} · ${gt(total)}`:`${gt(total)} dough`;
  else if(rid==="focaccia"){const t=TRAYS.find(x=>x.id===st.tray);summary=`${st.tray==="custom"?`${st.cw} × ${st.cl} cm`:t.label+" cm"} · ${gt(total)}`}
  else summary=`${units} ball${units>1?"s":""} · ${g1(perUnit)} g each`;
  return{rid,rows,total,totalPct:sum,F,units,q,
    stats:[[pc(tw/tf),"True hydration"],[pc(salt/tf),"Salt of total flour"],[pc(lev/2/tf),"Prefermented flour"],[rid==="pizza"?`${g1(perUnit)} g`:gt(total/units),unit]],
    build,extras,summary,tw,tf};
}

/* ---------- steps: the planner, the timer and the Method tab all come from here ----------
   k: prep (hands-on), oven (attended), wait (rising), cold (fridge), rest (cooling)
   hands: minutes of real work at the start of a wait step (mixing a build, cooking a tangzhong…)
   check: a fermentation/proof stage that ends with a readiness check, never an automatic next step */
function chillH(h){const v=+(h??(S&&S.variant&&S.variant.chillH));return Number.isFinite(v)?clamp(Math.round(v),CHILL_H.min,CHILL_H.max):CHILL_H.def}
function buildPlan(id,T,coldH,c,o){
  o=o||{};const bT=o.bulkT??T,b=band(T),q=c.q;
  const S_=(t,d,k,detail,x)=>Object.assign({t,d:Math.max(1,Math.round(d)),k,detail},x||{});
  if(id==="loaf"){const lev=interp(LEV,T).m,bulk=interp(LOAF_BULK,bT).m;return{anchor:11,steps:[
    S_("Build the levain",lev-45,"wait",`${gt(q.bm)} mother + ${gt(q.bf)} flour + ${gt(q.bw)} water. Mark the level, cover. You'll use ${gt(q.lev)}.`,{est:1,check:1,hands:15,key:"levain",cue:"Roughly doubled, bubbly, domed or just flattening."}),
    S_("Autolyse",45,"wait",`${gt(q.flour)} flour + ${gt(q.water1)} water, mixed until no dry flour. Keep the ${gt(q.reserve)} reserved water aside. The levain finishes peaking meanwhile.`,{hands:10,cue:"Levain domed or just flattening when this ends."}),
    S_("Add levain — bulk starts",20,"prep",`Spread ${gt(q.lev)} levain over, dimple in with wet fingers, pinch and fold. Note the dough temperature.`,{key:"bulkstart"}),
    S_("Salt + reserved water",30,"prep",`Dissolve ${gt(q.salt)} salt in the ${gt(q.reserve)} reserved water, pinch and fold until absorbed.`),
    S_("Stretch-and-folds, sets 1–4",90,"prep","One set now, then every 30 min (4 sets). Wet hand, all four sides.",{cue:"Smoother by set 3, cohesive by set 4."}),
    S_("Finish bulk, hands off",bulk-140,"wait",`Covered and undisturbed until ${LOAF_RISE[band(bT)]} rise.`,{est:1,check:1,key:"bulk",cue:"Bubbles on the sides and base, domed edges, wobbles."}),
    S_("Pre-shape + bench rest",25,"prep","Loose round, light tension, uncovered.",{cue:"Relaxes but doesn't puddle."}),
    S_("Shape → banneton → fridge",10,"prep","Tight boule, smooth side down in a rice-floured banneton, covered, straight into the fridge."),
    S_("Cold proof",coldH*60-60,"cold","3–5 °C. Flexible: 10–16 h is ideal."),
    S_("Preheat oven + cloche to 250 °C",60,"oven","The loaf stays in the fridge until the oven is ready."),
    S_("Score cold, bake covered at 250 °C",30,"oven","Turn out onto a sling, one score 1–1.5 cm deep at 30–45°."),
    S_("Bake uncovered at 220–225 °C",27,"oven","Lid off. Drop to 210–215 °C if colouring too fast.",{cue:"Chestnut crust, 96–98 °C inside."}),
    S_("Cool on a rack",150,"rest","2½–3 h before slicing; cutting early gives a gummy crumb.")]}}
  if(id==="focaccia"){const lev=interp(LEV_FAST,T).m,bulk=interp(LOAF_BULK,bT).m,warm=interp(FOC_WARM,T).m;return{anchor:11,steps:[
    S_("Build the levain",lev-35,"wait",`${gt(q.bm)} mother + ${gt(q.bf)} flour + ${gt(q.bw)} water. You'll use ${gt(q.lev)}.`,{est:1,check:1,hands:15,key:"levain",cue:"At or just before peak."}),
    S_("Flour + water rest",35,"wait",`${gt(q.flour)} flour + ${gt(q.water1)} water until no dry bits (keep ${gt(q.reserve)} back). Wet is right; don't add flour.`,{hands:10}),
    S_("Add levain — bulk starts",20,"prep",`Dimple in ${gt(q.lev)} levain and fold until incorporated.`,{key:"bulkstart"}),
    S_("Salt water, then olive oil",30,"prep",`${gt(q.salt)} salt dissolved in the ${gt(q.reserve)} reserved water, added in two goes; then fold in ${gt(q.oil)} olive oil.`),
    S_("Coil folds, sets 1–3",90,"prep","One set now, then every 30 min. A 4th only if still slack.",{cue:"Smooth, glossy, elastic, still soft."}),
    S_("Finish bulk, hands off",bulk-140,"wait",`Until ${FOC_RISE[band(bT)]} rise.`,{est:1,check:1,key:"bulk",cue:"Airy, bubbly sides and base, jiggles."}),
    S_("Oil the tray, stretch the dough",30,"prep",`${gnum(q.tray0)}–${gt(q.tray1)} olive oil in the tray, flip once, coax to the corners; rest 15–20 min if it springs back.`),
    S_("Cold rest in the tray",coldH*60,"cold","Covered, 3–5 °C, 8–16 h."),
    S_("Warm-up proof",warm-40,"wait","Covered, at room temperature.",{est:1,check:1,hands:5,key:"proof",cue:"Puffy, bubbly, big wobble."}),
    S_("Preheat 240–245 °C (fan 220–225 °C)",40,"oven","Dough keeps proofing meanwhile. At least 40 min."),
    S_("Oil, dimple, season",5,"prep",`${gnum(q.top0)}–${gt(q.top1)} olive oil over the top, oiled fingers down to the tray, flaky salt and rosemary. Optional brine: ${gt(q.brine)} water + ${gt(q.brine)} olive oil + a pinch of salt.`),
    S_("Bake",q.large?25:23,"oven",q.large?"22–28 min for a large tray. Check from 20 min.":"20–25 min. Check from 18 min.",{cue:"Deep golden top, crisp base."}),
    S_("Rest in the tray",5,"rest","Then lift onto a rack."),
    S_("Cool before cutting",25,"rest","20–30 min.")]}}
  if(id==="pizza"){const lev=interp(LEV_FAST,T).m,bulk=interp(PIZ_BULK,bT).m,warm=interp(PIZ_WARM,T).m;return{anchor:9,steps:[
    S_("Build the levain",lev-28,"wait",`${gt(q.bm)} mother + ${gt(q.bf)} flour + ${gt(q.bw)} water. You'll use ${gt(q.lev)}.`,{est:1,check:1,hands:15,key:"levain",cue:"At or just before peak."}),
    S_("Flour + water rest",28,"wait",`Both flours (${gt(q.flour)} total) + ${gt(q.water1)} water, mixed until no dry flour. Keep ${gt(q.reserve)} back.`,{hands:10}),
    S_("Add levain",15,"prep",`Pinch and fold ${gt(q.lev)} levain in until incorporated.`,{key:"bulkstart"}),
    S_("Salt + reserved water",30,"prep",`${gt(q.salt)} salt in the ${gt(q.reserve)} reserved water; pinch and fold until absorbed.`),
    S_("Folds 1–2",30,"prep","Fold 1 now, fold 2 at the end of this step. A 3rd only if batter-like."),
    S_("Finish bulk, hands off",bulk-75,"wait",`Until ${PIZ_RISE[band(bT)]} rise. Little rise is right for pizza.`,{est:1,check:1,key:"bulk",cue:"Slightly domed, a few bubbles."}),
    S_("Divide and ball",15,"prep",`${q.n} ball${q.n>1?"s":""} of ${g1(q.ball)} g, into lightly oiled lidded containers.`),
    S_("Cold ferment",coldH*60,"cold","3–5 °C, 20–28 h (24 h is the target)."),
    S_("Warm-up",warm-40,"wait","Balls out, covered. Don't re-ball. Prep sauce and drain mozzarella.",{est:1,check:1,hands:5,key:"proof",cue:"Poke springs back slowly."}),
    S_("Heat the Ooni",40,"oven","30–40 min until the stone centre reads 420–450 °C."),
    S_("Bake the pizzas",Math.max(1,q.n)*3,"oven","Open, top lightly (70–80 g sauce, 70–90 g mozzarella per pizza), launch, flame down, 60–90 s each, rotating every 15–20 s.")]}}
  // sandwich
  const bulk=interp(SW_BULK,bT).m,proof=interp(SW_PROOF,T).m,v=o.variant||"std",V=SANDWICH_VARIANTS[v];
  const build=`Stiff starter: ${gt(q.seed)} starter + ${gt(q.shoney)} honey + ${gt(q.swater)} water + ${gt(q.sflour)} flour. Tangzhong: ${gt(q.tflour)} flour + ${gt(q.milk)} milk, whisked to 65 °C, covered and chilled.`;
  const first=v==="chill"?[
    S_("Stiff starter + tangzhong",210,"wait",`${build} Starter 3–4 h at room temperature, then into the fridge.`,{est:1,check:1,hands:20,key:"levain",cue:"Starter visibly risen, about 50%."}),
    S_("Starter in the fridge",chillH(o.chillH)*60,"cold",`Covered, 3–5 °C, ${chillH(o.chillH)} h until you mix (your setting; 8–12 h works).`,{hands:0})]:[
    S_("Stiff starter + tangzhong",600,"wait",`${build} ${v==="warm"?"Warm-kitchen version: the smaller seed keeps it from overshooting. ":""}Leave 8–10 h.`,{est:1,check:1,hands:20,key:"levain",cue:"Starter domed and risen."})];
  const steps=[...first,
    S_("Mix and knead",20,"prep",`${gt(q.water)} cold water, ${gt(q.honey)} honey, the tangzhong, all the starter, ${gt(q.flour)} flour and ${gt(q.salt)} salt. Mix 2–3 min slow; add ${gt(q.oil)} oil after 3–4 min of kneading, 10–15 min total.`,{key:"bulkstart",cue:"Weak windowpane, dough 24–26 °C."}),
    S_("Bulk ferment",bulk,"wait","Covered, until 40–50% rise.",{est:1,check:1,key:"bulk",cue:"Puffy and soft, clear rise."}),
    S_("Shape → tin → fridge",15,"prep","25 × 35 cm rectangle, roll from the short end, seam down in the greased tin."),
    S_("Fridge overnight",coldH*60,"cold","Covered, 3–5 °C."),
    S_("Finish proof",proof-30,"wait","Covered, at room temperature.",{est:1,check:1,hands:5,key:"proof",cue:"Dome about level with the rim."}),
    S_("Preheat to 175 °C (fan ~160 °C)",30,"oven","Loaf keeps proofing meanwhile."),
    S_("Bake",42,"oven","40–45 min; foil at 25–30 min if darkening.",{cue:"93–96 °C inside."}),
    S_("Butter, rest in the tin",8,"rest",`Brush with ${gt(q.butter)} butter, 5–10 min in the tin.`),
    S_("Cool on a rack",100,"rest","1–2 h before slicing.")];
  return{anchor:steps.findIndex(s=>s.t==="Bake"),steps};
}
function currentPlan(rid,o){o=o||{};return buildPlan(rid,o.temp??S.temp,o.cold??S.cold[rid],o.c||calc(rid),{variant:S.variant.sandwich,chillH:chillH(),bulkT:o.bulkT})}

/* ---------- Method tab text, generated from the same numbers ---------- */
function methodFor(rid,c){
  c=c||calc(rid);const q=c.q,T=S.temp;
  if(rid==="loaf")return[["Build the levain",`${gt(q.bm)} mother + ${gt(q.bf)} flour + ${gt(q.bw)} water (makes ${gt(q.bt)}; you use ${gt(q.lev)}). ${fmtWin(interp(LEV,T))} at ${T} °C. Ready when roughly doubled, bubbly throughout, domed or just flattening, smelling pleasantly tangy.`],
    ["Autolyse, 40–45 min",`${gt(q.flour)} flour + ${gt(q.water1)} water, by hand until no dry flour remains. Rough and shaggy is fine. Cover.`],
    ["Add the levain — bulk starts",`Spread the ${gt(q.lev)} levain over, dimple in with wet fingers, pinch and fold. Note the time and dough temperature. Rest 15–20 min.`],
    ["Salt + reserved water",`Dissolve the ${gt(q.salt)} fine salt in the ${gt(q.reserve)} reserved water, add gradually, pinch and fold until the dough comes back together. Rest 30 min.`],
    ["Four sets of stretch-and-folds","Every 30 min: wet hand, lift one side to resistance, fold over, turn 90°, all four sides."],
    ["Finish bulk by the dough",`Straight-sided container with the level marked. Shape at ${LOAF_RISE[band(T)]} rise (bulk ${fmtWin(interp(LOAF_BULK,T))} from levain in), not by the clock.`],
    ["Pre-shape, bench rest 20–25 min","Loose round, light tension, uncovered. It should relax but not puddle."],
    ["Shape a boule","Flour the top, flip. Bottom up, sides in, top down, roll seam-down and drag to tighten until smooth and taut."],
    ["Banneton, straight into the fridge","Rice-floured, smooth side down, covered. Only if clearly under-fermented give it 15–30 min at room temperature first."],
    ["Cold proof 10–16 h at 3–5 °C","Overnight is ideal; 8 h works and it can stretch to 24 h."],
    ["Preheat 45–60 min","Oven and cloche to 250 °C. The loaf stays in the fridge."],
    ["Score cold","Turn out onto a sling, one confident score 1–1.5 cm deep, off-centre, blade at 30–45°."],
    ["Bake","Covered 30 min at 250 °C, then uncovered 25–30 min at 220–225 °C (210–215 °C if dark). Done at 96–98 °C inside."],
    ["Cool 2½–3 h","On a rack. Cutting early gives a gummy crumb."]];
  if(rid==="focaccia")return[["Build the levain",`${gt(q.bm)} mother + ${gt(q.bf)} flour + ${gt(q.bw)} water (makes ${gt(q.bt)}; you use ${gt(q.lev)}). ${fmtWin(interp(LEV_FAST,T))} at ${T} °C; use at or just before peak.`],
    ["Flour + water rest, 30–40 min",`${gt(q.flour)} flour + ${gt(q.water1)} water until no dry flour. It's meant to be wet; don't add flour.`],
    ["Add the levain",`Dimple in the ${gt(q.lev)} levain and fold until incorporated. Rest 15–20 min.`],
    ["Salt water, then olive oil",`Dissolve ${gt(q.salt)} salt in the ${gt(q.reserve)} reserved water, add in two goes; then fold in ${gt(q.oil)} olive oil until cohesive. Rest 30 min.`],
    ["Coil folds","3 sets 30 min apart (a 4th only if slack). Aim for smooth, glossy, elastic but soft."],
    ["Finish bulk",`Until ${FOC_RISE[band(T)]} rise (lower end when warm): airy, bubbly sides and base, jiggly.`],
    ["Oil the tray and transfer",`${gnum(q.tray0)}–${gt(q.tray1)} olive oil in the tray, flip once to coat, coax towards the corners. If it springs back, rest 15–20 min and repeat.`],
    ["Cold rest 8–16 h","Covered in the fridge."],
    ["Warm-up proof",`${fmtWin(interp(FOC_WARM,T))} at ${T} °C, until very puffy with a big wobble.`],
    ["Preheat","240–245 °C conventional / 220–225 °C fan, at least 40 min."],
    ["Oil, dimple, season",`${gnum(q.top0)}–${gt(q.top1)} olive oil over the top, oiled fingers right down to the tray. Optional brine: ${gt(q.brine)} water + ${gt(q.brine)} olive oil + a pinch of salt. Flaky salt and rosemary.`],
    [q.large?"Bake 22–28 min":"Bake 20–25 min",q.large?"Large tray: check from 20 min. Bottom rack for 2–5 min if pale underneath.":"Check from 18 min. Bottom rack for 2–5 min if pale underneath."],
    ["Rest and cut","Out of the tray after 5 min onto a rack; cut after 20–30 min."]];
  if(rid==="pizza")return[["Build the levain",`${gt(q.bm)} mother + ${gt(q.bf)} flour + ${gt(q.bw)} water (makes ${gt(q.bt)}; you use ${gt(q.lev)}). ${fmtWin(interp(LEV_FAST,T))} at ${T} °C; use at or just before peak.`],
    ["Flour + water rest, 25–30 min",`Both flours (${gt(q.flour)} total) + ${gt(q.water1)} water until no dry flour.`],
    ["Add the levain",`Pinch and fold in the ${gt(q.lev)} levain. Rest 15 min.`],
    ["Salt + reserved water",`${gt(q.salt)} salt in the ${gt(q.reserve)} reserved water; pinch and fold until absorbed. Rest 30 min.`],
    ["Two folds, 30 min apart","A 3rd only if it's still batter-like."],
    ["Bulk to 20–30%",`${fmtWin(interp(PIZ_BULK,T))} at ${T} °C. Stop at about 20% if the dough is 27 °C or warmer.`],
    ["Divide and ball",`${q.n} equal ball${q.n>1?"s":""} of ${g1(q.ball)} g, smooth and tight, into lightly oiled lidded containers.`],
    ["Cold ferment ~24 h","20–28 h at 3–5 °C."],
    ["Warm-up",`${fmtWin(interp(PIZ_WARM,T))} at ${T} °C. Don't re-ball. Ready when a poke springs back slowly.`],
    ["Heat the Ooni 30–40 min","Stone centre at 420–450 °C."],
    ["Open the dough","Press from the centre, leave the outer 1.5–2 cm alone; to 20–22 cm, then over the knuckles to 30–32 cm. No rolling pin."],
    ["Top lightly, shake test","Per pizza: 70–80 g uncooked sauce, 70–90 g drained mozzarella, basil, olive oil. Make sure it slides on the peel."],
    ["Launch, flame down","Turn the flame low just after launching so the top catches up with the base."],
    ["Bake 60–90 s","Rotate every 15–20 s."]];
  const v=S.variant.sandwich;
  return[[`Night before: stiff sweet starter (${c.variant.label.toLowerCase()})`,`${gt(q.seed)} starter + ${gt(q.shoney)} honey + ${gt(q.swater)} water + ${gt(q.sflour)} flour. ${v==="chill"?`3–4 h at room temperature, then ${chillH()} h in the fridge until you mix (8–12 h works).`:v==="warm"?"8–10 h; the smaller seed is for a 27 °C+ kitchen.":"8–10 h at about 23 °C."}`],
    ["Night before: tangzhong",`${gt(q.tflour)} flour + ${gt(q.milk)} milk, whisked over low heat to 65 °C (thick paste). Cover and chill.`],
    ["Mix 2–3 min slow",`${gt(q.water)} cold water, ${gt(q.honey)} honey, the tangzhong, all the starter, ${gt(q.flour)} flour, ${gt(q.salt)} salt.`],
    ["Knead 10–15 min",`Add the ${gt(q.oil)} oil after 3–4 min. Aim for a weak windowpane and 24–26 °C dough.`],
    ["Bulk to 40–50%",`${fmtWin(interp(SW_BULK,T))} at ${T} °C.`],
    ["Shape","Roll to 25 × 35 cm, roll up tightly from the short end, pinch the seam, seam down in the greased tin."],
    ["Fridge overnight","Covered."],
    ["Finish proof to the rim",`${fmtWin(interp(SW_PROOF,T))} at ${T} °C.`],
    ["Bake","175 °C conventional / ~160 °C fan for 40–45 min; foil at 25–30 min if dark. Done at 93–96 °C."],
    ["Butter and cool",`Brush with ${gt(q.butter)} butter, 5–10 min in the tin, then 1–2 h on a rack.`]];
}

/* ---------- planner: interval-based scheduling ---------- */
const TARGETS={loaf:[["oven","Out of the oven"],["serve","Ready to slice"]],focaccia:[["oven","Out of the oven"],["serve","Ready to cut"]],pizza:[["oven","First pizza in"],["serve","All pizzas done"]],sandwich:[["oven","Out of the oven"],["serve","Ready to slice"]]};
const READY_WIN={loaf:[7*60,20*60],focaccia:[11*60,20*60],pizza:[12*60,21*60],sandwich:[8*60,20*60]};
const attendMin=e=>e.k==="prep"||e.k==="oven"?e.d:(e.hands||0);
function awayCfg(){const a=S.plan.away;if(!a||!a.on)return null;const f=parseClock(a.from),t=parseClock(a.to);return f===null||t===null||f===t?null:{f,t}}
// minutes of [t0,t1) (ms) that fall inside the daily unavailable window
function awayOverlap(t0,t1,aw){if(!aw||t1<=t0)return 0;let tot=0;const d=new Date(t0);d.setHours(0,0,0,0);d.setDate(d.getDate()-1);
  while(d.getTime()<t1){const ws=new Date(d);ws.setHours(0,aw.f,0,0);const we=new Date(d);if(aw.t<aw.f)we.setDate(we.getDate()+1);we.setHours(0,aw.t,0,0);
    const o=Math.min(t1,we.getTime())-Math.max(t0,ws.getTime());if(o>0)tot+=o;d.setDate(d.getDate()+1)}return tot/60000}
function planSig(rid){const a=S.plan.away;return[rid,S.plan.mode,S.plan.day[rid],S.plan.mode==="finish"?S.plan.anchor[rid]:S.plan.start,S.plan.target[rid],S.cold[rid],S.temp,S.variant.sandwich,rid==="sandwich"&&S.variant.sandwich==="chill"?chillH():"",a.on?a.from+"-"+a.to:"off"].join("|")}
function timeline(rid,o){
  o=o||{};const mode=o.mode||S.plan.mode,date=o.date||S.plan.day[rid],target=o.target||S.plan.target[rid];
  const atS=o.at||(mode==="finish"?S.plan.anchor[rid]:S.plan.start);
  const p=o.p||currentPlan(rid,{cold:o.cold}),steps=p.steps,cum=[];let acc=0;steps.forEach(s=>{cum.push(acc);acc+=s.d});
  const ovenEnd=cum[p.anchor]+steps[p.anchor].d,at=parseClock(atS)??540;
  let base=mode==="finish"?at-(target==="serve"?acc:ovenEnd):at;
  const ev=steps.map((s,i)=>({...s,i,st:base+cum[i]}));
  // a "ready by" plan rounds its start down to 5 min; the spare minutes go to the first (estimated) step, so the target stays exact
  const base0=base,r=((base%5)+5)%5;if(r&&mode==="finish"){base-=r;ev[0].st=base;ev[0].d+=r}
  const d0=fromIso(date),dt=m=>{const d=new Date(d0);d.setMinutes(d.getMinutes()+m);return d};
  const aw=o.away!==undefined?o.away:awayCfg(),conflicts=[];
  ev.forEach(e=>{const a=attendMin(e);if(!a)return;const t0=dt(e.st).getTime(),t1=t0+a*60000,m=awayOverlap(t0,t1,aw);if(m>0){e.conflict=m;conflicts.push({i:e.i,t:e.t,from:new Date(t0),to:new Date(t1),min:m,whole:a===e.d})}});
  const startD=dt(base),ovenD=dt(base0+ovenEnd),serveD=dt(base0+acc);
  return{ev,dt,p,total:acc,startD,ovenD,serveD,targetD:target==="serve"?serveD:ovenD,conflicts,conflictMin:conflicts.reduce((a,c)=>a+c.min,0),
    past:startD.getTime()<NOW()+10*60000,ok:startD.getTime()>=NOW()+10*60000&&!conflicts.length,mode,target,date,at:atS}}
function prefTimes(rid,target,p){const steps=p.steps,acc=steps.reduce((a,s)=>a+s.d,0),ovenEnd=steps.slice(0,p.anchor+1).reduce((a,s)=>a+s.d,0);
  const sh=target==="serve"?Math.round((acc-ovenEnd)/15)*15:0,pref=parseClock(ANCHOR_DEFAULT[rid])+sh,[w0,w1]=READY_WIN[rid];
  const win=[];for(let m=w0+sh;m<=w1+sh;m+=15)win.push(m);if(!win.includes(pref))win.push(pref);
  const d=m=>Math.abs(m-pref),inWin=win.map(m=>((m%1440)+1440)%1440).sort((a,b)=>d(a)-d(b)||a-b);
  const rest=[];for(let m=0;m<1440;m+=15)if(!inWin.includes(m))rest.push(m);rest.sort((a,b)=>d(a)-d(b)||a-b);
  return[inWin,rest]}
/* find the default plan: earliest day, preferred daytime target, no attended minute in the unavailable window.
   Returns {ok:true,c} or {ok:false,c:best} where best is the least-conflicting achievable plan. Never silent. */
function findPlan(rid,o){
  o=o||{};const mode=o.mode||S.plan.mode,target=o.target||S.plan.target[rid],p=o.p||currentPlan(rid,{cold:o.cold});
  const today=new Date(NOW());today.setHours(0,0,0,0);let best=null;const consider=(c)=>{const tl=timeline(rid,{...c,p,cold:o.cold});if(tl.past)return false;
    if(tl.ok)return true;if(!best||tl.conflictMin<best.min)best={c,min:tl.conflictMin};return false};
  if(mode==="start"){const t0=Math.ceil((NOW()+10*60000)/9e5)*9e5;
    for(let i=0;i<8*96;i++){const d=new Date(t0+i*9e5),c={mode,target,date:isoDate(d),at:clockOf(d)};if(consider(c))return{ok:true,c}}
    return{ok:false,c:best&&best.c,min:best&&best.min}}
  const passes=prefTimes(rid,target,p);
  for(const times of passes)for(let k=0;k<9;k++){const d=new Date(today);d.setDate(d.getDate()+k);const date=isoDate(d);
    for(const m of times){const c={mode,target,date,at:fmtClock(m)};if(consider(c))return{ok:true,c}}}
  return{ok:false,c:best&&best.c,min:best&&best.min}}
/* alternatives for a plan that conflicts: later / earlier target, another day, another fridge option. */
function alternatives(rid){
  const tl=timeline(rid),out=[],seen=new Set(),p=tl.p,mode=tl.mode,target=tl.target,anchorT=mode==="finish"?tl.targetD:tl.startD;
  const lbl=TARGETS[rid].find(x=>x[0]===target)[1];
  const add=(label,c,pp,extra)=>{const k=c.date+c.at+(c.cold||"");if(seen.has(k))return;const t=timeline(rid,{...c,mode,target,p:pp});if(!t.ok)return;seen.add(k);
    out.push({label,date:c.date,at:c.at,cold:c.cold,desc:`${mode==="finish"?lbl:"Start"} ${dayName(mode==="finish"?t.targetD:t.startD)}, ${clockOf(mode==="finish"?t.targetD:t.startD)} · start ${dayName(t.startD)} ${clockOf(t.startD)}`,...extra})};
  const at=i=>{const d=new Date(anchorT.getTime()+i*9e5);return{date:isoDate(d),at:clockOf(d)}};
  const fits=(c,pp)=>timeline(rid,{...c,mode,target,p:pp}).ok;
  const scan=(dir,lim,pp)=>{for(let i=1;i<=lim;i++){const c=at(dir*i);if(dir<0&&timeline(rid,{...c,mode,target,p:pp}).past)return null;if(fits(c,pp))return c}return null};
  const later=scan(1,8*96,p);if(later)add(mode==="finish"?"Later finish":"Later start",later,p);
  const earlier=scan(-1,4*96,p);if(earlier)add(mode==="finish"?"Earlier finish":"Earlier start",earlier,p);
  for(let k=1;k<=7;k++){const d=new Date(anchorT);d.setDate(d.getDate()+k);const c={date:isoDate(d),at:clockOf(anchorT)};if(fits(c,p)){add("Same time, another day",c,p);break}}
  // another fridge option allowed by the recipe: the nearest time that fits with it
  for(const h of COLD_OPTS[rid]){if(h===S.cold[rid])continue;const ph=currentPlan(rid,{cold:h});let c=null;
    for(let i=0;i<=4*96&&!c;i++)for(const dir of i?[1,-1]:[1]){const x=at(dir*i);if(fits(x,ph)){c=x;break}}
    if(c)add(`${h} h fridge stage instead`,{...c,cold:h},ph,{note:"Within the recipe's fridge range; fermentation times are unchanged."})}
  return out}
// bulk fermentation timing temperature: the midpoint of the measured dough and the kitchen, because the dough drifts towards
// the kitchen as it rises (Claude's question on #7; Michael chose the midpoint). No dough reading: the kitchen alone. Only bulk uses it.
function bulkTemp(doughT,kitchenT){const k=+kitchenT;if(doughT===null||doughT===undefined||doughT===""||!Number.isFinite(+doughT))return k;return(+doughT+k)/2}
const fmtC=x=>String(Math.round(+x*100)/100); // 26.25 stays 26.25, 27.5 stays 27.5
// plain words for the temperature the bulk estimate was timed for
function bulkWhy(doughT,kitchenT,bulkT){const d=+doughT,k=+kitchenT,b=+bulkT;
  if(Math.abs(d-k)<1e-9)return`timed for ${fmtC(b)} °C (your dough and the kitchen are the same)`;
  if(Math.abs(b-(d+k)/2)<1e-9)return`timed for ${fmtC(b)} °C, midway between your ${fmtC(d)} °C dough and the ${fmtC(k)} °C kitchen`;
  return`timed for ${fmtC(b)} °C`}
// measured dough temperature vs the kitchen setting: the signed gap (dough − kitchen) when it is more than TEMP_GAP °C, else null
function tempMismatch(doughT,kitchenT){if(doughT===null||doughT===undefined||doughT===""||kitchenT===null||kitchenT===undefined)return null;const d=+doughT-+kitchenT;if(!Number.isFinite(d))return null;return Math.abs(d)>TEMP_GAP+1e-9?Math.round(d*10)/10:null}
const DDT_DEFAULT={target:25,flour:null,lev:null,fric:2};
// water °C = 4 × DDT − room − flour − levain − friction (the "4" is for doughs with a preferment)
function ddtWater(d,room){const f=d.flour??room,l=d.lev??room;return 4*d.target-room-f-l-d.fric}
