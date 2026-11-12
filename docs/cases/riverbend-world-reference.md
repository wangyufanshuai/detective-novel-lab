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

## 居民

开局（08:00）之后居民按日程走动；案件历史只写 08:00 以前。询问居民时，玩家要在游戏里找到他本人。

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

| 顺序 | key | 标题 | 时间窗 | 真凶 | 在哪里领取 |
|---|---|---|---|---|---|
| 1 | `seventh-minute` | 第七分钟 | 07:00—08:00 | 许知微 | books, police |
| 2 | `borrowed-chisel` | 借来的凿子 | 06:00—06:59 | 陈蕙 | inn, police |

## 居民在已有案件里的行踪

新案件里同一位居民的行踪必须和这里接得上（来得及走过去）。没有列出的时间都是空闲的。

- **宋棠**：06:38 河湾咖啡馆（borrowed-chisel）；07:18 河湾咖啡馆（seventh-minute）；07:35 旧书店（seventh-minute）
- **周砚**：07:18 旧书店（seventh-minute）；07:23 警务所（seventh-minute）；07:28 邮局（seventh-minute）
- **许知微**：07:05 旧书店（seventh-minute）；07:30 旧书店（seventh-minute）；07:31 旧书店（seventh-minute）；07:32 旧书店（seventh-minute）；07:37 河湾咖啡馆（seventh-minute）；07:42 河湾车站（seventh-minute）；07:47 河湾车站（seventh-minute）；07:52 河湾咖啡馆（seventh-minute）；07:57 旧书店（seventh-minute）
- **陆行舟**：06:25 警务所（borrowed-chisel）；06:55 警务所（borrowed-chisel）；07:10 警务所（seventh-minute）；08:00 警务所（seventh-minute）
- **陈蕙**：06:05 邮局后巷住宅（borrowed-chisel）；06:25 警务所（borrowed-chisel）；06:35 桥畔旅馆（borrowed-chisel）；06:36 桥畔旅馆（borrowed-chisel）；06:40 桥畔旅馆（borrowed-chisel）；06:56 邮局（borrowed-chisel）；06:58 邮局（borrowed-chisel）；07:28 邮局（seventh-minute）
- **顾远山**：06:30 河湾车站（borrowed-chisel）；07:42 河湾车站（seventh-minute）
- **白露**：06:25 桥畔旅馆（borrowed-chisel）；06:38 河湾咖啡馆（borrowed-chisel）
- **林阿梨**：06:10 桥畔旅馆（borrowed-chisel）；06:25 桥畔旅馆（borrowed-chisel）；06:30 桥畔旅馆（borrowed-chisel）；06:45 桥畔旅馆（borrowed-chisel）；06:55 警务所（borrowed-chisel）；07:20 桥畔旅馆（seventh-minute）
- **程渡**：06:15 桥畔旅馆（borrowed-chisel）；06:30 河湾车站（borrowed-chisel）
- **沈映**：06:30 桥畔旅馆（borrowed-chisel）；07:20 桥畔旅馆（seventh-minute）
- **韩朔**：07:10 警务所（seventh-minute）
- **江芷**：07:30 旧书店（seventh-minute）
