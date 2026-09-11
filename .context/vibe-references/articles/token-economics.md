# Token 经济学研究：当我们把所有“东方模型”的价格降成 DeepSeek 一样后，会发生什么？

作者：thinkthinking

我是 thinkthinking，ZenMuxAI 与 AgentOS 联合创始人、产品负责人。之前做过支付宝、百度的 AI 产品，也做过 CATL 宁德时代的自动驾驶算法。

![thinkthinking 的个人介绍卡片](../../public/assets/card.png)

这篇文章来自一个很朴素、但越看越有意思的问题：

> 如果把价格这层外衣先拿掉，开发者到底会选择哪个模型？

事情的起点，是 DeepSeek V4 Pro 发布之后，我们在 ZenMux 上观察到一个非常明显的现象：

DeepSeek V4 Pro 的调用量在快速爬升，并且一度已经逼近、甚至超过 Claude 旗舰模型 Opus 4.8 的调用量。

![DeepSeek V4 Pro 发布后，Token 用量快速追上 Claude Opus 4.8](../../token-economics/assets/dsv4-data-1.png)

换成榜单看会更直观。在这段观察窗口里，Claude Opus 4.8、DeepSeek V4 Pro、DeepSeek V4 Flash 几乎站在同一个第一梯队，后面才是 GLM 5.2、Claude Sonnet 4.6、GPT-5.5 等模型。

![DeepSeek V4 Pro 与 DeepSeek V4 Flash 进入模型用量第一梯队](../../token-economics/assets/dsv4-data-2.png)

如果再看厂商份额，就会发现 DeepSeek 的颜色在最近几周明显变厚。它不是一个“有人尝鲜一下”的新品曲线，而是正在持续吃掉真实工作流里的 token。

![DeepSeek 在市场份额图里持续抬升](../../token-economics/assets/dsv4-data-3.png)

当然，这一方面是因为 DeepSeek V4 Pro 的模型能力确实不错。

但另一方面，我们也很难忽略它的价格。

DeepSeek V4 Pro 的价格做得很低，Cache Hit 也做得非常极致。对于 Coding、Agent、长上下文这类输入 token 特别重的场景，价格一旦打下来，模型的“可试用性”和“可持续调用性”会立刻不一样。

于是我们半开玩笑地给这个现象起了一个名字：

> **DeepSeek 斩杀线。**

意思不是说 DeepSeek 真的要“斩杀”谁，而是说：当一个模型做到“效果可用 + 价格极低 + 工程接入稳定”之后，它会在开发者心里形成一条新的价格锚点。

从那一刻开始，所有其他模型都会被拿来问一句：

> 你比 DeepSeek 贵这么多，真的值得吗？

## 那如果其他模型也降到 DeepSeek 的价格呢？

这就是我们真正好奇的地方。

假如 GLM、Kimi、Qwen、MiniMax、Doubao、ERNIE、腾讯混元、小米 MiMo、阶跃星辰、蚂蚁 inclusionAI、快手 KAT 这些“东方模型”，都把价格降到和 DeepSeek V4 Pro / DeepSeek V4 Flash 一样，会发生什么？

开发者会继续选 DeepSeek 吗？

还是会开始更大规模地尝试 GLM 5.2、Qwen3.7 Max、Kimi K2.7 Code、MiniMax M3、Doubao Seed 2.0 Pro 这些模型？

更进一步，如果我们长期追踪模型价格和模型用量之间的关系，会不会看到一些“模型市场”的规律？

这就是我们这次想做的事：

> **Token 经济学。**

## 我们不看榜单，只看价格和用量

一般大家评价模型，喜欢看 benchmark、论文、发布会 PPT、社区口碑、排行榜、上下文长度、工具调用、推理能力、Coding 能力。

这些当然重要。

但从 ZenMux 的角度，我们还拥有另一个更后验的视角：

> 用户最后真的把 token 打给了谁？

所以这次研究，我们刻意采用一种“后验主义”的方法：

