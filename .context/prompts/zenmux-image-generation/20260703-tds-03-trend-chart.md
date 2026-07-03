# Optimized prompt — TDS 图3 · 补贴趋势图（SAVED $ 视角）

- **Model:** openai/gpt-image-2
- **Size:** 2560x1440
- **Quality:** high
- **Count:** 1
- **Output format:** image/png
- **Created:** 2026-07-03 (Asia/Shanghai)

---

# 风格：苹果 (Apple) Human Interface Guidelines

高保真 UI 设计稿（非线框图、非灰框占位），锚定苹果 Human Interface Guidelines 的设计语言：清晰、遵从内容、有层次感——界面干净精致、内容优先。配色用纯净的白或极浅灰背景（#FFFFFF / #F2F2F7），近黑正文（约 #1C1C1E），次要信息用系统灰（约 #8E8E93），可交互元素统一用系统蓝（#007AFF），成功/警示少量使用系统绿（#34C759）/ 系统红（#FF3B30）；规避高饱和撞色与重装饰。字体用类 SF Pro / 苹方的现代无衬线，字号层级分明。布局用圆角浅色卡片浮于浅灰底、舒适内边距。质感干净利落：极浅阴影、细分隔线、细线图标。整体精致、可信赖、克制。

界面必须使用真实文案与内容，不要占位框、假字或乱码；突出此刻的交互状态。

---

桌面 Web 界面（横版 2K）。画面：ZenMux「Token 让利账本」页向下滚动到的 "SUBSIDY OVER TIME · 补贴趋势" 图表区段特写（顶部可见细导航栏局部，DEALS 标签选中态）。

主体是一张占据画面约 70% 宽度的大型折线/面积趋势图卡片：
- 卡片标题行：左侧 "SUBSIDY OVER TIME"，右侧一组控件——Y 轴档位分段控件 "SAVED $ | TOKENS | PAID $"（"SAVED $" 处于选中态，深色底反白），时间范围分段控件 "ALL | 72H"（"ALL" 选中），以及一个细线下载图标按钮 "PNG"。
- 图表本体：X 轴为日期刻度（2026-05 至 2026-07），Y 轴为美元金额（$0 – $40K，等宽数字刻度）；6 条不同颜色的平滑折线各代表一个优惠模型，整体呈上升趋势；每条折线最右端点上有一枚发光的小圆点（Live 脉冲）；其中一条曲线上悬停着一个 tooltip 浮层，显示 "2026-06-28 · GLM-5.2 · SAVED $3,420 · 42.1B tokens"。
- 图表下方一行系列开关：6 枚小胶囊，各含彩色圆点 + 模型名 "GLM-5.2 / Qwen3.7-Max / MiniMax M3 / Kimi K2.7 / ERNIE 5.1 / LongCat-2.0"，其中 "ERNIE 5.1" 处于关闭态（灰色、圆点空心）。

关键设计决策：默认 Y 轴是补贴金额而非 token 量；Live 端点脉冲；tooltip 的当日明细。数据密集但排版克制清晰。
