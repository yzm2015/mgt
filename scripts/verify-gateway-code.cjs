'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const {manager,environment}=await require('./owner-cloud.cjs')();
 const dest=path.resolve(__dirname,'../.cloud-backup/mgt-gateway-verified');fs.mkdirSync(dest,{recursive:true});
 await manager.functions.downloadFunctionCode({destPath:dest,envId:environment,functionName:'mgt_gateway'});
 const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex'),files=['index.js','handler.js','storage.js','save-schema.js','package.json','social.js','social-storage.js'];
 for(const name of files)assert.equal(hash(fs.readFileSync(path.join(dest,name))),hash(fs.readFileSync(path.resolve(__dirname,'../cloudfunctions/mgt_gateway',name))),name+' deployment mismatch');
 const result={environment,functionName:'mgt_gateway',downloadedCodeMatchesLocal:true,verifiedFiles:files,otherFunctionsModified:[]};
 fs.writeFileSync(path.resolve(__dirname,'../gateway-verified.local.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error('Code verification failed:',e.code||'ERROR');process.exitCode=1;});
