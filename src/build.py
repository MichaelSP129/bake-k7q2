import base64,io,os,json,hashlib,shutil
from PIL import Image,ImageDraw,ImageFilter
D=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.normpath(os.path.join(D,'..'))
def b64(p): return base64.b64encode(open(os.path.join(D,p),'rb').read()).decode()
def icon(sz,k=1.0):
    """App icon: loaf on a terracotta gradient. k<1 shrinks the artwork towards the centre (maskable safe zone)."""
    S=sz*4; im=Image.new('RGB',(S,S),'#B5562F'); d=ImageDraw.Draw(im)
    for i in range(S):
        t=i/S; c=tuple(int(a+(b-a)*t) for a,b in zip((0xC9,0x68,0x3A),(0x8E,0x3F,0x1F))); d.line([(0,i),(S,i)],fill=c)
    P=lambda v: S*(.5+(v-.5)*k)
    B=lambda a,b,c,e: [P(a),P(b),P(c),P(e)]
    d.ellipse(B(.14,.70,.86,.86),fill=(0x5E,0x3A,0x22))
    loaf=Image.new('RGBA',(S,S),(0,0,0,0)); ld=ImageDraw.Draw(loaf)
    ld.chord(B(.18,.26,.82,1.02),180,360,fill=(0xC2,0x7A,0x3C)); ld.rectangle(B(.18,.62,.82,.76),fill=(0xC2,0x7A,0x3C))
    ld.ellipse(B(.18,.66,.82,.82),fill=(0xC2,0x7A,0x3C))
    hl=Image.new('RGBA',(S,S),(0,0,0,0)); hd=ImageDraw.Draw(hl); hd.ellipse(B(.26,.30,.62,.6),fill=(0xEC,0xB8,0x78,150)); hl=hl.filter(ImageFilter.GaussianBlur(S*.05*k))
    loaf=Image.alpha_composite(loaf,Image.composite(hl,Image.new('RGBA',(S,S),(0,0,0,0)),loaf.split()[3]))
    im.paste(loaf,(0,0),loaf); d=ImageDraw.Draw(im)
    d.arc(B(.30,.36,.78,.86),200,290,fill=(0xF6,0xD7,0xA6),width=int(S*.035*k))
    return im.resize((sz,sz),Image.LANCZOS)
os.makedirs(os.path.join(OUT,'icons'),exist_ok=True)
icons={'icon-192.png':icon(192),'icon-512.png':icon(512),'icon-maskable-512.png':icon(512,.74),'apple-touch-icon.png':icon(180)}
for n,im in icons.items(): im.save(os.path.join(OUT,'icons',n),'PNG',optimize=True)
icons['icon-512.png'].save(os.path.join(D,'icon512.png'))
css=open(os.path.join(D,'app.css')).read().replace('__FRAUNCES__',b64('fraunces.woff2')).replace('__SOURCESANS__',b64('sourcesans.woff2'))
h=open(os.path.join(D,'shell.html')).read()
for k,v in {'__CSS__':css,'__DATA__':open(os.path.join(D,'data.js')).read(),'__CORE__':open(os.path.join(D,'core.js')).read(),'__ART__':open(os.path.join(D,'art.js')).read(),'__APP__':open(os.path.join(D,'app.js')).read()}.items():
    h=h.replace(k,v)
manifest={"name":"Michael's Baking","short_name":"Baking","description":"Sourdough loaf, focaccia, pizza and sandwich loaf: scaling, planner and bake-day timer.",
  "id":"./","start_url":"./","scope":"./","display":"standalone","orientation":"portrait","lang":"en-GB",
  "background_color":"#FBF6EE","theme_color":"#FBF6EE",
  "icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},
           {"src":"icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},
           {"src":"icons/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
mj=json.dumps(manifest,indent=1,ensure_ascii=False)
open(os.path.join(OUT,'index.html'),'w').write(h)
open(os.path.join(OUT,'manifest.webmanifest'),'w').write(mj)
hs=hashlib.sha256((h+mj).encode())
for n in sorted(icons): hs.update(open(os.path.join(OUT,'icons',n),'rb').read())
ver=hs.hexdigest()[:10]
open(os.path.join(OUT,'sw.js'),'w').write(open(os.path.join(D,'sw.js')).read().replace('__VERSION__',ver))
print('built',len(h)//1024,'KB · sw version',ver)
