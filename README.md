# Deduction Engine

Deduction Engine 是一个中文本格推理游戏原型。系统先生成结构化真相，再让 LLM 写玩家可见案卷；玩家通过询问角色、搜索场景、比对证据和提交推理完成破案。

## 启动

```powershell
cd E:\xuexi\detective-novel-lab
npm install
npm run dev -- -p 3000
```

打开：

```text
http://localhost:3000
```

## 模型配置

复制 `.env.example` 为 `.env`，填入密钥。DeepSeek 示例：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的DeepSeek密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
```

修改 `.env` 后需要重启开发服务器。

## Deduction Game 流程

1. 输入题材与约束。
2. 点击 `生成可玩案件`。
3. 系统生成结构化真相 JSON，并用规则引擎校验唯一凶手、时间线和关键证据。
4. 系统生成玩家可见案卷，不泄露凶手和幕后真相。
5. 玩家询问角色、搜索场景、查看人物关系图和证据图。
6. 玩家提交凶手、动机、手法和证据链。
7. 本地规则引擎判定推理是否成立，LLM 只负责解释判定结果。

## 结构化模型

核心类型在 `lib/deduction.ts`：

- `CaseTruth`：凶手、动机、手段、机会、真实时间线。
- `Character`：身份、关系、秘密、动机、手段、机会、证词。
- `Evidence`：发现地点、可见描述、真实含义、关联人物和时间。
- `Scene`：可搜索区域和可发现证据。
- `PlayerTheory`：玩家提交的凶手、动机、手法和证据链。

## API 阶段

仍使用现有接口：

```text
POST /api/generate
```

新增游戏阶段：

- `gameTruthSeed`：生成结构化真相 JSON。
- `gameCaseFile`：把结构化真相写成玩家可见案卷。
- `gameDialogue`：按角色和已知信息生成问答。
- `gameJudgement`：解释规则引擎的判定结果。

保留小说生成阶段：

- `quickSynopsis`
- `quickOutline`
- `quickChapter`

## 测试脚本

使用现有 DeepSeek API 生成测试案件并保存日志：

```powershell
node scripts/run-deduction-game-test.mjs
```

输出位于：

```text
outputs/deduction-game-test-case.json
outputs/deduction-game-test-log.md
```

## 其他脚本

旧小说生成脚本仍保留：

```powershell
node scripts/generate-deepseek-novel.mjs
node scripts/run-quick-mode-test.mjs
```

## 安全

`.env` 包含 API Key，已被 `.gitignore` 忽略，不要提交到 Git 仓库。
