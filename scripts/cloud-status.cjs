'use strict';
const path=require('node:path'),fs=require('node:fs');
const CI='C:/Users/32863/.workbuddy/binaries/node/workspace/node_modules/miniprogram-ci';
const ci=require(CI),api=require(CI+'/dist/ci/cloud/cloudapi'),common=require(CI+'/dist/common/cloud-api');
const OWNER='wx0ece3f0f726260d2',ENV='zhiyuanzhushou-d5ghren6ta5622bdc';
const project=new ci.Project({appid:OWNER,type:'miniProgram',projectPath:'D:/openaiwork/02zyzsHelper/zhiyuan-v4',privateKeyPath:'D:/openaiwork/02zyzsHelper/zhiyuan-v4/keys/private.'+OWNER+'.key'});
(async()=>{
 api.initCloudAPI(OWNER);const req={request:api.boundTransactRequest(project),transactType:common.TransactType.IDE};
 const {envList}=await common.tcbGetEnvironments({},req);const env=envList.find(e=>e.envId===ENV);if(!env)throw Error('Requested environment not found');
 const codeSecret=await api.get3rdCloudCodeSecret(project).catch(()=>'');
 const names=['config','user','goods','article','order','pay','payNotify','admin','cloudbase_auth','mgt_gateway'];
 const functions=await Promise.all(names.map(async name=>{try{const f=await common.scfGetFunctionInfo({namespace:ENV,region:'',functionName:name,codeSecret},req);return{name,status:f.status,runtime:f.Runtime,modified:f.ModTime,codeHash:f.CodeInfo&&f.CodeInfo.CodeSha256};}catch(e){return{name,error:String(e.code||e.message).slice(0,180)};}}));
 const result={environment:ENV,ownerAppid:OWNER,region:env.functions&&env.functions[0]&&env.functions[0].region,functions};
 fs.writeFileSync(path.join(__dirname,'../cloud-status.local.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error('Cloud inspection failed:',e.code||e.message);process.exitCode=1;});
