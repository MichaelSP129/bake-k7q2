"use strict";
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const G=x=>`${gnum(x)}<small>g</small>`;
function fmtCD(sec){const s=Math.max(0,Math.ceil(sec)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),r=s%60;const mm=String(m).padStart(2,"0"),ss=String(r).padStart(2,"0");return h?`${h}:${mm}:${ss}`:`${mm}:${ss}`}
function haptic(ms){try{navigator.vibrate&&navigator.vibrate(ms||8)}catch(e){}}

/* ---------- state ---------- */
const KEY="michael-baking-app.v1";
const newEpoch=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
const DEFAULT={
  tab:"recipes",detail:null,seg:"ing",rid:"loaf",
  scale:{loaf:{mode:"loaves",n:1,w:1415},focaccia:{tray:"23x33",cw:23,cl:33},pizza:{balls:4,bw:280},sandwich:{tin:"large",n:1}},
  hyd:{loaf:69.7,focaccia:80,pizza:66.4},temp:25,
  cold:{loaf:14,focaccia:14,pizza:24,sandwich:12},variant:{sandwich:"std",chillH:CHILL_H.def},
  plan:{mode:"finish",anchor:Object.assign({},ANCHOR_DEFAULT),start:"07:00",day:{loaf:tomorrowIso(),focaccia:tomorrowIso(),pizza:tomorrowIso(),sandwich:tomorrowIso()},custom:{},
    target:{loaf:"oven",focaccia:"oven",pizza:"oven",sandwich:"oven"},away:{on:true,from:"23:00",to:"06:00"},accept:{}},
  session:null,starter:{fedAt:null},sound:true,wake:true,notify:false,theme:"auto",weekHot:false,openAcc:{},ddt:Object.assign({},DDT_DEFAULT),v:4,epoch:"",rev:0
};
const fresh=()=>JSON.parse(JSON.stringify(DEFAULT));
function merge(a,b){if(b===null||b===undefined)return a;if(typeof a!=="object"||a===null||Array.isArray(a))return b;if(typeof b!=="object"||Array.isArray(b))return a;const o={...a};for(const k in b)o[k]=(k in a)?merge(a[k],b[k]):b[k];return o}
function readStored(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch(e){return null}}
let S=merge(fresh(),readStored());
sanitize(S);if(!S.epoch)S.epoch=newEpoch();
let seenRev=S.rev||0,sessDirty=false;
/* validate everything that comes from storage or an import file; never trust it */
function sanitize(T){
  const num=(o,k,a,b,def,step)=>{const v=+o[k];o[k]=Number.isFinite(v)?clamp(step?Math.round(v/step)*step:v,a,b):def};
  if(!T.v||T.v<2){T.wake=true;if(T.plan&&T.plan.date){for(const r of RIDS)T.plan.day[r]=T.plan.date}if(T.plan)delete T.plan.date}
  if(!T.v||T.v<3){if(+T.scale.pizza.bw===276)T.scale.pizza.bw=276.5;T.v=3}   // 276 was the rounded booklet ball; 276.5 × 4 = the booklet's 1,106 g
  if(T.v<4){if(T.scale&&T.scale.pizza&&[276,276.5].includes(+T.scale.pizza.bw))T.scale.pizza.bw=280;T.v=4}   // Michael, 23 Oct: 280 g balls replace the old 276 / 276.5 g default
  num(T,"temp",16,40,25,1);num(T.scale.loaf,"n",1,8,1,1);num(T.scale.loaf,"w",300,12000,1415,1);
  num(T.scale.pizza,"balls",1,24,4,1);num(T.scale.pizza,"bw",150,400,280,.5);
  num(T.scale.focaccia,"cw",10,80,23,1);num(T.scale.focaccia,"cl",10,80,33,1);num(T.scale.sandwich,"n",1,6,1,1);
  for(const r of ["loaf","focaccia","pizza"]){const raw=+T.hyd[r];num(T.hyd,r,LEAN[r].Hmin,LEAN[r].Hmax,LEAN[r].H0,.5);if(Math.abs(raw-LEAN[r].H0)<.01)T.hyd[r]=LEAN[r].H0}   // the slider moves in 0.5 % steps, but the booklet values (69.7 %, 66.4 %) are kept exactly
 T.hyd.loaf=+(+T.hyd.loaf).toFixed(1);T.hyd.pizza=+(+T.hyd.pizza).toFixed(1);
  if(!["loaves","weight"].includes(T.scale.loaf.mode))T.scale.loaf.mode="loaves";
  if(!["large","std"].includes(T.scale.sandwich.tin))T.scale.sandwich.tin="large";
  if(!TRAYS.some(t=>t.id===T.scale.focaccia.tray))T.scale.focaccia.tray="23x33";
  if(!T.variant||typeof T.variant!=="object")T.variant={sandwich:"std"};if(!SANDWICH_VARIANTS[T.variant.sandwich])T.variant.sandwich="std";num(T.variant,"chillH",CHILL_H.min,CHILL_H.max,CHILL_H.def,1);
  const P=T.plan;if(!["finish","start"].includes(P.mode))P.mode="finish";if(parseClock(P.start)===null)P.start="07:00";
  for(const k of ["custom","accept","target","day","anchor"])if(!P[k]||typeof P[k]!=="object")P[k]={};
  if(!P.away||typeof P.away!=="object")P.away={on:true,from:"23:00",to:"06:00"};P.away.on=P.away.on!==false;
  if(parseClock(P.away.from)===null)P.away.from="23:00";if(parseClock(P.away.to)===null)P.away.to="06:00";
  const today=new Date(NOW());today.setHours(0,0,0,0);
  for(const r of RIDS){if(!COLD_OPTS[r].includes(+T.cold[r]))T.cold[r]=DEFAULT.cold[r];else T.cold[r]=+T.cold[r];
    if(parseClock(P.anchor[r])===null)P.anchor[r]=ANCHOR_DEFAULT[r];if(!["oven","serve"].includes(P.target[r]))P.target[r]="oven";
    if(typeof P.accept[r]!=="string")delete P.accept[r];P.custom[r]=!!P.custom[r];
    const d=P.day[r];if(!/^\d{4}-\d\d-\d\d$/.test(d||"")||fromIso(d)<today){P.day[r]=tomorrowIso();P.custom[r]=false}}
  if(!T.ddt||typeof T.ddt!=="object")T.ddt=Object.assign({},DDT_DEFAULT);num(T.ddt,"target",18,32,25,.5);num(T.ddt,"fric",0,20,2,1);
  for(const k of ["flour","lev"]){if(T.ddt[k]===null||T.ddt[k]===undefined||T.ddt[k]==="")T.ddt[k]=null;else num(T.ddt,k,-5,45,null,1)}
  if(!T.starter||typeof T.starter!=="object")T.starter={fedAt:null};if(T.starter.fedAt!==null&&!(Number.isFinite(+T.starter.fedAt)&&+T.starter.fedAt>0&&+T.starter.fedAt<NOW()+864e5))T.starter.fedAt=null;
  if(!["auto","light","dark"].includes(T.theme))T.theme="auto";for(const k of ["sound","wake","notify","weekHot"])T[k]=!!T[k];
  if(!["recipes","plan","timer","starter","ref"].includes(T.tab))T.tab="recipes";
  if(T.detail&&!RIDS.includes(T.detail))T.detail=null;if(!RIDS.includes(T.rid))T.rid="loaf";
  if(!["ing","method","fix"].includes(T.seg))T.seg="ing";
  T.rev=Number.isFinite(+T.rev)?+T.rev:0;if(typeof T.epoch!=="string")T.epoch="";
  const ss=T.session;if(ss&&(typeof ss!=="object"||!RECIPES[ss.rid]||!Array.isArray(ss.steps)||!ss.steps.length||!ss.steps.every(x=>x&&typeof x.t==="string"&&Number.isFinite(+x.d)&&+x.d>0)))T.session=null;
  else if(ss){ss.idx=clamp(Math.round(+ss.idx||0),0,ss.steps.length-1);if(!Number.isFinite(+ss.remaining))ss.remaining=ss.steps[ss.idx].d*60;if(!Number.isFinite(+ss.endsAt))ss.endsAt=0;
    ss.running=!!ss.running;ss.alerted=!!ss.alerted;if(ss.doughT!==null&&ss.doughT!==undefined&&!Number.isFinite(+ss.doughT))ss.doughT=null}
  return T}
/* one write path. Every save carries the data's epoch (changes on reset) and a revision number.
   A tab whose epoch is stale adopts the stored data instead of writing its old copy back,
   and a newer session written by another tab is never overwritten by an older one. */
