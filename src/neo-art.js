/* Canvas-native art: no network assets; works in WeChat's 2D canvas. */
(function(root){
  'use strict';
  function create(ctx){
    var cyan='#65edff',violet='#a48aff',white='#e5f4ff',muted='#6d8aa5',gold='#ffbd72';
    function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
    function path(points,fill,stroke,width){ctx.beginPath();points.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width||1;ctx.stroke();}}
    function line(x,y,xx,yy,c,w){ctx.strokeStyle=c;ctx.lineWidth=w||1;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();}
    function ring(x,y,r,c,w,start,end){ctx.strokeStyle=c;ctx.lineWidth=w||1;ctx.beginPath();ctx.arc(x,y,r,start||0,end===undefined?Math.PI*2:end);ctx.stroke();}
    function label(t,x,y,s,c,align){ctx.font='bold '+s+'px sans-serif';ctx.fillStyle=c||white;ctx.textAlign=align||'left';ctx.textBaseline='alphabetic';ctx.fillText(t,x,y);}
    function panel(x,y,w,h,color){path([[x+10,y],[x+w,y],[x+w,y+h-10],[x+w-10,y+h],[x,y+h],[x,y+10]],color||'#0b192a','#20374b');line(x+10,y,x+45,y,cyan,2);line(x+w-30,y+h,x+w-10,y+h,'#496684',2);}
    function glow(fn,color,blur){ctx.save();ctx.shadowColor=color;ctx.shadowBlur=blur||14;fn();ctx.restore();}
    function background(time,grid){
      rect(0,0,390,720,'#060e1b');
      for(var i=0;i<5;i++)rect(i*83,0,1,720,'rgba(55,108,145,.035)');
      if(grid){panel(14,174,362,463,'#091729');ctx.save();ctx.beginPath();ctx.rect(15,176,360,458);ctx.clip();for(var x=20;x<400;x+=26)line(x,176,x,636,'#10283b');for(var y=176;y<640;y+=26)line(15,y,375,y,'#10283b');
        for(var j=0;j<6;j++)line(15,220+j*68,375,150+j*68,'rgba(52,94,126,.1)');
        rect(15,190+(time*24)%440,360,1,'rgba(92,234,255,.12)');ctx.restore();
        [[24,186],[366,186],[24,626],[366,626]].forEach(function(p){line(p[0]-3,p[1],p[0]+3,p[1],cyan);line(p[0],p[1]-3,p[0],p[1]+3,cyan);});
      }
      rect(24,707,342,1,'#16334b');rect(24,707,50,1,cyan);
    }
    function scrap(x,y,scale){ctx.save();ctx.translate(x,y);ctx.scale(scale||1,scale||1);path([[-6,-4],[3,-7],[8,-2],[5,5],[-4,7],[-8,1]],'#254b62','#72c7e6');line(-4,-2,3,-3,cyan,2);ctx.restore();}
    function vehicle(x,y,angle,boost,time){
      ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);
      glow(function(){ring(0,0,29,boost?'#a48aff':'rgba(101,237,255,.3)',1);},cyan,10);
      for(var side=-1;side<=1;side+=2){path([[side*14,-15],[side*25,-9],[side*25,15],[side*15,22]],'#111c2d','#3d5d75');for(var i=0;i<3;i++)rect(side<0?-23:17,-8+i*8,6,3,'#5b8298');}
      path([[-14,-20],[0,-26],[14,-20],[17,15],[9,23],[-9,23],[-17,15]],'#142f46','#63cadf',1.5);
      path([[-10,-16],[0,-20],[10,-16],[10,-4],[-10,-4]],'#1a576c',cyan);
      glow(function(){line(-8,-13,8,-13,cyan,3);line(-10,15,-5,17,violet,3);line(5,17,10,15,violet,3);},cyan,12);
      ring(0,5,7,'#85eaff',2);ring(0,5,3,white,2);
      line(-10,-20,-13,-32,'#5a8a9e',5);line(10,-20,13,-32,'#5a8a9e',5);
      glow(function(){rect(-17,-35,8,8,boost?violet:cyan);rect(9,-35,8,8,boost?violet:cyan);line(-12,-30,12,-30,'rgba(101,237,255,.45)',2);},cyan,14);
      if(boost){for(var k=0;k<2;k++)path([[-7+k*10,24],[-3+k*10,40+Math.sin(time*30)*6],[1+k*10,24]],violet);}
      ctx.restore();
    }
    function building(b,time){
      var x=b.x-b.w/2,y=b.y-b.h/2,h=Math.min(69,b.floors*14),fall=b.state==='falling'?Math.min(1,b.fall/.85):0;
      if(b.state==='cleared'){path([[x,b.y-16],[b.x,b.y-28],[x+b.w,b.y-16],[b.x,b.y+22]],'#0b2130','#1e4555');label('区域已解锁',b.x,b.y+5,9,'#3f7b85','center');return;}
      ctx.save();if(fall){ctx.translate(Math.sin(fall*35)*fall*5,fall*12);ctx.globalAlpha=1-fall*.75;h*=1-fall;}
      var roof=y-h+10,depth=14,pal=b.accent||(b.id===1?violet:cyan);
      path([[x+8,y+20],[x+b.w+15,y+12],[x+b.w+20,y+b.h+15],[x+12,y+b.h+24]],'rgba(0,0,0,.35)');
      path([[x,roof],[x+b.w-12,roof],[x+b.w-12,y+b.h],[x,y+b.h]],'#15293e','#37536c');
      path([[x+b.w-12,roof],[x+b.w+4,roof-depth],[x+b.w+4,y+b.h-depth],[x+b.w-12,y+b.h]],'#0b182a','#2a4059');
      path([[x,roof],[x+16,roof-depth],[x+b.w+4,roof-depth],[x+b.w-12,roof]],'#253d53','#57738a');
      path([[x+13,roof-3],[x+23,roof-11],[x+b.w-9,roof-11],[x+b.w-20,roof-3]],'#0a2032',pal);
      glow(function(){line(x+4,roof+3,x+b.w-15,roof+3,pal,2);line(x+b.w-11,roof+4,x+b.w-11,y+b.h-4,pal,1);},pal,8);
      for(var r=0;r<Math.floor((h+b.h-17)/15);r++)for(var c=0;c<3;c++){var wx=x+8+c*(b.w-22)/3,wy=roof+12+r*15;rect(wx,wy,11,5,(r+c)%3===0?'#365777':b.id===1?'#69578c':'#34788c');if((r+c)%3!==0)rect(wx,wy,9,1,pal);}
      rect(x+3,y+b.h-9,b.w-18,6,'#1b364c');for(var k=0;k<4;k++)rect(x+8+k*17,y+b.h-8,7,2,pal);
      label('T-'+String(b.id+1).padStart(2,'0'),b.x,roof-depth-9,9,muted,'center');
      var removed=b.bolts.filter(function(a){return a.removed;}).length;
      for(var m=0;m<3;m++)rect(b.x-15+m*11,roof-7,7,3,m<removed?'#ffae65':pal);
      ctx.restore();
      b.bolts.forEach(function(a){if(a.removed){ring(a.x,a.y,4,'#294b60',1);return;}var health=a.hp/(a.maxHp||1),color=health<.5?gold:pal;glow(function(){path([[a.x,a.y-9],[a.x+8,a.y-4],[a.x+8,a.y+4],[a.x,a.y+9],[a.x-8,a.y+4],[a.x-8,a.y-4]],'#112940',color,1.5);rect(a.x-2,a.y-3,4,6,color);},color,health<1?13:5);ring(a.x,a.y,14,'#25425a');if(health<1)ring(a.x,a.y,15,color,2,-Math.PI/2,-Math.PI/2+(1-health)*Math.PI*2);});
    }
    function depot(time){
      path([[24,555],[68,542],[112,555],[112,601],[68,614],[24,601]],'#0c2835','#326773');
      ring(68,579,24,'#327584',1);ring(68,579,18,'#7affe0',2,time,-1+time+Math.PI*2);
      line(56,579,80,579,'#7affe0',2);line(68,567,68,591,'#7affe0',2);label('回收中枢',68,606,9,'#8af8db','center');
    }
    function hero(time){
      panel(20,161,350,273,'#0a192c');label('SECTOR 07  /  城市拆解计划',35,186,9,muted);label('LIVE',350,186,9,cyan,'right');
      ctx.save();ctx.beginPath();ctx.rect(22,194,346,235);ctx.clip();
      for(var y=231;y<460;y+=24)line(24,y,370,y,'#112c43');for(var x=-200;x<600;x+=60)line(195,204,x,434,'#112c43');
      ring(148,358,89,'#173a56');ring(148,358,65,'#245772',1);ring(148,358,45,'#43acbf',1,time,time+Math.PI*1.4);
      var b={id:0,x:253,y:290,w:94,h:53,floors:5,state:'standing',bolts:[{x:200,y:308,hp:1},{x:300,y:308,hp:.35},{x:251,y:326,hp:.65}]};building(b,time);
      ctx.save();ctx.setLineDash([5,5]);line(126,333,200,308,'#5ce7ff',2);line(126,333,251,326,'rgba(92,231,255,.3)',1);ctx.restore();
      for(var k=0;k<10;k++)scrap(116+Math.sin(k*.75+time)*19,384+k*4,.6);
      ctx.save();ctx.translate(117,337);ctx.scale(1.45,1.45);vehicle(0,0,.25,false,time);ctx.restore();
      for(var i=0;i<12;i++){var px=32+(i*47)%320,py=220+(i*37)%180+Math.sin(time+i)*3;rect(px,py,2,2,i%2?cyan:violet);}
      ctx.restore();panel(223,364,131,50,'#0b2033');label('磁场强度',234,381,9,muted);label('98.7',234,403,22,cyan);label('TESLA',341,402,8,muted,'right');
      label('01 / 磁吸锁定',35,418,9,cyan);
    }
    function icon(name,x,y,size,color){
      ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.strokeStyle=color||cyan;ctx.fillStyle=color||cyan;ctx.lineWidth=1.7;ctx.lineCap='round';ctx.lineJoin='round';
      function stroke(points,close){ctx.beginPath();points.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});if(close)ctx.closePath();ctx.stroke();}
      function dot(px,py,r){ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.stroke();}
      if(name==='gift'){stroke([[-9,-2],[9,-2],[9,9],[-9,9]],true);stroke([[-11,-6],[11,-6],[11,-2],[-11,-2]],true);line(0,-6,0,9,color);stroke([[0,-6],[-6,-10],[-8,-9],[-7,-6],[0,-6],[6,-10],[8,-9],[7,-6]],false);}
      else if(name==='star'){var points=[];for(var si=0;si<10;si++){var a=-Math.PI/2+si*Math.PI/5,r=si%2?4.5:10;points.push([Math.cos(a)*r,Math.sin(a)*r]);}stroke(points,true);}
      else if(name==='lock'){stroke([[-7,-1],[7,-1],[7,9],[-7,9]],true);ctx.beginPath();ctx.arc(0,-3,5,Math.PI,0);ctx.stroke();line(-5,-3,-5,-1,color);line(5,-3,5,-1,color);line(0,3,0,6,color);}
      else if(name==='route'){stroke([[-8,8],[-8,-7],[7,-7],[7,7]]);dot(-8,8,3);dot(7,7,3);dot(7,-7,2);}
      else if(name==='shield'){stroke([[0,-11],[9,-7],[7,3],[0,11],[-7,3],[-9,-7]],true);stroke([[-4,0],[-1,4],[5,-4]]);}
      else if(name==='bolt'){stroke([[2,-11],[-8,2],[-1,2],[-3,11],[8,-3],[1,-3]],true);}
      else if(name==='play')stroke([[-5,-8],[8,0],[-5,8]],true);
      else if(name==='pause'){line(-4,-7,-4,7,color,3);line(4,-7,4,7,color,3);}
      else if(name==='next')stroke([[-4,-8],[4,0],[-4,8]]);
      else if(name==='back')stroke([[4,-8],[-4,0],[4,8]]);
      else if(name==='home'){stroke([[-10,-1],[0,-9],[10,-1]]);stroke([[-7,-2],[-7,9],[-2,9],[-2,3],[3,3],[3,9],[8,9],[8,-2]]);}
      else if(name==='drone'){dot(-8,-6,3.5);dot(8,-6,3.5);dot(-8,6,3.5);dot(8,6,3.5);stroke([[-8,-6],[8,6]]);stroke([[8,-6],[-8,6]]);stroke([[-3,-4],[3,-4],[4,0],[0,4],[-4,0]],true);}
      else if(name==='dash'){stroke([[-9,-7],[-2,0],[-9,7]]);stroke([[-1,-7],[6,0],[-1,7]]);line(9,-3,9,3,color,2);}
      else if(name==='pulse'){dot(0,0,10);ctx.beginPath();ctx.arc(0,0,6,.5,4.7);ctx.stroke();stroke([[2,-7],[-3,1],[2,1],[-1,7]]);}
      else if(name==='garage'){stroke([[-10,-5],[0,-10],[10,-5],[10,9],[-10,9]],true);stroke([[-6,9],[-6,-2],[6,-2],[6,9]]);line(-4,2,4,2,color);line(-4,5,4,5,color);}
      else if(name==='daily'){dot(0,0,9);stroke([[0,-6],[0,0],[5,2]]);line(-3,-12,3,-12,color,2);}
      else if(name==='user'){dot(0,-5,5);ctx.beginPath();ctx.arc(0,10,9,Math.PI,0);ctx.stroke();}
      else if(name==='share'){dot(-7,0,3);dot(7,-7,3);dot(7,7,3);line(-4,-1,4,-6,color);line(-4,1,4,6,color);}
      else if(name==='retry'){ctx.beginPath();ctx.arc(0,0,8,-.6,4.8);ctx.stroke();stroke([[8,-8],[8,-2],[2,-3]]);}
      else if(name==='upgrade'){stroke([[-7,2],[0,-5],[7,2]]);stroke([[-7,-4],[0,-11],[7,-4]]);line(0,-3,0,10,color);line(-5,10,5,10,color);}
      else if(name==='help'){dot(0,0,10);stroke([[-3,-4],[-1,-6],[3,-5],[4,-2],[0,1],[0,3]]);line(0,6,0,7,color,2);}
      else if(name==='cloud'){ctx.beginPath();ctx.moveTo(-7,6);ctx.bezierCurveTo(-15,5,-11,-5,-5,-4);ctx.bezierCurveTo(-5,-13,9,-12,10,-3);ctx.bezierCurveTo(17,-2,15,6,8,6);ctx.closePath();ctx.stroke();line(-1,2,-1,8,color);}
      else if(name==='trophy'){stroke([[-6,-9],[6,-9],[5,1],[0,5],[-5,1]],true);stroke([[-6,-6],[-11,-6],[-10,0],[-5,1]]);stroke([[6,-6],[11,-6],[10,0],[5,1]]);line(0,5,0,10,color);line(-5,10,5,10,color);}
      else if(name==='magnet'){ctx.beginPath();ctx.arc(0,0,7,0,Math.PI);ctx.stroke();stroke([[-7,0],[-7,-8],[-3,-8],[-3,0]]);stroke([[7,0],[7,-8],[3,-8],[3,0]]);}
      else if(name==='cargo'){stroke([[-9,-5],[0,-10],[9,-5],[9,6],[0,11],[-9,6]],true);stroke([[-9,-5],[0,0],[9,-5]]);line(0,0,0,11,color);}
      else if(name==='check')stroke([[-8,0],[-2,6],[9,-7]]);
      else if(name==='upload'||name==='download'){stroke([[-9,4],[-9,9],[9,9],[9,4]]);if(name==='upload'){stroke([[-5,-4],[0,-9],[5,-4]]);line(0,-8,0,4,color);}else{stroke([[-5,-1],[0,4],[5,-1]]);line(0,-9,0,3,color);}}
      ctx.restore();
    }
    return{background:background,panel:panel,vehicle:vehicle,building:building,scrap:scrap,depot:depot,hero:hero,ring:ring,line:line,glow:glow,icon:icon};
  }
  if(typeof module!=='undefined')module.exports=create;else root.createMagnetArt=create;
})(typeof globalThis!=='undefined'?globalThis:this);
