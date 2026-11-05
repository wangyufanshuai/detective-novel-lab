# Town-play 设计令牌（河湾小镇）

`/town-play` 是玩家主入口。它的视觉语言是**奶油色纸张、木质工具栏、森林绿与黄铜点缀**。令牌定义在 `app/town-play/town-play.module.css` 的 `.town` 上，所有面板和对话框（`<dialog>` 也在 `main.town` 内）都能继承。

## 审计（2026-11-05）

| 项 | 令牌化前 | 令牌化后 |
|---|---|---|
| 不同的不透明颜色 | 154 | 31 个令牌 |
| 颜色使用处 | 194 处硬编码 | 191 处走令牌，3 处深色阴影保留原值 |
| CSS 变量 | 4 | 31 + 4 个兼容别名（`--paper / --ink / --forest / --brass`） |
| 字体 | Noto Serif SC（标题）+ Noto Sans SC（正文） | 不变 |

方法：在 CIELAB 空间按 ΔE < 8 聚类，每种颜色归到**最近**的簇中心。最大偏移 ΔE 7.4（一种深棕），其余基本在 ΔE 3 以内，肉眼难以分辨。带透明度的颜色改写为 `color-mix(in srgb, var(--tp-…) N%, transparent)`。

## 令牌

| 角色 | 令牌 | 值 | 用途 |
|---|---|---|---|
| 纸张 | `--tp-paper-glow` | `#fff2cf` | 选中工具格、按键字 |
| | `--tp-paper` | `#f6efdc` | 面板、卡片底 |
| | `--tp-paper-deep` | `#eadbb7` | 手记地点卡、行囊格、关闭钮 |
| | `--tp-parchment` | `#e0cd9d` | 次级底色 |
| 线 | `--tp-line` | `#c5b695` | 细边框 |
| | `--tp-line-strong` | `#ad9d7a` | 强调边框 |
| 文字 | `--tp-ink` | `#51472f` | 正文 |
| | `--tp-ink-muted` | `#8e7c57` | 说明、次要文字 |
| 森林 | `--tp-forest-deep` / `--tp-forest` / `--tp-forest-light` | `#2f4835` / `#415d47` / `#596d51` | 标题、主按钮、已完成状态 |
| | `--tp-moss` / `--tp-sage` / `--tp-sage-mist` | `#708064` / `#819269` / `#d2d5bf` | 图标、次级绿 |
| 黄铜 | `--tp-brass` / `--tp-brass-light` / `--tp-gold-soft` | `#ad7935` / `#c49a50` / `#f9e4a6` | 强调、选中、印章 |
| | `--tp-focus` | `#f8cb74` | 焦点光晕 |
| 木 | `--tp-wood-dark` / `--tp-wood` / `--tp-wood-tan` / `--tp-wood-light` | `#352e27` / `#706043` / `#aa9064` / `#cfb283` | 工具栏、木框 |
| 其他 | `--tp-sky` `--tp-slate` `--tp-teal-deep` `--tp-stone` `--tp-olive` `--tp-olive-deep` `--tp-forest-slate` `--tp-clay` `--tp-rust` | — | 场景底色、少量点缀 |

## 规则

- 新样式**只用 `--tp-*`**；需要新颜色时先加令牌、写进本表。
- 焦点：`outline 2px var(--tp-brass)` 加 `--tp-focus` 光晕。键盘可见，但不压过内容。
- 玩家界面不出现开发标签。状态提示只在保存中或已归档时出现。
- 下一步：`agent-first.module.css`（71 处硬编码）和 `snowbound-manor` 用同一套令牌；圆角（9 种）和阴影（多种）也收敛成令牌。
