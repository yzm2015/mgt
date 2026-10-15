'use strict';
const fs=require('node:fs');
const OWNER='wx0ece3f0f726260d2',ENV='zhiyuanzhushou-d5ghren6ta5622bdc';
module.exports=async function(){
 const values={};for(const raw of fs.readFileSync('D:/openaiwork/02zyzsHelper/zhiyuan-v4/.env.secrets','utf8').split(/\r?\n/)){const m=raw.match(/^([A-Z_]+)\s*=\s*(.*)$/);if(m)values[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
 if(values.WX_APPID!==OWNER||!values.WX_SECRET)throw Error('Owner credentials missing or mismatched');
 const token=await fetch('https://api.weixin.qq.com/cgi-bin/stable_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credential',appid:OWNER,secret:values.WX_SECRET,force_refresh:false})}).then(r=>r.json());
 if(!token.access_token)throw Error('Owner authentication failed: '+token.errcode);
 async function wxCall(name,data){
  if(!['databasecollectionget','databasecollectionadd','getqcloudtoken'].includes(name))throw Error('Owner API action is outside the allowlist');
  const result=await fetch('https://api.weixin.qq.com/tcb/'+name+'?access_token='+encodeURIComponent(token.access_token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(r=>r.json());
  if(result.errcode)throw Error('Owner API '+name+' failed: '+result.errcode);return result;
 }
 const auth=await wxCall('getqcloudtoken',{lifespan:1800});
 const CloudBase=require('C:/Users/32863/.codex/tools/mgt-cloud/node_modules/@cloudbase/manager-node');
 const manager=new CloudBase({envId:ENV,region:'ap-shanghai',secretId:auth.secretid,secretKey:auth.secretkey,token:auth.token});
 return{manager,wxCall,environment:ENV,credentials:{secretId:auth.secretid,secretKey:auth.secretkey,sessionToken:auth.token}};
};
