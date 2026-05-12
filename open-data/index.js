/**
 * 磁吸拆迁队 - 开放数据域
 * 用于微信好友排行榜
 * 此文件运行在独立的开放数据域上下文中
 */

var sharedCanvas = wx.getSharedCanvas();
var ctx = sharedCanvas.getContext('2d');
var friendData = [];

// 监听主域消息
wx.onMessage(function(data) {
  if (data.action === 'getFriendRank') {
    getFriendRank();
  }
});

function getFriendRank() {
  wx.getFriendCloudStorage({
    keyList: ['best_score'],
    success: function(res) {
      friendData = [];
      if (res && res.data) {
        for (var i = 0; i < res.data.length; i++) {
          var item = res.data[i];
          var score = 0;
          var level = 1;
          if (item.KVDataList && item.KVDataList.length > 0) {
            try {
              var val = JSON.parse(item.KVDataList[0].value);
              score = val.score || 0;
              level = val.level || 1;
            } catch(e) {
              score = parseInt(item.KVDataList[0].value) || 0;
            }
          }
          friendData.push({
            name: item.nickname || '???',
            avatar: item.avatarUrl || '',
            score: score,
            level: level
          });
        }
      }
      friendData.sort(function(a, b) { return b.score - a.score; });
      drawFriendRank();
    },
    fail: function() {
      drawNoData();
    }
  });
}

function drawFriendRank() {
  var w = sharedCanvas.width;
  var h = sharedCanvas.height;

  ctx.clearRect(0, 0, w, h);

  if (!friendData.length) {
    drawNoData();
    return;
  }

  // V3.0.9: 适配主域drawImage位置
  var itemH = 42;
  var startY = 0;
  var medals = ['🥇', '🥈', '🥉'];

  // 表头
  ctx.fillStyle = '#6b7db3';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('排名', 22, startY + 10);
  ctx.textAlign = 'center';
  ctx.fillText('玩家', w / 2 - 20, startY + 10);
  ctx.textAlign = 'right';
  ctx.fillText('得分', w - 22, startY + 10);
  startY += 24;

  for (var i = 0; i < Math.min(friendData.length, 10); i++) {
    var y = startY + i * itemH;
    var d = friendData[i];

    // 背景
    ctx.fillStyle = i < 3 ? 'rgba(255,224,51,0.08)' : 'rgba(30,35,60,0.3)';
    ctx.fillRect(15, y, w - 30, itemH - 4);

    // 排名
    ctx.fillStyle = i < 3 ? ['#FFD700', '#C0C0C0', '#CD7F32'][i] : '#6b7db3';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(i < 3 ? medals[i] : (i + 1) + '.', 25, y + itemH / 2 - 2);

    // 名字
    ctx.fillStyle = '#e0e8ff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    var name = d.name;
    if (name.length > 8) name = name.substring(0, 8) + '...';
    ctx.fillText(name, 55, y + itemH / 2 - 2);

    // 关卡
    ctx.fillStyle = '#6b7db3';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('L' + d.level, w / 2 + 30, y + itemH / 2 - 2);

    // 分数
    ctx.fillStyle = '#00ff88';
    ctx.textAlign = 'right';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(d.score + '分', w - 25, y + itemH / 2 - 2);
  }
}

function drawNoData() {
  var w = sharedCanvas.width;
  var h = sharedCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#6b7db3';
  ctx.font = '15px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('暂无好友数据', w / 2, h / 2 - 20);
  ctx.font = '12px Arial';
  ctx.fillText('完成关卡后分数将自动上传', w / 2, h / 2 + 10);
}
