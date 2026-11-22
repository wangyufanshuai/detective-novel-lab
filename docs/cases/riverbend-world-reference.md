# 河湾世界参考（自动生成）

由 `node scripts/check-cases.mjs --reference` 生成，不要手改。写案件前先读这一页。

## 地点

| id | 名称 | 玩家能进入调查 |
|---|---|---|
| `town-square` | 河湾广场 | 否（只能出现在 history 里） |
| `cafe` | 河湾咖啡馆 | 是 |
| `books` | 旧书店 | 是 |
| `police` | 警务所 | 是 |
| `station` | 河湾车站 | 是 |
| `post` | 邮局 | 是 |
| `inn` | 桥畔旅馆 | 是 |
| `house-east` | 河畔民居 | 否（只能出现在 history 里） |
| `house-north-a` | 书店后巷住宅 | 否（只能出现在 history 里） |
| `house-north-b` | 广场后巷住宅 | 否（只能出现在 history 里） |
| `house-north-c` | 邮局后巷住宅 | 否（只能出现在 history 里） |

## 步行时间（分钟，最短路线）

| 从 \ 到 | `town-square` | `cafe` | `books` | `police` | `station` | `post` | `inn` | `house-east` | `house-north-a` | `house-north-b` | `house-north-c` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `town-square` | 0 | 5 | 5 | 5 | 10 | 10 | 5 | 15 | 10 | 10 | 10 |
| `cafe` | 5 | 0 | 5 | 10 | 5 | 15 | 10 | 20 | 5 | 10 | 15 |
| `books` | 5 | 5 | 0 | 5 | 10 | 10 | 10 | 15 | 10 | 5 | 10 |
| `police` | 5 | 10 | 5 | 0 | 15 | 5 | 10 | 10 | 15 | 10 | 5 |
| `station` | 10 | 5 | 10 | 15 | 0 | 20 | 5 | 25 | 10 | 15 | 20 |
| `post` | 10 | 15 | 10 | 5 | 20 | 0 | 15 | 5 | 20 | 15 | 10 |
| `inn` | 5 | 10 | 10 | 10 | 5 | 15 | 0 | 20 | 15 | 15 | 15 |
| `house-east` | 15 | 20 | 15 | 10 | 25 | 5 | 20 | 0 | 25 | 20 | 15 |
| `house-north-a` | 10 | 5 | 10 | 15 | 10 | 20 | 15 | 25 | 0 | 5 | 10 |
| `house-north-b` | 10 | 10 | 5 | 10 | 15 | 15 | 15 | 20 | 5 | 0 | 5 |
| `house-north-c` | 10 | 15 | 10 | 5 | 20 | 10 | 15 | 15 | 10 | 5 | 0 |

## 室内可搜查的家具

物证的 `search` 文字里包含某件家具的关键词，搜查点就落在那件家具上；同时命中几件时，取下表里排在前面的那件。对不上任何关键词会被 check-cases 报错。

