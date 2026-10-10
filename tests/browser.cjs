// Start a loopback-only static server, run the real-browser suite, then stop it.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server = http.createServer((req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep)||!fs.statSync(file).isFile())throw Error('not found');
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    fs.createReadStream(file).pipe(res);
  } catch {res.writeHead(404);res.end('Not found');}
});
server.on('error',error=>{console.error(error);process.exitCode=1;});
server.listen(8765,'127.0.0.1',()=>{
  const child=spawn(process.execPath,[path.join(__dirname,'run.cjs')],{stdio:'inherit'});
  child.on('error',error=>{console.error(error);server.close();process.exitCode=1;});
  child.on('exit',code=>{server.close();process.exitCode=code??1;});
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{child.kill(signal);server.close();});
});
