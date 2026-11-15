# 找人与当面核对衔接

本轮在案件本查阅功能之后继续完善玩家调查流程。后端接口、判案规则、案件事实及居民日程未修改，正式站没有更新。

## 玩家可见变化

- 案件本「证词」页增加调查人物目录：列出公开嫌疑人和已经留下证词的人，区分尚未询问、已询问、说法已更正。
- 目录显示玩家已知的上次目击地点、故事天数与时间；可定位的地点提供地图标记入口，也可直接筛出该人物的证词。
- 案件看板选中人物后，同样可以标记其上次目击地点。只读取收到的公开目击记录，不把旧目击标成实时位置，不猜测住处或日程。
- 街角交谈与地点调查在出示前展示已取得物证的正文。预览不发送调查命令，明确点击出示才使用现有命令。
- 若已经向此人出示过该物证，显示原有核对结果，并提示再次出示仍需五分钟。没有出示过的组合不会预告结果。
- 街角交谈可以展开最初记下的原话，对照当前记录。更正记录不再被标为原话。
- 切换交谈人物或案件时清空物证选择；离场状态沿用原有在场校验，不能远程询问或出示。

只为可在现有地点列表中定位的目击提供标记按钮；未知或无法定位的地点保留说明，不生成无效按钮。

## 修改范围

`app/town-play/` 下的 `TownInvestigation.tsx`、`TownCaseBoard.tsx`、`TownStreetConversation.tsx`、`TownPlayClient.tsx`、`TownEvidencePreview.tsx`、`case-notebook.ts`、`town-play.module.css`。视觉沿用现有纸张、森林绿、黄铜令牌。

导航接入现有 `markScene` 回调，不新增传送、到访或时间推进操作。与 Claude 的后端分工保持不变。

## 验证

- `node scripts/run-town-followup-checks.mjs`：公开人物目录、未知人物、可定位地点、私密字段不传播、已发现物证边界、人与物证组合的历史隔离、原话对照、离场禁用，以及输入不被修改等行为检查通过。
- `node scripts/run-town-notebook-checks.mjs`：上一轮草稿、物证编号和引用检查通过。
- `node scripts/run-riverbend-case-checks.mjs`：13 项通过，包含真实命令、隔离 SQLite、三宗结案、归档与存档重读；报告为 `outputs/riverbend-case-jB6swH/report.json`。
- TypeScript 检查和改动文件的 `git diff --check` 通过。

内置浏览器在临时组件验收页中实际检查了：人物目录展开、目击地点标记、人物证词筛选、看板定位、原话展开、物证预览、两种已有核对结果、离场禁用、切换人物清空选择、明确点击出示才触发一次命令，以及 390×844 / 1280×720 的布局。标记、筛选、预览、展开原话时命令计数未增加。

页面使用上一轮隔离测试的真实公开命令回执；人物在场开关和命令计数是验收桩，不代表新的真实出示结果或完整步行试玩。临时路由已移出应用，留档于 `output/playwright/followup-review-page.tsx.txt`。图片为 `followup-desktop-20261112.png`、`followup-mobile-20261112.png`、`followup-people-mobile-20261112.png`，均在 `output/playwright/`。

开发过程中出现一次 Next 样式热更插件的 `removeChild` 错误，调用位置为 `mini-css-extract-plugin/hmr/hotModuleReplacement.js`。冷刷新后消失，最终组件页面读取的 error/warn 日志为空；未改第三方插件代码。

未进行真实手机、真人完整游戏、生产性能或上线验收。本轮没有提交、推送、部署，也没有触碰生产数据库。
