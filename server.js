'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assets = new Set(['/test.html', '/src/salvage-core.js', '/src/salvage-app.js', '/src/neo-art.js', '/src/social.js', '/src/stages.js', '/src/progression.js', '/src/missions.js', '/src/scene3d.js']);
const port = Number(process.env.PORT) || 8766;
http.createServer((req,res)=>{
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { res.writeHead(400).end(); return; }
  if(pathname === '/') pathname = '/test.html';
  if(!assets.has(pathname)){res.writeHead(404).end('Not found');return;}
  fs.readFile(path.join(__dirname,pathname),(err,data)=>{
    if(err){res.writeHead(500).end('Asset unavailable');return;}
    res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(data);
  });
}).listen(port,'127.0.0.1',()=>console.log('Magnet Crew: http://127.0.0.1:'+port));
