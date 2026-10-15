# V9.2 共享云功能

资源方：D:/openaiwork/02zyzsHelper/zhiyuan-v4，AppID wx0ece3f0f726260d2。
游戏 AppID wx775f636a27645c9d，共享环境 zhiyuanzhushou-d5ghren6ta5622bdc（上海）。共享授权与小游戏初始化健康检查此前已验证。

## 数据与权限

仅更新游戏专用 mgt_gateway，cloudbase_auth 沿用此前部署。游戏集合 mgt_saves、mgt_races、mgt_scores 均为 ADMINONLY，前端只能调用网关。资源方其他函数与集合不作修改。mgt_scores 建有 date/seconds/_id 复合索引。

网关只接受 cloud.getWXContext() 返回的 FROM_APPID 与 FROM_OPENID，用户标识在服务端哈希；事件参数不能指定身份、集合或任意函数。登录返回系统代号，不返回 OpenID。公开榜单只返回系统代号、用时和是否本人。

health/load/save 为原接口；login/leaderboard/raceStart/raceFinish 为新增接口。每个账号只保留最近一次开局凭证；换设备开新局会使旧局失效。凭证限当日且一小时内有效，实际游戏用时需在 10～1800 秒内，服务端时间必须足够。成绩事务只保留更快值，相同凭证及相同成绩重试幂等。相同用时同名次。

这些边界不能证明玩家真实完成拆楼：目前无服务端操作回放，不设排名奖励。不能作为竞技、支付或防作弊经济账本。历史每日成绩按日期保留，暂未配置自动删除策略。

## 游戏内使用

首页通行证 → 登录；首页每日榜 → 查看、刷新、邀请、开局。首次登录保存登录选择，随后重新验证平台身份。退出本次登录清除登录选择，仍保留本机数据。云备份为独立的手动流程，不随登录自动覆盖。

云存档支持 stageBest 星章记录；旧云存档缺少该字段时按空记录处理。恢复前保留本机回退副本，仍需确认。浏览器不连接微信身份，仅用于离线玩法与视觉验证。

## 运维

- npm test：34 项，涵盖玩法、界面交互、身份边界、竞速事务、分享参数、八关实际移动通关与存档兼容。
- node scripts/prepare-social-storage.cjs：只创建 mgt_races/mgt_scores 私有集合及游戏索引。
- node scripts/verify-social-storage.cjs：随机隔离测试账号验证真实数据库读写，完成后移除临时记录。
- node scripts/verify-cloud-storage.cjs：真实存档事务回归，不操作真实玩家存档。
- node scripts/update-mgt-gateway.cjs：只更新游戏网关。
- node scripts/verify-gateway-code.cjs：下载并比较 7 份部署文件哈希。

SDK 的管理端调用拥有资源方权限，可能保留平台运行上下文，不能作为普通玩家鉴权的有效性证明；鉴权边界由独立 handler 测试覆盖，跨应用身份的多账号手机实机验证仍待进行。

私钥、临时凭据、云端代码备份及本地验证回执不入 Git 或前端代码包。新增功能前备份在 .cloud-backup/mgt-gateway-before-social，原始备份在 .cloud-backup/mgt-gateway-before-save。

V9.2.0 已于 2026-10-15 使用登录账号“小明大爱”通过官方微信开发者工具 CLI 上传为开发版本，代码包 54,780 字节；未提审或发布。
