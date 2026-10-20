import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
const report={};
for(const version of [2,3,4]) {
 const {data,info}=await sharp(`assets/source/finales/attack-overhaul/gomez/cavalry-v${version}-raw.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const w=info.width,h=info.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h),components=[];
 for(let i=0;i<w*h;i++){
  if(seen[i]||!data[i*4+3])continue;
  let head=0,tail=1,minX=w,minY=h,maxX=-1,maxY=-1,maxAlpha=0,core=0; queue[0]=i;seen[i]=1;
  while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w),a=data[p*4+3];minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxAlpha=Math.max(maxAlpha,a);if(a>=40)core++;
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,at=yy*w+xx;if(xx<0||yy<0||xx>=w||yy>=h||seen[at]||!data[at*4+3])continue;seen[at]=1;queue[tail++]=at;}
  }
  if(maxAlpha>1)components.push({pixels:tail,core,maxAlpha,bounds:[minX,minY,maxX,maxY]});
 }
 report[version]=components;
 console.log({version,big:components.filter(c=>c.core>=1000),small:components.filter(c=>c.core<1000)});
}
await writeFile('docs/finales/attack-overhaul/gomez/component-inspection.json',JSON.stringify(report,null,2)+'\n');
