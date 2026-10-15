'use strict';
const fs=require('node:fs'),path=require('node:path');
const CI='C:/Users/32863/.workbuddy/binaries/node/workspace/node_modules/miniprogram-ci';
const ci=require(CI),api=require(CI+'/dist/ci/cloud/cloudapi'),common=require(CI+'/dist/common/cloud-api');
const {zipFile,zipToBuffer}=require(CI+'/dist/ci/cloud/utils');
const OWNER='wx0ece3f0f726260d2',ENV='zhiyuanzhushou-d5ghren6ta5622bdc',NAME=process.argv[2]||'mgt_gateway';
if(!['mgt_gateway','cloudbase_auth'].includes(NAME))throw Error('Deployment target is outside the game allowlist');
const project=new ci.Project({appid:OWNER,type:'miniProgram',projectPath:'D:/openaiwork/02zyzsHelper/zhiyuan-v4',privateKeyPath:'D:/openaiwork/02zyzsHelper/zhiyuan-v4/keys/private.'+OWNER+'.key'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 api.initCloudAPI(OWNER);const req={request:api.boundTransactRequest(project),transactType:common.TransactType.IDE};
 const codeSecret=await api.get3rdCloudCodeSecret(project).catch(()=>'');
 const info=name=>common.scfGetFunctionInfo({namespace:ENV,region:'',functionName:name,codeSecret},req);
 let existing;try{existing=await info(NAME);}catch(e){if(!/ResourceNotFound/.test(String(e.code||e.message)))throw e;}
 if(existing)throw Error('Refusing to overwrite existing '+NAME+'; inspect before updating');
 const {envList}=await common.tcbGetEnvironments({},req),env=envList.find(e=>e.envId===ENV);if(!env)throw Error('Expected environment missing');
 const ref=await info('user'),region=env.functions&&env.functions[0]&&env.functions[0].region;if(!region)throw Error('Environment region missing');
 const directory=path.resolve(__dirname,'../cloudfunctions',NAME),archive=zipFile(directory,{ignore:['node_modules']}),buffer=await zipToBuffer(archive);
 console.log('Creating only '+NAME+' in '+ENV+'; no existing function is updated.');
 await common.scfCreateFunction({functionName:NAME,code:{zipFile:buffer.toString('base64')},handler:'index.main',description:'Magnet Crew isolated connectivity gateway; no business database access',memorySize:128,timeout:10,environment:{variables:[]},role:'TCB_QcsRole',runtime:ref.runtime,namespace:ENV,region,stamp:'MINI_QCBASE',installDependency:true,codeSecret,clsLogsetId:env.logServices&&env.logServices[0]&&env.logServices[0].logsetId||'',clsTopicId:env.logServices&&env.logServices[0]&&env.logServices[0].topicId||''},req);
 for(let i=0;i<40;i++){
  await delay(2500);const f=await info(NAME);console.log(NAME+': '+f.status);
  if(f.status==='Active'){const receipt={environment:ENV,functionName:NAME,status:f.status,runtime:f.runtime,createdAt:new Date().toISOString(),sharingEnabled:false,existingFunctionsUpdated:[]};fs.writeFileSync(path.resolve(__dirname,'../cloud-deploy-'+NAME+'.local.json'),JSON.stringify(receipt,null,2));return;}
  if(/Failed/.test(f.status))throw Error('Function creation failed: '+f.status);
 }
 throw Error('Creation pending: check cloud-status before retrying');
})().catch(e=>{console.error('Deployment failed:',e.code||e.message);process.exitCode=1;});
