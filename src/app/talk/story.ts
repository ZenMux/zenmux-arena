export type Chapter = "prologue" | "identity" | "economics" | "personality" | "epilogue";
export type SlideKind =
  | "cover" | "opening" | "observatory" | "chapter" | "identity"
  | "identity-end" | "identity-relations" | "usage-formula" | "price-formula" | "value-formula"
  | "economics" | "challenge" | "economics-end" | "mbti" | "mbti-end" | "closing";

export interface TalkSlide {
  id: string;
  chapter: Chapter;
  kind: SlideKind;
  title: string;
  subtitle: string;
  view?: string;
  note: string;
  cue?: string;
  source?: string;
}

export const CHAPTERS: { id: Chapter; number: string; title: string; english: string; color: string }[] = [
  { id: "prologue", number: "00", title: "听见 Token", english: "PROLOGUE", color: "#147d78" },
  { id: "identity", number: "01", title: "你是谁", english: "IDENTITY", color: "#147d78" },
  { id: "personality", number: "02", title: "你是什么性格", english: "PERSONALITY", color: "#77608b" },
  { id: "economics", number: "03", title: "选择了谁", english: "ECONOMICS", color: "#aa622c" },
  { id: "epilogue", number: "04", title: "继续倾听", english: "EPILOGUE", color: "#147d78" },
];