不先争论模型发布时官方公布的性能分数，也不先假设谁更强、谁更弱。

我们把所有复杂变量，包括模型能力、PR 宣传、产品包装、默认集成、工具兼容、性价比、开发者信任，都先收束到两个可观测变量上：

- **价格**：用户为一次标准调用要付多少钱？
- **用量**：用户实际把多少 token 消耗在这个模型上？

这有点像一个“集总参数法”。

我们不说“模型能力”不重要，而是把它看成已经被市场选择吸收过的结果：如果一个模型真的好用、稳定、便宜、容易接入，它最终应该会体现在用量里。

当然，这里先打一个预防针：这不是全网份额，也不是绝对真理。这是 ZenMux 平台上的真实调用观测。它更适合回答的是：

> 在 ZenMux 这样的多模型聚合平台里，开发者真实工作流里的选择正在往哪里流动？

## 第一步：把用量放到同一起跑线

直接比较模型的累计用量是不公平的。

老模型上线时间长，天然有更长时间积累 token；新模型刚发布，即使增长很猛，累计量也可能暂时吃亏。

所以我们先对用量做了归一化处理。

核心思路是：从每个模型的发布时间开始，取之后 14 个工作日里的用量窗口，计算这个模型在发布早期的典型日消耗。

在代码实现里，我们使用的是“有实际用量工作日”的中位数，而不是平均数。这样可以避免某个首日尖峰把整个模型拉得过高。

公式可以写成这样：

$$
W_m = \operatorname{First}_{14}\{d \mid d \ge r_m,\ d \in \mathcal{B}\}
$$

其中，$m$ 表示模型，$r_m$ 表示模型发布时间，$\mathcal{B}$ 表示工作日集合。

再令 $x_{m,d}$ 表示模型 $m$ 在日期 $d$ 的 token 用量，取有真实用量的工作日：

$$
A_m = \{d \in W_m \mid x_{m,d} > 0\}
$$

最终，我们把模型的归一化日用量定义为：

$$
U_m =
\begin{cases}
\operatorname{median}_{d \in A_m}(x_{m,d}), & |A_m| > 0 \\
0, & |A_m| = 0
\end{cases}
$$

它的单位是：

$$
\mathrm{tokens/day}
$$

直觉上，$U_m$ 回答的是：

> 这个模型发布之后，在一个“正常被使用的工作日”里，大概能吃掉多少 token？

它比累计用量更适合比较不同发布时间的模型。

## 第二步：把输入价格和输出价格压成一个数字

模型价格还有另一个麻烦：输入和输出是分开计价的。

如果只看输入价格，会低估输出昂贵的模型；如果只看输出价格，又不符合 Coding 和 Agent 场景里的真实 token 结构。

ZenMux 当前最主要的试用场景之一是 Coding。我们统计了两个典型工作流：

- Claude Opus 4.8 在 Claude Code 里的输入 / 输出 token 比例
- GPT-5.5 在 Codex 里的输入 / 输出 token 比例

结果非常接近：大约都是 **100:1**。

![Claude Opus 4.8 在 Claude Code 场景中的输入输出 token 比例](../../token-economics/assets/token-ratio-1.png)

![GPT-5.5 在 Codex 场景中的输入输出 token 比例](../../token-economics/assets/token-ratio-2.png)

这也符合很多开发者的体感：AI Coding 不是简单问答，而是长上下文、项目文件、日志、历史对话、工具结果大量输入，然后模型输出相对短的代码片段、解释或操作建议。

所以我们定义了一个标准价格篮子：

> **100K input tokens + 1K output tokens**

假设模型 $m$ 的输入价格为 $p_m^{in}$，输出价格为 $p_m^{out}$，两者单位都是美元 / 1M tokens，那么归一化价格为：

$$
P_m =
\frac{100000}{1000000}p_m^{in}
+
\frac{1000}{1000000}p_m^{out}
$$

也就是：

$$
P_m = 0.1p_m^{in} + 0.001p_m^{out}
$$