let saveT=0,skipSave=false;
function persist(){
  const cur=readStored();
  if(cur&&cur.epoch&&cur.epoch!==S.epoch){adoptStored(cur,"This data was reset or replaced in another tab, so this tab now shows it.");return}
  if(cur&&cur.epoch===S.epoch&&(+cur.rev||0)>seenRev&&!sessDirty)S.session=cur.session===undefined?null:cur.session;
  S.rev=Math.max(cur&&+cur.rev||0,S.rev||0)+1;seenRev=S.rev;sessDirty=false;
  try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function save(){if(skipSave){skipSave=false;return}clearTimeout(saveT);saveT=setTimeout(persist,120)}
function saveNow(){clearTimeout(saveT);persist()}
function keepUI(){return{tab:S.tab,detail:S.detail,seg:S.seg,rid:S.rid}}
function adoptStored(cur,msg){const ui=keepUI();S=sanitize(merge(fresh(),cur));Object.assign(S,ui);seenRev=S.rev;closeSheet(true);wakeSync();skipSave=true;render();skipSave=false;if(msg)toast(msg)}

/* ---------- guidance ---------- */
function guideFor(rid){
  const t=S.temp,b=band(t),wt=75-2*t;
  const water=wt<5?"Ice-cold + chilled flour":`≈ ${Math.round(wt)} °C`;
  const g=[["Mother after feeding",t>=27?"30–60 min out, then fridge":"1–2 h out, then fridge",0]];
  if(rid==="loaf")g.push(["Levain to peak",fmtWin(interp(LEV,t)),1],["Mixing water",water,0],["Shape at rise",LOAF_RISE[b],0],["Bulk from levain in",fmtWin(interp(LOAF_BULK,t)),1]);
  else if(rid==="focaccia")g.push(["Levain to peak",fmtWin(interp(LEV_FAST,t)),1],["Mixing water",water,0],["Bulk target rise",FOC_RISE[b],0],["Bulk from levain in",fmtWin(interp(LOAF_BULK,t)),1],["Day-2 warm-up",fmtWin(interp(FOC_WARM,t)),1]);
  else if(rid==="pizza")g.push(["Levain to peak",fmtWin(interp(LEV_FAST,t)),1],["Mixing water",water,0],["Bulk target rise",PIZ_RISE[b],0],["Bulk from levain in",fmtWin(interp(PIZ_BULK,t)),1],["Warm-up before baking",fmtWin(interp(PIZ_WARM,t)),1]);
  else{const V=SANDWICH_VARIANTS[S.variant.sandwich];g.push(["Stiff starter",`${V.label}: ${V.sub}`,0],["Mixing water","Fridge-cold",0],["Bulk to 40–50%",fmtWin(interp(SW_BULK,t)),1],["Final proof from fridge",fmtWin(interp(SW_PROOF,t)),1])}
  return g;
}
function tempNote(){const t=S.temp;return t<18||t>32?`<div class="notebar" style="margin:10px 0 0"><span>ℹ︎</span><span>${t<18?"Below 18 °C":"Above 32 °C"} the timing tables are stretched beyond what they cover (estimates are held at the ${t<18?"23":"29"} °C values). Go by the dough cues${t>32?"; use chilled water and the fridge to slow things down":"; a warmer spot (oven with the light on) helps"}.</span></div>`:""}
function thermoColor(t){return t<=23?"#56707F":t<=25?"#5C6A38":t<=26?"#8A6A1E":t<=28?"#A9522A":"#B23A2E"} // v2.1: all ≥4.5:1 against the white label

/* ---------- timer ----------
   The session is a snapshot: steps, kitchen temp, fridge option and variant are copied at start,
   so changing settings mid-bake never changes a running timer. A step that ends never starts the
   next one by itself: rising/proof steps end in a readiness check, the others in a "Start next" tap. */
function remNow(){const s=S.session;if(!s)return 0;return s.running?Math.max(0,(s.endsAt-Date.now())/1000):s.remaining}
function startSession(rid,from){const p=currentPlan(rid);
  S.session={rid,steps:p.steps.map(x=>({t:x.t,d:x.d,k:x.k,detail:x.detail,cue:x.cue||"",est:!!x.est,check:!!x.check,key:x.key||"",hands:x.hands||0})),anchor:p.anchor,idx:from||0,running:false,
    remaining:p.steps[from||0].d*60,endsAt:0,startedAt:Date.now(),alerted:false,temp:S.temp,cold:S.cold[rid],variant:S.variant.sandwich,chillH:chillH(),doughT:null,summary:calc(rid).summary};
  sessDirty=true;unlockAudio();tPlay()}
function tPlay(){const s=S.session;if(!s)return;if(s.remaining<=0)s.remaining=s.steps[s.idx].d*60;s.endsAt=Date.now()+s.remaining*1000;s.running=true;s.alerted=false;sessDirty=true;saveNow();wakeSync()}
function tPause(){const s=S.session;if(!s)return;s.remaining=remNow();s.running=false;sessDirty=true;saveNow();wakeSync()}
function tGo(i,autoplay){const s=S.session;if(!s)return;s.idx=clamp(i,0,s.steps.length-1);s.remaining=s.steps[s.idx].d*60;s.running=false;s.alerted=false;s.closedEnd=false;sessDirty=true;if(autoplay)tPlay();else saveNow()}
function tAdd(min){const s=S.session;if(!s)return;if(s.running)s.endsAt+=min*60000;else s.remaining=Math.max(0,s.remaining+min*60);if(remNow()>0)s.alerted=false;sessDirty=true;saveNow()}
/* readiness check "not yet": run this same step on for m more minutes */
function tMore(m){const s=S.session;if(!s)return;s.remaining=m*60;s.closedEnd=false;sessDirty=true;tPlay();toast(`${m} more minutes, then check again`)}
/* measured dough temperature drives the bulk estimate (never shortens below what has already passed) */
function setDoughT(v){const s=S.session;if(!s)return;const bi=s.steps.findIndex(x=>x.key==="bulk");if(bi<0)return;
  if(s.idx>bi){toast("Bulk is already finished");return}
  const T=v===null?null:clamp(v,15,35);const p=buildPlan(s.rid,s.temp,s.cold,calc(s.rid),{variant:s.variant,chillH:s.chillH,bulkT:T===null?s.temp:T});
  const nd=p.steps.find(x=>x.key==="bulk").d,delta=nd-s.steps[bi].d;s.steps[bi].d=nd;s.steps[bi].detail=p.steps.find(x=>x.key==="bulk").detail;
  if(s.idx===bi&&!(s.alerted&&remNow()<=0)){if(s.running)s.endsAt+=delta*60000;else s.remaining=Math.max(60,s.remaining+delta*60)}
  s.doughT=T;sessDirty=true;saveNow();render();toast(T===null?"Back to the kitchen-temperature estimate":`Bulk estimate now uses ${T} °C dough: ${fmtDur(nd)}`)}
let AC=null;function unlockAudio(){try{if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(C)AC=new C()}AC&&AC.state==="suspended"&&AC.resume()}catch(e){}}
function chime(){if(!S.sound||!AC)return;try{const t0=AC.currentTime;[0,.32,.64].forEach((o,i)=>{const os=AC.createOscillator(),g=AC.createGain();os.type="sine";os.frequency.value=[784,988,1175][i];g.gain.setValueAtTime(0,t0+o);g.gain.linearRampToValueAtTime(.28,t0+o+.02);g.gain.exponentialRampToValueAtTime(.001,t0+o+.6);os.connect(g).connect(AC.destination);os.start(t0+o);os.stop(t0+o+.65)})}catch(e){}}
function stepDone(){const s=S.session,late=Date.now()-s.endsAt;
  // another tab may already have rung for this step
  const o=readStored();if(o&&o.session&&o.session.startedAt===s.startedAt&&o.session.idx===s.idx&&o.session.alerted){s.running=false;s.remaining=0;s.alerted=true;wakeSync();return}
  s.running=false;s.remaining=0;s.alerted=true;sessDirty=true;saveNow();haptic([300,120,300,120,500]);chime();
  const st=s.steps[s.idx],at=new Date(s.endsAt);
  toast(st.check?`Time to check: ${st.t}`:late>60000?`Step ${s.idx+1} finished at ${clockOf(at)}: ${st.t}`:`Step done: ${st.t}`);wakeSync();
  notify(st.check?`Check the dough: ${st.t}`:`Step ${s.idx+1} done: ${st.t}`,st.check?"Open the app for the readiness check.":s.idx<s.steps.length-1?`Next: ${s.steps[s.idx+1].t}`:"That was the last step.")}
const CAN_VIBRATE="vibrate"in navigator,CAN_WAKE="wakeLock"in navigator,CAN_NOTIFY="Notification"in window&&"serviceWorker"in navigator&&location.protocol.startsWith("http");
function notify(title,body){if(!S.notify||!CAN_NOTIFY||Notification.permission!=="granted"||!document.hidden)return;
  try{navigator.serviceWorker.ready.then(r=>r.showNotification(title,{body,tag:"bake-step",renotify:true,icon:"icons/icon-192.png",badge:"icons/icon-192.png",vibrate:[300,120,300]})).catch(()=>{})}catch(e){}}
/* screen wake lock: requested whenever a timer runs and the page is visible (boot, restore, tab return),
   re-requested after the browser releases it, and the button shows what is actually held */
let wakeLock=null,wakeErr="",wakeBusy=false,wakeRetry=0;
async function wakeSync(){if(!CAN_WAKE)return;const want=S.wake&&S.session&&S.session.running&&!document.hidden;
  if(wakeBusy)return;wakeBusy=true;
  try{if(want&&!wakeLock){const l=await navigator.wakeLock.request("screen");wakeLock=l;wakeErr="";
      l.addEventListener("release",()=>{if(wakeLock===l)wakeLock=null;wakeUI();if(!document.hidden&&wakeRetry<3){wakeRetry++;setTimeout(wakeSync,800)}});wakeUI();wakeRetry=0}
    else if(!want&&wakeLock){const l=wakeLock;wakeLock=null;await l.release();wakeUI()}}
  catch(e){wakeLock=null;wakeErr=(e&&e.name)||"Error";wakeUI()}
  finally{wakeBusy=false}}
function wakeBtn(){if(!CAN_WAKE)return"";const s=S.session,held=!!wakeLock;
  const [lbl,cls]=held?["Screen kept on","on"]:!S.wake?["Screen may sleep",""]:s&&s.running&&!document.hidden?["Screen lock not held · tap to retry","warn"]:["Keeps screen on while running",""];
  return`<button id="wakebtn" class="chipbtn ${cls}" data-act="twake" aria-pressed="${S.wake}" data-held="${held}">${held?"☀︎":"☾"} ${lbl}</button>`}
function wakeUI(){const b=$("#wakebtn");if(b)b.outerHTML=wakeBtn()}
setInterval(()=>{const s=S.session;if(!s)return;if(s.running&&remNow()<=0&&!s.alerted)stepDone();updateTimerDom()},250);
document.addEventListener("visibilitychange",()=>{wakeRetry=0;wakeSync();updateTimerDom()});

/* ---------- UI primitives ---------- */
function stepper(act,val,unit,opts){opts=opts||{};const lb=opts.label||"value";
  const mid=opts.input!==undefined?`<input class="val" type="number" inputmode="${opts.dec?"decimal":"numeric"}" data-inp="${act}" value="${opts.input}" aria-label="${esc(lb)}${unit?" in "+esc(unit):""}"${opts.lo!==undefined?` min="${opts.lo}" max="${opts.hi}"`:""}>${unit?`<span class="unit" aria-hidden="true">${unit}</span>`:""}`:`<div class="val num" aria-live="polite" aria-label="${esc(lb)}: ${val}${unit?" "+unit:""}">${val}${unit?`<small>${unit}</small>`:""}</div>`;
  return`<div class="stepper" role="group" aria-label="${esc(lb)}"><button data-act="${act}" data-arg="-1" aria-label="Decrease ${esc(lb)}"${opts.min?" disabled":""}>−</button>${mid}<button data-act="${act}" data-arg="1" aria-label="Increase ${esc(lb)}"${opts.max?" disabled":""}>+</button></div>`}
function seg(act,opts,val,cls){return`<div class="seg ${cls||""}" role="group">${opts.map(([v,l])=>`<button data-act="${act}" data-arg="${v}" class="${String(v)===String(val)?"on":""}" aria-pressed="${String(v)===String(val)}">${l}</button>`).join("")}</div>`}
function nav(title,o){o=o||{};return`<header class="nav${o.over?" over":""}">${o.left||""}<div class="t">${esc(title)}</div>${o.right?`<div class="right">${o.right}</div>`:""}</header>`}
function large(k,t,sub){return`<div class="large">${k?`<div class="kicker">${k}</div>`:""}<h1 class="lt">${t}</h1>${sub?`<div class="sub">${sub}</div>`:""}</div>`}
function rpick(act,cur){return`<div class="rpick">${RIDS.map(r=>`<button data-act="${act}" data-arg="${r}" class="${r===cur?"on":""}" aria-pressed="${r===cur}"><div class="th">${art(r,"rp"+act+r)}</div>${RECIPES[r].short}</button>`).join("")}</div>`}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("show"),2600+Math.max(0,msg.length-40)*45)}

