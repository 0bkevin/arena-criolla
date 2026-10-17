import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';

// Repack the two generated pose sheets without painting or changing faces.
async function silhouettes(file) {
  const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height,channels}=info;
  const seen=new Int32Array(width*height),queue=new Int32Array(seen.length),bounds=[];
  let component=0;
  for(let p=0;p<seen.length;p++){
    if(seen[p]||data[p*channels+3]<40)continue;
    const label=++component;
    let head=0,tail=1,minX=width,minY=height,maxX=0,maxY=0;queue[0]=p;seen[p]=label;
    while(head<tail){
      const n=queue[head++],x=n%width,y=Math.floor(n/width);
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
      for(const next of [x>0?n-1:-1,x<width-1?n+1:-1,y>0?n-width:-1,y<height-1?n+width:-1]){
        if(next>=0&&!seen[next]&&data[next*channels+3]>=40){seen[next]=label;queue[tail++]=next;}
      }
    }
    if(tail>4000)bounds.push({minX,minY,maxX,maxY,pixels:tail,label});
  }
  const top=bounds.filter(b=>b.minY<height/4).sort((a,b)=>a.minX-b.minX);
  const bottom=bounds.filter(b=>b.minY>=height/4).sort((a,b)=>a.minX-b.minX);
  if(top.length!==2||bottom.length!==2||bounds.length!==4)throw Error('Expected four isolated poses: '+file);
  return {bounds:[...top,...bottom],data,info,seen};
}
const sheets=['assets/source/capriles-v22-ready.png','assets/source/capriles-v22-action.png'];
const cell=768,bodyHeight=680,baseline=738,layers=[],audit=[];
for(let group=0;group<sheets.length;group++){
  const file=sheets[group],{bounds,data,info,seen}=await silhouettes(file);
  const reference=group===0?bounds[0]:bounds[1];
  const scale=bodyHeight/(reference.maxY-reference.minY+1);
  for(let n=0;n<bounds.length;n++){
    const b=bounds[n],frame=group*4+n,width=b.maxX-b.minX+1,height=b.maxY-b.minY+1;
    const outWidth=Math.round(width*scale),outHeight=Math.round(height*scale);
    if(outWidth>cell-40||outHeight>cell-40)throw Error('Pose too large: '+frame);
    // Rectangular crops can pick up neighboring feet when source rows overlap.
    // Retain only this connected silhouette and its own soft alpha edge.
    const isolated=Buffer.alloc(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const sx=b.minX+x,sy=b.minY+y,p=sy*info.width+sx;
      let own=seen[p]===b.label;
      if(!own&&data[p*4+3]<40){
        for(let dy=-2;dy<=2&&!own;dy++)for(let dx=-2;dx<=2;dx++){
          const nx=sx+dx,ny=sy+dy;
          if(nx>=0&&nx<info.width&&ny>=0&&ny<info.height&&seen[ny*info.width+nx]===b.label){own=true;break;}
        }
      }
      if(own)data.copy(isolated,(y*width+x)*4,p*4,p*4+4);
    }
    const buffer=await sharp(isolated,{raw:{width,height,channels:4}}).resize(outWidth,outHeight,{kernel:'lanczos3'}).png().toBuffer();
    const left=(frame%4)*cell+Math.floor((cell-outWidth)/2);
    const top=Math.floor(frame/4)*cell+baseline-outHeight;
    layers.push({input:buffer,left,top});
    audit.push({frame,file,bounds:b,scale,left,top,width:outWidth,height:outHeight});
  }
}
const source='assets/source/capriles-v22.png',webp='public/assets/capriles-v22.webp';
await sharp({create:{width:cell*4,height:cell*2,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(source);
await sharp(source).webp({lossless:true,effort:6}).toFile(webp);
await writeFile('docs/characters-v22/atlas-packing.json',JSON.stringify({source,webp,cell,bodyHeight,baseline,frames:audit},null,2)+'\n');
console.log('Packed eight poses: '+source+' / '+webp);