这个 $P_m$ 表示一次标准 Coding / Agent 调用篮子的美元成本。

这一步很重要。因为在这种输入极重的场景里，输入价格会被放大，输出价格不会被忽略，但权重会相对较小。

## 第三步：用“用量 / 价格”定义模型 Value

有了归一化日用量 $U_m$，也有了归一化价格 $P_m$，我们就可以定义一个模型的 Value：

$$
V_m = \frac{U_m}{P_m}
$$

单位是：

$$
\mathrm{tokens}/(\$ \cdot day)
$$

直觉上，它回答的是：

> 每花掉 1 美元标准调用成本，这个模型在真实工作流里能承载多少日用量？

但这里要强调一点：

这不是一个简单的“性价比榜”。

如果一个模型很便宜，但是没人用，它的 Value 不会高。

如果一个模型很贵，但是大家依然大量使用，它的 Value 也可能很强。

比如 Claude Opus 4.8 很贵，但它的真实用量也很大，所以它不会因为价格贵就被简单判死刑。

换句话说，Value 不是“越便宜越好”，而是：

> 价格和市场选择一起作用之后，用户到底愿意把多少 token 投给它。

## 先看结果：大模型 Value Ladder

我们按照这个 Value 指标，把 ZenMux 平台上的大语言模型做了一张天梯图：

![按照 Value 排序的大模型天梯图](../../token-economics/assets/token-economics-value-ladder.png)

结果非常有意思。

DeepSeek V4 Pro 当之无愧排在第一。

这也解释了为什么我们会把它叫做“斩杀线”：它不是单纯便宜，而是在低归一化价格下吃到了非常大的真实用量。

第二个很值得注意的是 GLM 5.2。

GLM 5.2 的位置非常靠前，说明它不是“国产模型里还不错”这种客气话，而是在价格和真实用量一起计算之后，已经站到了全场第一梯队。

Claude Opus 4.8、Claude Opus 4.7、Claude Opus 4.6 也依然强势。

这件事很重要。

它说明贵模型并不会因为贵就被市场抛弃。只要能力、稳定性、工具适配和开发者信任足够强，用户依然会买单。

反过来看，GPT、Gemini、Qwen 的很多模型落在中后段。它们不是不能用，而是在 ZenMux 的这个观察窗口里，价格和真实消耗量组合起来之后，没有形成 DeepSeek V4 Pro 那种压倒性的 Value。

我自己的一个额外观察是：

> 今天模型市场的竞争，已经不只是“谁更强”，也不是“谁更便宜”，而是谁能成为开发者默认愿意反复调用的那个模型。

这中间既有能力，也有价格，也有工具链里的路径依赖。

## 再看 Value Map：四个象限

只看排名还不够。

所以我们又做了一张 Value Map：

![大模型 Value Map：横轴是归一化价格，纵轴是归一化日用量](../../token-economics/assets/token-economics-value-map.png)

这张图的横坐标是归一化价格 $P_m$，纵坐标是归一化日用量 $U_m$。

两条虚线分别是价格中位数和用量中位数，于是模型天然被分成四个象限：

- **低价格 + 高用量**：真正的 value play
- **高价格 + 高用量**：premium demand，也就是贵但用户依然买单
- **低价格 + 低用量**：便宜但暂时没被大量选择
- **高价格 + 低用量**：最危险的区域，贵但没有足够真实需求

如果把 DeepSeek、GLM、Claude 这几条线高亮出来，会更明显：

![高亮 DeepSeek、GLM 与 Claude 的 Value Map](../../token-economics/assets/token-economics-value-map-2.png)

DeepSeek V4 Pro 和 DeepSeek V4 Flash 明显站在“低价高用量”区间。

GLM 5.2 则很有意思：它已经冲到了极高用量区，但价格也不再是最低价路线，更像是一个正在向旗舰 premium 靠拢的国产模型。

Claude Opus 4.8、Claude Opus 4.7、Claude Opus 4.6 则是典型的“高价格 + 高用量”。