/* ---------- views ---------- */
function vHome(){
  const h=new Date().getHours(),greet=h<5?"Late-night baking":h<12?"Good morning":h<17?"Good afternoon":"Good evening";
  const s=S.session;let now="";
  if(s){const st=s.steps[s.idx];now=`<button class="card pressable" data-act="tab" data-arg="timer" style="width:100%;text-align:left;display:flex;gap:14px;align-items:center;background:linear-gradient(135deg,#4A3326,#2B1D15);color:#FBEFE2">
  <div style="width:56px;height:56px;border-radius:16px;overflow:hidden;position:relative;flex-shrink:0">${art(s.rid,"nb")}</div>
  <div style="flex:1;min-width:0"><div class="kicker" style="color:#F2B27F">Now baking · step ${s.idx+1}/${s.steps.length}</div><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(st.t)}</b></div>
  <div class="num" data-live="cd" style="font-weight:700;font-size:20px">${fmtCD(remNow())}</div></button>`}
  const days=S.starter.fedAt?Math.floor((Date.now()-S.starter.fedAt)/864e5):null;
  return nav("Baking")+large(`${DOW[new Date().getDay()]} ${new Date().getDate()} ${MON[new Date().getMonth()]}`,"Michael's Baking",`${greet}, Michael. What are we baking?`)+
  `<div class="wrap">${now}<div class="rgrid">${RIDS.map(r=>{const c=calc(r),R=RECIPES[r];return`<button class="rcard pressable" data-act="open" data-arg="${r}">
   <div class="art">${art(r,"hc"+r)}</div><div class="body"><div class="name">${R.name}</div><div class="desc">${R.desc}</div>
   <div class="chips"><span class="chip t">${c.summary}</span><span class="chip">${R.days}</span>${r!=="sandwich"?`<span class="chip o">${S.hyd[r].toFixed(1)}% hydration</span>`:`<span class="chip o">Tangzhong</span>`}</div></div></button>`}).join("")}</div>
   <h2 class="sh">Your kitchen</h2>
   <div class="card"><div class="tempdial"><div class="thermo num" style="background:${thermoColor(S.temp)}">${S.temp}°</div><div style="flex:1"><b>${BAND_LABELS[band(S.temp)]}</b><div class="faint">Mixing water ${75-2*S.temp<5?"ice-cold":"≈ "+(75-2*S.temp)+" °C"} for a 25 °C dough</div></div></div>
   <div class="spacer"></div><div class="ctrl"><div class="lab">Kitchen temperature<small>Drives every timing estimate</small></div>${stepper("temp",S.temp,"°C",{label:"Kitchen temperature",min:S.temp<=16,max:S.temp>=40})}</div>${tempNote()}</div>
   <button class="card pressable starterchip" data-act="tab" data-arg="starter" style="width:100%;text-align:left"><div style="width:44px">${jarSVG(days===null?45:Math.max(15,80-days*7))}</div><div style="flex:1"><b>Mother starter</b><div class="faint">${days===null?"Log a feed to track refreshes":days===0?"Fed today":`Fed ${days} day${days>1?"s":""} ago${days>=7?" · refresh due":""}`}</div></div>${ICON.chev}</button>
  </div>`;
}
function vDetail(rid){
  const R=RECIPES[rid],c=calc(rid),st=S.scale[rid],segv=S.seg;
  const back=`<div class="left"><button class="back" data-act="back">${ICON.back}Recipes</button></div>`;
  let body="";
  if(segv==="ing"){
    let ctl="";
    if(rid==="loaf"){ctl=seg("loafmode",[["loaves","Loaves"],["weight","Dough weight"]],st.mode)+`<div class="spacer"></div>`+(st.mode==="loaves"?`<div class="ctrl"><div class="lab">Loaves<small>${gt(c.total/c.units)} each</small></div>${stepper("loafn",st.n,"",{label:"Loaves",min:st.n<=1,max:st.n>=8})}</div>`:`<div class="ctrl"><div class="lab">Total dough<small>Type it, or ±50 g</small></div>${stepper("loafw",gnum(st.w),"g",{label:"Total dough",input:Math.round(st.w),lo:300,hi:12000,min:st.w<=300,max:st.w>=12000})}</div>`)}
    if(rid==="focaccia"){ctl=`<div class="pillrow">${TRAYS.map(t=>`<button class="pill ${st.tray===t.id?"on":""}" data-act="tray" data-arg="${t.id}">${t.label}${t.id!=="custom"?" cm":""}<small>${t.sub}</small></button>`).join("")}</div>`+(st.tray==="custom"?`<div class="ctrl"><div class="lab">Width</div>${stepper("trayw",st.cw,"cm",{label:"Tray width",input:st.cw,lo:10,hi:80,min:st.cw<=10,max:st.cw>=80})}</div><div class="ctrl"><div class="lab">Length</div>${stepper("trayl",st.cl,"cm",{label:"Tray length",input:st.cl,lo:10,hi:80,min:st.cl<=10,max:st.cl>=80})}</div>`:"")}
    if(rid==="pizza"){ctl=`<div class="ctrl"><div class="lab">Pizza balls<small>One per 30–32 cm pizza</small></div>${stepper("balls",st.balls,"",{label:"Pizza balls",min:st.balls<=1,max:st.balls>=24})}</div><div class="ctrl"><div class="lab">Ball weight<small>280 g is the default · 250–280 g suits 30–32 cm</small></div>${stepper("bw",g1(st.bw),"g",{label:"Ball weight",input:g1(st.bw),dec:1,lo:150,hi:400,min:st.bw<=150,max:st.bw>=400})}</div><div class="faint">Total dough = balls × ball weight; the flour, water and levain are worked back from it.</div>`}
    if(rid==="sandwich"){ctl=seg("tin",[["large","Large 3–3.5 L"],["std","2 lb tin (0.75×)"]],st.tin)+`<div class="spacer"></div><div class="ctrl"><div class="lab">Tins<small>${st.tin==="large"?"33 cm Pullman or ~28 × 12 × 10 cm":"Standard 2 lb loaf tin"}</small></div>${stepper("tinn",st.n,"",{label:"Tins",min:st.n<=1,max:st.n>=6})}</div>`}
    if(rid==="sandwich")ctl+=`</div><div class="card"><div class="ct">Starter version</div>${variantPick()}`;
    let hyd="";
    if(rid!=="sandwich"){const L=LEAN[rid],H=S.hyd[rid],p=(H-L.Hmin)/(L.Hmax-L.Hmin)*100;
      hyd=`<div class="card"><div class="ct">Hydration</div><div class="slider"><div class="top"><div class="big num" id="hval">${H.toFixed(1)}<small>%</small></div>${Math.abs(H-L.H0)>.01?`<button class="chip t" data-act="hreset">Reset to ${L.H0}%</button>`:`<span class="mark">Booklet value</span>`}</div>
      <input type="range" id="hyd" min="${L.Hmin}" max="${L.Hmax}" step="0.5" value="${H}" style="--p:${p}%" aria-label="Hydration">
      <div class="ticks"><span>${L.Hmin}% · firmer, easier</span><span>${L.Hmax}% · wetter, more open</span></div></div>
      <div class="faint" style="margin-top:6px">True hydration: levain water and flour counted in. Water is recalculated live.</div></div>`}
    body=`<div class="card"><div class="ct">Batch size</div>${ctl}</div>${hyd}<div id="ingbox">${ingBox(rid,c)}</div>
    <div class="btnrow" style="margin-top:6px"><button class="btn sec" data-act="planthis" data-arg="${rid}">${ICON.cal}Plan it</button><button class="btn" data-act="startthis" data-arg="${rid}">${ICON.play}Start bake</button></div>`;
  }else if(segv==="method"){
    body=`<div class="card"><div class="steps">${methodFor(rid,c).map(([t,d],i)=>`<div class="step"><div class="dot">${i+1}</div><div class="tx"><b>${esc(t)}</b><span>${esc(d)}</span></div></div>`).join("")}</div></div>
    <div class="card heat"><div class="ct">Your kitchen · ${S.temp} °C</div>${guideFor(rid).map(([l,v,e])=>`<div class="ctrl" style="padding:7px 0;border-color:rgba(0,0,0,.06)"><div class="lab" style="font-weight:500">${l}${e?`<span class="est">est.</span>`:""}</div><b style="text-align:right">${v}</b></div>`).join("")}
    <ul class="clean" style="margin-top:6px">${warmTips(rid,S.temp).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`;
  }else{
    body=`<div class="card"><div class="ct">Troubleshooting</div>${TROUBLE[rid].map(([p,c2,f])=>`<div class="trow"><b>${esc(p)}</b><div class="cause">${esc(c2)}</div><div class="fix">${esc(f)}</div></div>`).join("")}</div>
    <div class="card olive"><div class="ct">What's improved</div><ul class="clean ok">${IMPROVED[rid].map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`;
  }
  return nav(R.name,{over:true,left:back,right:`<button class="iconbtn" data-act="planthis" data-arg="${rid}" aria-label="Plan this bake">${ICON.cal}</button>`})+
  `<div class="hero">${art(rid,"hero"+rid)}<div class="scrim"></div><div class="ht"><div class="kicker">${R.days} · ${R.oven}</div><h1>${R.name}</h1></div></div>
  <div class="wrap"><div class="seg sticky"><div class="inner">${[["ing","Ingredients"],["method","Method"],["fix","Fixes"]].map(([v,l])=>`<button data-act="seg" data-arg="${v}" class="${segv===v?"on":""}">${l}</button>`).join("")}</div></div><div class="spacer"></div>${body}</div>`;
}
function ingBox(rid,c){
  let list="";
  if(rid==="sandwich"){list=c.groups.map(g=>`<div class="grp">${g.g}</div>${g.rows.map(r=>`<div class="ing"><div class="n">${esc(r.name)}</div><div class="g">${G(r.g)}</div><div class="p">${pc(r.p)}</div></div>`).join("")}`).join("")}
  else list=c.rows.map(r=>`<div class="ing"><div class="n">${esc(r.name)}${r.sub?`<small>${esc(r.sub)}</small>`:""}</div><div class="g">${G(r.g)}</div><div class="p">${pc(r.p)}</div></div>`).join("");
  list+=`<div class="ing total"><div class="n">Total dough</div><div class="g">${G(c.total)}</div><div class="p">${pc(c.totalPct)}</div></div>`;
  const b=c.build;
  return`<div class="stats">${c.stats.map(([v,l])=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("")}</div>
  <div class="card"><div class="ct" style="display:flex;justify-content:space-between"><span>Ingredients</span><span>Baker's %</span></div>${list}</div>
  ${b?`<div class="card tint"><div class="ct">Levain build · start it first</div><div class="build"><div class="b"><b>${gnum(b.m)}</b><span>mother g</span></div><span class="plus">+</span><div class="b"><b>${gnum(b.f)}</b><span>flour g</span></div><span class="plus">+</span><div class="b"><b>${gnum(b.w)}</b><span>water g</span></div></div><div class="faint" style="margin-top:8px">Makes ≈ ${gt(b.t)}, use ${gt(b.use)} at peak. ${fmtWin(interp(rid==="loaf"?LEV:LEV_FAST,S.temp))} at ${S.temp} °C <span class="est">est.</span>${b.booklet?"":` · scaled from the booklet's ${BUILDS[rid][0].b.join(" + ")} for this batch`}</div></div>`:
  `<div class="card tint"><div class="ct">Night before · ${esc(c.variant.label)}</div><p style="margin:0">Stiff starter: ${gt(c.q.seed)} starter + ${gt(c.q.shoney)} honey + ${gt(c.q.swater)} water + ${gt(c.q.sflour)} flour${S.variant.sandwich==="chill"?`, 3–4 h out then ${chillH()} h in the fridge`:", 8–10 h"}. It's the levain: use it all. Tangzhong: ${gt(c.q.tflour)} flour + ${gt(c.q.milk)} milk cooked to 65 °C, then chilled.</p></div>`}
  ${c.extras.length?`<div class="card"><div class="ct">Also needed</div>${c.extras.map(([a,v])=>`<div class="ing"><div class="n">${a}</div><div style="text-align:right;font-weight:600;font-size:14.5px;max-width:60%">${v}</div></div>`).join("")}</div>`:""}`;
}
function variantPick(){const v=S.variant.sandwich,V=SANDWICH_VARIANTS[v];
  return seg("variant",Object.entries(SANDWICH_VARIANTS).map(([k,x])=>[k,x.label]),v)+`<div class="faint" style="margin-top:8px">${esc(V.sub)}.${v==="std"&&S.temp>=27?` <b>Your kitchen is ${S.temp} °C: Warm kitchen or Chill keeps the starter from overshooting.</b>`:""}${v==="chill"?" The planner and timer add the fridge stage.":""}</div>${v==="chill"?chillCtl():""}`}
function chillCtl(){const h=chillH();return`<div class="ctrl" data-test="chillh"><div class="lab">Starter in the fridge<small>8–12 h works; the planner and timer use this</small></div>${stepper("chillh",h,"h",{label:"Hours in the fridge",min:h<=CHILL_H.min,max:h>=CHILL_H.max})}</div>`}
/* planner: the user's plan is checked interval by interval against the unavailable window.
   Untouched plans are chosen automatically; if nothing complies the app says so (never a silent fallback). */
let PLAN_NONE={};
function applyAuto(rid){const r=findPlan(rid);PLAN_NONE[rid]=!r.ok;if(r.c){S.plan.day[rid]=r.c.date;if(S.plan.mode==="finish")S.plan.anchor[rid]=r.c.at;else S.plan.start=r.c.at}S.plan.custom[rid]=false}
function ensurePlan(rid,announce){const tl=timeline(rid),past=tl.startD.getTime()<Date.now()-60000;
  if(!S.plan.custom[rid]||past){const wasCustom=S.plan.custom[rid];applyAuto(rid);
    if(past&&wasCustom&&announce){const t=timeline(rid);setTimeout(()=>toast(`Your saved plan had passed, so it moved to ${S.plan.mode==="finish"?"ready":"start"} ${dayName(S.plan.mode==="finish"?t.targetD:t.startD)}, ${S.plan.mode==="finish"?S.plan.anchor[rid]:S.plan.start}.`),350)}}}
const tgtLabel=rid=>TARGETS[rid].find(x=>x[0]===S.plan.target[rid])[1];
function conflictBox(rid,tl){
  const a=S.plan.away,accepted=S.plan.accept[rid]===planSig(rid),n=tl.conflicts.length;
  if(!awayCfg())return`<div class="notebar" style="margin:12px 0 0"><span>ℹ︎</span><span>No unavailable hours set, so steps can land at any time.</span></div>`;
  if(!n)return`<div class="okbar" data-test="plan-ok"><span>✓</span><span>Every hands-on and oven step is outside ${a.from}–${a.to}. Rising, fridge and cooling may run through it.</span></div>`;
  const list=`<ul class="clash">${tl.conflicts.map(c=>`<li><b class="num">${clockOf(c.from)}–${clockOf(c.to)}</b> ${esc(c.t)}${c.whole?"":" (first minutes of hands-on work)"}</li>`).join("")}</ul>`;
  if(accepted)return`<div class="warnbar accepted" data-test="plan-accepted"><span>!</span><span><b>Kept with ${n} clash${n>1?"es":""} in your unavailable hours</b>${list}<button class="linkbtn" data-act="punaccept">Show alternatives again</button></span></div>`;
  const alts=alternatives(rid),none=!S.plan.custom[rid]&&PLAN_NONE[rid];
  return`<div class="conflictbox" role="alert" data-test="${none?"plan-none":"plan-conflict"}"><b class="h">${none?"No plan fits your unavailable hours":"This plan needs you while you're unavailable"}</b>
   <p>${none?`In the next 8 days there's no time where every hands-on and oven step stays outside ${a.from}–${a.to} with the ${S.cold[rid]} h fridge stage. This is the closest plan (${fmtDur(tl.conflictMin)} inside), with the clashes marked:`:`You're unavailable ${a.from}–${a.to}, but this plan has:`}</p>${list}
   ${alts.length?`<div class="ct" style="margin:10px 0 6px">Plans that fit</div><div class="alts">${alts.map(x=>`<button class="alt" data-act="palt" data-arg="${x.date}|${x.at}|${x.cold||""}"><b>${esc(x.label)}</b><span>${esc(x.desc)}</span>${x.note?`<small>${esc(x.note)}</small>`:""}</button>`).join("")}</div>`:`<p class="faint">Nothing fits within 8 days with these settings. A shorter unavailable window would help.</p>`}
   <button class="btn sec" data-act="paccept" style="margin-top:10px">Keep this plan anyway</button><div class="faint" style="margin-top:6px;text-align:center">Fermentation times are not shortened to make a plan fit.</div></div>`}
function vPlan(){
  const rid=S.rid;if(!S.plan.custom[rid])applyAuto(rid);const tl=timeline(rid),mode=S.plan.mode,maxd=Math.max(...tl.ev.map(e=>e.d)),c=calc(rid),T=TARGETS[rid];
  const days=[];for(let i=0;i<8;i++){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+i);days.push(d)}
  let lastDay="",items="";
  const mark=(d,label,sub,on)=>{const key=isoDate(d);if(key!==lastDay){lastDay=key;items+=`<div class="daytag"><span class="dd">${dayName(d)}</span><span class="rel">${relDay(d)}</span></div>`}
    items+=`<div class="ev anchor k-${on?"oven":"rest"}${on?" target":""}"><div class="tm num">${clockOf(d)}</div><div class="rail"><i></i></div><div class="bx"><div class="in"><b>${label}${on?` <span class="chip t">your target</span>`:""}</b><div class="d">${sub}</div></div></div></div>`};
  tl.ev.forEach(e=>{const d=tl.dt(e.st),key=isoDate(d);if(key!==lastDay){lastDay=key;items+=`<div class="daytag"><span class="dd">${dayName(d)}</span><span class="rel">${relDay(d)}</span></div>`}
    const w=Math.max(4,Math.sqrt(e.d/maxd)*100),hands=attendMin(e),handNote=e.k!=="prep"&&e.k!=="oven"&&hands?`<span class="chip t">${hands} min hands-on at the start</span>`:"";
    items+=`<div class="ev k-${e.k}${e.conflict?" clash":""}"><div class="tm num">${clockOf(d)}</div><div class="rail"><i></i></div><div class="bx"><div class="in"><b>${esc(e.t)}</b><div class="d">${esc(e.detail)}</div><div class="meta"><span class="chip ${e.k==="cold"?"c":e.k==="oven"?"h":e.k==="rest"?"o":e.k==="prep"?"t":""}">${e.est?"≈ ":""}${fmtDur(e.d)}</span>${e.est?`<span class="est">estimate</span>`:""}${handNote}<div class="bar" style="width:${w*.45}%"></div></div>${e.conflict?`<div class="clashtag">⚠ ${fmtDur(e.conflict)} inside your unavailable hours</div>`:""}</div></div></div>`;
    if(e.i===tl.p.anchor)mark(tl.ovenD,T[0][1],`${RECIPES[rid].name} · ${c.summary}`,S.plan.target[rid]==="oven")});
  mark(tl.serveD,T[1][1],rid==="pizza"?`${c.q.n} pizza${c.q.n>1?"s":""}, about 3 min each`:"After cooling",S.plan.target[rid]==="serve");
  const ov=tl.ev.map(e=>`<i class="k-${e.k}${e.conflict?" clash":""}" style="flex:${Math.max(e.d,8)}"></i>`).join("");
  const at=mode==="finish"?S.plan.anchor[rid]:S.plan.start,aw=S.plan.away,other=S.plan.target[rid]==="oven"?[T[1][1],tl.serveD]:[T[0][1],tl.ovenD];
  return nav("Plan")+large("Start-time planner","Plan a bake","Pick a recipe, set your kitchen and when you want it ready.")+
  `<div class="wrap">${rpick("prid",rid)}
  <div class="card"><div class="ct">Your kitchen</div><div class="ctrl"><div class="tempdial"><div class="thermo num" style="background:${thermoColor(S.temp)}">${S.temp}°</div><div class="lab">${BAND_LABELS[band(S.temp)]}<small>Kitchen temperature</small></div></div>${stepper("temp",S.temp,"°C",{label:"Kitchen temperature",min:S.temp<=16,max:S.temp>=40})}</div>${tempNote()}</div>
  <div class="guide">${guideFor(rid).map(([l,v,e],i)=>`<div class="g${i===0?" wide":""}"><span>${l}${e?`<span class="est">est.</span>`:""}</span><b>${v}</b></div>`).join("")}</div>
  ${rid==="sandwich"?`<div class="card"><div class="ct">Starter version</div>${variantPick()}</div>`:""}
  <h2 class="sh">When</h2>
  <div class="card">${seg("pmode",[["finish","Ready at"],["start","Start at"]],mode)}
   ${mode==="finish"?`<div class="spacer"></div><div class="ctrl" style="display:block;border:0;padding-top:4px"><div class="lab" style="margin-bottom:8px">The time means</div>${seg("ptarget",T,S.plan.target[rid])}</div>`:""}
   <div class="spacer"></div><div class="faint" style="font-weight:600;margin-bottom:6px">${mode==="finish"?tgtLabel(rid)+" on":"Levain build starts on"}</div>
   <div class="pillrow">${days.map(d=>`<button class="pill ${isoDate(d)===S.plan.day[rid]?"on":""}" aria-pressed="${isoDate(d)===S.plan.day[rid]}" data-act="pdate" data-arg="${isoDate(d)}">${DOW[d.getDay()]}<small>${relDay(d)==="Today"||relDay(d)==="Tomorrow"?relDay(d):d.getDate()+" "+MON[d.getMonth()]}</small></button>`).join("")}</div>
   <div class="ctrl"><div class="lab">At</div><div class="timepick"><button class="sm" data-act="ptime" data-arg="-15" aria-label="15 minutes earlier">−15</button><input type="time" id="ptime" value="${esc(at)}" step="300" aria-label="${mode==="finish"?tgtLabel(rid)+" time":"Start time"}"><button class="sm" data-act="ptime" data-arg="15" aria-label="15 minutes later">+15</button></div></div>
   <div class="ctrl" style="display:block"><div class="lab" style="margin-bottom:8px">Fridge stage</div>${seg("pcold",COLD_OPTS[rid].map(h=>[h,h+" h"]),S.cold[rid])}</div>
   <div class="ctrl" style="display:block"><div class="lab" style="margin-bottom:8px">I'm unavailable<small>Hands-on and oven steps stay out of these hours; rising, fridge and cooling can run through them.</small></div>
    ${seg("pawayon",[["1","Set hours"],["0","Any time"]],aw.on?"1":"0")}
    ${aw.on?`<div class="awayrow"><label>From<input type="time" id="pawayf" value="${esc(aw.from)}" step="900"></label><label>To<input type="time" id="pawayt" value="${esc(aw.to)}" step="900"></label></div>`:""}</div></div>
  <div class="sum"><div><span>Start</span><b class="num">${clockOf(tl.startD)}</b><div class="faint">${dayName(tl.startD)}</div></div><div class="arrow">${ICON.chev}</div><div><span>${esc(T.find(x=>x[0]===S.plan.target[rid])[1])}</span><b class="num">${clockOf(tl.targetD)}</b><div class="faint">${dayName(tl.targetD)}</div></div></div>
  <div class="faint" style="text-align:center;margin-top:6px">${esc(other[0])}: ${dayName(other[1])}, ${clockOf(other[1])}</div>
  ${tl.past?`<div class="warnbar"><span>!</span><span>That start time has already passed. Pick a later ${mode==="finish"?"time or day":"start time"}, or start the timer from a later step.</span></div>`:conflictBox(rid,tl)}
  <div class="overview">${ov}</div><div class="legend"><span class="k-prep">Hands-on</span><span class="k-wait">Rising</span><span class="k-cold">Fridge</span><span class="k-oven">Oven</span><span class="k-rest">Cooling</span></div>
  <div class="faint" style="margin-top:6px">≈ marks estimates for ${S.temp} °C. If the dough runs ahead or behind, follow its cues; later steps shift with it.</div>
  <div class="tl" style="margin-top:6px">${items}</div>
  <button class="btn" data-act="startthis" data-arg="${rid}" style="margin-top:10px">${ICON.play}Open the bake-day timer</button><div class="faint" style="text-align:center;margin-top:8px">The timer runs step by step from when you press start; it doesn't wait for the planned time.</div></div>`;
}
function ringSVG(frac,id){const r=130,C=2*Math.PI*r;return`<svg viewBox="0 0 300 300"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2B27F"/><stop offset="1" stop-color="#D9733F"/></linearGradient></defs><circle class="ring-bg" cx="150" cy="150" r="${r}" fill="none" stroke-width="14"/><circle id="${id}" class="ring-fg" cx="150" cy="150" r="${r}" fill="none" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-frac)).toFixed(1)}"/></svg>`}
function vTimer(){
  const s=S.session;
  if(!s){const rid=S.rid,p=currentPlan(rid),tot=p.steps.reduce((a,x)=>a+x.d,0),hands=p.steps.filter(x=>x.k==="prep").reduce((a,x)=>a+x.d,0);
    return nav("Timer")+large("Bake-day timer","Ready when you are",`<span style="color:rgba(251,239,226,.7)">Walk through every step with a countdown and a chime at the end.</span>`)+
    `<div class="wrap">${rpick("trid",rid)}<div class="card"><div style="display:flex;justify-content:space-between;gap:10px"><div><div class="kicker" style="color:#F2B27F">${RECIPES[rid].name}</div><b style="font-size:20px">${p.steps.length} steps · ≈ ${fmtDur(tot)}</b><div class="faint">≈ ${fmtDur(hands)} hands-on · estimates for ${S.temp} °C</div></div></div></div>
    <button class="btn" data-act="tstart" data-arg="0">${ICON.play}Start step 1 now</button><div class="spacer"></div>
    <div class="card"><div class="ct" style="color:rgba(251,239,226,.5)">Or start from a later step</div><ul class="slist">${p.steps.map((x,i)=>`<li><span class="i">${i+1}</span><span class="x">${esc(x.t)}</span><span class="du">${x.est?"≈ ":""}${fmtDur(x.d)}</span>${i?`<button data-act="tstart" data-arg="${i}">Start</button>`:""}</li>`).join("")}</ul></div></div>`;
  }
  const st=s.steps[s.idx],rem=remNow(),frac=st.d?1-rem/(st.d*60):1,done=rem<=0;
  const totalAll=s.steps.reduce((a,x)=>a+x.d,0),doneMin=s.steps.slice(0,s.idx).reduce((a,x)=>a+x.d,0)+(st.d-rem/60);
  const endT=new Date(Date.now()+rem*1000),endDay=relDay(endT),endLbl=fmtClock(endT.getHours()*60+endT.getMinutes())+(endDay==="Today"?"":endDay==="Tomorrow"?" tomorrow":" "+dayName(endT));
  return nav(RECIPES[s.rid].name,{left:`<div class="left"><button class="back" data-act="tend" style="color:#F7C9A6">${ICON.close}End</button></div>`,right:`<button class="iconbtn" data-act="focus" aria-label="${document.body.classList.contains("focus")?"Exit focus mode":"Focus mode"}">${document.body.classList.contains("focus")?ICON.shrink:ICON.expand}</button>`})+
  `<div class="overall"><div class="bar"><i data-live="obar" style="width:${(doneMin/totalAll*100).toFixed(1)}%"></i></div><div class="lab"><span>Step ${s.idx+1} of ${s.steps.length}</span><span data-live="oleft">≈ ${fmtDur(totalAll-doneMin)} to go</span></div></div>
  <div class="ringwrap ${done?"done":""}" id="ringwrap">${ringSVG(frac,"ringfg")}<div class="ctr"><div class="lbl" data-live="rlbl">${done?"Step done":s.running?"Remaining":"Paused"}</div><div class="cd num" data-live="cd" role="timer" aria-label="Time remaining">${fmtCD(rem)}</div><div class="of" data-live="rof">${done?"Check the cue below":`of ${fmtDur(st.d)}${st.est?" (estimate)":""} · ${s.running?"ends "+endLbl:"tap play"}`}</div></div></div>
  <div class="tstep"><div class="no">Step ${s.idx+1}${st.est?" · follow the dough":""}</div><h2>${esc(st.t)}</h2><p>${esc(st.detail)}</p>${st.cue?`<div class="cue"><span>✓</span><span><b>Ready when:</b> ${esc(st.cue)}</span></div>`:""}${doughTBox(s)}</div>
  ${done&&st.check?readyBox(s,st):""}
  <div class="tctl"><button class="rb" data-act="tprev" ${s.idx===0?"disabled":""} aria-label="Previous step">${ICON.prev}</button>
   <button class="play ${done?"done-pulse":""}" data-act="${done?(st.check?"tchk":"tnext"):"tplay"}" aria-label="${done?(st.check?"Go to the readiness check":"Start the next step"):s.running?"Pause":"Start"}" id="playbtn">${done?(st.check?"?":ICON.next):s.running?ICON.pause:ICON.play}</button>
   <button class="rb" data-act="tnext" ${s.idx>=s.steps.length-1?"disabled":""} aria-label="Next step">${ICON.next}</button></div>
  <div class="tsmall"><button data-act="tadd" data-arg="-5">−5 min</button><button data-act="tadd" data-arg="5">+5 min</button><button data-act="treset">Restart step</button><button data-act="tsound" class="${S.sound?"on":""}" aria-pressed="${S.sound}">Sound ${S.sound?"on":"off"}</button>${CAN_NOTIFY&&!IS_IOS?`<button data-act="tnotify" class="${S.notify&&Notification.permission==="granted"?"on":""}" aria-pressed="${S.notify&&Notification.permission==="granted"}">Alerts ${S.notify&&Notification.permission==="granted"?"on":"off"}</button>`:""}</div>
  <div class="wakerow">${wakeBtn()}</div>
  ${alertNote()}${!done&&s.running&&(st.check||st.k==="oven"||st.d>=20)?`<div class="alarmtip" data-test="alarmtip">⏰ <b>Backup alarm:</b> set your Clock app for <b class="num">${endLbl}</b>${st.check?" to check the dough":""}. A web app can't guarantee an alert while the phone is locked.</div>`:""}
  ${done&&!st.check&&s.idx<s.steps.length-1?`<button class="btn nextbtn done-pulse" data-act="tnext">Start next: ${esc(s.steps[s.idx+1].t)}</button>`:""}
  ${done&&s.idx===s.steps.length-1?`<button class="btn nextbtn" data-act="tend">Finish bake</button>`:""}
  <div class="scards" id="scards">${s.steps.map((x,i)=>`<button class="scard ${i===s.idx?"cur":i<s.idx?"past":""}" data-act="tgo" data-arg="${i}"><div class="sn">STEP ${i+1}</div><b>${esc(x.t)}</b><span>${x.est?"≈ ":""}${fmtDur(x.d)}</span></button>`).join("")}</div>`;
}
function readyBox(s,st){const last=s.idx>=s.steps.length-1,nx=last?null:s.steps[s.idx+1];
  return`<div class="ready" role="group" aria-labelledby="rdyh" data-test="readiness"><h3 id="rdyh">Is it ready?</h3>${Number.isFinite(+s.endsAt)&&!s.running?(()=>{const at=new Date(+s.endsAt),rd=relDay(at);return`<p class="faint" data-test="ended-at">Timer ended at ${fmtClock(at.getHours()*60+at.getMinutes())}${rd==="Today"?"":" "+esc(rd.toLowerCase())}${s.closedEnd?" while the app was closed":""}.</p>`})():""}${st.cue?`<p><b>Look for:</b> ${esc(st.cue)}</p>`:""}
   <div class="ct">Not ready yet</div><div class="rmore">${[15,30,60].map(m=>`<button data-act="tmore" data-arg="${m}">+${m} min</button>`).join("")}</div>
   <button class="btn" data-act="${last?"tend":"tnext"}">${last?"Ready: finish":`Ready: start ${esc(nx.t)}`}</button>
   <button class="btn sec" data-act="tguide">Unsure: how to judge it</button>
   <div class="faint" style="margin-top:6px">Nothing starts until you choose. The time was an estimate; the dough decides.</div></div>`}
function doughTBox(s){const bi=s.steps.findIndex(x=>x.key==="bulk"),si=s.steps.findIndex(x=>x.key==="bulkstart");if(bi<0||si<0||s.idx<si||s.idx>bi)return"";
  return`<div class="dtemp"><label for="dtin">Dough temperature after mixing</label><div class="dtrow"><input id="dtin" type="number" inputmode="decimal" step="0.5" min="15" max="35" value="${s.doughT??""}" placeholder="${s.temp}"><span>°C</span>${s.doughT!=null?`<button class="linkbtn" data-act="dtclear">Use kitchen temp</button>`:""}</div>
   <div class="faint">${s.doughT!=null?`Bulk estimate uses your ${s.doughT} °C dough: ≈ ${fmtDur(s.steps[bi].d)} for the hands-off part.`:`Optional. Probe the dough; the bulk estimate then follows the dough instead of the ${s.temp} °C kitchen.`}</div></div>`}
function guideSheet(s,st){const r=s.rid,b=band(s.temp),key=st.key;
  let h,li;
  if(key==="levain"&&r==="sandwich"){h="Is the stiff starter ready?";li=["Clearly risen, about 50% or more, and domed","Webby, bubbly inside when you pull a bit back","Smells sweet-tangy, not sharp or alcoholic","Not risen at all: leave it longer; it's still alive, just slow"]}
  else if(key==="levain"){h="Is the levain at peak?";li=["Roughly doubled from the mark (80–100% rise)","Bubbly all through when you look at the side of the jar","Dome is just starting to flatten: use it now","Collapsed and very sour: it's past peak. Use it soon, or build again for a milder loaf"]}
  else if(key==="bulk"){const tgt=r==="loaf"?LOAF_RISE[b]:r==="focaccia"?FOC_RISE[b]:r==="pizza"?PIZ_RISE[b]:"40–50%";h="Is bulk fermentation done?";
    li=[`Risen about ${tgt} from the mark on the container`,r==="pizza"?"Only slightly domed with a few bubbles; pizza dough should look under-risen":"Domed edges where the dough meets the container","Bubbles on the sides and underneath",r==="sandwich"?"Soft and puffy; a floured finger leaves a dent that slowly fills":"The whole mass wobbles when you shake the container","Warm kitchen and right at the target: move on. Over-fermented dough is harder to rescue than slightly under"]}
  else{h="Is the proof done?";li=r==="sandwich"?["The dome has reached about the rim of the tin","Poke test: springs straight back → wait; fills back slowly → bake; stays dented → bake now"]:r==="pizza"?["Balls have relaxed and spread a little","Poke springs back slowly and leaves a slight dent","Still tight and springy: give it 30 more minutes"]:["Very puffy, with bubbles under the surface","The whole sheet jiggles when you move the tray","Still tight at the edges: 15–30 more minutes, or let the preheat run longer"]}
  return`<h3>${h}</h3><ul class="clean">${li.map(x=>`<li>${esc(x)}</li>`).join("")}</ul><div class="faint" style="margin:10px 0">Times are estimates for ${s.temp} °C${s.doughT!=null?` with ${s.doughT} °C dough`:""}. These cues decide.</div><button class="btn" data-act="sheetclose">Back to the check</button>`}
const IS_IOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function alertNote(){const bits=[];
  if(IS_IOS)bits.push("iPhone can't vibrate for web apps, and the chime can't play while the screen is locked or another app is open. Keep this screen open and the ring/silent switch off.");
  else if(!CAN_VIBRATE)bits.push("This device can't vibrate for web apps, so the chime is the alert.");
  if(!CAN_WAKE)bits.push("Set Auto-Lock to Never (or a long time) while you bake.");
  else if(!S.wake)bits.push("Screen sleep is allowed, so a locked phone may miss the chime.");
  if(!S.sound)bits.push("Sound is off.");
  bits.push("Lock-screen alerts would need a push server, which this offline app doesn't use; set a Clock alarm for the key steps.");
  return bits.length?`<div class="ionote" role="note"><b>Alerts:</b> ${bits.join(" ")}</div>`:""}
function vStarter(){
  const days=S.starter.fedAt?Math.floor((Date.now()-S.starter.fedAt)/864e5):null;
  const status=days===null?["Not logged yet",""]:days<7?["Fresh","o"]:days<=10?["Refresh due","h"]:["Overdue — revive","t"];
  return nav("Starter")+large("Mother & levain","Starter","Keep the mother small and cold; build a fresh levain for every bake.")+
  `<div class="wrap"><div class="card"><div class="feed"><div class="jar">${jarSVG(days===null?45:Math.max(15,80-days*7))}</div><div style="flex:1"><div class="days num">${days===null?`<span style="font-size:22px">No feed logged</span>`:days}<small style="font-size:15px;font-family:var(--sans);color:var(--ink3)"> ${days===null?"":"day"+(days===1?"":"s")+" since feeding"}</small></div>
   ${status[1]?`<span class="chip ${status[1]}" style="margin-top:8px">${status[0]}</span>`:`<div class="faint" style="margin-top:6px">Tap below after each feed.</div>`}
   ${S.starter.fedAt?`<div class="faint" style="margin-top:6px">Last fed ${dayName(new Date(S.starter.fedAt))}, ${fmtClock(new Date(S.starter.fedAt).getHours()*60+new Date(S.starter.fedAt).getMinutes())}</div>`:""}</div></div>
   <div class="spacer"></div><button class="btn" data-act="fed">I fed it just now</button></div>
  <h2 class="sh">Mother feed <small>87.5% hydration</small></h2>
  <div class="card tint"><div class="build"><div class="b"><b>20</b><span>starter g</span></div><span class="plus">+</span><div class="b"><b>40</b><span>flour g</span></div><span class="plus">+</span><div class="b"><b>35</b><span>water g</span></div><span class="plus">=</span><div class="b tot"><b>95</b><span>total g</span></div></div></div>
  <div class="card"><div class="steps">${[["Feed","Mix 20 g starter + 40 g flour + 35 g water in a clean jar. Mark the level."],["Short start at room temperature",`1–2 h (30–60 min at 28 °C+) until the first bubbles. Your kitchen is ${S.temp} °C: ${S.temp>=27?"30–60 min":"1–2 h"}.`],["Fridge before peak","3–5 °C. Refresh every 7–10 days."],["Revive if sluggish","A recovery feed left out until about doubled; repeat if needed. Emergency rebuild: 10 g + 20 g flour + 17–18 g water."]].map(([t,d],i)=>`<div class="step"><div class="dot">${i+1}</div><div class="tx"><b>${t}</b><span>${d}</span></div></div>`).join("")}</div></div>
  <h2 class="sh">Levain builds</h2>
  <div class="card"><table class="tbl"><thead><tr><th>For</th><th>Mother + flour + water</th><th class="r">Makes / use</th></tr></thead><tbody>${LEVAIN_TABLE.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="r">${r[2]}</td></tr>`).join("")}</tbody></table></div>
  <div class="card"><div class="ct">When is it ready?</div><p>5–8 h at 24–26 °C (3½–5 h at 28–30 °C). Use it at peak or as the dome just starts to flatten: 80–100% rise.</p><div class="chips"><span class="chip t">Your kitchen (${S.temp} °C): ${fmtWin(interp(LEV,S.temp))} <span class="est">est.</span></span></div></div>
  <div class="card heat"><div class="ct">Slow it down in the heat</div><ul class="clean"><li>Use 20 °C water for the build.</li><li>Halve the mother: 10 g + 75 + 75 (roughly 2–3 h longer, an estimate).</li><li>Let it rise about 50%, then refrigerate until needed.</li></ul></div>
  <div class="card"><div class="ct">Healthy</div><ul class="clean ok"><li>Bubbly, domed, predictable rise</li><li>Yogurty or mildly vinegary smell</li><li>Grey liquid on top: hungry, pour off and feed</li></ul><div class="ct" style="margin-top:12px">Discard if you see</div><ul class="clean bad"><li>Fuzzy mould</li><li>Pink, orange or red growth</li><li>A putrid smell</li></ul></div></div>`;
}
function ddtCard(){const d=S.ddt,room=S.temp,w=ddtWater(d,room),wr=Math.round(w*2)/2;
  const row=(act,lab,sub,val,lo,hi,isNull)=>`<div class="ctrl"><div class="lab">${lab}<small>${sub}</small></div>${stepper(act,val,"°C",{label:lab,input:val,dec:1,lo,hi,min:val<=lo,max:val>=hi})}</div>`;
  const warn=w<2?"That's colder than tap water can go: use iced water, chilled flour, or a cooler room.":w>40?"Water above about 40 °C stresses the culture. Mix with 35–38 °C water and give the dough a warmer spot instead.":"";
  return`<h2 class="sh">Dough temperature calculator <small>optional</small></h2><div class="card" data-test="ddt">
   ${row("ddtT","Target dough temp","After mixing",d.target,18,32)}
   <div class="ctrl"><div class="lab">Kitchen<small>From your kitchen setting</small></div><b class="num">${room} °C</b></div>
   ${row("ddtF","Flour temp",d.flour===null?"Assumed = kitchen":"Measured",d.flour??room,-5,45)}
   ${row("ddtL","Levain temp",d.lev===null?"Assumed = kitchen":"Measured",d.lev??room,-5,45)}
   ${row("ddtX","Friction factor","Needs calibrating to your mixing",d.fric,0,20)}
   <div class="ddtres"><span>Water temperature</span><b class="num" data-test="ddt-water">${g1(wr)} °C</b></div>${warn?`<div class="warnbar"><span>!</span><span>${warn}</span></div>`:""}
   <div class="eq">Water = 4 × target − kitchen − flour − levain − friction</div>
   <div class="faint">Hand-mixing adds little heat (start at 1–3 °C). Calibrate once: friction = 4 × target − kitchen − flour − levain − water you used, using the dough temperature you actually measured as the target. ${d.flour!==null||d.lev!==null||d.fric!==2||d.target!==25?`<button class="linkbtn" data-act="ddtreset">Reset</button>`:""}</div></div>`}
function acc(id,title,body){const o=S.openAcc[id];return`<div class="acc ${o?"open":""}"><button data-act="acc" data-arg="${id}">${title}<span class="ch">${ICON.chev}</span></button><div class="ab">${body}</div></div>`}
function vRef(){
  const wk=S.weekHot;const tb=[22,24,26,28,30,32];const near=tb.reduce((a,b)=>Math.abs(b-S.temp)<Math.abs(a-S.temp)?b:a);
  return nav("Reference")+large("Quick reference","Reference","Rules, temperatures, conversions and fixes.")+
  `<div class="wrap"><h2 class="sh">Golden rules</h2><div class="card"><ol class="rules">${RULES.map(r=>`<li>${esc(r)}</li>`).join("")}</ol></div>
  <h2 class="sh">Sample week</h2><div class="card">${seg("week",[["0","Standard"],["1","Hot season"]],wk?"1":"0")}<div class="spacer"></div>
  ${wk?"":`<div class="faint" data-test="week-temp" style="margin-bottom:8px">Timed for a kitchen of about 25 °C. In a warmer kitchen the rises and warm-ups are shorter, so use the Plan screen for your own times.</div>`}${wk?`<p>Build the levain about <b>08:00</b> with 20 °C water, mix <b>11:30–12:00</b> with 15–19 °C water, and expect bulk to end about <b>15:00–16:00</b>. Shape, fridge, and bake the next morning as usual.</p>`:`<div class="tl">${WEEK.map(([w,t,k])=>`<div class="ev k-${k}" style="grid-template-columns:86px 22px 1fr"><div class="tm num" style="font-size:14px">${w}</div><div class="rail"><i></i></div><div class="bx"><div class="in" style="box-shadow:none;background:var(--bg)"><b style="font-size:14.5px;font-weight:600">${esc(t)}</b></div></div></div>`).join("")}</div>`}</div>
  <h2 class="sh">Oven temperatures</h2><div class="card"><table class="tbl"><thead><tr><th>Bake</th><th class="r">Conv.</th><th class="r">Fan</th><th class="r">°F</th></tr></thead><tbody>${OVENS.map(r=>`<tr><td>${r[0]}</td><td class="r">${r[1]}</td><td class="r">${r[2]}</td><td class="r">${r[3]}</td></tr>`).join("")}</tbody></table></div>
  <h2 class="sh">Water temperature <small>for a 25 °C dough</small></h2><div class="card"><div class="wtable">${tb.map(t=>`<div class="${t===near?"on":""}"><span>room ${t}°</span><b>${75-2*t}°</b></div>`).join("")}</div><div class="eq" style="margin-top:10px">Water °C = (25 × 3) − room °C − flour °C</div></div>
  ${ddtCard()}
  <div class="card"><div class="ct">True hydration</div><div class="eq">Hydration = <span class="fr"><span>water + ½ levain</span><span>flour + ½ levain</span></span> × 100</div><div class="faint">Levain at 100% hydration is half flour, half water.</div></div>
  <h2 class="sh">Cues</h2><div class="card">
   <div class="ing"><div class="n">Lean loaf done</div><b>96–98 °C</b></div><div class="ing"><div class="n">Sandwich loaf done</div><b>93–96 °C</b></div>
   <div class="ct" style="margin-top:12px">Poke test</div><ul class="clean"><li><b>Springs straight back:</b> needs more time</li><li><b>Fills back slowly:</b> ready</li><li><b>Stays dented:</b> over-proofed, bake now</li></ul></div>
  <h2 class="sh">Handy weights</h2><div class="card">${[["1 tbsp butter","≈ 14 g"],["1 tbsp honey","≈ 21 g"],["1 tbsp olive oil","≈ 13 g"],["1 tbsp water","15 g"],["1 tsp fine salt","≈ 6 g"]].map(([a,b])=>`<div class="ing"><div class="n">${a}</div><b>${b}</b></div>`).join("")}
   <div class="faint" style="margin-top:8px">Scaling: multiply by new flour ÷ old flour; trays by the area ratio.</div></div>
  <h2 class="sh">Troubleshooting</h2>${RIDS.map(r=>acc("t"+r,RECIPES[r].name,TROUBLE[r].map(([p,c,f])=>`<div class="trow"><b>${esc(p)}</b><div class="cause">${esc(c)}</div><div class="fix">${esc(f)}</div></div>`).join(""))).join("")}
  <h2 class="sh">App</h2><div class="card"><div class="ctrl" style="display:block"><div class="lab" style="margin-bottom:8px">Appearance</div>${seg("theme",[["auto","Auto"],["light","Light"],["dark","Dark"]],S.theme)}</div>
   <div class="faint" style="margin-top:10px">Everything is saved on this device only. Add to Home Screen for a full-screen app.</div>
   <div class="ct" style="margin-top:14px">Your data</div><div class="btnrow"><button class="btn sec" data-act="export">Export</button><label class="btn sec filebtn">Import<input type="file" id="impfile" accept="application/json,.json"></label></div>
   <div class="faint" style="margin-top:6px">A JSON file with your settings, scales, plans and starter feed. A running timer isn't included. You'll see a preview before anything is replaced.</div>
   <div class="spacer"></div><button class="btn ghost" data-act="resetall">Reset all settings</button></div></div>`;
}

/* ---------- render ---------- */
const VIEWS={recipes:()=>S.detail?vDetail(S.detail):vHome(),plan:vPlan,timer:vTimer,starter:vStarter,ref:vRef};
let lastKey="";
function render(anim){
  const v=$("#view"),key=S.tab+"|"+(S.tab==="recipes"?S.detail||"":""),keep=key===lastKey?v.scrollTop:0;
  v.className="view"+(S.tab==="timer"?(S.session?" timerv":" timerv tstart"):"")+(S.session&&S.tab!=="timer"&&!(S.tab==="recipes"&&!S.detail)?" has-pill":"");
  v.innerHTML=VIEWS[S.tab]();
  if(key!==lastKey){v.scrollTop=0;void v.offsetWidth;v.classList.add(anim||"enter")}else v.scrollTop=keep;
  lastKey=key;
  document.querySelectorAll(".tabbar button").forEach(b=>{const on=b.dataset.arg===S.tab;b.classList.toggle("on",on);on?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current")});
  $("#tbadge").style.display=S.session&&S.session.running?"block":"none";
  renderPill();onScroll();
  const sc=$("#scards");if(sc){const c=sc.querySelector(".cur");if(c)sc.scrollLeft=c.offsetLeft-sc.clientWidth/2+c.clientWidth/2}
  document.body.classList.toggle("ontimer",S.tab==="timer");document.documentElement.dataset.theme=S.theme==="auto"?"":S.theme;
  const dark=S.theme==="dark"||(S.theme==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);
  $('meta[name="theme-color"]').content=S.tab==="timer"?"#2B1D15":dark?"#1A1410":"#FBF6EE";
  save();
}
function renderPill(){const p=$("#pill"),s=S.session;if(!s||S.tab==="timer"||(S.tab==="recipes"&&!S.detail)){p.style.display="none";return}
  const st=s.steps[s.idx],rem=remNow(),fr=st.d?1-rem/(st.d*60):1,C=2*Math.PI*16;
  p.style.display="flex";p.setAttribute("aria-label",`Current bake: step ${s.idx+1}, ${st.t}. Open timer`);p.innerHTML=`<svg class="mini" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.15)" stroke-width="4"/><circle data-live="pring" cx="20" cy="20" r="16" fill="none" stroke="#D9733F" stroke-width="4" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-fr)}" transform="rotate(-90 20 20)"/></svg><span class="tt"><b>${esc(st.t)}</b><span>${RECIPES[s.rid].short} · step ${s.idx+1}/${s.steps.length}${s.running?"":rem<=0?" · done":" · paused"}</span></span><span class="cd" data-live="pcd">${fmtCD(rem)}</span>`}
let lastState="";
function updateTimerDom(){
  const s=S.session;if(!s)return;const rem=remNow(),st=s.steps[s.idx];
  const sig=`${s.idx}|${s.running}|${rem<=0}`;
  if(S.tab==="timer"){if(sig!==lastState){lastState=sig;render();return}
    const C=2*Math.PI*130,fr=st.d?1-rem/(st.d*60):1;const r=$("#ringfg");if(r)r.setAttribute("stroke-dashoffset",(C*(1-fr)).toFixed(1));
    document.querySelectorAll('[data-live="cd"]').forEach(e=>e.textContent=fmtCD(rem));
    const totalAll=s.steps.reduce((a,x)=>a+x.d,0),doneMin=s.steps.slice(0,s.idx).reduce((a,x)=>a+x.d,0)+(st.d-rem/60);
    const ob=$('[data-live="obar"]');if(ob)ob.style.width=(doneMin/totalAll*100).toFixed(1)+"%";const ol=$('[data-live="oleft"]');if(ol)ol.textContent=`≈ ${fmtDur(totalAll-doneMin)} to go`;
  }else{if(sig!==lastState){lastState=sig;renderPill();$("#tbadge").style.display=s.running?"block":"none"}
    const C=2*Math.PI*16,fr=st.d?1-rem/(st.d*60):1;const pr=$('[data-live="pring"]');if(pr)pr.setAttribute("stroke-dashoffset",C*(1-fr));
    document.querySelectorAll('[data-live="pcd"],[data-live="cd"]').forEach(e=>e.textContent=fmtCD(rem));}
}
function onScroll(){const v=$("#view"),n=v.querySelector(".nav");if(n)n.classList.toggle("solid",v.scrollTop>(S.tab==="recipes"&&S.detail?170:36))}

/* ---------- sheet: a modal dialog ---------- */
let sheetReturn=null;
const FOCUSABLE='button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
function sheet(html,label){const ret=document.querySelector(".sheet")?sheetReturn:document.activeElement;closeSheet(true);sheetReturn=ret;
  const bg=document.createElement("div");bg.className="sheet-bg";bg.setAttribute("aria-hidden","true");
  const sh=document.createElement("div");sh.className="sheet";sh.setAttribute("role","dialog");sh.setAttribute("aria-modal","true");sh.tabIndex=-1;
  sh.innerHTML=`<div class="grab" aria-hidden="true"></div>${html}`;const h=sh.querySelector("h3");
  if(h){h.id="sheet-title";sh.setAttribute("aria-labelledby","sheet-title")}else sh.setAttribute("aria-label",label||"Dialog");
  bg.onclick=()=>closeSheet();document.body.append(bg,sh);const app=$("#app");if(app){app.inert=true;app.setAttribute("aria-hidden","true")}
  const f=sh.querySelector(FOCUSABLE);(f||sh).focus({preventScroll:true})}
function closeSheet(silent){const had=!!document.querySelector(".sheet");document.querySelectorAll(".sheet,.sheet-bg").forEach(e=>e.remove());
  const app=$("#app");if(app){app.inert=false;app.removeAttribute("aria-hidden")}
  if(had&&!silent){const r=sheetReturn;if(r&&document.contains(r))r.focus({preventScroll:true});else{const v=$("#view");v&&v.focus&&v.focus({preventScroll:true})}}
  if(!silent)sheetReturn=null}
document.addEventListener("keydown",e=>{const sh=document.querySelector(".sheet");if(!sh)return;
  if(e.key==="Escape"){e.preventDefault();closeSheet();return}
  if(e.key==="Tab"){const f=[...sh.querySelectorAll(FOCUSABLE)];if(!f.length){e.preventDefault();sh.focus();return}
    const first=f[0],last=f[f.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===sh)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}},true);

/* ---------- export / import ---------- */
const EXPORT_KEYS=["scale","hyd","temp","cold","variant","plan","starter","sound","wake","theme","weekHot","ddt"];
function exportObj(){const data={};EXPORT_KEYS.forEach(k=>data[k]=JSON.parse(JSON.stringify(S[k])));return{format:"michaels-baking-export",version:1,app:"2.1",exportedAt:new Date().toISOString(),data}}
function exportData(){const o=exportObj(),blob=new Blob([JSON.stringify(o,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`michaels-baking-${isoDate(new Date())}.json`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast("Exported. Keep the file somewhere safe.")}
/* returns {ok,cand,problems} — the candidate is fully sanitised; nothing is applied here */
function parseImport(text){let o;try{o=JSON.parse(text)}catch(e){return{ok:false,problems:["This isn't a JSON file."]}}
  if(!o||typeof o!=="object"||o.format!=="michaels-baking-export")return{ok:false,problems:["This file wasn't exported from this app."]};
  if(o.version!==1)return{ok:false,problems:[`Export format version ${esc(String(o.version))} isn't supported (this app reads version 1).`]};
  if(!o.data||typeof o.data!=="object"||Array.isArray(o.data))return{ok:false,problems:["The file has no data section."]};
  const d={};EXPORT_KEYS.forEach(k=>{if(k in o.data)d[k]=o.data[k]});if(!Object.keys(d).length)return{ok:false,problems:["The file's data section is empty."]};
  const cand=sanitize(merge(fresh(),d)),problems=[];
  const chk=(lab,a,b)=>{if(JSON.stringify(a)!==JSON.stringify(b))problems.push(lab)};
  if("temp" in d)chk("Kitchen temperature was out of range and has been adjusted.",+d.temp,cand.temp);
  if(d.scale)for(const r of RIDS)if(d.scale[r])for(const k in cand.scale[r])if(k in d.scale[r]&&String(d.scale[r][k])!==String(cand.scale[r][k]))problems.push(`${RECIPES[r].short}: ${k} adjusted to ${cand.scale[r][k]}.`);
  return{ok:true,cand,problems,exportedAt:o.exportedAt}}
let pendingImport=null;
function previewImport(text){const r=parseImport(text);
  if(!r.ok){sheet(`<h3>Can't import this file</h3><p class="muted">${r.problems.join(" ")}</p><p class="faint">Nothing was changed.</p><button class="btn" data-act="sheetclose">OK</button>`);return}
  pendingImport=r.cand;const keep=S;S=Object.assign({},keep,r.cand,{session:keep.session});let rows;
  try{rows=RIDS.map(x=>[RECIPES[x].short,calc(x).summary+(x!=="sandwich"?` · ${S.hyd[x]}%`:` · ${SANDWICH_VARIANTS[S.variant.sandwich].label}`)])}finally{S=keep}
  const c=r.cand,when=Date.parse(r.exportedAt);
  rows.unshift(["Kitchen",`${c.temp} °C`]);rows.push(["Unavailable",c.plan.away.on?`${c.plan.away.from}–${c.plan.away.to}`:"Not set"],["Starter fed",c.starter.fedAt?dayName(new Date(c.starter.fedAt)):"Not logged"]);
  sheet(`<h3>Replace your data with this file?</h3><p class="muted">Exported ${Number.isFinite(when)?dayName(new Date(when))+", "+clockOf(new Date(when)):"(date unknown)"}. Your settings, scales, plans and starter log will be replaced${S.session?"; the running bake is kept":""}.</p>
   <div class="card" style="margin:10px 0">${rows.map(([a,b])=>`<div class="ing"><div class="n">${esc(a)}</div><div style="text-align:right;font-weight:600">${esc(b)}</div></div>`).join("")}</div>
   ${r.problems.length?`<div class="warnbar"><span>!</span><span>${r.problems.map(esc).join(" ")}</span></div>`:""}
   <div class="btnrow"><button class="btn sec" data-act="sheetclose">Cancel</button><button class="btn" data-act="importok">Replace</button></div>`)}

/* ---------- actions ---------- */
const ACT={
  tab(a){haptic();if(a===S.tab&&a==="recipes"&&S.detail){S.detail=null;render("pop");return}if(a==="plan"&&S.tab!=="plan")ensurePlan(S.rid,true);S.tab=a;render("enter")},
  open(a){haptic();S.detail=a;S.seg="ing";S.rid=a;try{history.pushState({v:"detail"},"")}catch(e){}render("push")},
  back(){haptic();if(history.state&&history.state.v==="detail"){history.back();return}S.detail=null;render("pop")},
  seg(a){S.seg=a;render()},
  temp(d){S.temp=clamp(S.temp+ +d,16,40);haptic(5);render()},
  loafmode(a){S.scale.loaf.mode=a;render()},
  loafn(d){S.scale.loaf.n=clamp(S.scale.loaf.n+ +d,1,8);haptic(5);render()},
  loafw(d){S.scale.loaf.w=clamp(S.scale.loaf.w+50*d,300,12000);haptic(5);render()},
  tray(a){S.scale.focaccia.tray=a;haptic(5);render()},
  trayw(d){S.scale.focaccia.cw=clamp(S.scale.focaccia.cw+ +d,10,80);render()},
  trayl(d){S.scale.focaccia.cl=clamp(S.scale.focaccia.cl+ +d,10,80);render()},
  balls(d){S.scale.pizza.balls=clamp(S.scale.pizza.balls+ +d,1,24);haptic(5);render()},
  bw(d){S.scale.pizza.bw=clamp(S.scale.pizza.bw+5*d,150,400);haptic(5);render()},
  tin(a){S.scale.sandwich.tin=a;render()},
  tinn(d){S.scale.sandwich.n=clamp(S.scale.sandwich.n+ +d,1,6);render()},
  hreset(){const r=S.detail;S.hyd[r]=LEAN[r].H0;render()},
  planthis(a){haptic();S.rid=a;S.tab="plan";S.detail=null;ensurePlan(a,true);render("enter")},
  startthis(a){haptic();S.rid=a;if(S.session){sheet(`<h3>Replace the current bake?</h3><p class="muted">${RECIPES[S.session.rid].name} is on step ${S.session.idx+1}. Starting ${RECIPES[a].name} ends it.</p><div class="btnrow"><button class="btn sec" data-act="sheetclose">Keep it</button><button class="btn" data-act="replace" data-arg="${a}">Start new</button></div>`);return}S.tab="timer";S.detail=null;render("enter")},
  replace(a){closeSheet();S.session=null;sessDirty=true;S.rid=a;S.tab="timer";render("enter")},
  sheetclose(){closeSheet()},
  prid(a){S.rid=a;ensurePlan(a,true);render()},trid(a){S.rid=a;render()},
  pmode(a){if(S.plan.mode===a)return;const tl=timeline(S.rid);S.plan.mode=a;
    // keep the same bake when switching: carry the start (or ready) time across
    if(a==="start"){S.plan.day[S.rid]=isoDate(tl.startD);S.plan.start=clockOf(tl.startD)}else{S.plan.day[S.rid]=isoDate(tl.targetD);S.plan.anchor[S.rid]=clockOf(tl.targetD)}
    S.plan.custom[S.rid]=true;render()},
  pdate(a){S.plan.day[S.rid]=a;S.plan.custom[S.rid]=true;haptic(5);render()},
  ptime(d){const k=S.plan.mode==="finish";const cur=parseClock(k?S.plan.anchor[S.rid]:S.plan.start)??540;const nv=fmtClock(cur+ +d);if(k)S.plan.anchor[S.rid]=nv;else S.plan.start=nv;S.plan.custom[S.rid]=true;haptic(5);render()},
  pcold(a){S.cold[S.rid]=+a;render()},
  ptarget(a){const r=S.rid;if(S.plan.target[r]===a)return;S.plan.target[r]=a;render()},
  pawayon(a){S.plan.away.on=a==="1";render()},
  palt(a){const [d,t,c]=a.split("|"),r=S.rid;S.plan.day[r]=d;if(S.plan.mode==="finish")S.plan.anchor[r]=t;else S.plan.start=t;if(c)S.cold[r]=+c;S.plan.custom[r]=true;haptic(8);render();toast(c?`Plan moved to the ${c} h fridge option`:"Plan moved")},
  paccept(){const r=S.rid;S.plan.custom[r]=true;S.plan.accept[r]=planSig(r);render()},
  punaccept(){delete S.plan.accept[S.rid];render()},
  variant(a){S.variant.sandwich=a;haptic(5);render()},
  chillh(d){S.variant.chillH=clamp(chillH()+ +d,CHILL_H.min,CHILL_H.max);haptic(5);render()},
  tstart(a){startSession(S.rid,+a);render();const v=$("#view");v&&v.scrollTo(0,0)},
  tplay(){unlockAudio();haptic(12);if(S.session.running)tPause();else tPlay();render()},
  tnext(){unlockAudio();haptic(12);const s=S.session;if(s.idx<s.steps.length-1)tGo(s.idx+1,true);render();const v=$("#view");v&&v.scrollTo(0,0)},
  tmore(m){unlockAudio();tMore(+m);render()},
  tchk(){const r=$(".ready");if(r){r.scrollIntoView({block:"center"});const b=r.querySelector("button");b&&b.focus({preventScroll:true})}},
  tguide(){const s=S.session;sheet(guideSheet(s,s.steps[s.idx]))},
  dtclear(){setDoughT(null)},
  tprev(){haptic();tGo(S.session.idx-1,false);render()},
  tgo(a){haptic();tGo(+a,false);render()},
  treset(){tGo(S.session.idx,false);render()},
  tadd(d){tAdd(+d);render()},
  tsound(){S.sound=!S.sound;if(S.sound){unlockAudio();chime()}render()},
  twake(){if(S.wake&&!wakeLock&&S.session&&S.session.running&&!document.hidden){wakeRetry=0;wakeSync().then(()=>{if(!wakeLock)toast(`The browser refused the screen lock${wakeErr?` (${wakeErr})`:""}. Set Auto-Lock to a long time instead.`)});return}
    S.wake=!S.wake;wakeSync();wakeUI();render()},
  tnotify(){if(!CAN_NOTIFY)return;if(S.notify&&Notification.permission==="granted"){S.notify=false;render();return}
    Notification.requestPermission().then(p=>{S.notify=p==="granted";if(p==="denied")toast("Notifications are blocked for this site in your browser settings.");render()}).catch(()=>{})},
  tend(){sheet(`<h3>End this bake?</h3><p class="muted">The timer and step progress will be cleared.</p><div class="btnrow"><button class="btn sec" data-act="sheetclose">Keep going</button><button class="btn" data-act="tendok">End bake</button></div>`)},
  tendok(){closeSheet();S.session=null;sessDirty=true;wakeSync();document.body.classList.remove("focus");render()},
  focus(){const b=document.body;b.classList.toggle("focus");try{if(b.classList.contains("focus"))document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen().catch(()=>{});else document.fullscreenElement&&document.exitFullscreen()}catch(e){}render()},
  fed(){S.starter.fedAt=Date.now();haptic(20);toast("Feed logged. Fridge it after 1–2 h (30–60 min if 28 °C+).");render()},
  week(a){S.weekHot=a==="1";render()},
  acc(a){S.openAcc[a]=!S.openAcc[a];render()},
  theme(a){S.theme=a;render()},
  updreload(){location.reload()},
  resetall(){sheet(`<h3>Reset everything?</h3><p class="muted">Scaling, plans, starter log and any running bake will be cleared.</p><div class="btnrow"><button class="btn sec" data-act="sheetclose">Cancel</button><button class="btn" data-act="resetok">Reset</button></div>`)},
  resetok(){closeSheet(true);S=sanitize(fresh());S.epoch=newEpoch();S.rev=1;seenRev=1;sessDirty=false;try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}PLAN_NONE={};wakeSync();document.body.classList.remove("focus");skipSave=true;render();skipSave=false;toast("Everything was reset")},
  export(){exportData()},
  importok(){if(!pendingImport)return;const ui=keepUI(),sess=S.session;S=Object.assign(pendingImport,ui,{session:sess,epoch:S.epoch,rev:S.rev});pendingImport=null;closeSheet();PLAN_NONE={};render();saveNow();toast("Imported")},
  ddtT(d){S.ddt.target=clamp(S.ddt.target+.5*d,18,32);render()},
  ddtF(d){S.ddt.flour=clamp((S.ddt.flour??S.temp)+ +d,-5,45);render()},
  ddtL(d){S.ddt.lev=clamp((S.ddt.lev??S.temp)+ +d,-5,45);render()},
  ddtX(d){S.ddt.fric=clamp(S.ddt.fric+ +d,0,20);render()},
  ddtreset(){S.ddt=Object.assign({},DDT_DEFAULT);render()}
};
/* press-and-hold on steppers repeats; the click that ends a hold is swallowed */
let repT=0,repFired=false,swallowUntil=0;
function repStop(){clearTimeout(repT);repT=0;if(repFired){repFired=false;swallowUntil=Date.now()+350}}
document.addEventListener("pointerdown",e=>{unlockAudio();repStop();swallowUntil=0;const b=e.target.closest(".stepper button[data-act]");if(!b||b.disabled)return;const act=b.dataset.act,arg=b.dataset.arg;
  let n=0;repT=setTimeout(function tick(){repFired=true;n++;ACT[act](arg);repT=setTimeout(tick,n>12?45:90)},450)},{passive:true});
["pointerup","pointercancel","blur"].forEach(t=>window.addEventListener(t,repStop));
document.addEventListener("click",e=>{if(Date.now()<swallowUntil){swallowUntil=0;e.preventDefault();return}const b=e.target.closest("[data-act]");if(!b||b.disabled)return;const f=ACT[b.dataset.act];if(f){e.preventDefault();f(b.dataset.arg)}});
document.addEventListener("input",e=>{
  if(e.target.id==="hyd"){const r=S.detail,L=LEAN[r],v=+e.target.value;S.hyd[r]=v;e.target.style.setProperty("--p",((v-L.Hmin)/(L.Hmax-L.Hmin)*100)+"%");$("#hval").innerHTML=`${v.toFixed(1)}<small>%</small>`;$("#ingbox").innerHTML=ingBox(r,calc(r));save()}
});
document.addEventListener("change",e=>{
  if(e.target.id==="hyd")render();
  const inp=e.target.dataset&&e.target.dataset.inp;
  if(inp){const v=parseFloat(String(e.target.value).replace(",","."));if(Number.isFinite(v)){const sc=S.scale;
    const step={bw:.5,ddtT:.5}[inp]||1,r=Math.round(v/step)*step,lo=+e.target.min,hi=+e.target.max,c=clamp(r,lo,hi);
    ({loafw:()=>sc.loaf.w=c,bw:()=>sc.pizza.bw=c,trayw:()=>sc.focaccia.cw=c,trayl:()=>sc.focaccia.cl=c,ddtT:()=>S.ddt.target=c,ddtF:()=>S.ddt.flour=c,ddtL:()=>S.ddt.lev=c,ddtX:()=>S.ddt.fric=c}[inp]||(()=>0))();
    if(c!==r)toast(`Kept within ${gnum(lo)}–${gnum(hi)}`)}render();return}
  if(e.target.id==="dtin"){const t=String(e.target.value).trim();if(t===""){setDoughT(null);return}const v=parseFloat(t.replace(",","."));if(Number.isFinite(v))setDoughT(Math.round(v*2)/2);return}
  if(e.target.id==="pawayf"||e.target.id==="pawayt"){const v=e.target.value;if(parseClock(v)!==null){S.plan.away[e.target.id==="pawayf"?"from":"to"]=v;render()}return}
  if(e.target.id==="impfile"){const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;if(f.size>1e6){toast("That file is too big to be an export from this app.");return}f.text().then(previewImport).catch(()=>toast("Couldn't read that file."));return}
  if(e.target.id==="ptime"){const v=e.target.value;if(parseClock(v)!==null){if(S.plan.mode==="finish")S.plan.anchor[S.rid]=v;else S.plan.start=v;S.plan.custom[S.rid]=true;render()}}
});
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.dataset&&e.target.dataset.inp){e.target.blur();return}if(S.tab==="timer"&&S.session&&e.code==="Space"&&e.target===document.body){e.preventDefault();ACT.tplay()}});
document.addEventListener("fullscreenchange",()=>{if(!document.fullscreenElement&&document.body.classList.contains("focus")){document.body.classList.remove("focus");render()}});
// another tab changed the data: take its data but keep this tab's own screen.
// Removal (storage cleared elsewhere) resets this tab to defaults without writing anything back.
window.addEventListener("storage",e=>{if(e.key!==KEY&&e.key!==null)return;
  if(e.newValue===null||e.key===null){const ui=keepUI();S=sanitize(fresh());Object.assign(S,ui);S.epoch=newEpoch();seenRev=0;PLAN_NONE={};closeSheet(true);wakeSync();skipSave=true;render();skipSave=false;toast("The app's data was cleared in another tab");return}
  let o;try{o=JSON.parse(e.newValue)}catch(x){return}if(!o)return;
  const resetElsewhere=o.epoch!==S.epoch;
  if(resetElsewhere){adoptStored(o,"Everything was reset or replaced in another tab");return}
  const ui=keepUI();S=sanitize(merge(fresh(),o));Object.assign(S,ui);seenRev=S.rev;
  if(!document.querySelector(".sheet")&&!(document.activeElement&&document.activeElement.matches&&document.activeElement.matches("input"))){skipSave=true;render();skipSave=false}else updateTimerDom()});
window.addEventListener("popstate",()=>{if(document.querySelector(".sheet")){closeSheet();return}if(S.detail){S.detail=null;render("pop")}});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>render());

/* ---------- boot ---------- */
function boot(){
  $("#view").addEventListener("scroll",onScroll,{passive:true});
  if(S.detail){try{history.replaceState(null,"");history.pushState({v:"detail"},"")}catch(e){}}
  const ss=S.session;if(ss&&ss.running&&remNow()<=0&&!ss.alerted){const at=new Date(ss.endsAt);ss.running=false;ss.remaining=0;ss.alerted=true;ss.closedEnd=true;sessDirty=true;saveNow();
    setTimeout(()=>toast(`Step ${ss.idx+1} finished at ${fmtClock(at.getHours()*60+at.getMinutes())}${relDay(at)==="Today"?"":" "+relDay(at).toLowerCase()} while the app was closed.`),400)}
  if(S.tab==="plan")ensurePlan(S.rid,true);
  wakeSync();
  registerSW();
  render("enter");
}
/* ---------- offline: service worker ---------- */
function registerSW(){
  if(!("serviceWorker"in navigator)||!location.protocol.startsWith("http"))return;
  let had=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(had)showUpdate();had=true});
  window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").then(reg=>{
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)reg.update().catch(()=>{})});
  }).catch(()=>{})});
}
function showUpdate(){if(document.querySelector(".updbar"))return;const d=document.createElement("div");d.className="updbar";d.setAttribute("role","status");
  d.innerHTML=`<span>A new version of the app is ready.</span><button data-act="updreload">Reload</button>`;document.body.appendChild(d)}
boot();
