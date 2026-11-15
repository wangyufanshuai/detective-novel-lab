# 已结案手记回看

本轮把结案后的调查记录接到正式手记入口。玩家在领取下一宗委托后，仍可从河湾手记里回看已经结案的案件。

归档只在当前案件已经被服务器判定为结案时生成。记录来自公开调查视图，包含结案标题、动机、手法、已取得物证、当面证词、真实时间线和三段结局。原始案例包、未发现物证、居民私密字段和草稿不会进入归档。

归档使用当前浏览器的 `localStorage`，按 `worldId` 分开保存。刷新页面会恢复同一手记，切换到另一份独立手记不会读取旧案。读取损坏数据时保留原值并在手记中提示，浏览器存储失败时保留当前页面内的记录并提示导出。

在「河湾手记」页可以打开已结案手记，按三个页签查看完整经过、物证和证词。每宗案件都可以单独导出 Markdown，整本手记导出也会包含本机已有的完整旧案和没有完整留存的结案摘要。

实现位于 `app/town-play/case-archive.ts`、`useTownCaseArchive.ts` 和 `TownCaseArchive.tsx`，正式入口接在 `TownPlayClient.tsx`。这是玩家端留存层，后端案件存档仍由现有 SQLite 会话负责。

验证包括 `node scripts/run-town-archive-checks.mjs`、`node scripts/run-town-notebook-checks.mjs`、`node scripts/run-town-followup-checks.mjs` 和 TypeScript 检查。归档回归覆盖结案门槛、公开字段白名单、重复刷新、同一手记多宗案件、世界隔离、损坏数据、存储配额失败、Markdown 内容和只读回看页面。

本轮没有部署或更新正式站。桌面和手机的回看页面曾在内置浏览器中验证，临时验收页已移除。