也就是说，Claude 的逻辑不是用低价换规模，而是用足够强的模型能力和开发者信任，支撑一个更贵的价格带。

下面分厂商看，会更有意思。

## Anthropic：奢侈品路线，但市场真的买单

先看 Anthropic：

![Anthropic / Claude 系列在 Value Map 中的位置](../../token-economics/assets/token-economics-value-map-3.png)

Claude 系列从一开始就很像“奢侈品路线”。

大多数 Claude 模型都在价格中位线右侧，尤其是 Opus 系列，明显位于高价格区域。

但问题是，它们并没有掉到“高价低用量”的尴尬区。

Claude Opus 4.8、Opus 4.7、Opus 4.6、Sonnet 4.6 等模型，依然能拿到很高的真实用量。

这说明 Anthropic 这条路线非常清晰：

> 我不便宜，但我足够强，强到你在关键任务里还是会选我。

这也是为什么很多开发者嘴上嫌 Claude 贵，但到了复杂 Coding、长任务、Agent loop，手还是会很诚实地伸过去。

## OpenAI：既要又要，正在向 premium 靠拢

再看 OpenAI：

![OpenAI / GPT 系列在 Value Map 中的位置](../../token-economics/assets/token-economics-value-map-4.png)

OpenAI 的分布很有意思。

它不像 Anthropic 那样路线单一，而是典型的“既要又要”：

既有 GPT-5 Nano、GPT-4.1 Nano 这类低价模型，也有 GPT-5.5、GPT-5.4、GPT-5 Pro 这类高价模型。

但从图上看，低价模型并没有天然带来高用量。

很多低价 GPT 模型落在左下角：便宜，但真实用量并不高。

反而是 GPT-5.4、GPT-5.5 这些更贵的新旗舰，开始往 Anthropic 的 premium demand 区域移动。

这说明 OpenAI 的真实策略可能也在发生变化：

> 便宜模型负责覆盖场景，旗舰模型负责证明上限。

只不过在 ZenMux 的数据里，便宜不等于被选择。开发者最终还是会为“更稳、更强、更会写代码”付钱。

## Google：双路线很清楚，Flash 也在变贵

接下来是 Google Gemini：

![Google / Gemini 系列在 Value Map 中的位置](../../token-economics/assets/token-economics-value-map-google.png)

Google 的路线相对清晰：

一边是低价 Flash，一边是高价 Pro。

这两个路线的用量都还算健康，没有明显失控。

但最新趋势也很值得注意：Gemini 3.5 Flash 已经不再只是“便宜小模型”的位置，它也开始进入更高价格、更高用量的象限。

这背后其实有一个现实问题：

> 旗舰模型并没有一直降价，恰恰相反，真正强的模型正在越来越敢涨价。

因为只要它能解决真实问题，市场就会给它价格空间。

## DeepSeek：这就是斩杀线

然后是 DeepSeek：

![DeepSeek 系列在 Value Map 中的位置](../../token-economics/assets/token-economics-value-map-deepseek.png)

DeepSeek 的策略从 V3 到 V4 都非常清晰：

低价格，强效果，高可用性。

DeepSeek V4 Pro 和 DeepSeek V4 Flash 基本就是“低价高用量”的教科书案例。

它最可怕的地方不是便宜，而是便宜之后用户真的愿意用。

这和很多“低价但无人问津”的模型完全不同。

所以 DeepSeek 斩杀线真正的含义是：

> 当一个模型同时做到低价、可用、稳定、可规模化，它会把整个市场的价格参照系往下拉。

从此以后，其他模型的定价都必须回答一个问题：

> 我比 DeepSeek 贵，贵在哪里？

## 智谱 GLM：越来越像 OpenAI 的国内路径

再看智谱 GLM，尤其是把它和 OpenAI 放在一起：

![GLM 与 OpenAI 在 Value Map 中的对比](../../token-economics/assets/token-economics-value-map-glm-openai.png)

有人说智谱是最像 OpenAI 的国内公司。

