'use strict';
const fs=require('fs'),path=require('path');
(async()=>{
 const {manager,wxCall,environment}=await require('./owner-cloud.cjs')(),service=manager.commonService();
 const list=await wxCall('databasecollectionget',{env:environment,limit:100,offset:0});if(list.pager&&list.pager.Total>100)throw Error('Collection pagination review required');
 const report={environment,collections:[],otherCollectionsModified:[]};
 for(const name of ['mgt_races','mgt_scores']){
  const exists=(list.collections||[]).some(c=>c.name===name);
  if(!exists)await wxCall('databasecollectionadd',{env:environment,collection_name:name});
  const old=await service.call({Action:'DescribeDatabaseACL',Param:{EnvId:environment,CollectionName:name}});
  if(exists&&old.AclTag!=='ADMINONLY')throw Error('Unexpected existing collection ACL: '+name);
  if(!exists)await service.call({Action:'ModifyDatabaseACL',Param:{EnvId:environment,CollectionName:name,AclTag:'ADMINONLY'}});
  const verified=await service.call({Action:'DescribeDatabaseACL',Param:{EnvId:environment,CollectionName:name}});if(verified.AclTag!=='ADMINONLY')throw Error('ACL verification failed');
  report.collections.push({name,created:!exists,acl:verified.AclTag});
 }
 const index='mgt_daily_seconds_id';if(!(await manager.database.checkIndexExists('mgt_scores',index)).Exists)await manager.database.updateCollection('mgt_scores',{CreateIndexes:[{IndexName:index,MgoKeySchema:{MgoIsUnique:false,MgoIndexKeys:[{Name:'date',Direction:'1'},{Name:'seconds',Direction:'1'},{Name:'_id',Direction:'1'}]}}]});
 report.index=index;fs.writeFileSync(path.resolve(__dirname,'../../social-storage.local.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error('Social storage preparation failed:',e.code||e.errCode||'ERROR',String(e.message||'').slice(0,200));process.exitCode=1;});
