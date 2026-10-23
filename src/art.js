"use strict";
function art(rid,u){
  u=u||rid+Math.random().toString(36).slice(2,7);
  const P='preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
  if(rid==="loaf"){
    let dust="";const pts=[[150,96],[172,84],[205,80],[238,86],[256,99],[190,92],[222,95],[165,108],[246,110],[200,104],[182,100],[232,104]];
    pts.forEach(([x,y],i)=>dust+=`<circle cx="${x}" cy="${y}" r="${1.2+(i%3)*.7}" fill="#FFF7EA" opacity="${.55+(i%2)*.3}"/>`);
    return `<svg ${P}><defs>
<linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9683A"/><stop offset="1" stop-color="#8E3F1F"/></linearGradient>
<radialGradient id="${u}l" cx=".42" cy=".32" r=".8"><stop offset="0" stop-color="#E9B271"/><stop offset=".45" stop-color="#C27A3C"/><stop offset="1" stop-color="#6E3416"/></radialGradient>
<linearGradient id="${u}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8A5A36"/><stop offset="1" stop-color="#5E3A22"/></linearGradient></defs>
<rect width="400" height="240" fill="url(#${u}b)"/>
<circle cx="340" cy="30" r="90" fill="#F2B27F" opacity=".14"/><circle cx="40" cy="220" r="70" fill="#3B2A20" opacity=".18"/>
<ellipse cx="205" cy="205" rx="165" ry="34" fill="url(#${u}w)"/><ellipse cx="205" cy="199" rx="160" ry="28" fill="#9C6A43"/>
<ellipse cx="205" cy="196" rx="112" ry="14" fill="#3B2A20" opacity=".35"/>
<path d="M95 170 C 95 95, 150 62, 205 62 C 262 62, 318 95, 316 170 C 300 192, 110 194, 95 170 Z" fill="url(#${u}l)"/>
<path d="M140 128 C 170 92, 228 82, 276 104" stroke="#F6D7A6" stroke-width="9" fill="none" stroke-linecap="round" opacity=".95"/>
<path d="M140 132 C 172 100, 226 90, 274 110" stroke="#7A3A18" stroke-width="3" fill="none" stroke-linecap="round" opacity=".55"/>
${dust}
<g stroke="#F6D7A6" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".9"><path d="M42 40 C 60 70, 66 104, 64 150"/>
<path d="M50 62 q-14 -2 -18 -14 q14 0 18 14Z M52 80 q-15 -1 -20 -13 q15 -1 20 13Z M55 98 q-15 0 -21 -12 q15 -2 21 12Z M54 66 q12 -6 22 -1 q-10 9 -22 1Z M57 85 q12 -6 22 -1 q-10 9 -22 1Z M60 104 q12 -6 22 -1 q-10 9 -22 1Z" fill="#F6D7A6" stroke="none"/></g>
</svg>`}
  if(rid==="focaccia"){
    let dim="",salt="",ros="";
    for(let r=0;r<4;r++)for(let c=0;c<7;c++){const x=104+c*32+(r%2)*15,y=92+r*26;dim+=`<ellipse cx="${x}" cy="${y}" rx="8" ry="6" fill="#B9782E" opacity=".75"/><ellipse cx="${x-1}" cy="${y-1.5}" rx="4.5" ry="3" fill="#F7D995" opacity=".8"/>`}
    [[120,80],[180,120],[250,90],[290,140],[150,150],[220,160],[310,100],[200,100]].forEach(([x,y],i)=>{ros+=`<g transform="translate(${x} ${y}) rotate(${i*41})"><path d="M-12 0 L12 0" stroke="#4F5D2E" stroke-width="2"/>${[-9,-5,-1,3,7].map(o=>`<ellipse cx="${o}" cy="-3" rx="1.6" ry="4" fill="#5D6E35" transform="rotate(-30 ${o} -3)"/><ellipse cx="${o+2}" cy="3" rx="1.6" ry="4" fill="#6E7F3E" transform="rotate(30 ${o+2} 3)"/>`).join("")}</g>`});
    for(let i=0;i<36;i++){const x=95+((i*53)%225),y=78+((i*37)%95);salt+=`<rect x="${x}" y="${y}" width="3.2" height="2.4" rx=".6" fill="#FFFDF5" opacity=".9" transform="rotate(${i*23} ${x} ${y})"/>`}
    return `<svg ${P}><defs>
<linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8C9A5E"/><stop offset="1" stop-color="#55613A"/></linearGradient>
<linearGradient id="${u}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F1C46E"/><stop offset=".6" stop-color="#D99A45"/><stop offset="1" stop-color="#B0702C"/></linearGradient></defs>
<rect width="400" height="240" fill="url(#${u}b)"/><circle cx="360" cy="20" r="100" fill="#F1E4CF" opacity=".12"/>
<g transform="rotate(-4 200 125)"><rect x="70" y="58" width="262" height="150" rx="14" fill="#2E2A26"/><rect x="78" y="64" width="246" height="136" rx="20" fill="url(#${u}f)"/>
<rect x="78" y="64" width="246" height="136" rx="20" fill="none" stroke="#A9662A" stroke-width="3" opacity=".5"/>${dim}${ros}${salt}</g>
</svg>`}
  if(rid==="pizza"){
    let spots="",moz="",bas="";
    for(let i=0;i<22;i++){const a=i*0.2856*1,rr=92+((i*7)%9);const x=200+Math.cos(a)*rr,y=128+Math.sin(a)*rr*.92;spots+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${2+(i%3)}" fill="#2A1A10" opacity="${.55+(i%2)*.3}"/>`}
    [[170,110,20],[232,100,17],[210,150,21],[160,158,15],[250,145,16],[200,118,12]].forEach(([x,y,r],i)=>{moz+=`<path d="M${x-r} ${y} q${r*.3} -${r*.9} ${r} -${r*.8} q${r*.9} 0 ${r} ${r*.8} q-${r*.2} ${r*.9} -${r} ${r*.85} q-${r*.8} 0 -${r} -${r*.85}Z" fill="#FFF8EC"/><ellipse cx="${x-r*.2}" cy="${y-r*.3}" rx="${r*.4}" ry="${r*.22}" fill="#FFFFFF" opacity=".7"/>`});
    [[190,98,20],[244,126,-30],[178,138,60],[222,168,10]].forEach(([x,y,r])=>{bas+=`<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-11 0 Q0 -10 11 0 Q0 10 -11 0Z" fill="#3E7A2E"/><path d="M-9 0 L9 0" stroke="#7FB25E" stroke-width="1"/></g>`});
    return `<svg ${P}><defs>
<radialGradient id="${u}b" cx=".5" cy=".4" r=".9"><stop offset="0" stop-color="#6A3A26"/><stop offset="1" stop-color="#26170F"/></radialGradient>
<radialGradient id="${u}c" cx=".45" cy=".4" r=".6"><stop offset=".72" stop-color="#F2D29B"/><stop offset=".88" stop-color="#E0A35E"/><stop offset="1" stop-color="#B9733A"/></radialGradient>
<radialGradient id="${u}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#D2432C"/><stop offset="1" stop-color="#A92E1E"/></radialGradient></defs>
<rect width="400" height="240" fill="url(#${u}b)"/>
<g opacity=".5"><circle cx="40" cy="40" r="2" fill="#F7C9A6"/><circle cx="360" cy="200" r="2.5" fill="#F7C9A6"/><circle cx="340" cy="50" r="1.5" fill="#F7C9A6"/><circle cx="70" cy="190" r="1.8" fill="#F7C9A6"/></g>
<path d="M60 236 L120 182 L280 182 L340 236Z" fill="#8A5A36" opacity=".8"/>
<ellipse cx="200" cy="128" rx="108" ry="100" fill="url(#${u}c)"/>
<ellipse cx="200" cy="130" rx="86" ry="78" fill="url(#${u}s)"/>${spots}${moz}${bas}
<path d="M150 116 q2 -2 4 0 M260 160 q2 -2 4 0" stroke="#FCE9C8" stroke-width="1.5" fill="none"/>
</svg>`}
  // sandwich
  let crumb="";for(let i=0;i<40;i++){const x=232+((i*29)%92),y=118+((i*17)%78);crumb+=`<ellipse cx="${x}" cy="${y}" rx="${1+(i%3)*.8}" ry="${.8+(i%2)*.6}" fill="#E2C59A" opacity=".8"/>`}
  return `<svg ${P}><defs>
<linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9C99C"/><stop offset="1" stop-color="#C98F57"/></linearGradient>
<linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9652E"/><stop offset="1" stop-color="#8A4520"/></linearGradient>
<linearGradient id="${u}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#77808A"/><stop offset="1" stop-color="#4C535A"/></linearGradient></defs>
<rect width="400" height="240" fill="url(#${u}b)"/><circle cx="60" cy="30" r="90" fill="#FFF6E8" opacity=".25"/>
<rect x="0" y="200" width="400" height="40" fill="#8A5A36" opacity=".35"/>
<path d="M54 120 L66 206 L214 206 L226 120Z" fill="url(#${u}m)"/>
<path d="M50 124 C 50 72, 96 60, 140 60 C 184 60, 230 72, 230 124 Z" fill="url(#${u}t)"/>
<path d="M78 92 C 100 76, 180 76, 202 92" stroke="#E8A86A" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>
<g transform="rotate(6 280 150)"><path d="M228 128 C 228 92, 248 84, 280 84 C 312 84, 332 92, 332 128 L 332 206 L 228 206 Z" fill="#9E5326"/>
<path d="M236 130 C 236 100, 252 93, 280 93 C 308 93, 324 100, 324 130 L 324 200 L 236 200 Z" fill="#FBEBD0"/>${crumb}</g>
<path d="M60 216 h150" stroke="#3B2A20" stroke-width="3" opacity=".15" stroke-linecap="round"/>
</svg>`;
}
function jarSVG(level){
  const h=Math.max(10,Math.min(80,level));const y=100-h;
  return `<svg viewBox="0 0 80 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="16" y="4" width="48" height="12" rx="4" fill="var(--terra)"/>
<path d="M12 22 Q12 16 18 16 H62 Q68 16 68 22 V98 Q68 106 60 106 H20 Q12 106 12 98Z" fill="var(--card)" stroke="var(--line2)" stroke-width="2"/>
<clipPath id="jc"><path d="M14 22 Q14 18 18 18 H62 Q66 18 66 22 V98 Q66 104 60 104 H20 Q14 104 14 98Z"/></clipPath>
<g clip-path="url(#jc)"><rect x="10" y="${y}" width="60" height="${h+10}" fill="#EBD8B6"/><path d="M10 ${y} q10 -5 20 0 t20 0 t20 0 v6 h-60z" fill="#F6EAD3"/>
${[0,1,2,3,4,5,6].map(i=>`<circle cx="${20+i*7}" cy="${y+10+((i*13)%Math.max(8,h-10))}" r="${1.4+(i%3)}" fill="#fff" opacity=".8"/>`).join("")}</g>
<path d="M20 40 v40" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5"/></svg>`;
}
const ICON={
  recipes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14c0-5 3.6-8 8-8s8 3 8 8c0 2-1.5 3-3 3H7c-1.5 0-3-1-3-3z"/><path d="M9 9.5c1.5-1 4.5-1 6 0"/><path d="M6 20h12"/></svg>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8 14h3M8 17h6"/></svg>',
  timer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5"/></svg>',
  starter:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h10M8 3.5v3M16 3.5v3"/><path d="M6.5 8.5Q6.5 6.5 8.5 6.5h7q2 0 2 2V19a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z"/><path d="M6.5 13q2.75-1.5 5.5 0t5.5 0"/><circle cx="10" cy="17" r=".6" fill="currentColor"/><circle cx="14" cy="16" r=".6" fill="currentColor"/></svg>',
  ref:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chev:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.3"/><rect x="13.5" y="5" width="4" height="14" rx="1.3"/></svg>',
  prev:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM19 6.2v11.6a1 1 0 0 1-1.5.86L9.5 13a1.2 1.2 0 0 1 0-2l8-5.66A1 1 0 0 1 19 6.2z"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM5 6.2v11.6a1 1 0 0 0 1.5.86l8-5.66a1.2 1.2 0 0 0 0-2l-8-5.66A1 1 0 0 0 5 6.2z"/></svg>',
  expand:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  shrink:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
