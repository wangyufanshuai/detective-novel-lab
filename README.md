# 逻辑之王推理工坊使用说明

这是一个中文本格推理小说创作原型 Web 应用。它通过本地网页调用 AI 模型，支持快速生成和专家分阶段创作。

## 1. 启动项目

```powershell
cd E:\xuexi\detective-novel-lab
npm install
npm run dev -- -p 3000
```

打开：

```text
http://localhost:3000
```

## 2. 配置模型

复制 `.env.example` 为 `.env`，填入密钥。

DeepSeek 示例：

```env
AI_PROVIDER=deepseek

DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

硅基流动示例：

```env
SILICONFLOW_API_KEY=你的硅基流动密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Flash
```

修改 `.env` 后需要重启开发服务器。

## 3. 快速模式

网页默认进入“快速模式”。适合日常使用：

1. 输入故事大纲、人物、线索和要求。
2. 点击 `生成故事大概`。
3. 如果不满意，在“修改意见”里写要求，点击 `按意见重生成`。
4. 满意后点击 `确认并生成完整小说`。
5. 系统会自动生成章节大纲，并逐章生成全文。

快速模式会在“故事大概”里显示幕后真相、凶手、诡计、公平线索和可能漏洞，方便创作者判断是否满意。右上角可以切换显示或隐藏真相。

## 4. 专家模式

左侧可以切换到“专家模式”。专家模式保留 8 个创作阶段：

1. 素材输入
2. 案件方案
3. 真相骨架
4. 嫌疑人与时间线
5. 线索与红鲱鱼
6. 公平推理检查
7. 章节大纲
8. 正文生成

每一步都可以生成、修改、采用并进入下一步。

## 5. 脚本生成

按固定方案调用本地网站 API 生成完整小说：

```powershell
node scripts/generate-deepseek-novel.mjs
```

快速模式新题材测试：

```powershell
node scripts/run-quick-mode-test.mjs
```

这些脚本调用的是本地接口：

```text
http://localhost:3000/api/generate
```

不会绕过网站直连模型。

## 6. 输出位置

生成文件位于：

```text
outputs/
```

示例：

```text
outputs\听雪馆第十三把钥匙.deepseek.md
outputs\quick-test-astronomy-deepseek.md
```

网页右上角也支持复制全文、导出 Markdown 和导出 TXT。

## 7. 常见问题

### 页面生成的是离线示例

说明 `.env` 没有正确配置 API Key，或服务没有重启。

### 修改模型后没有生效

Next.js 通常在服务启动时读取 `.env`。修改 `.env` 后请重启：

```powershell
npm run dev -- -p 3000
```

### 浏览器控制台出现 content-script / Range / Invalid URL 报错

这些通常来自浏览器扩展注入脚本，不是本项目代码。项目已加入扩展错误隔离脚本，并给文本框加了 `translate="no"`、`data-gramm="false"` 等属性。

如果仍然刷屏，建议用无痕窗口，或临时关闭划词翻译、资源搜索、AI 助手类扩展。

## 8. 项目结构

```text
app/
  api/generate/route.ts        # AI 调用接口
  page.tsx                     # Web 工作台页面
  globals.css                  # 页面样式

scripts/
  generate-deepseek-novel.mjs  # 固定方案生成脚本
  run-quick-mode-test.mjs      # 快速模式测试脚本

outputs/
  *.md                         # 生成的小说和阶段草稿

.env.example                   # 环境变量模板
.env                           # 本地密钥配置，不应提交
```

## 9. 安全提醒

`.env` 包含 API Key，已经被 `.gitignore` 忽略。不要把 `.env` 发给别人，也不要提交到 Git 仓库。