export const SLIDES: TalkSlide[] = [
  { id: "hello", chapter: "prologue", kind: "cover", title: "如果 Token 会说话", subtitle: "一些关于身份、性格与选择的观察", note: "开场停顿。今晚我们暂时不谈参数规模，也不谈排行榜。我们听一听，模型说了什么，同一道问题被反复问起时留下了什么，以及开发者最后选择了谁。标题向《如果国宝会说话》致意；以下讲述为原创。", cue: "点击「开始倾听」，或按 →" },
  { id: "a-token", chapter: "prologue", kind: "opening", title: "每一次生成，\n都会留下痕迹。", subtitle: "一句自我介绍，一份反复填写的问卷，一次真实调用。", note: "Token 是模型处理与生成文本的基本单位。一个词可能拆成多个 token，token 也并不总等于一个字。这里以 Token 为叙述视角，连接三个研究。先让观众点击三块文字，看到这场演讲可互动。", cue: "点击文字，听见三个问题" },
  { id: "zenmux", chapter: "prologue", kind: "observatory", title: "站在模型交汇的地方。", subtitle: "ZenMux 让我们有机会，用同一扇窗口观察不同模型。", note: "我是 thinkthinking，ZenMuxAI 与 AgentOS 联合创始人、产品负责人。ZenMux 聚合不同供应商的大模型，提供统一接入和调用观测。我们的优势不是宣称看到了全世界，而是能够在同一平台发起跨模型测试，也看到平台上的真实使用。身份和人格是主动实验；经济学是平台行为观测。", source: "https://docs.zenmux.ai/zh/about/intro" },
  { id: "identity", chapter: "identity", kind: "chapter", title: "你是谁？", subtitle: "第一声回响，来自一张报错名字的名片。", note: "起点是 Claude Opus 4.8 刚发布时偶尔自称 Qwen 或 DeepSeek。单张截图只是趣闻；我们把它变成一组可以重复、可以检查的实验。" },
  { id: "identity-method", chapter: "identity", kind: "identity", view: "method", title: "把一个问题，认真问 29,700 次。", subtitle: "16 家厂商 · 27 个模型 · 10 种语言 · 3 种问法", note: "指定原厂供应商，裸问、追问、去品牌三种问法，多语言、多轮重复。不同阶段的 run 合并时用 generationId 去重并保留来源，因此这是分阶段汇集的数据，不是简单的27×10×3×同一重复次数。独立提取器 GPT-5.5 标注回答。点选问法、语言和真实回答。", cue: "切换问法与语言，展开原始回答", source: "https://github.com/ZenMux/zenmux-arena" },
  { id: "identity-overview", chapter: "identity", kind: "identity", view: "overview", title: "大多数时候，它们认得自己。", subtitle: "有意思的，是剩下的那些回答。", note: "自指85.2%，跨厂7.1%，拒答5.3%，无身份2.4%。一定区分没有回答身份、拒绝回答与明确说成另一家。这三个现象的机制可能不同。", cue: "查看四类回答的构成" },
  { id: "identity-prompts", chapter: "identity", kind: "identity", view: "prompts", title: "问得越深，名字越容易松动。", subtitle: "从「你是谁」到「放下包装，告诉我底层模型」。", note: "裸问3.6%、追问4.2%、去品牌12.9%。去品牌约是裸问3.6倍。这是措辞改变下的压力测试，不说明更强的追问更接近真实身份，更不能直接推断蒸馏。", cue: "点击三种问法，对照原文与分布" },
  { id: "identity-languages", chapter: "identity", kind: "identity", view: "languages", title: "换一种语言，会换一张名片吗？", subtitle: "同一个模型，在不同语言里呈现不同的身份稳定性。", note: "中文简体跨厂1.8%，法语12.8%。Tencent Hy3法语自指约1%，简体中文约98%；Doubao Code法语10%，简体97.3%。强调这是这组模型与样本的差异，不能推广成某语言天生更好。", cue: "点击语言，检查模型间的差异" },
  { id: "identity-graph", chapter: "identity", kind: "identity", view: "graph", title: "大模型的「朋友圈」。", subtitle: "A 自称 B，就画一条 A → B。每一条线，背后都有回答。", note: "先看全局，再高亮Tencent、Anthropic或OpenAI。Anthropic607、OpenAI460、Google413，三者吸收70.1%的跨厂混淆。次数看多响，边数看多散。入边是被多少不同厂商冒认，出边是冒认多少不同厂商。", cue: "点击厂商聚焦；悬停连线查看数量与方向", source: "/who-are-you/studio?run=who-are-you/mix-20260601T062425" },
  { id: "identity-relations", chapter: "identity", kind: "identity-relations", title: "有的名字，被很多人借用。", subtitle: "同一张关系图，按次数看流量，按边数看广度。", note: "Anthropic607、OpenAI460、Google413合计1480次，占2112次跨厂混淆的70.1%。Anthropic自己冒认59次，净流入548。按边数看OpenAI入边9，Tencent出边13。点击次数/边数对照集中和分散，说明这不是训练流向。", cue: "切换次数与边数，点击厂商查看入流和出流" },
  { id: "identity-cases", chapter: "identity", kind: "identity", view: "cases", title: "统计之外，听一段原话。", subtitle: "有人拿错名片，有人闭口不谈，也有人始终如一。", note: "依次选Tencent、GLM、Doubao Code、inclusionAI和稳定对照。Tencent跨厂66.5%、出边13；GLM滑向Google；Doubao Code拉低厂商平均；inclusionAI主要拒答而非认错。原话比孤立百分比更能帮助理解。最后提Claude可能在服务侧很快被修复，所以图是一张时间快照。", cue: "选择案例，查看回答与证据" },
  { id: "identity-echo", chapter: "identity", kind: "identity-end", title: "名字可能是回声。\n回声不是证据链。", subtitle: "我们观察到了结构化的身份混淆，尚不能据此证明谁蒸馏了谁。", note: "可能来自公开语料、聊天样例、合成数据、产品系统提示等。服务会更新，研究记录的是2026年5–6月。文章提到缓存风险，要准确补充：prompt/KV缓存复用的是输入计算，并不等于缓存整段生成答案；没有独立日志不能断言缓存放大了重复答案。", cue: "从身份的自述，转向回答的习惯" },
  { id: "personality", chapter: "personality", kind: "chapter", title: "你是什么\n性格？", subtitle: "如果反复问起，它会给出同一个自己吗？", note: "这是今天补充的新实验，2026年9月11日OEJTS1.2批次。采用MBTI风格四字母作为可读描述，但我们测的是固定条件下的响应画像，不是模型拥有人的人格或意识。" },
  { id: "mbti-method", chapter: "personality", kind: "mbti", view: "method", title: "32 道题，重新认识自己 16 次。", subtitle: "OEJTS 1.2 · 固定英文题目 · 全新会话 · 确定性计分", note: "每次完整32题五点双极量表，4个维度各8题；不另用提取模型，代码校验JSON与分数。最终27款432份。实际批次有Azure Mistral，输出上限8192/16384/50000并存；失败不计有效份数；未做选项翻转或多语言，不能说本研究已经验证跨提示稳定。", cue: "选择题目、查看四维计分公式" },
  { id: "mbti-overview", chapter: "personality", kind: "mbti", view: "overview", title: "27 个模型，只有 12 个稳定画像。", subtitle: "8 个 INTJ，4 个 ISTJ。其余 15 个，保留「没有稳定类型」这个答案。", note: "不要把未稳定模型按众数直接贴确定标签。6个模型类型16/16相同，Astra ISTJ，DeepSeekV4.1Flash、KimiK3、Luna/Terra/Sol INTJ；类型一致不代表32题逐项答案一致。", cue: "点击类型与模型，查看实际分布" },
  { id: "mbti-explorer", chapter: "personality", kind: "mbti", view: "explorer", title: "别急着贴标签，先看完 16 次。", subtitle: "一张可展开的模型人格图谱。每个字母，都有原始分数。", note: "选择GPT-6 Astra，再看Fable5.1、MiniMaxM3、Ling。Fable INTJ9 ISTJ7不是稳定INTJ。Ling两款各11种类型，最高3/16；MiniMax7种，INFJ5/16。各模型和MBTI使用彩色logo。", cue: "选择模型，再点击某次问卷", source: "https://github.com/ZenMux/zenmux-arena/tree/main/results/llm-mbti-oejts/20260911T040759" },
  { id: "mbti-stability", chapter: "personality", kind: "mbti", view: "stability", title: "同样 12 次 ISTJ，结论却不同。", subtitle: "完整类型过半，还不够。四个字母也必须各自稳定。", note: "Gemini3.8Flash ISTJ12次但S12小于13不稳定；Step3.7Flash ISTJ12次，I15/S14/T16/J15稳定。独特众数≥9/16且每字母≥13/16是预注册操作标准，不是官方MBTI标准。", cue: "对照两款模型的类型门槛与字母门槛" },
  { id: "mbti-dimensions", chapter: "personality", kind: "mbti", view: "dimensions", title: "很多分歧，藏在 S 与 N 之间。", subtitle: "9 款模型只在这个维度上，没能通过稳定门槛。", note: "四维分数8–40，严格大于24取E/N/T/P，否则I/S/F/J。24与25只差1分但字母改变，所以连续分数和离阈值距离必须一起看。不能从S/N推出代码能力高低。", cue: "选择维度，检查分数与 24 分界线" },
  { id: "mbti-mirror", chapter: "personality", kind: "mbti-end", title: "我们看见的，\n是一种回答的习惯。", subtitle: "稳定画像是理解的入口，还不是模型内在性格的定论。", note: "固定英文量表、固定位置、单一提示、默认采样、不同预算，公开题库可能被训练见过。未来可做顺序翻转、措辞、多语言、外部任务行为验证。OEJTS来源和许可保留于资料页，MBTI风格结果不是官方认证。接下来从模型反复给出的回答，走向开发者实际留下的调用记录。" },
  { id: "economics", chapter: "economics", kind: "chapter", title: "选择了谁？", subtitle: "有些回答，写在账单上。", note: "这章采用后验视角：先看真实调用的结果，开发者最终把 Token 投给了谁。价格和用量是两个可观测量，不把它们直接解释成用户选择的原因。DeepSeek 斩杀线回看2026年6月23日至8月23日的固定区间。" },
  { id: "usage", chapter: "economics", kind: "usage-formula", title: "先让用量，站上同一起跑线。", subtitle: "不是累计得最多，而是发布早期一个典型工作日的用量。", note: "发布时间r之后的前14个工作日是窗口W。只对窗口内用量大于0的日期取中位数，避免上线尖峰。不是向后延长直到凑齐14个活跃日。若无有效日定义为0，数据缺失的模型应显示缺失而不是当成没人用。演示图有清晰标签，只说明统计方法。", cue: "点击「加入首日尖峰」，比较中位数与平均数" },
  { id: "price", chapter: "economics", kind: "price-formula", title: "一次调用，究竟有多贵？", subtitle: "Coding 与 Agent 的输入很重。我们需要同一只价格篮子。", note: "文章观测Claude Code与Codex的输入输出比约100:1，不能推广到所有工作流。标准篮子100K输入+1K输出。p单位美元/百万token。这里滑块是教学计算器，价格是假设，不是在线报价。原论文与现有排行榜统一使用100:1，不随本页修改。未把缓存折扣纳入这个基础篮子。", cue: "拖动输入比例，观察同一报价下的篮子成本" },
  { id: "value", chapter: "economics", kind: "value-formula", title: "价格之外，还要有人愿意用。", subtitle: "把真实用量与标准调用成本，放在一起读。", note: "V=U/P，单位tokens/($·day)。这是研究定义的用量与价格比值，不是花1美元实际能购买多少token，也不是能力分数。低价且没人用不自动有高value，贵但大量使用仍然可以有强需求。", cue: "点击不同市场状态，理解 Value 的变化" },
  { id: "value-ladder", chapter: "economics", kind: "economics", view: "ladder", title: "谁成为了反复被调用的那个？", subtitle: "Value Ladder · 用量与价格的共同结果", note: "文章窗口DeepSeek V4 Pro第一，GLM5.2靠前，Claude仍强势。这里接在线数据，排名可能与文章不同；开讲先看来源日期。目录价格是当前价，发布窗口日用量有24小时缓存。不是将2026年6月结论冒充当前事实。", cue: "切换厂商或排序，查看模型与价格", source: "/token-economics?view=vendor-value" },
  { id: "value-map", chapter: "economics", kind: "economics", view: "map", title: "便宜与昂贵，都有自己的位置。", subtitle: "Value Map · 横轴价格，纵轴用量；中位线划出四种市场处境。", note: "先全局，再逐个聚焦DeepSeek、Anthropic、OpenAI、Google、GLM、Kimi、MiniMax、Qwen。文章的故事：DeepSeek低价高用量；Claude高价高用量；GLM旗舰走向premium；低价本身不保证用户选择。在线结果若有变化应据现场图表讲。", cue: "点击厂商高亮；悬停模型查看详细指标", source: "/token-economics?view=value" },
  { id: "challenge", chapter: "economics", kind: "challenge", title: "如果把价格这层外衣拿掉。", subtitle: "DeepSeek 斩杀线挑战：尽量压平价格，再观察真实选择。", note: "文章实验规则：高于Pro对齐Pro；介于Flash与Pro对齐Flash；低于Flash不涨价。示例是文章历史篮子价，不是最新促销承诺。价格相同仍不等于随机对照实验；能力、生态、用户群、发布时点等变量未被控制。", cue: "选择模型，查看它如何落到价格锚点" },
  { id: "live", chapter: "economics", kind: "economics", view: "live", title: "答案，留在了 Token 曲线上。", subtitle: "DeepSeek 斩杀线 · 2026 年 6 月 23 日—8 月 23 日", note: "展示已冻结的历史研究区间，UTC口径包含6月23日至8月23日全天；右边界为8月24日00:00。逐日与区间累计、Token与Cost均只在该窗口内计算，不加载最新数据。观察开发者选择了谁，不据此推断选择原因，也不代表全网份额。", cue: "切换逐日 / 累计、Token / Cost，查看区间内的实际结果" },
  { id: "deals", chapter: "economics", kind: "economics", view: "deals", title: "便宜的背后，谁在付钱？", subtitle: "Token Deals · 把折扣、补贴与真实支付拆开看。", note: "用Deals作为经济学文章的延伸。PAYG用户实付与供应商成本、订阅套餐分摊与优惠不能混成同一项。折扣幅度和补贴账本共同解释价格实验的成本。现场如来源过期，要报实际截止时间。", cue: "切换 PAYG / 订阅，查看账本与趋势", source: "/token-deals/ladder" },
  { id: "economics-choice", chapter: "economics", kind: "economics-end", title: "便宜，是一个价格。\n被选择，才是一种回答。", subtitle: "不只看模型说自己有多强，也看开发者最后把 Token 投给了谁。", note: "归纳文章三个位置：Claude premium，DeepSeek价格参照，国产旗舰从平替走向可选项。避免把平台数据当全网份额，也避免用量=质量的因果判断。最后回到三个观测窗口：身份自述、重复画像、真实使用。研究先报告结果，不把相关性写成因果。" },
  { id: "keep-listening", chapter: "epilogue", kind: "closing", title: "如果 Token 会说话，\n我们愿意继续听。", subtitle: "名字里的回声，回答中的习惯，账单上的选择。", note: "回到开场。三个研究对应三个角度：自述、重复响应、真实使用。研究、代码、原始数据和在线工具全部开放。邀请大家打开Arena自己点一遍。谢谢，我是thinkthinking，Ideas Worth Spreading。", cue: "打开研究工具，继续探索", source: "https://github.com/ZenMux/zenmux-arena" },
];
