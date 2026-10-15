'use strict';
const fs=require('node:fs'),path=require('node:path');
const ENV='zhiyuanzhushou-d5ghren6ta5622bdc',COLLECTION='mgt_saves';
(async()=>{
 const {manager,wxCall}=await require('./owner-cloud.cjs')();
 // A failed metadata read must not be treated as an empty environment.
 const list=await wxCall('databasecollectionget',{env:ENV,limit:100,offset:0});
 if(list.pager&&list.pager.Total>100)throw Error('More than 100 collections; pagination audit required');
 const exists=(list.collections||[]).some(c=>c.name===COLLECTION);
 if(!exists){await wxCall('databasecollectionadd',{env:ENV,collection_name:COLLECTION});console.log('Created only '+COLLECTION);}
 const service=manager.commonService();
 const previous=await service.call({Action:'DescribeDatabaseACL',Param:{EnvId:ENV,CollectionName:COLLECTION}});
 if(exists&&previous.AclTag!=='ADMINONLY')throw Error('Existing game collection has unexpected permissions; refusing to alter it');
 if(!exists)await service.call({Action:'ModifyDatabaseACL',Param:{EnvId:ENV,CollectionName:COLLECTION,AclTag:'ADMINONLY'}});
 const verified=await service.call({Action:'DescribeDatabaseACL',Param:{EnvId:ENV,CollectionName:COLLECTION}});
 if(verified.AclTag!=='ADMINONLY')throw Error('Game storage is not private; cloud saves must stay disabled');
 const receipt={environment:ENV,collection:COLLECTION,acl:verified.AclTag,created:!exists,otherCollectionsModified:[]};
 fs.writeFileSync(path.resolve(__dirname,'../game-storage.local.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
})().catch(e=>{console.error('Game storage preparation failed:',e.code||e.message);process.exitCode=1;});
