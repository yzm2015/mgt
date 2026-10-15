(function (root) {
  'use strict';
  function start(platform, core) {
    var canvas = platform.canvas, ctx = canvas.getContext('2d'), game, mode = 'tour', level = 1, aim = null, buttons = [], resultSaved = false, paused = false;
    var saved = platform.load() || {}, best = saved.best || {}, dailyDate = core.day(), message = '', messageUntil = 0;
    level = Math.max(1, Math.min(999, Number(saved.level) || 1));
    function begin(nextMode) { mode = nextMode; dailyDate = core.day(); game = new core.Game(core.hash(mode === 'daily' ? dailyDate : 'tour-' + level), mode === 'daily' ? 5 : level); resultSaved = false; aim = null; platform.event('round_start', { mode: mode, level: level }); }
    function key() { return mode === 'daily' ? 'daily-' + dailyDate : 'tour-' + level; }
    function save() { platform.save({ level: level, best: best }); }
    function text(t, x, y, size, color, align) { ctx.fillStyle = color || '#f7f3e9'; ctx.font = 'bold ' + size + 'px sans-serif'; ctx.textAlign = align || 'left'; ctx.fillText(t, x, y); }
    function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
    function button(label, x, y, w, action, secondary) { rect(x, y, w, 46, secondary ? '#243b48' : '#e9ff70'); text(label, x + w / 2, y + 29, 16, secondary ? '#eaf1eb' : '#142a30', 'center'); buttons.push({ x:x, y:y, w:w, h:46, action:action }); }
    function render() {
      var scale = Math.min(canvas.width / 390, canvas.height / 720), ox = (canvas.width - 390 * scale) / 2, oy = (canvas.height - 720 * scale) / 2;
      ctx.setTransform(1,0,0,1,0,0); rect(0,0,canvas.width,canvas.height,'#10242e'); ctx.setTransform(scale,0,0,scale,ox,oy); buttons = [];
      rect(0,0,390,720,'#10242e');
      text('MAGNET / DEMOLITION',24,42,11,'#91b1b6'); text('磁吸拆迁队',24,76,28);
      text(mode === 'daily' ? '每日同题 · ' + dailyDate : '街区 ' + String(level).padStart(2,'0') + ' / 三发拆楼',24,104,13,'#afc5c5');
      text(String(game.score).padStart(5,'0'),24,151,30,'#e9ff70'); text('拆除 ' + Math.round(game.ratio()*100) + '%',366,149,15,'#e9ff70','right');
      rect(24,166,342,5,'#29434b'); rect(24,166,342*game.ratio(),5,'#e9ff70');
      text('● '.repeat(game.shots) + '○ '.repeat(3-game.shots),24,201,18,'#e9ff70');
      text('本机最佳 ' + (best[key()] || 0),366,201,12,'#afc5c5','right');
      for(var i=0;i<7;i++) { rect(i*68-12,350+(i%3)*24,50,290,'#162f39'); }
      rect(0,642,390,78,'#1e3740'); rect(0,642,390,3,'#8aa7a9');
      game.blocks.forEach(function(b){ if(!b.alive)return; var color=b.type==='tnt'?'#ff735c':b.type==='steel'?'#8faab9':'#eac386'; rect(b.x,b.y,30,30,color);rect(b.x+3,b.y+3,24,3,'rgba(255,255,255,.25)');text(b.type==='tnt'?'TNT':b.type==='steel'?(b.hp===2?'◆':'◇'):'',b.x+15,b.y+20,10,'#263942','center'); });
      game.effects.forEach(function(e){ ctx.globalAlpha=e.life/.7; for(var j=0;j<6;j++){ var a=j*Math.PI/3, d=(.7-e.life)*110;rect(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d+45*(.7-e.life),7,7,e.type==='tnt'?'#ff735c':'#eac386'); }ctx.globalAlpha=1; });
      // The magnet doubles as the launch anchor; a dotted arc previews gravity.
      ctx.strokeStyle='#9eb6b8';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(62,270);ctx.lineTo(62,466);ctx.stroke();
      ctx.strokeStyle='#e9ff70';ctx.lineWidth=8;ctx.beginPath();ctx.arc(62,480,16,0,Math.PI);ctx.stroke();
      if(aim && !game.ball){var dx=aim.x-62,dy=aim.y-480,len=Math.hypot(dx,dy);if(len>15){var speed=Math.min(760,420+len*1.2);ctx.fillStyle='#e9ff70';for(var k=1;k<19;k++){var t=k*.035;ctx.beginPath();ctx.arc(62+dx/len*speed*t,480+dy/len*speed*t+255*t*t,2,0,7);ctx.fill();}}}
      if(game.ball){ctx.fillStyle='#e9ff70';ctx.beginPath();ctx.arc(game.ball.x,game.ball.y,12,0,Math.PI*2);ctx.fill();}
      text(game.done?'三发挑战 · 一击连锁':game.ball?'漂亮！寻找下一处支撑':aim?'松手发射 · 瞄准红色 TNT':'拖向建筑瞄准，松手发射',195,680,16,'#eaf1eb','center');
      if(!game.done && game.combo>1 && game.elapsed-game.lastHit<1) text(game.combo+' 连拆！',195,260,28,'#e9ff70','center');
      if(game.done){rect(15,239,360,350,'rgba(12,30,38,.97)');text(game.ratio()>=.7?'拆得漂亮！':'再找找承重点',195,286,27,'#e9ff70','center');text('★'.repeat(game.ratio()>=.95?3:game.ratio()>=.7?2:1),195,328,30,'#e9ff70','center');text(game.score+' 分 · 拆除 '+Math.round(game.ratio()*100)+'%',195,366,18,null,'center');text(mode==='daily'?'相同日期、相同建筑，比比谁拆得巧':'打掉底部支撑，可以让整片楼体倒塌',195,397,12,'#afc5c5','center');
        button(mode==='tour' && game.ratio()>=.7?'下一街区':'再拆一次',35,421,320,function(){if(mode==='tour'&&game.ratio()>=.7){level=Math.min(999,level+1);save();}begin(mode);});
        button('分享挑战',35,479,153,function(){platform.share('我用三发拆掉了'+Math.round(game.ratio()*100)+'%！来试试磁吸拆迁队',mode==='daily'?'mode=daily&day='+dailyDate:'mode=tour&level='+level);message='挑战已准备好';messageUntil=Date.now()+2200;},true);
        button(mode==='daily'?'返回街区':'每日同题',200,479,155,function(){begin(mode==='daily'?'tour':'daily');},true);
        text('成绩仅保存在本机',195,566,11,'#afc5c5','center');
      }else{button(mode==='daily'?'街区挑战':'每日同题',246,219,120,function(){begin(mode==='daily'?'tour':'daily');},true);}
      if(Date.now()<messageUntil)text(message,195,712,12,'#e9ff70','center');
    }
    function point(p){var s=Math.min(canvas.width/390,canvas.height/720);return{x:(p.x-(canvas.width-390*s)/2)/s,y:(p.y-(canvas.height-720*s)/2)/s};}
    platform.input(function(type,p){p=point(p);if(type==='cancel'){aim=null;return;}if(type==='down'){var b=buttons.find(function(b){return p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;});if(b){aim=null;b.action();return;}if(!game.done&&!game.ball&&p.y>250)aim=p;}if(type==='move'&&aim)aim=p;if(type==='up'&&aim){if(game.fire(p.x,p.y))platform.event('shot',{mode:mode});aim=null;}});
    platform.visibility(function(hidden){paused=hidden;aim=null;});
    begin(platform.launch && platform.launch.mode==='daily'?'daily':'tour');
    if(platform.launch && platform.launch.mode==='tour'){var sharedLevel=Number(platform.launch.level);if(Number.isInteger(sharedLevel)&&sharedLevel>0&&sharedLevel<=999){level=sharedLevel;begin('tour');}}
    var last=0;function frame(now){var dt=last?(now-last)/1000:0;last=now;if(!paused){game.update(dt);if(game.done&&!resultSaved){resultSaved=true;best[key()]=Math.max(best[key()]||0,game.score);save();platform.event('round_end',{mode:mode,score:game.score,ratio:game.ratio(),seconds:Math.round(game.elapsed)});}render();}platform.frame(frame);}platform.frame(frame);
  }
  if(typeof module!=='undefined')module.exports=start;else root.startDemolition=start;
})(typeof globalThis!=='undefined'?globalThis:this);
