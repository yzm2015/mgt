/* Native WebGL 3D scene. Ground-plane simulation and 2D HUD share one display canvas. */
(function(root){
 'use strict';
 function camera(angle,aspect,zoom){
  var s=Math.sin(angle),c=Math.cos(angle),e=.78,f=Math.sqrt(1-e*e),right=[c,0,-s],up=[-s*e,f,-c*e],back=[s*f,e,c*f],w=254*(zoom||1),h=w/aspect,t=[0,18,0],near=1,far=1800,d=900;
  var matrix=new Float32Array([right[0]/w,up[0]/h,-2*back[0]/(far-near),0,right[1]/w,up[1]/h,-2*back[1]/(far-near),0,right[2]/w,up[2]/h,-2*back[2]/(far-near),0,0,-18*up[1]/h,(2*d+36*back[1]-far-near)/(far-near),1]);
  return{matrix:matrix,right:right,up:up,back:back,w:w,h:h,target:t};
 }
 function project(p,cam,rect){var v=[p[0],p[1]-18,p[2]],dot=function(a){return a[0]*v[0]+a[1]*v[1]+a[2]*v[2];};return{x:rect.x+(dot(cam.right)/cam.w+1)*rect.w/2,y:rect.y+(1-dot(cam.up)/cam.h)*rect.h/2};}
 function ground(p,cam,rect){var nx=((p.x-rect.x)/rect.w*2-1)*cam.w,ny=(1-(p.y-rect.y)/rect.h*2)*cam.h,r=cam.right,u=cam.up,b=cam.back,t=(18+u[1]*ny)/b[1];return{x:r[0]*nx+u[0]*ny-b[0]*t+195,y:r[2]*nx+u[2]*ny-b[2]*t+430};}
 function create(canvas){
  var gl;try{gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});if(!gl||typeof gl.getParameter(gl.VERSION)!=='string')return null;}catch(e){return null;}
  var sceneProgram,hudProgram,buffer,quad,texture,angle=.38,targetAngle=.38,lastTime=null,lost=false,failed='',lastCam=null,rect={x:15,y:176,w:360,h:458},textureW=0,textureH=0,vertices=[];
  function shader(type,source){var sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('3D_SHADER_FAILED');return sh;}
  function program(vs,fs){var v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('3D_LINK_FAILED');return p;}
  function init(){
   sceneProgram=program('attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uVP;varying vec3 vColor;void main(){float light=0.54+0.46*max(dot(aNormal,normalize(vec3(-0.4,1.0,0.6))),0.0);vColor=aColor*light;gl_Position=uVP*vec4(aPosition,1.0);}','precision mediump float;varying vec3 vColor;void main(){gl_FragColor=vec4(vColor,1.0);}');
   hudProgram=program('attribute vec2 aPosition;attribute vec2 aUV;varying vec2 vUV;void main(){vUV=aUV;gl_Position=vec4(aPosition,0.0,1.0);}','precision mediump float;uniform sampler2D uHUD;varying vec2 vUV;void main(){gl_FragColor=texture2D(uHUD,vUV);}');
   buffer=gl.createBuffer();quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,0,0,1,-1,1,0,-1,1,0,1,-1,1,0,1,1,-1,1,0,1,1,1,1]),gl.STATIC_DRAW);
   texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);textureW=textureH=0;
  }
  try{init();}catch(e){failed=e.message;throw e;}
  if(canvas.addEventListener){canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();lost=true;});canvas.addEventListener('webglcontextrestored',function(){try{init();lost=false;failed='';}catch(e){failed=e.message;}});}
  function color(c){return typeof c==='string'?[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255]:c;}
  function vertex(p,n,c){vertices.push(p[0],p[1],p[2],n[0],n[1],n[2],c[0],c[1],c[2]);}
  function cube(x,y,z,w,h,d,c,yaw){c=color(c);yaw=yaw||0;var cs=Math.cos(yaw),sn=Math.sin(yaw),pts=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(function(p){var px=p[0]*w/2,pz=p[2]*d/2;return[x+px*cs+pz*sn,y+p[1]*h/2,z-px*sn+pz*cs];}),faces=[[[0,1,2,3],[0,0,-1]],[[5,4,7,6],[0,0,1]],[[4,0,3,7],[-1,0,0]],[[1,5,6,2],[1,0,0]],[[3,2,6,7],[0,1,0]],[[4,5,1,0],[0,-1,0]]];faces.forEach(function(f){var n=f[1],rn=[n[0]*cs+n[2]*sn,n[1],-n[0]*sn+n[2]*cs];[0,1,2,0,2,3].forEach(function(i){vertex(pts[f[0][i]],rn,c);});});}
  function ring(x,z,r,c,width,y,progress){if(r<=0)return;c=color(c);y=y||1.3;width=Math.min(r,width||2);for(var i=0;i<Math.ceil(40*(progress===undefined?1:Math.max(0,Math.min(1,progress))));i++){var a=i*Math.PI/20,b=(i+1)*Math.PI/20,p=[[x+Math.cos(a)*(r-width),y,z+Math.sin(a)*(r-width)],[x+Math.cos(a)*r,y,z+Math.sin(a)*r],[x+Math.cos(b)*r,y,z+Math.sin(b)*r],[x+Math.cos(b)*(r-width),y,z+Math.sin(b)*(r-width)]];[0,1,2,0,2,3].forEach(function(j){vertex(p[j],[0,1,0],c);});}}
  function beam(x,z,xx,zz,y,c,width){var dx=xx-x,dz=zz-z;cube((x+xx)/2,y,(z+zz)/2,width||2,2,Math.hypot(dx,dz),c,Math.atan2(dx,dz));}
  function scene(g,time,fx,focus){var reduced=!!(fx&&fx.reduced());
   var cyan='#65edff',violet='#a48aff',green='#96ffd4',gold='#ffbd72';
   cube(0,-7,0,374,12,408,'#16283e');cube(0,-.7,0,360,1.4,394,'#102237');
   for(var x=-175;x<=175;x+=25)cube(x,.12,0,.6,.3,390,'#24435a');for(var z=-190;z<=190;z+=25)cube(0,.12,z,350,.3,.6,'#24435a');
   beam(-183,-200,183,-200,1,cyan,2);beam(-183,200,183,200,1,cyan,2);beam(-183,-200,-183,200,1,violet,2);beam(183,-200,183,200,1,violet,2);
   [[-183,-200],[183,-200],[-183,200],[183,200]].forEach(function(p){cube(p[0],6,p[1],8,12,8,'#2c5065');cube(p[0],13,p[1],9,2,9,cyan);});
   if(!reduced){var scan=-190+(time*24)%380;beam(-175,scan,175,scan,1,'#2d7387',1);}
   if(g.navGoal){ring(g.navGoal.x-195,g.navGoal.y-430,10+(reduced?0:Math.sin(time*5)*2),'#65edff',2,2);g.route.slice(0,48).forEach(function(p,i){if(i%3===0)cube(p.x-195,1.8,p.y-430,2.5,1,2.5,'#4094a7');});}
   if(focus&&focus.target){var fp=focus.target;ring(fp.x-195,fp.y-430,16+(reduced?0:Math.sin(time*4)*2),'#96ffd4',1.5,2);}
   var dx=67-195,dz=584-430;cube(dx,1,dz,74,2,63,'#164c50');ring(dx,dz,26,green,3,2.5);cube(dx,3,dz,35,2,4,green);cube(dx,3,dz,4,2,35,green);ring(dx,dz,31+(reduced?0:Math.sin(time*3)*2),'#438e85',1,1.7);
   if(g.mission)g.mission.nodes.forEach(function(n){var mx=n.x-195,mz=n.y-430,c=n.active?'#325260':g.mission.kind==='rescue'?gold:g.mission.kind==='power'||g.mission.kind==='switch'?violet:cyan;ring(mx,mz,19+(reduced?0:Math.sin(time*3+n.id)*1.5),c,2,1.8);if(n.charge>0&&!n.active)ring(mx,mz,24,'#e5f4ff',2,2,n.charge);if(!n.active){cube(mx,2,mz,20,3,20,'#243b55');cube(mx,12+n.charge*10,mz,9,16+n.charge*20,9,c,time*.6);if(g.mission.kind==='dash')cube(mx,25,mz,24,2,4,c);}});
   if(g.lab){g.buildings.forEach(function(b){if(b.tension&&b.tension.life>0){beam(b.x-195,b.y-430,b.tension.x-195,b.tension.y-430,35,b.tension.kind==='attract'?'#ff829a':'#65caff',3);}});if(g.lab.attack){var a=g.lab.attack;ring(a.x-195,a.y-430,48,'#ff637f',3,2);ring(a.x-195,a.y-430,48,'#ffc272',4,3,1-a.left/1.8);}}
   g.buildings.forEach(function(b){var bx=b.x-195,bz=b.y-430,c=b.pole===1?'#ff829a':b.pole===-1?'#65caff':b.accent||cyan,fall=b.state==='falling'?Math.min(1,b.fall/.85):b.state==='cleared'?1:0,height=(b.floors*18+18)*(1-fall),shield=g.mission&&(g.mission.kind==='switch'&&b.id===2&&g.mission.value<2||g.mission.kind==='power'&&!g.mission.nodes[b.id].active)||g.lab&&g.lab.def.boss&&b.id===2&&g.demolished<2;
    cube(bx,1,bz,b.w+12,1,b.h+12,'#080f1e');
    if(b.state==='falling'){
      for(var layer=0;layer<b.floors;layer++){var push=fall*fall,ly=Math.max(3,(layer*18+10)*(1-push*1.7)),lx=bx+Math.sin(layer*2.4+b.id)*push*23+(b.fallVector?b.fallVector.x*push*65:0),lz=bz+Math.cos(layer*2.1)*push*20+(b.fallVector?b.fallVector.y*push*65:0);cube(lx,ly,lz,b.w*(1-fall*.12),Math.max(3,15*(1-fall*.6)),b.h,'#35586d',Math.sin(layer+1)*fall*.2);cube(lx,ly+7,lz,b.w-12,1,b.h-12,c,Math.sin(layer+1)*fall*.2);}
      ring(bx,bz,20+fall*66,'#ffbd72',2,2);return;
    }
    if(height<2){cube(bx,2,bz,b.w,3,b.h,'#1d3b43');ring(bx,bz,19,'#3a7e83',1,4);return;}
    cube(bx,height/2+2,bz,b.w,height,b.h,'#27415a');cube(bx,height+4,bz,b.w+4,6,b.h+4,'#3c6175');cube(bx,height+8,bz,b.w-14,3,b.h-14,'#102b3b');
    if(b.boss){ring(bx,bz,Math.max(b.w,b.h)*.8,'#ff637f',3,4);for(var arm=0;arm<4;arm++){var ba=arm*Math.PI/2+(reduced?0:time*.15),rx=bx+Math.cos(ba)*66,rz=bz+Math.sin(ba)*66;beam(bx,bz,rx,rz,26,'#60758e',7);cube(rx,20,rz,20,35,20,'#35475e',ba);cube(rx,40,rz,14,5,14,'#ff637f',ba);}cube(bx,height*.7,bz+b.h/2+2,b.w*.65,10,5,'#ff637f');cube(bx,height*.7,bz+b.h/2+6,16,16,6,shield?violet:gold);}
    cube(bx,height+10,bz,b.w-25,1,b.h-25,'#173c4b');ring(bx,bz,12,c,2,height+11);cube(bx+b.w*.3,height+20,bz-b.h*.25,2,19,2,'#7290a2');cube(bx+b.w*.3,height+31,bz-b.h*.25,5,3,5,c);cube(bx-b.w/2+.5,height/2,bz+b.h/2+.5,2,height,2,c);cube(bx+b.w/2-.5,height/2,bz+b.h/2+.5,2,height,2,c);
    for(var floor=0;floor<Math.ceil(height/18)-1;floor++)for(var k=0;k<3;k++){cube(bx-b.w*.31+k*b.w*.3,12+floor*18,bz+b.h/2+.5,9,4,1,(floor+k)%3?c:'#59778c');cube(bx+b.w/2+.5,12+floor*18,bz-b.h*.3+k*b.h*.3,1,4,8,(floor+k)%3?c:'#59778c');cube(bx-b.w*.31+k*b.w*.3,12+floor*18,bz-b.h/2-.5,9,4,1,(floor+k)%3?c:'#59778c');cube(bx-b.w/2-.5,12+floor*18,bz-b.h*.3+k*b.h*.3,1,4,8,(floor+k)%3?c:'#59778c');}
    if(shield){ring(bx,bz,Math.max(b.w,b.h)*.7,violet,3,2);for(var j=0;j<4;j++){var a=time*.4+j*Math.PI/2;cube(bx+Math.cos(a)*b.w*.7,height*.6,bz+Math.sin(a)*b.h*.7,3,height,3,violet);}}
    b.bolts.forEach(function(a){var ax=a.x-195,az=a.y-430;if(a.removed){ring(ax,az,6,'#325668',1);return;}ring(ax,az,10,shield?violet:gold,2);if(a.hp<a.maxHp)ring(ax,az,14,'#e5f4ff',2,2,1-a.hp/a.maxHp);cube(ax,7+(reduced?0:Math.sin(time*4)*1.2),az,8,12,8,shield?violet:gold,time*.35);});
    if(fall>0)for(var j=0;j<10;j++){var a=j*2.399,r=fall*70;cube(bx+Math.cos(a)*r,5+(1-fall)*22,bz+Math.sin(a)*r,5,5,5,j%2?c:gold,a+fall*4);}
   });
   g.scrap.forEach(function(s,i){cube(s.x-195,4+(i%2),s.y-430,5,5,5,i%3===0?gold:'#6eb8c8',s.rot);});
   var previous={x:g.car.x,y:g.car.y};g.cargo.forEach(function(s){beam(previous.x-195,previous.y-430,s.x-195,s.y-430,3,'#3d7e8e',1.5);cube(s.x-195,5,s.y-430,6,6,6,'#8bd4df',s.rot);previous=s;});
   var car=g.car,cx=car.x-195,cz=car.y-430,heading=-g.heading,carColor=g.rig==='hauler'?green:g.rig==='striker'?gold:cyan;
   if(g.lab){var l=g.lab;if(g.cargo.length>=4){if(l.weapon==='hammer'){beam(cx,cz,cx+23,cz,29,gold,4);cube(cx+26,30,cz,15,12,15,gold);}else if(l.weapon==='drill'){for(var di=0;di<4;di++)cube(cx,15,cz-25-di*4,12-di*2,12-di*2,5,cyan,time*7+di);}else ring(cx,cz,35,violet,3,12);}if(l.shield>0)ring(cx,cz,110,'#96ffd4',3,8);if(l.shot&&l.shot.life>0){var sh=l.shot;if(sh.kind==='drill')beam(cx,cz,sh.target.x-195,sh.target.y-430,12,cyan,6);else ring(sh.x-195,sh.y-430,10+(1-sh.life/.65)*135,sh.kind==='shield'?green:gold,4,4);}}
   cube(cx,1,cz,35,1,44,'#070d17',heading);cube(cx,8,cz,27,12,35,'#346078',heading);cube(cx,17,cz,19,10,21,'#183649',heading);cube(cx,23,cz,13,2,15,carColor,heading);
   [-1,1].forEach(function(side){var tx=cx+Math.cos(heading)*side*17,tz=cz-Math.sin(heading)*side*17;cube(tx,6,tz,8,11,34,'#101a2a',heading);cube(tx,12,tz,5,1,27,'#4b7789',heading);var fx=cx+Math.cos(heading)*side*8-Math.sin(heading)*23,fz=cz-Math.sin(heading)*side*8-Math.cos(heading)*23;cube(fx,8,fz,5,8,13,carColor,heading);});
   ring(cx,cz,g.radius(),g.boost>0?violet:'#2c626c',1.4,1.8);if(g.activeBolt){var ax=g.activeBolt.x-195,az=g.activeBolt.y-430;beam(cx,cz,ax,az,10,cyan,2);if(!reduced)for(var j=0;j<5;j++){var t=(time*2.4+j/5)%1;cube(ax+(cx-ax)*t,11+Math.sin(t*Math.PI)*8,az+(cz-az)*t,3,3,3,'#c9fbff');}}
   if(!reduced)g.trail.forEach(function(t){cube(t.x-195,2,t.y-430,15*t.life/.25,1,12*t.life/.25,'#665b96',-t.heading);});
   if(g.boost>0){var rearX=cx+Math.sin(heading)*25,rearZ=cz+Math.cos(heading)*25;cube(rearX,8,rearZ,10,5,12+(reduced?0:Math.sin(time*35)*4),violet,heading);}
   if(g.airlift&&g.airlift.life>0){var t=reduced?1:1-g.airlift.life/1.2,dx=g.airlift.x-195+(67-g.airlift.x)*t,dz=g.airlift.y-430+(584-g.airlift.y)*t,dy=35+Math.sin(t*Math.PI)*42;cube(dx,dy,dz,15,7,15,green);cube(dx,dy-7,dz,10,8,10,'#315965');[-1,1].forEach(function(s){[-1,1].forEach(function(z){beam(dx,dz,dx+s*12,dz+z*12,dy,'#668995',2);cube(dx+s*12,dy+2,dz+z*12,12,1,2,cyan,reduced?0:time*25*s);});});}
   if(fx){fx.particles().forEach(function(p){var size=p.size*Math.max(.2,p.life/p.max);cube(p.x-195,p.y,p.z-430,size,size,size,p.color,p.life*3);});fx.bursts().forEach(function(p){ring(p.x-195,p.z-430,6+(1-p.life/p.max)*p.r,p.color,Math.max(.5,2*p.life/p.max),2.2);});}
   if(g.mission&&g.mission.passenger!==null)cube(cx,30,cz,9,9,9,gold,heading);
   g.pulses.forEach(function(p){ring(p.x-195,p.y-430,p.r*Math.sqrt(1-p.life/p.max),violet,3,2);});
   if(g.storm.active){ring(g.storm.x-195,g.storm.y-430,g.storm.r,violet,4,2);for(var i=0;i<9;i++){var a=time*2+i*Math.PI*2/9;cube(g.storm.x-195+Math.cos(a)*g.storm.r,15+Math.sin(time*3+i)*7,g.storm.y-430+Math.sin(a)*g.storm.r,3,22,3,violet,a);}}
  }
  function attrib(p,name,size,stride,offset){var loc=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,stride,offset);return loc;}
  function prepare(time,reduced){var dt=lastTime===null?0:Math.max(0,Math.min(.05,time-lastTime));lastTime=time;angle=reduced?targetAngle:angle+(targetAngle-angle)*(1-Math.exp(-12*dt));if(Math.abs(targetAngle-angle)<.0001)angle=targetAngle;lastCam=camera(angle,rect.w/rect.h,rect.h<400?1.3:1);}
  function render(game,view,hud,time,fx,focus){
   if(lost||failed)return false;
   gl.disable(gl.SCISSOR_TEST);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.024,.055,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   if(game){prepare(time,fx&&fx.reduced());vertices.length=0;scene(game,time,fx,focus);var x=Math.round(view.x+rect.x*view.s),y=Math.round(canvas.height-view.y-(rect.y+rect.h)*view.s),w=Math.round(rect.w*view.s),h=Math.round(rect.h*view.s);gl.viewport(x,y,w,h);gl.enable(gl.SCISSOR_TEST);gl.scissor(x,y,w,h);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.disable(gl.BLEND);gl.useProgram(sceneProgram);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);var attrs=[attrib(sceneProgram,'aPosition',3,36,0),attrib(sceneProgram,'aNormal',3,36,12),attrib(sceneProgram,'aColor',3,36,24)];gl.uniformMatrix4fv(gl.getUniformLocation(sceneProgram,'uVP'),false,lastCam.matrix);gl.drawArrays(gl.TRIANGLES,0,vertices.length/9);attrs.forEach(function(a){gl.disableVertexAttribArray(a);});}
   gl.disable(gl.SCISSOR_TEST);gl.disable(gl.DEPTH_TEST);gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.useProgram(hudProgram);gl.bindBuffer(gl.ARRAY_BUFFER,quad);var attrs=[attrib(hudProgram,'aPosition',2,16,0),attrib(hudProgram,'aUV',2,16,8)];gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
   if(textureW!==hud.width||textureH!==hud.height){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,hud);textureW=hud.width;textureH=hud.height;}else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,hud);
   gl.uniform1i(gl.getUniformLocation(hudProgram,'uHUD'),0);gl.drawArrays(gl.TRIANGLES,0,6);attrs.forEach(function(a){gl.disableVertexAttribArray(a);});return true;
  }
  return{layout:function(compact){rect.h=compact?282:458;},render:render,prepare:prepare,rotate:function(step){targetAngle+=step;},reset:function(){targetAngle=angle+Math.atan2(Math.sin(.38-angle),Math.cos(.38-angle));},groundPoint:function(p){if(!lastCam)return null;var hit=ground(p,lastCam,rect);return hit.x>=20&&hit.x<=370&&hit.y>=238&&hit.y<=625?hit:null;},project:function(x,y,height){return project([x-195,height||0,y-430],lastCam||camera(angle,rect.w/rect.h),rect);},status:function(){return lost?'lost':failed?'failed':'ready';}};
 }
 create.camera=camera;create.project=project;create.ground=ground;if(typeof module!=='undefined')module.exports=create;else root.createMagnet3D=create;
})(typeof globalThis!=='undefined'?globalThis:this);