| 地点 | 家具 | 关键词 |
|---|---|---|
| `books` 旧书店 | 展台 | 展台、封条、原图 |
| `books` 旧书店 | 修复桌 | 修复、信件、桌 |
| `books` 旧书店 | 柜台（领取手记处） | 交接、柜台、登记、收据 |
| `books` 旧书店 | 书架 | 书架、地图集、旧书 |
| `cafe` 河湾咖啡馆 | 收银台（领取手记处） | 收银、小票、豆浆、拿铁 |
| `cafe` 河湾咖啡馆 | 便笺板 | 便笺、早餐、留言 |
| `cafe` 河湾咖啡馆 | 窗边座位 | 窗边、座位 |
| `cafe` 河湾咖啡馆 | 咖啡吧台 | 咖啡机、吧台、磨豆 |
| `police` 警务所 | 值班桌（领取手记处） | 巡逻、值班、报失 |
| `police` 警务所 | 校时台 | 钟楼、检修、校时、电波 |
| `police` 警务所 | 门廊桌 | 门廊、复写、底页、代写 |
| `police` 警务所 | 街区图 | 街区图、告示、地图 |
| `post` 邮局 | 挂号柜台（领取手记处） | 挂号、存根、清点、报值 |
| `post` 邮局 | 分拣机 | 分拣、日志、开机 |
| `post` 邮局 | 留底柜 | 留底、保密、回条、回执、请求 |
| `post` 邮局 | 信格 | 信格、邮件、包裹 |
| `inn` 桥畔旅馆 | 募捐箱 | 募捐 |
| `inn` 桥畔旅馆 | 前台（领取手记处） | 前台、核页、核号、编号、客簿、照片 |
| `inn` 桥畔旅馆 | 厨房窗口 | 厨房、出餐、早饭 |
| `inn` 桥畔旅馆 | 门廊工具箱 | 工具箱、门廊、凿 |
| `station` 河湾车站 | 值班柜台（领取手记处） | 柜台、交接清单、时刻册、签收、木料、值班 |
| `station` 河湾车站 | 留言册展示夹 | 展示夹、纸茬、折纸条、留言册 |
| `station` 河湾车站 | 寄存柜 | 寄存 |
| `station` 河湾车站 | 发车钟 | 电波钟、时刻表、发车 |

## 天气（固定，每位玩家都一样）

物证可以写 `weather`：`"washes-away"` 表示户外痕迹，案件开始（当天 08:00）后的第一场大雨会冲掉它，之后就搜不到了，所以不能放进 answer 或 decisive；`"needs-clear-air"` 表示要隔着距离看的东西，浓雾时不能核对，雾散后就可以。案件历史（08:00 以前）里提到的天气要和下表一致。

| 天 | 06:00 | 08:00 | 10:00 | 12:00 | 14:00 | 16:00 | 18:00 | 20:00 | 浓雾时段 | 第一场大雨（washes-away 的痕迹在此后消失） |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 晴 | 晴 | 晴 | 晴 | 晴 | 晴 | 晴 | 晴夜 | 无 | 第 2 天 17:50 |
| 2 | 雾 | 雾 | 晴 | 晴 | 多云 | 多云 | 小雨 | 雨 | 00:00—09:25 | 第 2 天 17:50 |
| 3 | 多云 | 多云 | 多云 | 阴 | 雨 | 多云 | 晴 | 晴夜 | 无 | 第 3 天 12:30 |

## 居民

游戏共 3 天。每天 08:00 起居民按日程走动，19:00 回家；玩家傍晚在旅馆过夜，醒来是第二天 08:00。案件历史只写某一天 08:00 以前（用 day 指定哪一天）。询问居民时，玩家要在游戏里找到他本人。

