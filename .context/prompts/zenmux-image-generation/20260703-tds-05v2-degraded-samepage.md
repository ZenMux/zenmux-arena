# Optimized prompt — TDS 图5 v2 · 降级态（公开单页版）

- **Model:** openai/gpt-image-2
- **Size:** 2560x1440
- **Quality:** high
- **Count:** 1
- **Output format:** image/png
- **Created:** 2026-07-03 (Asia/Shanghai)

---

# 风格：苹果 (Apple) Human Interface Guidelines

高保真 UI 设计稿（非线框图、非灰框占位），锚定苹果 Human Interface Guidelines 的设计语言：清晰、遵从内容、有层次感——界面干净精致、内容优先。配色用纯净的白或极浅灰背景（#FFFFFF / #F2F2F7），近黑正文（约 #1C1C1E），次要信息用系统灰（约 #8E8E93），可交互元素统一用系统蓝（#007AFF），成功/警示少量使用系统绿（#34C759）/ 系统红（#FF3B30）；规避高饱和撞色与重装饰。字体用类 SF Pro / 苹方的现代无衬线，字号层级分明。布局用圆角浅色卡片浮于浅灰底、舒适内边距。质感干净利落。整体精致、可信赖、克制。

界面必须使用真实文案与内容，不要占位框、假字或乱码；突出此刻的交互状态。

---

桌面 Web 界面（横版 2K，公开数据页，无任何登录元素、无侧边栏、无后台感）。画面：ZenMux Arena「Token 让利账本」公开页（arena.zenmux.ai/token-deals）的**降级态**——实时计费数据不可用，但牌价与折扣照常展示。

与默认态同构的页面布局（和"让利账本"主页一模一样的骨架），关键差异如下：

1. 顶部同款细导航栏：左侧 "ZenMux" 字标；右侧 "DEALS" 选中态（深色底反白胶囊）、"ABOUT" 常规态、GitHub 小图标、"zenmux.ai ↗"。**不要侧边栏、不要用户头像。**
2. 导航正下方一条通栏浅黄色警示带（细边框、克制不刺眼）：左侧细线感叹号图标 + 文字"实时数据暂不可用 · Live data unavailable — 正在自动重试"，右侧系统蓝文字按钮 "Retry"。
3. Hero 总账区：小标题 "TOTAL SAVED FOR DEVELOPERS · 累计让利" 照常；原本放超大金额的位置显示灰色的 "— LIVE DATA UNAVAILABLE"，下方小字"上次成功更新 2026-07-03 09:42 UTC"。无绿色 LIVE 脉冲点。
4. 4 枚统计小卡："ACTIVE DEALS 18" 与 "AVG DISCOUNT x0.42（≈ 58% subsidized）" 正常显示（来自牌价）；"TOKENS ON DEAL" 与 "DEVELOPERS PAID" 数值显示灰色 "—"。
5. 下方"进行中优惠"卡片墙（可见一行 3 张卡：GLM-5.2、Qwen3.7-Max、MiniMax M3）：每张卡价格账本行完整正常（红删除线原价 → 绿色现价，如 "INPUT $4.56 → $1.40 /M"；折扣徽章各不相同 "x0.31 · 3.1 折" / "x0.17 · 1.7 折" / "x0.46 · 4.6 折"，副注 "ZenMux 补贴 69% / 83% / 54%"）；但底部三数行显示 "USED — · PAID — · SAVED —"（灰色破折号）；卡片右上角**无** LIVE 角标；右下角外链箭头仍在（跳模型详情页不受降级影响）。

关键设计决策：降级不清空页面——公开牌价信息（原价/现价/折扣）与 Live 金额解耦，比价与跳转模型详情页任何时候可用；警示带克制、可操作。
