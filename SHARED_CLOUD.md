# 共享云存档：当前状态

资源方项目：D:/openaiwork/02zyzsHelper/zhiyuan-v4
资源方 AppID：wx0ece3f0f726260d2
环境：zhiyuanzhushou-d5ghren6ta5622bdc（上海）
游戏 AppID：wx775f636a27645c9d

## 已完成

用户已完成环境共享授权；微信开发者工具的游戏首页已实际显示“云端已连接”，验证了跨账号初始化和 mgt_gateway 健康检查。

云端只使用游戏专用 mgt_gateway 与 mgt_saves 集合。mgt_saves 权限已验证为 ADMINONLY，前端不直接访问数据库。网关只信任平台 FROM_APPID 和 FROM_OPENID，以服务端计算的用户哈希作为文档 ID；不接受客户端指定集合、函数或其他用户 ID。原项目的 config/user/goods/article/order/pay/payNotify/admin 函数未由本次脚本更新，其他集合也未由本次脚本修改。

已部署的网关支持 health、load、save。备份使用事务和 expectedRevision 检查，版本过期返回 MGT_SAVE_CONFLICT，不覆盖新版本。存档字段及体积在服务器校验；只在明确的“文档不存在”异常下创建首份记录，其他数据库错误必须返回失败。

## 游戏内使用

首页云图标 → 云端存档。先读取并比较本机和云端，再选择“备份本机”或“恢复云端”，最后确认。恢复前保留本机副本，可用“撤销恢复”回退。没有自动覆盖或自动合并，备份不改变本机进度。

网络失败仍能离线玩。浏览器保持离线试玩，不连接微信账号。存档属于单机进度备份，不是防作弊经济账本或支付依据；公共排行榜仍未开放。

前端 V9.0.0 已于 2026-10-15 由登录账号小明大爱通过官方 CLI 上传为开发版本（42,815 字节），未提审或发布；微信开发者工具如果仍显示旧界面，请手动编译/重启游戏。没有替用户点击真实账号的备份或恢复，也未做手机真机验收。

## 验证与运维

- npm test：游戏、前端确认/恢复/撤销流程、云端鉴权、数据校验和冲突保护。
- node scripts/verify-cloud-storage.cjs：使用与云函数一致的微信 SDK，针对独立随机测试文档验证实库读写和冲突，最终删除该临时记录；不操作真实玩家存档。
- node scripts/verify-gateway-code.cjs：后台下载 mgt_gateway，逐文件比对五份部署文件哈希。
- node scripts/cloud-status.cjs：只读查询原有业务函数与游戏函数状态。
- node scripts/update-mgt-gateway.cjs：仅更新 mgt_gateway，要求存在此前下载的备份。不会部署原项目的全部函数。

部署前代码保留在 .cloud-backup/mgt-gateway-before-save。备份目录、脚本、后端函数与 *.local.json 回执不进入小游戏前端包；私钥、临时凭据及测试报告不入 Git。脚本通过资源方现有凭据与官方接口获取短期调用凭证，不输出或持久化密钥，不强制刷新 access_token。