| id | 姓名 | 身份 | 家 | 08:00 | 12:00 | 14:00 | 16:00 | 19:00 | 私事（可以用作动机或隐瞒的理由） |
|---|---|---|---|---|---|---|---|---|---|
| `rb-song-tang` | 宋棠 | 咖啡馆店主 | house-north-a | cafe | cafe | cafe | post | house-north-a | 把妹妹寄回的钱垫进了咖啡馆租金，一直没写回信说明。 |
| `rb-zhou-yan` | 周砚 | 投递员 | house-north-c | post | cafe | post | station | house-north-c | 私下替年迈住户读信，从未向分拣员说明谁请他帮过忙。 |
| `rb-xu-zhiwei` | 许知微 | 旧书修复师 | house-north-b | books | town-square | books | books | house-north-b | 一张旧地图上的注记出自她的祖父，她尚未决定是否公开这层关系。 |
| `rb-lu-xingzhou` | 陆行舟 | 值班警员 | house-north-c | police | town-square | police | station | house-north-c | 上周未及时处理一份匿名报失单，准备下班前补查。 |
| `rb-chen-hui` | 陈蕙 | 邮局分拣员 | house-north-c | post | town-square | post | post | house-north-c | 珍藏着一封没有寄出的辞职信，信上写着她真正想去的城市。 |
| `rb-gu-yuanshan` | 顾远山 | 车站值班员 | house-north-c | station | station | station | police | house-north-c | 保留了一本已经作废的列车时刻册，用来记往年离镇的人。 |
| `rb-bai-lu` | 白露 | 花摊摊主 | house-east | town-square | cafe | town-square | inn | house-east | 欠旅馆老板一笔育苗钱，交货失败后尚未凑齐。 |
| `rb-lin-ali` | 林阿梨 | 旅馆老板 | inn | inn | inn | inn | post | inn | 替一位不愿留下姓名的客人保管着行李，承诺等他本人来取。 |
| `rb-cheng-du` | 程渡 | 桥梁木工 | house-east | town-square | cafe | town-square | station | house-east | 偷偷替邻居修过不在工单上的栏杆，费用全记在自己的账里。 |
| `rb-shen-ying` | 沈映 | 地方记者 | inn | town-square | books | town-square | police | inn | 她来河湾既是采访，也是为了查明母亲留下的一句旧话。 |
| `rb-han-shuo` | 韩朔 | 钟表维修工 | house-north-b | police | town-square | police | books | house-north-b | 有一次把钟楼的校时误差先记在便笺上，忘了补进正式登记。 |
| `rb-jiang-zhi` | 江芷 | 退休教师 | house-north-a | cafe | books | cafe | town-square | house-north-a | 她给旧学生写过一封很严厉的信，至今想当面道歉。 |

## 已经写好的案件

| 顺序 | key | 标题 | 第几天 | 时间窗 | 真凶 | 在哪里领取 |
|---|---|---|---|---|---|---|
| 1 | `seventh-minute` | 第七分钟 | 1 | 07:00—08:00 | 许知微 | books, police |
| 2 | `borrowed-chisel` | 借来的凿子 | 1 | 06:00—06:59 | 陈蕙 | inn, police |
| 3 | `missing-farewell-page` | 撕下的那一页 | 1 | 05:00—05:59 | 顾远山 | station, police |
| 4 | `same-numbered-luggage` | 同号行李 | 2 | 05:45—07:40 | 林阿梨 | station, police |
| 5 | `returned-window` | 错开的投递窗 | 2 | 04:50—07:30 | 陈蕙 | post, police |
| 6 | `silent-tower-bell` | 没响的钟 | 3 | 05:20—07:45 | 韩朔 | police, station |
| 7 | `empty-eighth-train` | 空白的第八班车 | 3 | 06:20—07:30 | 沈映 | station, police |
| 8 | `borrowed-bridge-seal` | 借来的桥牌 | 3 | 06:25—07:15 | 程渡 | station, police |
| 9 | `second-seven-receipt` | 两张七点收据 | 3 | 07:05—07:55 | 宋棠 | police, cafe |
| 10 | `map-without-north` | 没有北面的地图 | 3 | 07:15—07:55 | 沈映 | books, police |

## 居民在已有案件里的行踪

新案件里同一位居民的行踪必须和这里接得上（来得及走过去）。没有列出的时间都是空闲的。

