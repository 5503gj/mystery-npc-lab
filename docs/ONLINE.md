# 在线规则体验部署

公开入口：https://5503gj.github.io/mystery-npc-lab/ 。访客不需要安装Python、不需要Key或账号。

原有三页剧情、NPC问答、证据板、调查助手和导出可直接使用。在线版不请求Ollama或本地API；界面明确显示规则模式。页面会话笔记刷新清空。

## 能力与数据边界

不含在线大模型推理、账号或跨设备存档。Python服务版仍保留；需要模型时须独立部署Ollama及服务端。

原有Python服务不被替换。浏览器版与服务版的存储和连接方式不同，不能把页面会话当作企业持久化、云端同步或身份认证。

## 构建与验证

运行 `python scripts/build_online.py`，再运行 `npm run test:online`。构建目录dist仅包含公开资源，不包含.git、.env或服务端密钥。dist和运行时缓存忽略提交。

工作流 `.github/workflows/test.yml` 在原测试通过后构建、执行在线浏览器回归；仅main推送发布，部署依赖测试成功。浏览器测试以子目录路径提供资源，实际调用工具和导出，验证响应式并检查没有本地API或上传请求。

