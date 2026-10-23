"use strict";
const RECIPES = {
  loaf:{name:"Sourdough loaf",short:"Loaf",desc:"Crackling crust, open crumb, overnight cold proof.",days:"2 days",oven:"250 °C cloche"},
  focaccia:{name:"Focaccia",short:"Focaccia",desc:"High-hydration, olive-oil rich, dimpled and crisp-bottomed.",days:"2 days",oven:"240–245 °C"},
  pizza:{name:"Pizza",short:"Pizza",desc:"Neapolitan-style balls for the Ooni, 24 h cold ferment.",days:"2 days",oven:"Ooni 420–450 °C"},
  sandwich:{name:"Sandwich loaf",short:"Sandwich",desc:"Soft honey-milk tangzhong loaf from a stiff sweet starter.",days:"3 days",oven:"175 °C"}
};
const RIDS=["loaf","focaccia","pizza","sandwich"];
const LEAN={
  loaf:{flours:[{name:"Strong white bread flour",note:"Doves",pct:1}],L:.2,salt:.02,oil:0,reserve:.04,baseFlour:750,H0:69.7,Hmin:64,Hmax:76,build:[20,70,70],need:150},
  focaccia:{flours:[{name:"Strong white bread flour",note:"",pct:1}],L:.2,salt:.022,oil:.04,reserve:.06,baseFlour:500,H0:80,Hmin:74,Hmax:86,build:[20,50,50],need:100},
  pizza:{flours:[{name:"Tipo 00",note:"Molino Casillo",pct:.6},{name:"Strong white bread flour",note:"Doves",pct:.4}],L:110/600,salt:16/600,oil:0,reserve:.05,baseFlour:600,H0:66.4,Hmin:62,Hmax:70,build:[20,55,55],need:110}
};
const TRAYS=[
  {id:"23x33",label:"23 × 33",sub:"Standard",area:759,w:33,h:23},
  {id:"30x40",label:"30 × 40",sub:"Large ×1.58",area:759*1.58,w:40,h:30},
  {id:"33x46",label:"33 × 46",sub:"Half-sheet",area:1518,w:46,h:33},
  {id:"20x20",label:"20 × 20",sub:"Square tin",area:400,w:20,h:20},
  {id:"r28",label:"Ø 28",sub:"Round tin",area:615.75,w:28,h:28,round:true},
  {id:"custom",label:"Custom",sub:"Your size",area:759}
];
const SANDWICH=[
  {group:"Stiff starter",name:"Active starter",g:15,key:"seed"},{group:"Stiff starter",name:"Honey",g:15,key:"shoney"},{group:"Stiff starter",name:"Water",g:30,key:"swater"},{group:"Stiff starter",name:"Bread flour",g:60,key:"sflour"},
  {group:"Tangzhong",name:"Bread flour",g:35,key:"tflour"},{group:"Tangzhong",name:"Milk",g:175,key:"milk"},
  {group:"Main dough",name:"Cold water",g:225,key:"water"},{group:"Main dough",name:"Honey",g:75,key:"honey"},{group:"Main dough",name:"Neutral oil",g:25,key:"oil"},{group:"Main dough",name:"Bread flour",g:575,key:"flour"},{group:"Main dough",name:"Fine salt",g:12,key:"salt"}
];
const BAND_LABELS=["23 °C or cooler","24–25 °C","26 °C","27–28 °C","29 °C or warmer"];
function band(t){return t<=23?0:t<=25?1:t<=26?2:t<=28?3:4}
const R=(r,m)=>({r,m});
const LEV=[R("7–10 h",510),R("5–8 h",390),R("4½–7 h",345),R("3½–5 h",255),R("3–4½ h",225)];
const LEV_FAST=[R("6–8 h",420),R("4–6 h",300),R("3½–5 h",255),R("3–4 h",210),R("2½–3½ h",180)];
const LOAF_BULK=[R("6–8 h",420),R("4–6 h",300),R("3½–5 h",255),R("3–4 h",210),R("2½–3½ h",180)];
const LOAF_RISE=["50–60%","about 50%","40–50%","30–40%","30–35%"];
const FOC_RISE=["60–75%","50–75%","50–65%","about 50%","about 50%"];
const FOC_WARM=[R("3–4 h",210),R("2½–4 h",195),R("2–3 h",150),R("1½–2½ h",120),R("1¼–2 h",100)];
const PIZ_BULK=[R("4–6 h",300),R("3–5 h",240),R("2½–4 h",195),R("2–3 h",150),R("1½–2½ h",120)];
const PIZ_RISE=["20–30%","20–30%","20–25%","about 20%","about 20%"];
const PIZ_WARM=[R("4–4½ h",255),R("3½–4 h",225),R("3–3½ h",195),R("2–3 h",150),R("1½–2½ h",120)];
const SW_BULK=[R("9–12 h",630),R("8–11 h",570),R("6–9 h",450),R("5–7 h",360),R("4–6 h",300)];
const SW_PROOF=[R("3–4 h",210),R("2–4 h",180),R("2–3 h",150),R("1½–3 h",135),R("1½–2½ h",120)];
const COLD_OPTS={loaf:[10,12,14,16],focaccia:[8,10,12,14,16],pizza:[20,24,28],sandwich:[8,10,12,14]};
const ANCHOR_DEFAULT={loaf:"09:00",focaccia:"13:05",pizza:"16:30",sandwich:"10:15"};

