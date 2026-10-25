---
name: evidence-director
description: "维护 Mystery NPC Lab 的证据工作台、人物对话和可追溯调查摘要；用于本仓库案件交互或调查工具扩展。"
---

# evidence-director

1. 先读 PRODUCT.md、DESIGN.md、public/investigation.js 与 public/common.js；可信场景目录来自 public/catalog.js，服务端校验仍是边界。

2. 调查摘要只采纳当前案件已发现证据和实际对话，并区分现场事实、角色说法和玩家笔记。不要把猜测呈现为定论或输出未发现事实。

3. 切案件或角色时保留 Conversation 的取消/轮次保护；用户与模型文本用 textContent 渲染，不拼成HTML。

4. 新静态资源需要加入 server.py 专用白名单及正确MIME，不能开放项目根目录。记录和引用保持有界，导出不包含隐藏目录数据或凭证。

5. 验证用 python -m unittest discover -s tests -v 及 npm run test:browser，浏览器覆盖三页、恶意文本、切案和调查结果来源。

6. 角色和剧本第三方授权状态见README，新增公开内容要记录来源；按已有用户请求的范围更新GitHub。

在线版入口与构建见docs/ONLINE.md。浏览器和服务版本共用核心；修改后运行npm run test:online，保留以上在线能力边界，不把浏览器会话标成云端同步。
