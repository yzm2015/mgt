'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ci=require('C:/Users/32863/.workbuddy/binaries/node/workspace/node_modules/miniprogram-ci');
const OWNER='wx0ece3f0f726260d2',ENV='zhiyuanzhushou-d5ghren6ta5622bdc',NAME='mgt_gateway';
(async()=>{
 const backup=path.resolve(__dirname,'../.cloud-backup/mgt-gateway-before-save');
 for(const name of ['handler.js','index.js','package.json'])if(!fs.existsSync(path.join(backup,name)))throw Error('Verified cloud code backup required before updating');
 const project=new ci.Project({appid:OWNER,type:'miniProgram',projectPath:'D:/openaiwork/02zyzsHelper/zhiyuan-v4',privateKeyPath:'D:/openaiwork/02zyzsHelper/zhiyuan-v4/keys/private.'+OWNER+'.key'});
 const r=await ci.cloud.uploadFunction({project,name:NAME,path:path.resolve(__dirname,'../cloudfunctions',NAME),env:ENV,remoteNpmInstall:true});
 const receipt={environment:ENV,functionName:NAME,version:2,filesCount:r.filesCount,packSize:r.packSize,backupHandlerHash:crypto.createHash('sha256').update(fs.readFileSync(path.join(backup,'handler.js'))).digest('hex'),otherFunctionsModified:[]};
 fs.writeFileSync(path.resolve(__dirname,'../gateway-update.local.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
})().catch(e=>{console.error('Gateway update failed:',e.code||e.message);process.exitCode=1;});