const TROUBLE={
  loaf:[["Dense, tight crumb, pale","Under-fermented","Longer bulk or warmer spot; shape at the target rise"],["Flat, spreads, big irregular holes on top","Over-fermented","Shape at a lower rise when warm; cooler water"],["No ear, score seals","Shallow score or weak shaping","Score cold, 1–1.5 cm deep at 30–45°; tighter boule"],["Gummy crumb","Cut too soon or underbaked","Bake to 96–98 °C; cool 2½–3 h"],["Very sour","Hungry starter or long warm bulk","Feed the mother more often; levain at peak; shorten bulk"],["Dark base","Hot cloche base","Baking tray on the rack below for the uncovered stage"]],
  focaccia:[["Dense, few bubbles","Under-proofed","Longer warm-up; wait for the big wobble"],["Collapses when dimpled","Over-proofed","Shorter warm-up or bulk when warm"],["Pale, soft base","Oven not hot enough or too little oil","Full preheat; tray oil 25–30 g; bottom rack at the end"],["Dough won't stretch to corners","Gluten tight","Rest 15–20 min and try again"],["Dry, bready","Underproofed or overbaked","Check from 18 min; pull at deep golden"]],
  pizza:[["Tears when opening","Cold or under-rested dough","Full warm-up; let it relax 5 min and continue"],["Sticks to the peel","Wet spots or too long topping","Flour the peel, top fast, shake test before launching"],["Burnt base, pale top","Stone too hot vs flame","Let the stone settle; turn the flame down after launch"],["Puffy, bready rim","Over-proofed or pressed unevenly","Bulk to 20% when warm; shorter warm-up"],["Soggy centre","Too much sauce or wet mozzarella","70–80 g sauce; drain mozzarella well"]],
  sandwich:[["Short loaf, dense","Under-proofed","Proof until the dome reaches the rim"],["Sunken top or wrinkles","Over-proofed","Shorter bulk or proof; cooler water when hot"],["Pale, soft crust","Underbaked","Bake to 93–96 °C; full 40–45 min"],["Too dark on top","Honey browns quickly","Foil at 25–30 min"],["Dough tears, no windowpane","Underkneaded","Knead longer; oil goes in after 3–4 min"]]
};
const IMPROVED={
  loaf:["Shape-by-rise table linked to dough temperature, so warm Qatar kitchens don't over-ferment the loaf.","Straight from banneton to fridge by default; room-temperature time only if under-fermented.","True hydration (69.7%) and salt (1.8%) shown with the levain counted in.","Doneness by internal temperature (96–98 °C) rather than time alone."],
  focaccia:["Both tray sizes from one formula, scaled by area (×1.58 for 30 × 40 cm).","Salt water before oil, so the salt dissolves and the oil doesn't coat the gluten early.","Warm-up times split by kitchen temperature.","Check from 18 min and lift out after 5 min to keep the base crisp."],
  pizza:["Bulk stops at 20–30% (20% when warm), because balls keep fermenting in the fridge.","Ball weight and count are linked to the total dough, with no leftover scraps.","Flame down after launch for an even top and base in the Ooni.","Sauce kept uncooked and weighed: 400 g tomatoes + 4 g salt."],
  sandwich:["Kept the stiff sweet starter and tangzhong exactly; added the 65 °C cue.","Bulk times for both 23–24 °C and 27–28 °C kitchens.","Tin guidance: 3–3.5 L tin as standard, 0.75× for a 2 lb tin.","Doneness by internal temperature (93–96 °C) and foil timing for honey browning."]
};
const WARM_TIPS={
  loaf:["Mix with water at the temperature shown above.","Shape at a lower rise as the dough gets warmer.","Use the coolest spot in the house, away from windows."],
  focaccia:["Aim for the lower end of 50–75% rise when warm.","Shorter warm-up on day 2: 1½–2½ h at 28–30 °C.","Cool water for the main mix."],
  pizza:["Stop bulk at about 20% if the dough is 27 °C or warmer.","Warm-up 2–3 h at 28–30 °C.","Keep balls covered so they don't skin over in air-conditioning."],
  sandwich:["At 27 °C+ pick the Warm (smaller seed) or Chill starter option above the ingredients.","Fridge-cold water for the main mix.","Bulk 5–7 h at 27–28 °C."]
};
const RULES=["Never use up the mother.","Build a separate levain for each bake.","For storage: feed, short start, fridge before peak.","Bake with the levain at peak.","Sour usually means hungry.","Follow the dough, not the clock.","Keep the ratios fixed.","Change one variable at a time, and log temperatures and times."];
const WEEK=[["Mon / Tue","Refresh the mother if it's been 7+ days","rest"],["Thu 07:00","Build the loaf levain","wait"],["Thu 12:15","Autolyse; 13:00 levain in; folds until 15:20","prep"],["Thu 17:00–19:00","Shape → fridge","cold"],["Fri 07:00","Preheat 250 °C; build the pizza levain","oven"],["Fri 08:00","Bake the loaf (out ~09:00, slice ~11:30)","oven"],["Fri 12:30","Mix pizza; 2 folds; bulk 20–30% (~16:00–18:00); ball → fridge","prep"],["Sat 12:30–13:00","Pizza balls out","wait"],["Sat 15:50","Ooni on","oven"],["Sat 16:30","Pizza","oven"]];
// booklet base builds (reference card); the recipe screens compute the build for the batch you set
const LEVAIN_TABLE=[["Loaf","20 + 70 + 70","160 / 150 g"],["Focaccia 23 × 33","20 + 50 + 50","120 / 100 g"],["Focaccia 30 × 40","25 + 75 + 75","175 / 160 g"],["Pizza","20 + 55 + 55","130 / 110 g"],["Sandwich stiff starter","15 starter + 15 honey + 30 water + 60 flour","120 g / all"]];
const OVENS=[["Loaf, covered","250 °C","230 °C","480 °F"],["Loaf, uncovered","220–225 °C","200–205 °C","430–435 °F"],["Focaccia","240–245 °C","220–225 °C","465–475 °F"],["Sandwich loaf","175 °C","~160 °C","350 °F"],["Pizza (Ooni stone)","420–450 °C","—","—"]];
