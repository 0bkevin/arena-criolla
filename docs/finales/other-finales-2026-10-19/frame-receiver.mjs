// Temporary loopback-only review server; forwards game modules to Vite.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = path.resolve('docs/finales/other-finales-2026-10-19/frames');
await fs.mkdir(base,{recursive:true});
http.createServer(async(req,res)=>{
  const match = req.url.match(/^\/__frames\/([a-z]+)$/);
  if(req.method==='POST' && match){
    try{
      const buffers=[]; let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>40000000)throw Error('batch too large');buffers.push(chunk);}
      await fs.mkdir(path.join(base,match[1]),{recursive:true});
      const data=Buffer.concat(buffers),headerSize=data.readUInt32LE(0);
      const lengths=JSON.parse(data.subarray(4,4+headerSize).toString());
      if(lengths.length!==36)throw Error('expected36frames');
      let offset=4+headerSize;
      await Promise.all(lengths.map((length,index)=>{
        const frame=data.subarray(offset,offset+length);offset+=length;
        return fs.writeFile(path.join(base,match[1],String(index).padStart(3,'0')+'.webp'),frame);
      }));
      res.writeHead(204);res.end();
    }catch(error){res.writeHead(400);res.end(String(error));}
    return;
  }
  if(req.url==='/'){
    res.setHeader('content-type','text/html');
    res.end('<!doctype html><html><body style="margin:0;background:#10151d;color:#fff;font:16px system-ui"><p id="status">Preparing actual renderer frames</p></body></html>');
    return;
  }
  const upstream=http.request({hostname:'127.0.0.1',port:5184,path:req.url,method:req.method,headers:{...req.headers,host:'localhost:5184'}},response=>{
    res.writeHead(response.statusCode,response.headers);response.pipe(res);
  });
  upstream.on('error',error=>{res.writeHead(502);res.end(String(error));});
  req.pipe(upstream);
}).listen(5190,'127.0.0.1',()=>process.stdout.write('Frame receiver ready on5190\n'));
