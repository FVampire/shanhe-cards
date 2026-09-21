import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve,extname,sep } from 'node:path';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const port=Number(process.env.PORT??5173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try{
  const relative=decodeURIComponent(new URL(req.url??'/', 'http://localhost').pathname);
  const path=resolve(root,'.'+relative);
  if(path!==resolve(root)&&!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  const target=(await stat(path).catch(()=>null))?.isFile()?path:resolve(root,'index.html');
  const data=await readFile(target);res.writeHead(200,{'Content-Type':mime[extname(target)]??'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data);
 }catch{res.writeHead(500);res.end('Build missing. Run npm run build first.');}
});
server.on('error',err=>{console.error(err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log('山河问道：http://127.0.0.1:'+port+' — Ctrl+C 关闭服务'));