从 Token 经济学的角度看，这个说法还真有点意思。

GLM 的产品线也呈现出类似的双路线：

一边是低价 Flash / Turbo，一边是更旗舰、更 premium 的 GLM 5.2。

早期一些平民路线模型并没有全部跑出来，但 GLM 5.2 这次明显不一样。

它已经不是“低价国产替代”的叙事，而是在往“高用量旗舰模型”的位置走。

这可能是国产模型一个很重要的拐点：

> 过去大家更习惯用“便宜”解释国产模型；但接下来，真正有机会突围的模型，必须让用户在不便宜的时候也愿意用。

## 其他几家：Kimi、MiniMax、Qwen

Kimi 的位置很像在对标 Anthropic：

![Kimi 系列在 Value Map 中的位置](../../token-economics/assets/token-economics-value-map-kimi.png)

它不是极致低价路线，而是更偏 premium。Kimi K2.7 Code 的用量表现不错，说明开发者对它在 Coding 场景里的能力是有真实兴趣的。

MiniMax 则更像在对标 DeepSeek：

![MiniMax 系列在 Value Map 中的位置](../../token-economics/assets/token-economics-value-map-minimax.png)

路线更平价，价格更亲民。如果这类模型能把真实用量继续打上去，就会很有潜力。

Qwen 的分布最复杂：

![Qwen 系列在 Value Map 中的位置](../../token-economics/assets/token-economics-value-map-qwen.png)

它几乎每个象限都有模型。

这说明 Qwen 的产品线覆盖非常广，但从外部看，策略也显得没那么集中。

不过最新的 Qwen3.7 Max 是个值得关注的点：它正在往更 premium 的方向走，而且市场反馈并不差。

这也再次说明一个趋势：

> 中国模型厂商不能只打低价牌。真正的胜负手，是有没有模型能站上“高价格 + 高用量”的区域。

## 所以，我们发起 DeepSeek 斩杀线挑战

既然问题已经摆在这里了，那就干脆做一次实验。

我们把一批“东方模型”的价格，全部按前面的归一化价格方法，对齐到 DeepSeek V4 Pro 或 DeepSeek V4 Flash。

完整模型名单来自开源仓库里的这份配置：

```text
config/token-economics-live-models.json
```

这次参与的模型包括：

- DeepSeek V4 Pro
- DeepSeek V4 Flash
- GLM 5.2
- Kimi K2.7 Code
- Qwen3.7-Plus
- Qwen3.7-Max
- MiniMax M3
- Step 3.7 Flash
- Agnes-2.0-Flash
- ERNIE 5.1
- Ring-2.6-1T
- Ling-2.6-1T
- Hy3 preview
- MiMo-V2.5
- MiMo-V2.5-Pro
- Ling-2.6-flash
- KAT-Coder-Pro-V2
- Qwen3.6 Flash
- Doubao-Seed-2.0-pro
- Doubao-Seed-2.0-mini

其中，Agnes-2.0-Flash、Ling-2.6-flash、Doubao-Seed-2.0-mini 这类本来就低于斩杀线的模型，会保持原价。

其中一些旗舰模型的降价幅度非常夸张：

| 模型 | 对齐锚点 | 归一化价格变化 | 降价幅度 |
| --- | --- | ---: | ---: |
| Qwen3.7 Max | DeepSeek V4 Pro | 0.2575 → 0.04437 | 82.8% |
| GLM 5.2 | DeepSeek V4 Pro | 0.1444 → 0.04437 | 69.3% |
| Qwen3.7 Plus | DeepSeek V4 Flash | 0.0416 → 0.01428 | 65.7% |
| Kimi K2.7 Code | DeepSeek V4 Pro | 0.0990 → 0.04437 | 55.2% |
| MiniMax M3 | DeepSeek V4 Flash | 0.0312 → 0.01428 | 54.2% |
| KAT-Coder-Pro-V2 | DeepSeek V4 Flash | 0.0312 → 0.01428 | 54.2% |
| Ring-2.6-1T / Ling-2.6-1T | DeepSeek V4 Flash | 0.0325 → 0.01428 | 56.1% |

