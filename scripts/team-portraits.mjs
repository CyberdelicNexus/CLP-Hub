/**
 * Team card portraits (D-122): fits each transparent cut-out in
 * public/landing/media/portraits/Transparent onto one 600x900 canvas with the
 * same head height and head-top line, face centred, stray shapes (Sila's dog)
 * removed and cut edges feathered. Head top, chin and face centre per photo
 * were read off a gridded contact sheet; adjust them in P for a new photo.
 *
 *   node scripts/team-portraits.mjs public/landing/media/portraits/cards
 */
import sharp from 'sharp';
import fs from 'node:fs';

const D='public/landing/media/portraits/Transparent/', OUT=process.argv[2];
// top, chin, face-centre x as fractions of the source (read off a gridded sheet)
const P=[
 ["david-glowacki","david-glowacki.png",.076,.395,.58],
 ["joe-hardy","joe-hardy 1.png",.036,.345,.47],
 ["justin-wall","justin-wall 1.png",.066,.57,.50],
 ["valerie-bonnelle","Valérie+Bonnelle 1.png",.139,.51,.64],
 ["sila-sobrado","20240711_193214+(1) (1) 1.png",.027,.46,.175],
 ["catherine-andreu","cathherine-andrew.png",.038,.39,.475],
 ["jose-montemayor","JEMA Headshot_Color_2 1.png",.018,.61,.50],
 ["joana-vidal","joana-hero 1.png",.092,.48,.47],
];
const CW=600,CH=900,TOP=70,HEAD=324,MAXOFF=0.15*CW,FEATHER=0.14;
(async()=>{fs.mkdirSync(OUT,{recursive:true});
for(const [slug,f,t,c,cx] of P){
 let {data,info}=await sharp(D+f).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const W=info.width,H=info.height,A=(x,y)=>data[(y*W+x)*4+3];
 // keep only the largest opaque component (drops the dog from Sila's photo)
 const lab=new Int32Array(W*H).fill(-1);let best=-1,bestN=0,id=0;
 for(let i=0;i<W*H;i++){if(lab[i]>=0||data[i*4+3]<=16)continue;let n=0;const st=[i];lab[i]=id;
  while(st.length){const p=st.pop();n++;const x=p%W,y=(p-x)/W;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const q=Y*W+X;if(lab[q]<0&&data[q*4+3]>16){lab[q]=id;st.push(q);}}}
  if(n>bestN){bestN=n;best=id;}id++;}
 for(let i=0;i<W*H;i++)if(data[i*4+3]>16&&lab[i]!==best&&lab[i]>=0)data[i*4+3]=0;
 // which borders the cut-out touches
 const touch={l:false,r:false,b:false};
 for(let y=0;y<H;y++){if(A(0,y)>128)touch.l=true;if(A(W-1,y)>128)touch.r=true;}
 for(let x=0;x<W;x++)if(A(x,H-1)>128)touch.b=true;
 const s=HEAD/((c-t)*H);
 let left=CW/2-cx*W*s;const top=TOP-t*H*s;const w=W*s,h=H*s;
 // a cut side edge inside the canvas: shift the face (up to 15% of the width) to hide it
 if(touch.l&&left>0)left=Math.max(left-MAXOFF,0)===0?0:left-Math.min(left,MAXOFF);
 if(touch.r&&left+w<CW)left+=Math.min(CW-(left+w),MAXOFF);
 // feather any cut edge that still lands inside the canvas
 const fl=touch.l&&left>0.5, fr=touch.r&&left+w<CW-0.5, fb=touch.b&&top+h<CH-0.5;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){let k=1;
  if(fl)k*=Math.min(1,x/(FEATHER*W));if(fr)k*=Math.min(1,(W-1-x)/(FEATHER*W));if(fb)k*=Math.min(1,(H-1-y)/(FEATHER*1.6*H));
  if(k<1){const i=(y*W+x)*4+3;data[i]=Math.round(data[i]*k*k*(3-2*k));}}
 const img=await sharp(data,{raw:{width:W,height:H,channels:4}}).resize(Math.round(w),Math.round(h)).png().toBuffer();
 // place on the canvas, cropping whatever falls outside it
 const L=Math.round(left),T=Math.round(top);
 const ex={left:Math.max(0,-L),top:Math.max(0,-T)};ex.width=Math.min(Math.round(w)-ex.left,CW-Math.max(L,0));ex.height=Math.min(Math.round(h)-ex.top,CH-Math.max(T,0));
 const part=await sharp(img).extract(ex).toBuffer();
 await sharp({create:{width:CW,height:CH,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:part,left:Math.max(L,0),top:Math.max(T,0)}]).webp({quality:88,alphaQuality:90}).toFile(`${OUT}/${slug}.webp`);
 console.log(slug,{s:s.toFixed(2),touch,fl,fr,fb});
}})();
