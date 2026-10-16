'use strict';
var start = require('./src/salvage-app');
var core = require('./src/salvage-core');
var cloudClient = require('./src/cloud-client')(wx, require('./src/cloud-config'));
cloudClient.connect();
var canvas = wx.createCanvas();
var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
var ratio = Math.min(info.pixelRatio || 1, 2);
var menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
var safeTop = Math.max(info.safeArea ? info.safeArea.top : 24, menu ? menu.bottom + 8 : 24);
canvas.width = info.windowWidth * ratio;
canvas.height = info.windowHeight * ratio;
var displayCanvas=canvas,scene3D=require('./src/scene3d')(displayCanvas);
if(scene3D){canvas=wx.createCanvas();canvas.width=displayCanvas.width;canvas.height=displayCanvas.height;}
wx.showShareMenu({withShareTicket: true});
wx.onShareAppMessage(function () { return {title:'开着磁吸车，吸走整栋楼！磁吸拆迁队',query:require('./src/social').query(core.day())}; });
start({
  canvas: canvas,
  scene3D:scene3D,
  autoLogin:wx.getStorageSync('mgt-login-enabled')===true,
  rememberLogin:function(enabled){try{wx.setStorageSync('mgt-login-enabled',enabled);}catch(e){}},
  login:function(){return cloudClient.login();},
  leaderboard:function(){return cloudClient.leaderboard();},
  raceStart:function(){return cloudClient.raceStart();},
  raceFinish:function(session,seconds){return cloudClient.raceFinish(session,seconds);},
  onLaunchQuery:function(fn){wx.onShow(function(options){if(options&&options.query&&options.query.mode==='daily')fn(options.query);});},
  cloudStatus: function () { return cloudClient.status(); },
  cloudError: function () { return cloudClient.errorCode(); },
  cloudRetry: function () { return cloudClient.retry(); },
  cloudFeatures: function () { return cloudClient.features(); },
  cloudLoad: function () { return cloudClient.load(); },
  cloudSave: function (data, revision) { return cloudClient.save(data, revision); },
  backupLocal: function (data) { try { wx.setStorageSync('mgt-before-cloud-restore',JSON.stringify(data)); } catch(e) { return false; } return true; },
  loadRestoreBackup: function () { try { return JSON.parse(wx.getStorageSync('mgt-before-cloud-restore')||'null'); } catch(e) { return null; } },
  insets: {top:safeTop*ratio,bottom:(info.safeArea ? Math.max(0,info.windowHeight-info.safeArea.bottom) : 12)*ratio},
  launch: wx.getLaunchOptionsSync().query || {},
  frame: function (fn) { requestAnimationFrame(fn); },
  feedback: function (type) { try { wx.vibrateShort({type:type === 'collapse' ? 'heavy' : 'light'}); } catch(e) {} },
  load: function () { try { return JSON.parse(wx.getStorageSync('magnet-crew-v5') || '{}'); } catch(e) { return {}; } },
  save: function (data) { try { wx.setStorageSync('magnet-crew-v5', JSON.stringify(data)); return true; } catch(e) { return false; } },
  share: function (title, query) { wx.shareAppMessage({title:title,query:query}); },
  event: function (name, data) { if(wx.reportEvent) wx.reportEvent(name,data); },
  visibility: function (fn) { wx.onHide(function () { fn(true); }); wx.onShow(function () { fn(false); }); },
  input: function (fn) {
    function touch(type,e) { var t=(e.changedTouches || e.touches)[0];if(t)fn(type,{x:t.clientX*ratio,y:t.clientY*ratio}); }
    wx.onTouchStart(function(e){touch('down',e);});wx.onTouchMove(function(e){touch('move',e);});wx.onTouchEnd(function(e){touch('up',e);});wx.onTouchCancel(function(e){touch('cancel',e);});
  }
},core);