这里的规则很简单：

- 如果模型的归一化价格高于 DeepSeek V4 Pro，就把它打折到 DeepSeek V4 Pro
- 如果模型的归一化价格低于 DeepSeek V4 Pro、但高于 DeepSeek V4 Flash，就把它打折到 DeepSeek V4 Flash
- 如果模型本来就比 DeepSeek V4 Flash 更便宜，那就保持原价

我们的目标也很简单：

> 把价格这个变量尽量压平，然后看真实开发者最终会选择谁。

## 实时榜单：看谁能冲过斩杀线

我们为这次挑战做了实时榜单：

https://arena.zenmux.ai/token-economics?view=live

榜单支持实时榜和累计榜，也支持从 Token 和 Cost 两个角度查看。

![DeepSeek 斩杀线挑战实时榜单](../../token-economics/assets/token-economics-live-leaderboard.png)

![累计 Token 视角下的 DeepSeek 斩杀线挑战榜单](../../token-economics/assets/token-economics-live-leaderboard-6.png)

![累计 Cost 视角下的 DeepSeek 斩杀线挑战榜单](../../token-economics/assets/token-economics-live-leaderboard-7.png)

![实时 Token 视角下的 DeepSeek 斩杀线挑战榜单](../../token-economics/assets/token-economics-live-leaderboard-8.png)

![实时 Cost 视角下的 DeepSeek 斩杀线挑战榜单](../../token-economics/assets/token-economics-live-leaderboard-9.png)

你可以把它理解成一个持续运行的模型市场实验：

当 DeepSeek V4 Pro、DeepSeek V4 Flash、GLM 5.2、Kimi K2.7 Code、Qwen3.7 Max、MiniMax M3、Doubao Seed 2.0 Pro 等模型，被放到接近同一条价格线上之后，谁会真正被开发者调用？

答案不会出现在发布会上。

答案会出现在 token 曲线上。

## 一个更现实的结论

做完这次 Token 经济学研究，我最大的感受是：

模型价格不是一个简单的财务数字。

它其实是模型厂商对自己能力、成本、生态位置和市场野心的综合表达。

低价模型如果没有真实用量，只是便宜。

高价模型如果依然有高用量，就是市场愿意为它的能力付费。

而像 DeepSeek V4 Pro 这样同时做到低价和高用量的模型，会变成一种新的价格制度：

> 它不只是一个模型，它是一条新的参照线。

这条参照线会逼问所有模型厂商：

你到底是要走 Claude 式的 premium 路线，证明自己贵得有道理？

还是要走 DeepSeek 式的斩杀线路线，把价格打到让开发者无法拒绝？

又或者，你能不能像 GLM 5.2 这样，开始从“国产平替”走向“旗舰可选项”？

这就是我们接下来会持续追踪的 Token 经济学。

不只看模型说自己有多强。

也看开发者最后把 token 投给了谁。

## 最后，欢迎来挑战 DeepSeek 斩杀线

这次 DeepSeek 斩杀线挑战里，ZenMux 已经把上述模型按统一归一化价格策略做了降价。

PAYG 按量付费和订阅制都会同步生效。

ZenMux 平台上的所有大模型，也天然支持：

- OpenAI Chat Completions 协议
- OpenAI Responses 协议
- Anthropic Messages 协议

你可以把它们接入 Claude Code、Codex、OpenCode、OpenClaw、Hermes 等 Agent 工具里，随意组合、随意试用。

互动页面在这里：

https://arena.zenmux.ai/token-economics?view=value

实时挑战榜单在这里：

https://arena.zenmux.ai/token-economics?view=live

项目也已经开源：

https://github.com/ZenMux/zenmux-arena

接下来我们会持续看这件事：

> 当价格被拉平之后，谁还能留下真实用量？

这可能比任何榜单都更接近模型市场的答案。
