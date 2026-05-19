# 逻辑之王推理工坊使用说明

这是一个中文本格推理小说创作原型 Web 应用。它通过本地网页调用 AI 模型，按阶段生成案件方案、真相、时间线、线索、公平推理检查、章节大纲和正文。

## 1. 启动项目

进入项目目录：

```powershell
cd E:\xuexi\detective-novel-lab
```

安装依赖：

```powershell
npm install
```

启动开发服务器：

```powershell
npm run dev -- -p 3000
```

打开浏览器访问：

```text
http://localhost:3000
```

## 2. 配置模型

项目使用 `.env` 存放模型配置。可以参考 `.env.example`。

DeepSeek 配置示例：

```env
AI_PROVIDER=deepseek

DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

硅基流动配置示例：

```env
SILICONFLOW_API_KEY=你的硅基流动密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V4-Flash
```

修改 `.env` 后，需要重启开发服务器。

## 3. 网页使用流程

网页默认进入“快速模式”。快速模式适合日常使用：

1. 输入你的故事大纲、人物、线索和要求。
2. 点击“生成故事大概”。
3. 你确认故事大概，或在“修改意见”里要求重生成。
4. 点击“确认并生成完整小说”。
5. 系统会在后台自动生成章节大纲，并逐章生成全文。

快速模式会在“故事大概”里显示幕后真相、凶手、诡计、公平线索和可能漏洞，方便你作为创作者判断是否满意。右上角可以切换“显示/隐藏真相”。

快速模式按钮说明：

- `生成故事大概`：根据你输入的大纲生成标准版故事大概。
- `按意见重生成`：根据“修改意见”重写故事大概。
- `仅确认大概`：保存当前故事大概，不立刻生成全文。
- `确认并生成完整小说`：自动生成章节大纲，并按所选篇幅逐章生成完整小说。

左侧也可以切换到“专家模式”。专家模式保留原来的 8 个创作阶段：

1. 素材输入
2. 案件方案
3. 真相骨架
4. 嫌疑人与时间线
5. 线索与红鲱鱼
6. 公平推理检查
7. 章节大纲
8. 正文生成

专家模式推荐流程：

1. 在“创作素材”中填写人物、场景、已有线索和大纲灵感。
2. 选择案件类型，例如“密室杀人”。
3. 点击“生成本阶段”。
4. 查看 AI 草案。
5. 如果满意，点击“采用并进入下一步”。
6. 如果不满意，在“本轮修改要求”里写修改意见，再点击“按要求重生成”。
7. 重复直到完成正文。

每一步生成的内容会自动保存到浏览器本地 `localStorage`。

## 4. 按方案生成完整小说

如果要按照固定方案自动分章调用 DeepSeek 生成完整小说，可以运行脚本：

```powershell
node scripts/generate-deepseek-novel.mjs
```

这个脚本会调用本地网站接口：

```text
http://localhost:3000/api/generate
```

它不会绕过网站直连模型。

当前脚本内置的是“听雪馆第十三把钥匙”方案，会生成 7 章正文并合并成最终文件。

输出位置：

```text
outputs\听雪馆第十三把钥匙.deepseek.md
```

分章文件位置：

```text
outputs\deepseek-key-chapter-01.md
outputs\deepseek-key-chapter-02.md
...
outputs\deepseek-key-chapter-07.md
```

## 5. 导出

网页右上角提供：

- 复制全文
- 导出 Markdown
- 导出 TXT
- 显示/隐藏幕后真相

如果使用脚本生成，最终 Markdown 文件会直接保存在 `outputs` 目录。

## 6. 常见问题

### 页面生成的是离线示例

说明 `.env` 没有正确配置 API Key，或服务器没有重启。

处理方式：

```powershell
Ctrl+C
npm run dev -- -p 3000
```

### 修改了模型但没有生效

Next.js 读取 `.env` 通常发生在服务启动时。修改 `.env` 后需要重启服务器。

### PowerShell 里中文显示乱码

这通常只是终端编码显示问题，文件本身是 UTF-8。可以用编辑器打开 `.md` 文件查看。

### 浏览器控制台出现 content-script / Range / Invalid URL 报错

如果控制台出现类似：

```text
Failed to construct 'URL': Invalid URL
content-script.js
helper.aisouziyuan.com
Failed to execute 'setEnd' on 'Range'
579.js / 861.js
```

这些通常来自浏览器扩展注入脚本，不是本项目代码。项目已经加入扩展错误隔离脚本，并给文本框加了 `translate="no"`、`data-gramm="false"` 等属性，减少翻译、划词、AI 助手类扩展扫描长文本时的崩溃。

如果仍然刷屏，建议用无痕窗口或临时关闭划词翻译、资源搜索、AI 助手类扩展后再测试。

### 生成内容跑偏

可以在“本轮修改要求”中明确写：

```text
不要改变核心诡计，不要新增案件类型，不要改凶手，只按当前方案继续。
```

对于脚本生成，可以修改：

```text
scripts/generate-deepseek-novel.mjs
```

其中的 `brief`、`lockedPlan` 和 `chapterDirections` 控制故事方案、章节结构和每章要求。

## 7. 项目结构

```text
app/
  api/generate/route.ts    # AI 调用接口
  page.tsx                 # Web 工作台页面
  globals.css              # 页面样式

scripts/
  generate-deepseek-novel.mjs  # 分章生成完整小说脚本

outputs/
  *.md                     # 生成的小说和阶段草稿

.env.example               # 环境变量模板
.env                       # 本地密钥配置，不应提交或公开
```

## 8. 安全提醒

`.env` 里包含 API Key，已经被 `.gitignore` 忽略。不要把 `.env` 发给别人，也不要提交到 Git 仓库。
