// Loads data.js + core.js into a sandbox with a fake state and a fake clock.
const vm=require("vm"),fs=require("fs"),path=require("path");
const SRC=path.join(__dirname,"..","src");
function defaults(nowIso){return{
  scale:{loaf:{mode:"loaves",n:1,w:1415},focaccia:{tray:"23x33",cw:23,cl:33},pizza:{balls:4,bw:280},sandwich:{tin:"large",n:1}},
  hyd:{loaf:69.7,focaccia:80,pizza:66.4},temp:25,cold:{loaf:14,focaccia:14,pizza:24,sandwich:12},variant:{sandwich:"std",chillH:8},
  plan:{mode:"finish",anchor:{loaf:"09:00",focaccia:"13:05",pizza:"16:30",sandwich:"10:15"},start:"07:00",day:{},custom:{},target:{loaf:"oven",focaccia:"oven",pizza:"oven",sandwich:"oven"},away:{on:true,from:"23:00",to:"06:00"},accept:{}}}}
function load(){
  const ctx={console};vm.createContext(ctx);
  for(const f of ["data.js","core.js"])vm.runInContext(fs.readFileSync(path.join(SRC,f),"utf8"),ctx,{filename:f});
  vm.runInContext("var S;var __now=0;NOW=()=>__now;",ctx);
  const api={ctx,run:(code)=>vm.runInContext(code,ctx),
    reset(state){ctx.__state=state||defaults();vm.runInContext("S=JSON.parse(JSON.stringify(__state))",ctx)},
    setNow(ms){ctx.__nowv=ms;vm.runInContext("__now=__nowv",ctx)}};
  api.reset();api.setNow(Date.now());return api}
module.exports={load,defaults};
