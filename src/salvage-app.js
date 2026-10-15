(function(root){
  'use strict';
  function start(platform,core){
    var canvas=platform.canvas,ctx=canvas.getContext('2d'),save=core.cleanSave(platform.load()),scene='home',mode='tour',game=null,buttons=[],drag=false,paused=false,last=0,toast='',toastTime=0,date=core.day(),paid=false,remoteSave=null,remoteLoading=false,cloudBusy=false,cloudMessage='',cloudConfirm='',restoreBackup=platform.loadRestoreBackup?platform.loadRestoreBackup():null;
    var social=typeof module!=='undefined'?require('./social'):root.MagnetSocial,profile=null,socialBusy=false,board=null,boardError='',race=null,raceMessage='',finishPending=null,challenge=null,lastChallenge='',pendingChallenge=null;
    var ink='#e5f4ff',cream='#060e1b',muted='#7393ad',orange='#65edff',green='#96ffd4',blue='#a48aff';
    var createArt=typeof module!=='undefined'?require('./neo-art'):root.createMagnetArt,art=createArt(ctx),visualTime=0;
    function persist(){return platform.save(save);}
    function event(n,d){platform.event(n,d||{});}
    function begin(m,serverRace,stageId){mode=m;var level=m==='daily'?4:(stageId||Math.min(save.level,core.stages.length));date=serverRace?serverRace.date:core.day();race=serverRace||null;raceMessage='';finishPending=null;game=new core.Game(core.hash(m==='daily'?date:'yard-'+save.level),level,m==='daily'?{magnet:0,cargo:0}:save.upgrades,m==='daily'?null:{stage:level});scene='play';paid=false;drag=false;event('yard_start',{mode:m,level:save.level});}
    function startDaily(){
      if(socialBusy){notice('正在连接，请稍候');return;}
      if(!profile||!platform.raceStart){begin('daily');return;}
      var openingScene=scene;socialBusy=true;platform.raceStart().then(function(r){socialBusy=false;if(scene!==openingScene)return;if(r.ok)begin('daily',r);else{notice('竞速连接失败，可重试或退出登录后本机试玩');}}).catch(function(){socialBusy=false;notice('竞速连接失败，请重试');});
    }
    function login(){if(socialBusy)return;if(!platform.login){notice('请在微信小游戏中登录');return;}socialBusy=true;platform.login().then(function(r){socialBusy=false;if(r.ok){profile=r.profile;if(platform.rememberLogin)platform.rememberLogin(true);notice('登录成功 · '+profile.name);}else notice('登录未完成，请检查网络后重试');}).catch(function(){socialBusy=false;notice('登录失败，请重试');});}
    function shareChallenge(){var seconds=game&&mode==='daily'&&scene==='result'?Math.ceil(game.time):scene==='leaderboard'&&board&&board.mine?board.mine.seconds:null;var d=scene==='leaderboard'&&board?board.date:seconds?date:core.day();platform.share(seconds?'我用 '+seconds+' 秒拆完整座工地，你能更快吗？':'今日同题已就绪，来磁吸拆迁队比一场！',social.query(d,seconds));event('challenge_share_opened',{mode:'daily'});}
    function openBoard(){scene='leaderboard';board=null;boardError='';if(!platform.leaderboard){boardError='请在微信小游戏中查看实时排行榜';return;}platform.leaderboard().then(function(r){if(r.ok)board=r;else boardError='排行榜暂不可用，点击刷新重试';}).catch(function(){boardError='读取失败，点击刷新重试';});}
    function submitRace(){if(!finishPending||socialBusy)return;socialBusy=true;raceMessage='成绩上传中…';var pending=finishPending;platform.raceFinish(pending.session,pending.seconds).then(function(r){socialBusy=false;if(finishPending!==pending)return;if(r.ok){finishPending=null;raceMessage='已上榜 · 今日最佳 '+r.best+' 秒';}else{raceMessage=r.code==='MGT_RACE_EXPIRED'?'本局凭证已过期，重新挑战可上榜':'上传未完成，点击重试';if(r.code==='MGT_RACE_EXPIRED')finishPending=null;}}).catch(function(){socialBusy=false;raceMessage='上传未完成，点击重试';});}
    function acceptChallenge(q){var c=social.parse(q,core.day());if(!c)return;var key=JSON.stringify(c);if(key===lastChallenge)return;lastChallenge=key;if(scene==='play'||scene==='module'||scene==='leave'){pendingChallenge=c;notice('已收到挑战，返回基地后可查看');return;}challenge=c;scene='challenge';drag=false;}
    function notice(s){toast=s;toastTime=2.5;}
    function box(x,y,w,h,color,r){ctx.fillStyle=color;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r||0);else ctx.rect(x,y,w,h);ctx.fill();}
    function line(x,y,x2,y2,color,width){ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
    function text(t,x,y,size,color,align){ctx.fillStyle=color||ink;ctx.font='bold '+size+'px sans-serif';ctx.textAlign=align||'left';ctx.textBaseline='alphabetic';ctx.fillText(t,x,y);}
    function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    function button(label,x,y,w,fn,secondary){
      var type=/登录|通行证/.test(label)?'user':/分享|邀请/.test(label)?'share':/返回基地/.test(label)?'home':/返回/.test(label)?'back':/满级/.test(label)?'check':/升级/.test(label)?'upgrade':/再次|再挑战|连接/.test(label)?'retry':'play';
      art.panel(x,y,w,46,secondary?'#102338':'#60e6f6');art.icon(type,x+25,y+23,21,secondary?orange:'#0b3447');text(label,x+(w+18)/2,y+29,14,secondary?ink:'#051322','center');buttons.push({x:x,y:y,w:w,h:46,fn:fn});
    }
    function iconButton(type,x,y,options){
      var o=options||{},small=o.small,r=small?17:27,color=o.enabled===false?'#526a80':o.color||orange;
      art.glow(function(){circle(x,y,r+3,'#10283b');},o.ready?color:'#18394b',o.ready?14:5);art.ring(x,y,r+3,'#264159',1);art.ring(x,y,r,color,1);
      if(o.progress!==undefined)art.ring(x,y,r+3,color,2.5,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.001,Math.min(1,o.progress)));
      if(o.ready)art.glow(function(){art.ring(x,y,r+3,color,1);},color,12);
      art.icon(type,x,y,small?18:25,color);
      if(o.badge!==undefined&&o.badge!==''){circle(x+22,y-19,11,'#132d43');text(String(o.badge),x+22,y-15,10,ink,'center');}
      if(o.label)text(o.label,x,y+39,10,o.enabled===false?muted:ink,'center');
      var w=small?44:92,h=small?44:78;buttons.push({x:x-w/2,y:y-(small?22:34),w:w,h:h,fn:o.action});
    }
    function navTile(type,label,x,y,w,fn){art.panel(x,y,w,46,'#0d2034');circle(x+27,y+23,16,'#173548');art.icon(type,x+27,y+23,22,orange);text(label,x+50,y+28,12,ink);art.icon('next',x+w-12,y+23,10,muted);buttons.push({x:x,y:y,w:w,h:46,fn:fn});}
    function chip(label,x,y,w){box(x,y,w,26,'#10243a',4);line(x,y+25,x+w,y+25,'#23506a',1);text(label,x+w/2,y+18,11,'#a7d3e9','center');}
    function bolt(x,y,scale){art.scrap(x,y,scale);}
    function truck(x,y,t){art.vehicle(x,y,t,game&&scene!=='home'&&scene!=='garage'&&game.boost>0,visualTime);}
    function building(b){art.building(b,visualTime);}
    function background(){art.background(visualTime,scene==='play'||scene==='leave'||scene==='result'||scene==='module');}
    function depot(){art.depot(visualTime);}
    function home(){
      text('MGC / 磁力工程局',25,38,10,muted);circle(300,34,3,green);text(platform.cloudStatus?({ready:'云端已连接',pending:'云端连接中',unavailable:'云端未连接'})[platform.cloudStatus()]:'离线试玩',312,38,10,green);
      text('磁吸拆迁队',24,98,43,ink);text('MAGNET CREW',26,121,10,orange);text('引爆磁场，拆掉整座未来城。',26,145,13,muted);
      art.hero(visualTime);
      [['help','操作指引',orange,function(){scene='guide';}],['route','关卡航图',blue,function(){scene='campaign';}],['cloud','云端存档',green,function(){openCloud();}]].forEach(function(item,i){var x=24+i*116;art.panel(x,450,110,74,'#0c1e31');circle(x+55,476,21,'#142d43');art.ring(x+55,476,23,item[2],1,visualTime*.2,visualTime*.2+Math.PI*1.4);art.icon(item[0],x+55,475,25,item[2]);text(item[1],x+55,512,11,ink,'center');buttons.push({x:x,y:450,w:110,h:74,fn:item[3]});});
      text('下一目标 / 第 '+String(Math.min(save.level,core.stages.length)).padStart(2,'0')+' 号区域',25,545,10,muted);text('CREDIT '+save.coins,365,545,10,orange,'right');
      button('启动拆解任务',25,557,340,function(){begin('tour');});navTile('garage','装备机库',25,615,163,function(){scene='garage';});navTile('daily','每日竞速',200,615,165,startDaily);
      navTile('user',profile?'我的通行证':(socialBusy?'登录中…':'微信登录'),25,672,163,function(){scene='account';});navTile('trophy','每日榜 / 分享',200,672,165,openBoard);
    }
    function garage(){
      box(0,0,390,720,cream);text('HANGAR / 模组装配',25,45,11,muted);text('装备你的磁场',25,93,30);chip('回收币 '+save.coins,25,117,132);truck(195,220,0);
      ['magnet','cargo'].forEach(function(id,i){var rank=save.upgrades[id],cost=core.cost(rank),y=284+i*146;box(24,y,342,132,'#0d2035',18);text(id==='magnet'?'磁力线圈':'牵引拖链',40,y+32,20);text('等级 '+rank+' / 5',346,y+30,12,muted,'right');text(id==='magnet'?'范围更大，拔除承重点更快':'每级增加 5 格载重，少跑回收站',40,y+58,12,muted);button(rank>=5?'已满级':'升级 · '+cost+' 币',40,y+74,310,function(){if(rank>=5)return;if(save.coins<cost){notice('回收币不足，先去拆一栋楼');return;}save.coins-=cost;save.upgrades[id]++;persist();notice('升级完成');event('upgrade',{type:id,rank:save.upgrades[id]});});});
      button('返回工地',25,621,340,function(){scene='home';},true);text('每日同题使用统一初始车辆，升级仅用于普通工地',195,697,10,muted,'center');
    }
    function play(){
      text(mode==='daily'?'DAILY RIFT / '+date:'NEO CITY / 第 '+String(game.level).padStart(2,'0')+' 号区域',24,35,10,muted);text(game.stage?game.stage.name:['离子工厂','双塔回廊','三角阵列'][game.variant],24,72,29,ink);text(String(game.score).padStart(5,'0'),366,70,23,orange,'right');
      chip('拆解 '+game.demolished+' / 3',24,91,102);chip('回收 '+game.delivered+' / '+game.quota,136,91,124);chip(Math.floor(game.time)+' SEC',270,91,96);
      var hint=game.cargo.length>=game.capacity()?'满载！呼叫无人机远程回收，继续连拆':game.demolished===3?'回收剩余金属，完成本区任务':game.activeBolt?'核心已锁定 · 脉冲可同时击穿附近核心':'拖动驾驶 → 靠近六边形核心 → 释放脉冲';text(hint,195,144,11,game.cargo.length>=game.capacity()?green:muted,'center');
      if(game.stage)text('支线 / '+game.stage.goalLabel+'  '+Math.min(game.stage.target,core.stageProgress(game))+'/'+game.stage.target,195,164,10,game.stage.color,'center');
      depot();var car=game.car,rad=game.radius();if(game.energy>=1){ctx.save();ctx.beginPath();ctx.rect(15,176,360,458);ctx.clip();ctx.setLineDash([3,8]);art.ring(car.x,car.y,game.pulseRadius(),'#3b3d68',1);ctx.restore();}circle(car.x,car.y,rad,game.boost>0?'rgba(164,138,255,.075)':'rgba(101,237,255,.035)');ctx.setLineDash([4,7]);art.ring(car.x,car.y,rad,game.boost>0?'#7365ac':'#20465c',1);ctx.setLineDash([]);
      game.buildings.slice().sort(function(a,b){return a.y-b.y;}).forEach(building);game.scrap.forEach(function(s){bolt(s.x,s.y,.65);});
      if(game.cargo.length){ctx.save();ctx.beginPath();ctx.moveTo(car.x,car.y);game.cargo.forEach(function(s){ctx.lineTo(s.x,s.y);});ctx.strokeStyle='rgba(101,237,255,.4)';ctx.lineWidth=1;ctx.stroke();ctx.restore();}
      game.cargo.slice().reverse().forEach(function(s){bolt(s.x,s.y,.8);});
      if(game.activeBolt){var a=game.activeBolt;art.glow(function(){line(car.x,car.y,a.x,a.y,'rgba(101,237,255,.3)',5);line(car.x,car.y,a.x,a.y,orange,1);},orange,10);}
      game.trail.forEach(function(t){ctx.globalAlpha=t.life/.25*.25;art.vehicle(t.x,t.y,t.heading,true,visualTime);ctx.globalAlpha=1;});truck(car.x,car.y,game.heading);
      (game.pulses||[]).forEach(function(p){var progress=1-p.life/p.max;ctx.globalAlpha=1-progress;art.glow(function(){art.ring(p.x,p.y,p.r*Math.pow(progress,.5),'#9c8aff',3);art.ring(p.x,p.y,p.r*Math.pow(progress,.5)*.85,orange,1);},blue,14);ctx.globalAlpha=1;});
      game.buildings.forEach(function(b){if(b.state==='falling')for(var i=0;i<14;i++){var a=i*2.399,dist=b.fall*72;ctx.globalAlpha=1-b.fall*.9;box(b.x+Math.cos(a)*dist,b.y+Math.sin(a)*dist*.6,4+i%3,3,i%2?blue:orange,1);ctx.globalAlpha=1;}});
      if(game.airlift&&game.airlift.life>0){var f=1-game.airlift.life/1.2;ctx.setLineDash([3,5]);line(car.x,car.y,67,584,green,1);ctx.setLineDash([]);circle(car.x+(67-car.x)*f,car.y+(584-car.y)*f,4,green);}
      if(game.combo>1&&game.time<game.comboUntil){text('CHAIN ×'+game.combo,25,204,19,orange);text('连续击破',25,221,9,muted);box(25,229,80,2,'#1b3047');box(25,229,80*Math.min(1,(game.comboUntil-game.time)/(game.moduleId==='arc'?6:4)),2,orange);}if(game.moduleId)text(({arc:'电弧共振',swarm:'回收蜂群',drive:'矢量超驱'})[game.moduleId],366,615,10,blue,'right');
      game.effects.forEach(function(e){ctx.globalAlpha=Math.min(1,e.life*2);text(e.text,Math.max(85,Math.min(305,e.x)),e.y-(1-e.life)*18,12,e.text.indexOf('坍塌')>=0?blue:green,'center');ctx.globalAlpha=1;});
      text('牵引载重 '+game.cargo.length+' / '+game.capacity(),25,645,10,muted);text('脉冲能量 '+Math.round(game.energy*100)+'%',365,645,10,orange,'right');
      art.panel(24,649,342,57,'#0b1d31');
      iconButton('drone',77,674,{color:green,label:'无人机',badge:game.dispatchCooldown>0?Math.ceil(game.dispatchCooldown):'',progress:1-game.dispatchCooldown/(game.moduleId==='swarm'?8:16),enabled:game.dispatchCooldown<=0&&game.cargo.length>0,action:function(){if(game.dispatch()){notice('运输无人机已接管货物');event('drone',{mode:mode});}else notice(game.cargo.length?'无人机正在返航，请稍候':'先吸取金属，再呼叫无人机');}});
      iconButton('dash',195,674,{color:blue,label:'推进',badge:game.dashCooldown>0?Math.ceil(game.dashCooldown):'',progress:1-game.dashCooldown/4,enabled:game.dashCooldown<=0,action:function(){if(game.dash())event('dash',{mode:mode});else notice('推进器冷却中');}});
      iconButton('pulse',313,674,{color:game.boost>0?blue:orange,label:game.boost>0?'超频':'脉冲',badge:game.boost>0?Math.ceil(game.boost):game.energy>=1?'':Math.round(game.energy*100)+'%',progress:game.boost>0?game.boost/(game.moduleId==='drive'?8:5):game.energy,enabled:game.energy>=1||game.boost>0,ready:game.energy>=1,action:function(){if(game.activate()){notice('脉冲释放！同时击穿范围内的核心');event('boost',{mode:mode});if(platform.feedback)platform.feedback('collapse');}else notice(game.boost>0?'超频中，继续靠近核心拆解':'回收金属可加速脉冲充能');}});
      iconButton('pause',346,30,{small:true,color:muted,action:function(){scene='leave';drag=false;}});
    }
    function subHeader(kind,title,eyebrow){box(0,0,390,720,cream);text(eyebrow,24,43,10,muted);art.icon(kind,42,91,31,orange);text(title,68,100,27,ink);}
    function guide(){
      subHeader('help','驾驶手册','PILOT GUIDE / 四步开拆');
      [['magnet','拖动驾驶，靠近锁定','靠近塔底六边形核心，自动拔除。'],['pulse','选好站位，一键引爆','青蓝脉冲圈内的核心会同时被击穿。'],['drone','满载交给运输无人机','远程卸货可充能；回收站也能卸货。'],['dash','推进突袭，连击构筑','先朝目标转向，再推进；首塔掉落模组。']].forEach(function(item,i){var y=143+i*106;art.panel(24,y,342,91,'#0b2034');art.icon(item[0],57,y+42,29,i%2?blue:orange);text(item[1],84,y+36,15,ink);text(item[2],84,y+61,10,muted);});
      text('按钮外环表示能量 / 冷却，右上角显示剩余秒数',195,598,10,muted,'center');button('返回基地',25,630,340,function(){scene='home';},true);
    }
    function records(){
      subHeader('trophy','任务档案','LOCAL ARCHIVE / 本机记录');var r=save.records;
      [['完成任务',r.completed,'check'],['最高得分',r.bestScore,'trophy'],['最高连击','×'+r.maxCombo,'pulse'],['累计回收',r.recovered,'cargo']].forEach(function(item,i){var x=24+(i%2)*176,y=142+Math.floor(i/2)*105;art.panel(x,y,166,94,'#0c2034');art.icon(item[2],x+23,y+23,18,orange);text(item[0],x+42,y+28,11,muted);text(String(item[1]),x+17,y+71,28,ink);});
      text('最近任务',24,382,14,ink);
      if(!r.recent.length){art.icon('trophy',195,450,42,muted);text('完成第一场任务，点亮你的档案',195,498,12,muted,'center');}
      r.recent.slice(0,4).forEach(function(item,i){var y=400+i*45;line(24,y+34,366,y+34,'#18344b');art.icon(item.mode==='daily'?'daily':'check',39,y+13,17,green);text(item.mode==='daily'?'每日竞速':'第 '+item.level+' 区',57,y+17,11,ink);text(item.score+' 分',232,y+17,12,orange,'right');text(item.seconds+'s · ×'+item.combo,362,y+17,11,muted,'right');});
      text('从本次更新起记录；仅保存在当前设备',195,607,10,muted,'center');button('返回基地',25,630,340,function(){scene='home';},true);
    }
    function cloudError(code){return({MGT_SAVE_CONFLICT:'云存档已被其他设备更新，请刷新后再选择',MGT_STORAGE_UNAVAILABLE:'云存档暂不可用，请稍后重试',MGT_SAVE_NOT_ENABLED:'云存档服务尚未就绪',CLOUD_TIMEOUT:'连接超时，本机进度未改变',MGT_BAD_SAVE:'存档格式校验失败，本机进度已保留'})[code]||'请求未完成，请检查连接后重试';}
    function refreshCloud(){
      if(!platform.cloudLoad)return;remoteLoading=true;cloudMessage='';
      platform.cloudLoad().then(function(r){remoteLoading=false;if(r.ok)remoteSave=r;else{remoteSave=null;cloudMessage=cloudError(r.code);}}).catch(function(){remoteLoading=false;cloudMessage='云端读取失败，本机进度未改变';});
    }
    function openCloud(){scene='cloud';remoteSave=null;refreshCloud();}
    function finishCloudAction(){
      if(cloudBusy)return;
      if(cloudConfirm==='undo'){if(restoreBackup){save=core.cleanSave(restoreBackup);persist();cloudMessage='已撤销恢复，回到之前的本机进度';}cloudConfirm='';scene='cloud';return;}
      if(!remoteSave||!remoteSave.ok){cloudConfirm='';scene='cloud';return;}
      if(cloudConfirm==='restore'){
        if(!remoteSave.save){cloudMessage='云端还没有备份';cloudConfirm='';scene='cloud';return;}
        if(platform.backupLocal&&!platform.backupLocal(save)){cloudMessage='无法保存本机回退副本，恢复已取消';cloudConfirm='';scene='cloud';return;}
        restoreBackup=core.cleanSave(save);save=core.cleanSave(remoteSave.save);if(persist()===false){save=core.cleanSave(restoreBackup);cloudMessage='本机存储写入失败，恢复已取消';cloudConfirm='';scene='cloud';return;}cloudMessage='已恢复云存档，可在下方撤销恢复';event('cloud_restored');cloudConfirm='';scene='cloud';return;
      }
      cloudBusy=true;var snapshot=core.cleanSave(save),revision=remoteSave.revision;
      platform.cloudSave(snapshot,revision).then(function(r){cloudBusy=false;cloudConfirm='';scene='cloud';if(r.ok){remoteSave={ok:true,save:snapshot,revision:r.revision,updatedAt:r.updatedAt};cloudMessage='备份成功 · 版本 '+r.revision;event('cloud_backup');}else{cloudMessage=cloudError(r.code);if(r.code==='MGT_SAVE_CONFLICT')remoteSave=null;}}).catch(function(){cloudBusy=false;cloudConfirm='';scene='cloud';cloudMessage='备份失败，本机进度未改变';});
    }
    function cloudPanel(){
      subHeader('cloud','云端存档','CLOUD VAULT / 手动备份与恢复');var status=platform.cloudStatus?platform.cloudStatus():'offline';
      art.panel(24,142,342,99,'#0b2034');art.icon('cloud',57,183,34,status==='ready'?green:orange);
      text(({ready:'云端已连接',pending:'正在连接',unavailable:'连接尚未完成',offline:'浏览器离线试玩'})[status]||'离线模式',86,181,18,ink);
      text('本机进度始终保留 · 公共排行榜尚未开放',86,209,10,muted);
      art.panel(24,258,342,174,'#0b2034');text('本机',40,287,12,orange);text('云端',218,287,12,green);
      text('第 '+save.level+' 区',40,323,23,ink);text(save.coins+' 回收币',40,350,12,muted);text('完成 '+save.records.completed+' 场',40,376,11,muted);
      if(remoteSave&&remoteSave.save){var data=core.cleanSave(remoteSave.save);text('第 '+data.level+' 区',218,323,23,ink);text(data.coins+' 回收币',218,350,12,muted);text('版本 '+remoteSave.revision,218,376,11,green);text('备份于 '+new Date(remoteSave.updatedAt+8*3600000).toISOString().slice(0,16).replace('T',' ')+' 北京时间',40,413,9,muted);}
      else text(remoteLoading?'读取中…':remoteSave?'暂无备份':'未读取',218,329,16,muted);
      if(status==='offline')text('浏览器离线试玩；微信内可使用存档和排行榜',195,463,11,muted,'center');else if(cloudMessage)text(cloudMessage,195,463,10,green,'center');else text('先备份再换设备；恢复会替换当前本机进度',195,463,10,muted,'center');
      if(platform.cloudSave){
        navTile('upload','备份本机',25,484,163,function(){if(!remoteLoading&&!cloudBusy&&remoteSave){cloudConfirm='backup';scene='cloud-confirm';}else notice('请先成功读取云端版本');});
        navTile('download','恢复云端',200,484,165,function(){if(!remoteLoading&&!cloudBusy&&remoteSave&&remoteSave.save){cloudConfirm='restore';scene='cloud-confirm';}else notice('云端还没有可恢复的备份');});
        navTile('retry','刷新存档',25,542,163,function(){if(!remoteLoading&&!cloudBusy)refreshCloud();});
        if(restoreBackup)navTile('back','撤销恢复',200,542,165,function(){cloudConfirm='undo';scene='cloud-confirm';});
      }else if(platform.cloudRetry)button(status==='pending'?'连接中':'重新连接',25,516,340,function(){if(status!=='pending')platform.cloudRetry();},true);
      text('备份不是公共排名或支付凭证',195,607,10,muted,'center');button('返回基地',25,630,340,function(){scene='home';},true);
      if(scene==='cloud-confirm'){
        buttons=[];box(0,0,390,720,'rgba(2,8,18,.96)');art.panel(24,225,342,287,'#0b2034');
        art.icon(cloudConfirm==='backup'?'upload':'download',195,269,36,orange);text(cloudConfirm==='backup'?'确认备份本机？':cloudConfirm==='undo'?'撤销这次恢复？':'确认恢复云端？',195,315,23,ink,'center');
        text(cloudConfirm==='backup'?'将以本机进度更新云端备份，保留本机数据':cloudConfirm==='undo'?'将切回恢复前保留的本机副本':'将替换本机进度；恢复前会保留一份回退副本',195,349,10,muted,'center');
        button(cloudBusy?'正在备份…':'确认',44,385,302,finishCloudAction,cloudBusy);button('取消',44,445,302,function(){if(!cloudBusy){cloudConfirm='';scene='cloud';}},true);
      }
    }
    function moduleChoice(){
      buttons=[];box(0,0,390,720,'rgba(2,8,18,.94)');
      text('FIELD UPGRADE / 战术补给',24,145,10,orange);text('选择你的拆解流派',24,186,28,ink);text('第一座塔已拆除 · 免费装载一枚模组',24,215,12,muted);
      [['arc','01 / ARC','电弧共振','脉冲范围 +30 · 冲击扩散更远','连击窗口延长至 6 秒',orange],['swarm','02 / SWARM','回收蜂群','载重 +8 · 无人机冷却减半','少跑运输，专心拆塔',green],['drive','03 / DRIVE','矢量超驱','移速、磁吸范围和充能提升','超频持续时间延长至 8 秒',blue]].forEach(function(m,i){
        var y=246+i*107;art.panel(24,y,342,94,'#0b2034');text(m[1],40,y+20,9,m[5]);text(m[2],40,y+46,21,ink);text(m[3],40,y+67,11,muted);text(m[4],40,y+83,10,m[5]);
        art.ring(326,y+43,15,m[5],1);text('+',326,y+49,21,m[5],'center');
        buttons.push({x:24,y:y,w:342,h:94,fn:function(){if(game.chooseModule(m[0])){scene='play';drag=false;notice(m[2]+' 已装载 · 脉冲能量充满');event('module_selected',{type:m[0]});}}});
      });
      text('仅本局生效 · 选择期间计时暂停',195,607,11,muted,'center');
    }
    function result(){
      box(0,0,390,720,'rgba(2,8,18,.92)');box(24,139,342,448,cream,23);text('区域拆解完成',195,195,35,ink,'center');text('MISSION COMPLETE / 磁场已净空',195,225,15,muted,'center');truck(195,287,0);text('3 栋建筑 / '+game.delivered+' 件回收',195,352,18,ink,'center');text(Math.ceil(game.time)+' 秒完成 · '+(mode==='daily'?'同题记录':'回收币 +'+(game.delivered+30+game.contractBonus)),195,384,14,orange,'center');if(mode==='daily')text('本机今日最快 '+save.dailyBest[date]+' 秒',195,414,12,muted,'center');else text('最高连击 ×'+game.maxCombo+'  /  '+game.score+' 分',195,414,12,blue,'center');
      if(mode==='tour'&&game.contractBonus)text('6 连击委托达成 · 额外 +25 币',195,432,10,green,'center');
      button(mode==='daily'?'再挑战一次':game.level===core.stages.length?'首章完成 · 返回航图':'下一工地',44,438,302,function(){if(mode==='daily')startDaily();else if(game.level===core.stages.length)scene='campaign';else begin('tour',null,game.level+1);});button('返回基地',44,496,144,function(){scene='home';},true);button(mode==='daily'?'分享战绩':'邀请挑战',202,496,144,shareChallenge,true);text(raceMessage||(mode==='daily'?'登录后开局可上传每日榜':'普通工地成绩保存在本机'),195,565,10,muted,'center');if(game.stage){for(var si=0;si<3;si++)art.icon('star',165+si*30,601,22,si<core.stageStars(game)?'#ffbd72':'#304154');}else if(challenge&&!challenge.expired&&challenge.date===date&&challenge.target){text(Math.ceil(game.time)<challenge.target?'挑战成功 · 比好友快 '+(challenge.target-Math.ceil(game.time))+' 秒':'好友目标 '+challenge.target+' 秒 · 再试一次！',195,602,12,orange,'center');}if(mode==='daily'){buttons.push({x:44,y:540,w:302,h:40,fn:finishPending?submitRace:openBoard});}
    }

    function campaignPanel(){
      subHeader('route','城市拆解航图','CHAPTER 01 / 八座独立工地');
      var totalStars=Object.keys(save.stageBest).reduce(function(n,key){return n+save.stageBest[key].stars;},0);text('已收集 '+totalStars+' / 24 任务星章 · 支线目标可重玩达成',24,133,10,muted);
      core.stages.forEach(function(stage,i){var x=24+i%2*176,y=151+Math.floor(i/2)*101,locked=stage.id>save.level,record=save.stageBest[stage.id];
        art.panel(x,y,166,91,locked?'#0b1625':'#0d2337');circle(x+26,y+25,15,locked?'#132132':'#17394a');art.icon(locked?'lock':stage.icon,x+26,y+25,21,locked?muted:stage.color);text(String(stage.id).padStart(2,'0')+' / '+stage.subtitle,x+48,y+23,9,muted);text(stage.name,x+15,y+55,19,locked?muted:ink);
        for(var j=0;j<3;j++)art.icon('star',x+20+j*19,y+75,13,record&&j<record.stars?'#ffbd72':'#304455');text(locked?'待解锁':record?record.seconds+'s':'开始任务',x+151,y+79,10,locked?muted:stage.color,'right');
        buttons.push({x:x,y:y,w:166,h:91,fn:function(){if(locked)notice('先完成前一座工地即可解锁');else begin('tour',null,stage.id);}});
      });
      text('通关、目标用时、支线任务各得一星',195,578,11,muted,'center');
      navTile('trophy','本机档案',25,599,163,function(){scene='records';});navTile('daily','每日竞速',200,599,165,startDaily);button('返回基地',25,660,340,function(){scene='home';},true);
    }
    function accountPanel(){
      subHeader('user','工程师通行证','WECHAT ID / 微信身份');
      art.panel(24,150,342,180,'#0b2034');art.icon('user',195,197,42,orange);
      text(profile?profile.name:'游客工程师',195,256,24,ink,'center');text(profile?'已登录 · 跨设备识别同一账号':'登录后可参加每日竞速排行榜',195,293,11,muted,'center');
      text('仅使用微信平台身份，不读取头像、昵称或手机号',195,376,10,muted,'center');text('榜单公开展示系统代号和今日最佳用时',195,400,11,muted,'center');
      button(profile?'退出本次登录':socialBusy?'正在登录…':'微信一键登录',25,444,340,function(){if(socialBusy)return;if(profile){profile=null;if(platform.rememberLogin)platform.rememberLogin(false);notice('已退出，仍可本机试玩');}else login();});
      navTile('cloud','云端存档',25,507,163,openCloud);navTile('trophy','每日排行',200,507,165,openBoard);
      button('返回基地',25,630,340,function(){scene='home';},true);
    }
    function leaderboardPanel(){
      subHeader('trophy','每日竞速榜','DAILY RANK / 每日北京时间重置');
      text(board?board.date+' · 统一车辆 / 用时越短越靠前':'正在连接今日榜单',24,133,11,muted);
      if(board){if(!board.entries.length)text('今日首位工程师，等你登榜',195,255,16,orange,'center');
        board.entries.slice(0,8).forEach(function(r,i){var y=161+i*40;art.panel(24,y,342,35,r.mine?'#173e50':'#0c2034');text(String(i+1).padStart(2,'0'),39,y+24,13,i<3?orange:muted);text(r.name+(r.mine?' · 我':''),78,y+24,12,ink);text(r.seconds+'s',350,y+24,16,green,'right');});
        text(board.mine?'我的今日最佳 '+board.mine.seconds+'s · 第 '+board.mine.rank+' 名（同分同名次）':'今日还未上榜，完成一次登录后的每日竞速即可',195,511,10,orange,'center');
      }else text(boardError||'正在读取…',195,275,12,muted,'center');
      text('展示前 8 名 · 休闲榜，无排名奖励',195,541,10,muted,'center');
      navTile('retry','刷新',25,559,105,openBoard);navTile('share','挑战',137,559,105,shareChallenge);navTile('daily','竞速',249,559,116,function(){if(!profile){scene='account';notice('先登录再参加上榜竞速');}else startDaily();});
      button('返回基地',25,630,340,function(){scene='home';},true);
    }
    function challengePanel(){
      subHeader('share','好友挑战书','SAME YARD / 同题比一场');art.panel(24,158,342,228,'#0c2034');art.icon('daily',195,207,45,orange);
      text(challenge.expired?'这份挑战已过期':'今日同题挑战',195,269,26,ink,'center');text(challenge.expired?'每日地图已更新，一起挑战今天的工地':challenge.target?'好友目标 '+challenge.target+' 秒 · 试着超越 TA':'三座建筑，同一辆车，比比谁拆得快',195,315,12,orange,'center');text('挑战日期 '+challenge.date,195,353,11,muted,'center');
      button('接受今日挑战',25,442,340,startDaily);navTile('user',profile?'已登录':'登录上榜',25,505,163,function(){scene='account';});navTile('share','邀请好友',200,505,165,shareChallenge);text('无需登录也可试玩；好友目标由分享者提供',195,592,10,muted,'center');button('返回基地',25,630,340,function(){scene='home';},true);
    }
    function viewport(){var insets=platform.insets||{top:0,bottom:0},height=canvas.height-insets.top-insets.bottom,s=Math.min(canvas.width/390,height/720);return{s:s,x:(canvas.width-390*s)/2,y:insets.top+(height-720*s)/2};}
    function render(){if(scene==='home'&&pendingChallenge){challenge=pendingChallenge;pendingChallenge=null;scene='challenge';}var v=viewport();ctx.setTransform(1,0,0,1,0,0);box(0,0,canvas.width,canvas.height,cream);ctx.setTransform(v.s,0,0,v.s,v.x,v.y);buttons=[];background();if(scene==='campaign')campaignPanel();else if(scene==='account')accountPanel();else if(scene==='leaderboard')leaderboardPanel();else if(scene==='challenge')challengePanel();else if(scene==='home')home();else if(scene==='garage')garage();else if(scene==='guide')guide();else if(scene==='records')records();else if(scene==='cloud'||scene==='cloud-confirm')cloudPanel();else{play();if(scene==='result'){buttons=[];result();}if(scene==='module')moduleChoice();if(scene==='leave'){buttons=[];box(0,0,390,720,'rgba(2,8,18,.92)');box(24,256,342,220,cream,22);text('先歇一会儿？',195,299,25,ink,'center');text('返回基地会放弃本局尚未结算的回收币',195,331,12,muted,'center');button('继续拆',44,355,302,function(){scene='play';});button('返回基地',44,413,302,function(){scene='home';},true);}}if(toastTime>0){art.panel(35,123,320,39,'#102b40');text(toast,195,148,11,green,'center');}}
    function point(p){var v=viewport();return{x:(p.x-v.x)/v.s,y:(p.y-v.y)/v.s};}
    platform.input(function(type,p){p=point(p);if(type==='cancel'){drag=false;if(game)game.target=null;return;}if(type==='down'){var b=buttons.find(function(b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;});if(b){drag=false;b.fn();return;}if(scene==='play'&&p.y>=240&&p.y<=640){drag=true;game.move(p.x,p.y);}}else if(type==='move'&&drag&&scene==='play')game.move(p.x,p.y);else if(type==='up'){drag=false;if(game)game.target=null;}});
    platform.visibility(function(hidden){paused=hidden;drag=false;last=0;if(game)game.target=null;});if(platform.onLaunchQuery)platform.onLaunchQuery(acceptChallenge);acceptChallenge(platform.launch);if(platform.autoLogin)login();
    function frame(now){var dt=last?Math.min(.04,Math.max(0,(now-last)/1000)):0;last=now;if(!paused){visualTime+=dt;toastTime=Math.max(0,toastTime-dt);if(scene==='play'){var prev=game.demolished,extracted=game.extracted;game.update(dt);if(platform.feedback&&(game.demolished>prev||game.extracted>extracted))platform.feedback(game.demolished>prev?'collapse':'extract');if(mode==='tour'&&!game.moduleOffered&&!game.moduleId&&game.demolished>=1&&game.demolished<3&&game.buildings.some(function(b){return b.state==='cleared';})){game.moduleOffered=true;game.target=null;drag=false;scene='module';}if(game.done&&!paid){paid=true;var r=save.records;r.completed++;r.bestScore=Math.max(r.bestScore,game.score);r.maxCombo=Math.max(r.maxCombo,game.maxCombo);r.recovered+=game.delivered;r.recent.unshift({mode:mode,level:game.level,score:game.score,seconds:Math.ceil(game.time),combo:game.maxCombo});r.recent=r.recent.slice(0,6);if(mode==='tour'){save.coins+=game.delivered+30+game.contractBonus;var stageId=game.level,old=save.stageBest[stageId],stars=core.stageStars(game);save.stageBest[stageId]={stars:Math.max(old?old.stars:0,stars),seconds:Math.min(old?old.seconds:Infinity,Math.ceil(game.time))};save.level=Math.max(save.level,Math.min(core.stages.length,stageId+1));}else{var seconds=Math.ceil(game.time);save.dailyBest[date]=Math.min(Number(save.dailyBest[date])||Infinity,seconds);}persist();if(mode==='daily'&&race&&platform.raceFinish){finishPending={session:race.session,seconds:Math.ceil(game.time)};submitRace();}event('yard_complete',{mode:mode,seconds:Math.ceil(game.time),recovered:game.delivered});scene='result';drag=false;}}render();}platform.frame(frame);}platform.frame(frame);
  }
  if(typeof module!=='undefined')module.exports=start;else root.startMagnetCrew=start;
})(typeof globalThis!=='undefined'?globalThis:this);