- **宋棠**：第 1 天 05:18 河湾咖啡馆（missing-farewell-page）；第 1 天 06:38 河湾咖啡馆（borrowed-chisel）；第 1 天 07:18 河湾咖啡馆（seventh-minute）；第 1 天 07:35 旧书店（seventh-minute）；第 2 天 06:15 河湾咖啡馆（same-numbered-luggage）；第 2 天 06:25 河湾咖啡馆（returned-window）；第 3 天 06:50 河湾咖啡馆（silent-tower-bell）；第 3 天 07:05 河湾咖啡馆（second-seven-receipt）；第 3 天 07:08 河湾咖啡馆（second-seven-receipt）；第 3 天 07:18 桥畔旅馆（second-seven-receipt）；第 3 天 07:28 河湾咖啡馆（second-seven-receipt）；第 3 天 07:42 河湾咖啡馆（second-seven-receipt）
- **周砚**：第 1 天 05:00 河湾车站（missing-farewell-page）；第 1 天 05:16 警务所（missing-farewell-page）；第 1 天 05:41 邮局（missing-farewell-page）；第 1 天 05:42 邮局（missing-farewell-page）；第 1 天 07:18 旧书店（seventh-minute）；第 1 天 07:23 警务所（seventh-minute）；第 1 天 07:28 邮局（seventh-minute）；第 2 天 04:50 邮局（returned-window）；第 2 天 05:40 邮局（returned-window）；第 2 天 05:45 邮局（same-numbered-luggage）；第 2 天 06:00 桥畔旅馆（same-numbered-luggage）；第 2 天 06:10 河湾车站（same-numbered-luggage）；第 2 天 06:20 河湾车站（same-numbered-luggage）；第 2 天 06:35 河湾车站（same-numbered-luggage）；第 2 天 06:40 桥畔旅馆（same-numbered-luggage）；第 2 天 06:45 河湾车站（same-numbered-luggage）；第 2 天 06:50 河湾车站（same-numbered-luggage）；第 2 天 06:55 桥畔旅馆（same-numbered-luggage）；第 2 天 07:10 邮局（same-numbered-luggage）；第 3 天 06:20 桥畔旅馆（empty-eighth-train）
- **许知微**：第 1 天 07:05 旧书店（seventh-minute）；第 1 天 07:30 旧书店（seventh-minute）；第 1 天 07:31 旧书店（seventh-minute）；第 1 天 07:32 旧书店（seventh-minute）；第 1 天 07:37 河湾咖啡馆（seventh-minute）；第 1 天 07:42 河湾车站（seventh-minute）；第 1 天 07:47 河湾车站（seventh-minute）；第 1 天 07:52 河湾咖啡馆（seventh-minute）；第 1 天 07:57 旧书店（seventh-minute）；第 3 天 06:20 旧书店（silent-tower-bell）；第 3 天 06:21 旧书店（silent-tower-bell）；第 3 天 07:05 旧书店（empty-eighth-train）；第 3 天 07:06 旧书店（empty-eighth-train）；第 3 天 07:45 旧书店（map-without-north）；第 3 天 07:55 警务所（map-without-north）
- **陆行舟**：第 1 天 05:16 警务所（missing-farewell-page）；第 1 天 05:45 警务所（missing-farewell-page）；第 1 天 06:25 警务所（borrowed-chisel）；第 1 天 06:55 警务所（borrowed-chisel）；第 1 天 07:10 警务所（seventh-minute）；第 1 天 08:00 警务所（seventh-minute）；第 2 天 06:10 警务所（returned-window）；第 2 天 07:10 桥畔旅馆（same-numbered-luggage）；第 2 天 07:20 警务所（same-numbered-luggage）；第 2 天 07:30 邮局（returned-window）；第 3 天 05:50 警务所（silent-tower-bell）；第 3 天 07:15 警务所（empty-eighth-train）；第 3 天 07:15 警务所（map-without-north）；第 3 天 07:30 河湾车站（empty-eighth-train）；第 3 天 07:45 警务所（silent-tower-bell）；第 3 天 07:55 警务所（second-seven-receipt）；第 3 天 07:55 警务所（map-without-north）
- **陈蕙**：第 1 天 05:41 邮局（missing-farewell-page）；第 1 天 06:05 邮局后巷住宅（borrowed-chisel）；第 1 天 06:25 警务所（borrowed-chisel）；第 1 天 06:35 桥畔旅馆（borrowed-chisel）；第 1 天 06:36 桥畔旅馆（borrowed-chisel）；第 1 天 06:40 桥畔旅馆（borrowed-chisel）；第 1 天 06:56 邮局（borrowed-chisel）；第 1 天 06:58 邮局（borrowed-chisel）；第 1 天 07:28 邮局（seventh-minute）；第 2 天 05:05 邮局后巷住宅（returned-window）；第 2 天 05:20 邮局（returned-window）；第 2 天 05:28 邮局（returned-window）；第 2 天 05:29 邮局（returned-window）；第 2 天 05:40 邮局（returned-window）；第 2 天 05:45 邮局（same-numbered-luggage）；第 2 天 06:45 邮局（returned-window）；第 2 天 07:10 邮局（same-numbered-luggage）；第 2 天 07:30 邮局（returned-window）；第 3 天 07:30 邮局（second-seven-receipt）
- **顾远山**：第 1 天 05:00 河湾车站（missing-farewell-page）；第 1 天 05:00 河湾车站（missing-farewell-page）；第 1 天 05:08 河湾车站（missing-farewell-page）；第 1 天 05:16 河湾车站（missing-farewell-page）；第 1 天 05:19 河湾车站（missing-farewell-page）；第 1 天 05:20 河湾车站（missing-farewell-page）；第 1 天 05:21 河湾车站（missing-farewell-page）；第 1 天 05:26 河湾车站（missing-farewell-page）；第 1 天 06:30 河湾车站（borrowed-chisel）；第 1 天 07:42 河湾车站（seventh-minute）；第 2 天 06:10 河湾车站（same-numbered-luggage）；第 2 天 06:20 河湾车站（same-numbered-luggage）；第 2 天 06:35 河湾车站（same-numbered-luggage）；第 2 天 06:45 河湾车站（same-numbered-luggage）；第 2 天 06:50 河湾车站（same-numbered-luggage）；第 2 天 07:05 河湾车站（returned-window）；第 2 天 07:40 河湾车站（same-numbered-luggage）；第 3 天 06:35 河湾车站（silent-tower-bell）；第 3 天 06:35 河湾车站（empty-eighth-train）；第 3 天 06:35 河湾车站（borrowed-bridge-seal）；第 3 天 06:36 河湾车站（silent-tower-bell）；第 3 天 06:40 河湾车站（empty-eighth-train）；第 3 天 06:50 河湾车站（borrowed-bridge-seal）；第 3 天 06:55 河湾车站（borrowed-bridge-seal）；第 3 天 07:15 河湾车站（borrowed-bridge-seal）；第 3 天 07:30 河湾车站（empty-eighth-train）；第 3 天 07:35 河湾车站（map-without-north）；第 3 天 07:42 河湾咖啡馆（second-seven-receipt）；第 3 天 07:55 警务所（second-seven-receipt）
- **白露**：第 1 天 05:08 河湾车站（missing-farewell-page）；第 1 天 05:18 河湾咖啡馆（missing-farewell-page）；第 1 天 06:25 桥畔旅馆（borrowed-chisel）；第 1 天 06:38 河湾咖啡馆（borrowed-chisel）；第 2 天 06:15 河湾咖啡馆（same-numbered-luggage）；第 3 天 07:00 桥畔旅馆（borrowed-bridge-seal）
- **林阿梨**：第 1 天 05:12 桥畔旅馆（missing-farewell-page）；第 1 天 06:10 桥畔旅馆（borrowed-chisel）；第 1 天 06:25 桥畔旅馆（borrowed-chisel）；第 1 天 06:30 桥畔旅馆（borrowed-chisel）；第 1 天 06:45 桥畔旅馆（borrowed-chisel）；第 1 天 06:55 警务所（borrowed-chisel）；第 1 天 07:20 桥畔旅馆（seventh-minute）；第 2 天 06:00 桥畔旅馆（same-numbered-luggage）；第 2 天 06:02 桥畔旅馆（same-numbered-luggage）；第 2 天 06:20 桥畔旅馆（same-numbered-luggage）；第 2 天 06:27 桥畔旅馆（same-numbered-luggage）；第 2 天 06:40 桥畔旅馆（same-numbered-luggage）；第 2 天 06:55 桥畔旅馆（same-numbered-luggage）；第 2 天 07:10 桥畔旅馆（same-numbered-luggage）；第 3 天 06:22 桥畔旅馆（empty-eighth-train）；第 3 天 06:42 桥畔旅馆（borrowed-bridge-seal）；第 3 天 07:00 桥畔旅馆（borrowed-bridge-seal）；第 3 天 07:18 桥畔旅馆（second-seven-receipt）；第 3 天 07:20 桥畔旅馆（second-seven-receipt）；第 3 天 07:25 桥畔旅馆（map-without-north）；第 3 天 07:37 旧书店（map-without-north）；第 3 天 07:40 旧书店（map-without-north）
- **程渡**：第 1 天 05:16 河湾车站（missing-farewell-page）；第 1 天 05:26 河湾车站（missing-farewell-page）；第 1 天 05:45 警务所（missing-farewell-page）；第 1 天 06:15 桥畔旅馆（borrowed-chisel）；第 1 天 06:30 河湾车站（borrowed-chisel）；第 2 天 07:40 河湾车站（same-numbered-luggage）；第 3 天 06:25 警务所（borrowed-bridge-seal）；第 3 天 06:30 警务所（borrowed-bridge-seal）；第 3 天 06:42 桥畔旅馆（borrowed-bridge-seal）；第 3 天 06:55 河湾车站（borrowed-bridge-seal）；第 3 天 07:00 桥畔旅馆（borrowed-bridge-seal）；第 3 天 07:05 河湾车站（borrowed-bridge-seal）；第 3 天 07:15 河湾车站（borrowed-bridge-seal）
- **沈映**：第 1 天 05:12 桥畔旅馆（missing-farewell-page）；第 1 天 06:30 桥畔旅馆（borrowed-chisel）；第 1 天 07:20 桥畔旅馆（seventh-minute）；第 2 天 06:20 桥畔旅馆（same-numbered-luggage）；第 2 天 07:20 警务所（same-numbered-luggage）；第 3 天 06:20 桥畔旅馆（empty-eighth-train）；第 3 天 06:22 桥畔旅馆（empty-eighth-train）；第 3 天 06:40 河湾车站（empty-eighth-train）；第 3 天 06:45 河湾车站（empty-eighth-train）；第 3 天 06:50 河湾车站（empty-eighth-train）；第 3 天 07:05 旧书店（empty-eighth-train）；第 3 天 07:06 旧书店（empty-eighth-train）；第 3 天 07:15 警务所（empty-eighth-train）；第 3 天 07:15 警务所（map-without-north）；第 3 天 07:25 桥畔旅馆（map-without-north）；第 3 天 07:27 桥畔旅馆（map-without-north）；第 3 天 07:37 旧书店（map-without-north）；第 3 天 07:38 旧书店（map-without-north）；第 3 天 07:39 旧书店（map-without-north）
- **韩朔**：第 1 天 07:10 警务所（seventh-minute）；第 3 天 05:20 警务所（silent-tower-bell）；第 3 天 05:35 警务所（silent-tower-bell）；第 3 天 05:50 警务所（silent-tower-bell）；第 3 天 06:05 警务所（silent-tower-bell）；第 3 天 06:25 警务所（borrowed-bridge-seal）；第 3 天 06:50 河湾车站（borrowed-bridge-seal）；第 3 天 07:06 警务所（borrowed-bridge-seal）；第 3 天 07:55 警务所（map-without-north）
- **江芷**：第 1 天 07:30 旧书店（seventh-minute）；第 2 天 06:25 河湾咖啡馆（returned-window）；第 3 天 06:50 河湾咖啡馆（silent-tower-bell）；第 3 天 07:05 河湾咖啡馆（second-seven-receipt）；第 3 天 07:28 河湾咖啡馆（second-seven-receipt）；第 3 天 07:45 旧书店（map-without-north）
