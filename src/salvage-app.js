(function(root){
  'use strict';
  function start(platform,core){
    var canvas=platform.canvas,ctx=canvas.getContext('2d'),save=core.cleanSave(platform.load()),scene='home',mode='tour',game=null,buttons=[],drag=false,paused=false,last=0,toast='',toastTime=0,date=core.day(),paid=false,remoteSave=null,remoteLoading=false,cloudBusy=false,cloudMessage='',cloudConfirm='',restoreBackup=platform.loadRestoreBackup?platform.loadRestoreBackup():null;
    var ink='#e5f4ff',cream='#060e1b',muted='#7393ad',orange='#65edff',green='#96ffd4',blue='#a48aff';
    var createArt=typeof module!=='undefined'?require('./neo-art'):root.createMagnetArt,art=createArt(ctx),visualTime=0;
    function persist(){return platform.save(save);}
    function event(n,d){platform.event(n,d||{});}
    function begin(m){mode=m;date=core.day();game=new core.Game(core.hash(m==='daily'?date:'yard-'+save.level),m==='daily'?4:save.level,m==='daily'?{magnet:0,cargo:0}:save.upgrades);scene='play';paid=false;drag=false;event('yard_start',{mode:m,level:save.level});}
    function notice(s){toast=s;toastTime=2.5;}
    function box(x,y,w,h,color,r){ctx.fillStyle=color;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r||0);else ctx.rect(x,y,w,h);ctx.fill();}
    function line(x,y,x2,y2,color,width){ctx.strokeStyle=color;ctx.lineWidth=width||1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
    function text(t,x,y,size,color,align){ctx.fillStyle=color||ink;ctx.font='bold '+size+'px sans-serif';ctx.textAlign=align||'left';ctx.textBaseline='alphabetic';ctx.fillText(t,x,y);}
    function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    function button(label,x,y,w,fn,secondary){
      var type=/分享/.test(label)?'share':/返回基地/.test(label)?'home':/返回/.test(label)?'back':/满级/.test(label)?'check':/升级/.test(label)?'upgrade':/再次|再挑战|连接/.test(label)?'retry':'play';
      art.panel(x,y,w,46,secondary?'#102338':'#60e6f6');art.icon(type,x+25,y+23,21,secondary?orange:'#0b3447');text(label,x+(w+18)/2,y+29,14,secondary?ink:'#051322','center');buttons.push({x:x,y:y,w:w,h:46,fn:fn});
    }
    function iconButton(type,x,y,options){
      var o=options||{},small=o.small,r=small?17:27,color=o.enabled===false?'#526a80':o.color||orange;
      circle(x,y,r+3,'#0b1c2e');art.ring(x,y,r+3,'#264159',1);art.ring(x,y,r,color,1);
      if(o.progress!==undefined)art.ring(x,y,r+3,color,2.5,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.001,Math.min(1,o.progress)));
      if(o.ready)art.glow(function(){art.ring(x,y,r+3,color,1);},color,12);
      art.icon(type,x,y,small?18:25,color);
      if(o.badge!==undefined&&o.badge!==''){circle(x+22,y-19,11,'#132d43');text(String(o.badge),x+22,y-15,10,ink,'center');}
      if(o.label)text(o.label,x,y+39,10,o.enabled===false?muted:ink,'center');
      var w=small?44:92,h=small?44:78;buttons.push({x:x-w/2,y:y-(small?22:34),w:w,h:h,fn:o.action});
    }
    function navTile(type,label,x,y,w,fn){art.panel(x,y,w,46,'#0d2034');art.icon(type,x+29,y+23,25,orange);text(label,x+54,y+29,13,ink);buttons.push({x:x,y:y,w:w,h:46,fn:fn});}
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
      [['help','操作指引',orange,function(){scene='guide';}],['trophy','任务档案',blue,function(){scene='records';}],['cloud','云端存档',green,function(){openCloud();}]].forEach(function(item,i){var x=24+i*116;art.panel(x,450,110,74,'#0c1e31');art.icon(item[0],x+55,475,27,item[2]);text(item[1],x+55,512,11,ink,'center');buttons.push({x:x,y:450,w:110,h:74,fn:item[3]});});
      text('下一目标 / 第 '+String(save.level).padStart(2,'0')+' 号区域',25,545,10,muted);text('CREDIT '+save.coins,365,545,10,orange,'right');
      button('启动拆解任务',25,557,340,function(){begin('tour');});navTile('garage','装备机库',25,615,163,function(){scene='garage';});navTile('daily','每日竞速',200,615,165,function(){begin('daily');});
      text('首塔掉落模组 · 6 连击可获得额外奖励',195,692,11,muted,'center');
    }
    function garage(){
      box(0,0,390,720,cream);text('HANGAR / 模组装配',25,45,11,muted);text('装备你的磁场',25,93,30);chip('回收币 '+save.coins,25,117,132);truck(195,220,0);
      ['magnet','cargo'].forEach(function(id,i){var rank=save.upgrades[id],cost=core.cost(rank),y=284+i*146;box(24,y,342,132,'#0d2035',18);text(id==='magnet'?'磁力线圈':'牵引拖链',40,y+32,20);text('等级 '+rank+' / 5',346,y+30,12,muted,'right');text(id==='magnet'?'范围更大，拔除承重点更快':'每级增加 5 格载重，少跑回收站',40,y+58,12,muted);button(rank>=5?'已满级':'升级 · '+cost+' 币',40,y+74,310,function(){if(rank>=5)return;if(save.coins<cost){notice('回收币不足，先去拆一栋楼');return;}save.coins-=cost;save.upgrades[id]++;persist();notice('升级完成');event('upgrade',{type:id,rank:save.upgrades[id]});});});
      button('返回工地',25,621,340,function(){scene='home';},true);text('每日同题使用统一初始车辆，升级仅用于普通工地',195,697,10,muted,'center');
    }
    function play(){
      text(mode==='daily'?'DAILY RIFT / '+date:'NEO CITY / 第 '+String(save.level).padStart(2,'0')+' 号区域',24,35,10,muted);text(['离子工厂','双塔回廊','三角阵列'][game.variant],24,72,29,ink);text(String(game.score).padStart(5,'0'),366,70,23,orange,'right');
      chip('拆解 '+game.demolished+' / 3',24,91,102);chip('回收 '+game.delivered+' / '+game.quota,136,91,124);chip(Math.floor(game.time)+' SEC',270,91,96);
      var hint=game.cargo.length>=game.capacity()?'满载！呼叫无人机远程回收，继续连拆':game.demolished===3?'回收剩余金属，完成本区任务':game.activeBolt?'核心已锁定 · 脉冲可同时击穿附近核心':'拖动驾驶 → 靠近六边形核心 → 释放脉冲';text(hint,195,144,11,game.cargo.length>=game.capacity()?green:muted,'center');
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
      if(status==='offline')text('云存档与排行榜尚未开放',195,463,11,muted,'center');else if(cloudMessage)text(cloudMessage,195,463,10,green,'center');else text('先备份再换设备；恢复会替换当前本机进度',195,463,10,muted,'center');
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
      button(mode==='daily'?'再挑战一次':'下一工地',44,438,302,function(){begin(mode);});button('返回基地',44,496,144,function(){scene='home';},true);button('分享战绩',202,496,144,function(){platform.share('我在磁吸拆迁队用 '+Math.ceil(game.time)+' 秒拆掉了三栋楼！','mode='+mode);},true);text('成绩保存在本机',195,565,10,muted,'center');
    }
    function viewport(){var insets=platform.insets||{top:0,bottom:0},height=canvas.height-insets.top-insets.bottom,s=Math.min(canvas.width/390,height/720);return{s:s,x:(canvas.width-390*s)/2,y:insets.top+(height-720*s)/2};}
    function render(){var v=viewport();ctx.setTransform(1,0,0,1,0,0);box(0,0,canvas.width,canvas.height,cream);ctx.setTransform(v.s,0,0,v.s,v.x,v.y);buttons=[];background();if(scene==='home')home();else if(scene==='garage')garage();else if(scene==='guide')guide();else if(scene==='records')records();else if(scene==='cloud'||scene==='cloud-confirm')cloudPanel();else{play();if(scene==='result'){buttons=[];result();}if(scene==='module')moduleChoice();if(scene==='leave'){buttons=[];box(0,0,390,720,'rgba(2,8,18,.92)');box(24,256,342,220,cream,22);text('先歇一会儿？',195,299,25,ink,'center');text('返回基地会放弃本局尚未结算的回收币',195,331,12,muted,'center');button('继续拆',44,355,302,function(){scene='play';});button('返回基地',44,413,302,function(){scene='home';},true);}}if(toastTime>0){art.panel(35,123,320,39,'#102b40');text(toast,195,148,11,green,'center');}}
    function point(p){var v=viewport();return{x:(p.x-v.x)/v.s,y:(p.y-v.y)/v.s};}
    platform.input(function(type,p){p=point(p);if(type==='cancel'){drag=false;if(game)game.target=null;return;}if(type==='down'){var b=buttons.find(function(b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;});if(b){drag=false;b.fn();return;}if(scene==='play'&&p.y>=240&&p.y<=640){drag=true;game.move(p.x,p.y);}}else if(type==='move'&&drag&&scene==='play')game.move(p.x,p.y);else if(type==='up'){drag=false;if(game)game.target=null;}});
    platform.visibility(function(hidden){paused=hidden;drag=false;last=0;if(game)game.target=null;});if(platform.launch&&platform.launch.mode==='daily')begin('daily');
    function frame(now){var dt=last?Math.min(.04,Math.max(0,(now-last)/1000)):0;last=now;if(!paused){visualTime+=dt;toastTime=Math.max(0,toastTime-dt);if(scene==='play'){var prev=game.demolished,extracted=game.extracted;game.update(dt);if(platform.feedback&&(game.demolished>prev||game.extracted>extracted))platform.feedback(game.demolished>prev?'collapse':'extract');if(mode==='tour'&&!game.moduleOffered&&!game.moduleId&&game.demolished>=1&&game.demolished<3&&game.buildings.some(function(b){return b.state==='cleared';})){game.moduleOffered=true;game.target=null;drag=false;scene='module';}if(game.done&&!paid){paid=true;var r=save.records;r.completed++;r.bestScore=Math.max(r.bestScore,game.score);r.maxCombo=Math.max(r.maxCombo,game.maxCombo);r.recovered+=game.delivered;r.recent.unshift({mode:mode,level:game.level,score:game.score,seconds:Math.ceil(game.time),combo:game.maxCombo});r.recent=r.recent.slice(0,6);if(mode==='tour'){save.coins+=game.delivered+30+game.contractBonus;save.level=Math.min(99,save.level+1);}else{var seconds=Math.ceil(game.time);save.dailyBest[date]=Math.min(Number(save.dailyBest[date])||Infinity,seconds);}persist();event('yard_complete',{mode:mode,seconds:Math.ceil(game.time),recovered:game.delivered});scene='result';drag=false;}}render();}platform.frame(frame);}platform.frame(frame);
  }
  if(typeof module!=='undefined')module.exports=start;else root.startMagnetCrew=start;
})(typeof globalThis!=='undefined'?globalThis:this);
