# Lingua 英语学习平台开发文档

> 最后更新：2026-09-16  
> 当前阶段：Web MVP / 背单词模块与 ECDICT 词典已接入

## 变更记录

### 2026-09-16 · 新增抗遗忘功能（艾宾浩斯遗忘曲线）

- 数据模型：新增 `UserMemory`（userId+wordId 唯一，含 stage / nextReviewAt / reviewCount / lastResult）。
- 收录：学后检测答错的单词在 `/api/review/submit` 里同步 upsert 到抗遗忘（答错重置 stage=0）。
- 遗忘曲线间隔（天）：阶段 0~6 = `[0, 1, 2, 4, 7, 15, 30]`；答对 stage+1 并顺延下次复习时间，答错重置 stage=0。
- 新增 API：`GET /api/memory`（主页：今日待复习数 + 未来 30 天每日词数曲线）、`GET /api/memory/review`（今日待复习词列表）、`POST /api/memory/review`（提交一轮结果）。
- 前端：侧边栏新增「抗遗忘」入口；`/dashboard/student/memory` 主页（卡片 + SVG 柱状曲线 + 开始复习）；`/dashboard/student/memory/review` 复习界面（标记会/不会 → 错词进入下一轮直到无错）。
- 新增 `lib/memory.ts`（间隔常量、nextReviewAfter、isDue、dailyReviewCounts）。
- `npx tsc --noEmit` 通过。

### 2026-09-16 · 单词发音改为 edge-tts 在线合成（上线可用方案）

- 背景：`speechSynthesis` 依赖用户本机语音包，多用户上线后不可控（无本地英文音色时英文单词发音带口音甚至无声）。
- 方案：新增 `GET /api/tts?word=xxx`，后端用 edge-tts（微软神经网络音色 en-US-AriaNeural，免费无需 Key）合成标准美式发音 mp3 返回；`components/speaker-button.tsx` 改为优先播放 TTS mp3，失败回退 `speechSynthesis`。
- 磁盘缓存：合成结果缓存到 `.tts-cache/`（md5 命名），同一单词第二次请求 51ms 命中缓存，不再联网合成。
- 新增 `scripts/tts.py`（edge-tts 合成脚本）；`.env` 增加 `PYTHON_BIN`；`.gitignore` 增加 `/.tts-cache/`。
- 依赖：Python 3.13 + `edge-tts` 7.2.8（已安装到隔离环境）。
- `npx tsc --noEmit` 通过；TTS API 实测返回 200 / audio/mpeg。

### 2026-09-16 · TTS 缓存预热（消除首次点击等待）

- 首次点击单词才合成要等约 2.4s（实测首次 2399ms vs 缓存命中 21ms）。
- 新增 `components/tts-warmup.ts`：`warmupTts(words, concurrency)` 后台限流（3 并发）请求 `/api/tts` 预热磁盘缓存，去重 + 静默失败。
- 接入：pretest/reinforce 预热「当前页+下一页」；review 预热「当前组+下一组」；wrong-words 预热全部错题。
- 效果：进入页面即后台预热，点击时命中缓存（~21ms），即时出声。

### 2026-09-15 · 修复语音朗读与性能，UI 动画美化

- 修复语音朗读无反应：重写 `speaker-button.tsx`，改用健壮的 `speechSynthesis` 实现——优先选择 en-US 音色、朗读前加 60ms 延迟（规避 Chrome 连续 `cancel()` 后立即 `speak()` 静默失败的问题）、增加朗读状态与错误处理、添加声波动画。
- 修复点击响应慢：抽取共享 `word-meaning.tsx` 组件，用 `useMemo` 缓存 `splitMeaningParts` 结果（此前每页 30 词每次点击都重复执行复杂正则拆分），消除 pretest/review/reinforce/wrong-words 四处重复定义。
- UI 美化：新增全局微交互动画（fadeInUp / fadeIn / popIn / waveBar / ringPulse），按钮 `:active` 缩放反馈、单词行渐入动画、标记按钮弹跳动画、结果页与弹窗动画；支持 `prefers-reduced-motion` 降级。
- `npx tsc --noEmit` 通过。

### 2026-09-15 · 教师代理学生视角（陪学）

- 新增「代理」机制：教师可在学生管理界面点击「切换」按钮，以学生身份操作词汇学习，产生的笔记、错题本、学习进度等全部写入学生账户（而非教师账户）。
- 新增 `getEffectiveUser()`：教师代理某绑定学生时返回该学生，否则返回当前登录用户本人；代理通过 `lingua_impersonate` cookie 记录，并在 `dashboard/layout.tsx` 与 API 层统一校验「教师—学生」绑定关系。
- 新增 API `POST /api/impersonate`：`{ studentId }` 设置代理、`{ studentId: null }` 清除代理（切回教师本人）。
- 背单词相关 API（books/current、books、books/:id/words、words/:id/note、pretest/submit、review/submit、wrong-words）全部改用 `getEffectiveUser()`。
- 背单词页面（vocabulary/books/pretest/review/reinforce/wrong-words）允许教师代理访问，未代理时重定向到学生管理页。
- 教师端侧边栏「词汇学习」由占位改为跳转背单词；顶栏在代理模式显示「正在以 XX 身份学习 + 切回自己」横幅。
- `npx tsc --noEmit` 通过。

### 2026-09-15 · 修复学前检测「会」的单词重复出现

- 修复：学前检测标记「会」的单词在第二次学习后重新出现。
- 根因：`/api/pretest/submit` 的 `deleteMany` 范围过大，清空了整个词书的 `KNOWN` 记录，导致之前标记「会」的单词被误删。
- 修复：学前检测「会」统一改为 `MASTERED`（与学后检测「会」一致，表示已掌握）；提交时只更新本次提交的单词，未提交的单词保持原状态。
- 相关过滤/统计逻辑统一改为只识别 `MASTERED`（不再使用 `KNOWN`）。
- `npx tsc --noEmit` 通过。

### 2026-09-15 · 新增错题本功能

- 新增数据模型 `UserWrongWord`：记录学后检测中答错的单词（含答错次数 wrongCount、最近答错时间 lastWrongAt、来源词书 bookId）。
- 学后检测提交时：答错的单词自动收录错题本（重复答错累计次数）；答对的单词从错题本移除。
- 新增 API：`GET /api/wrong-words`（错题列表）、`DELETE /api/wrong-words/:wordId`（移除错题）。
- 学生端侧边栏新增「错题本」入口，错题本页面支持列表展示（发音/释义/音标开关/笔记）、按答错次数展示徽标、移除错题。
- `npx tsc --noEmit` 通过，prisma generate / db push 完成。

### 2026-09-15 · 学后检测未掌握单词重新进入学前检测

- 学后检测标记「不会」的单词：删除其进度记录，重新进入学前检测阶段（而非回到单词识记）；「会」的单词标记为 MASTERED，从词书剔除。
- `/api/review/submit`：不会→删除进度记录（回到学前检测），会→MASTERED。
- `/api/pretest/submit`：重测时只清空 `KNOWN`/`UNKNOWN` 旧进度，**保留 `MASTERED`**，避免已掌握单词被重测误清除。
- 学后检测结果界面「有错」分支跳转从「继续单词识记」改为「重新学前检测」。
- 完整状态流转：学前检测（会→KNOWN / 不会→UNKNOWN）→ 识记（UNKNOWN）→ 学后检测（会→MASTERED / 不会→删除记录回学前检测）。
- `npx tsc --noEmit` 通过。

### 2026-09-15 · 单词识记增加组级强化学习

- 单词识记五个一组，每组新增「强化学习」按钮，点击后只显示本组单词进入强化学习。
- 强化学习第一阶段：每个单词右侧只有对号，点击表示「这轮会了」，该词消失；全部点完进入第二阶段。
- 强化学习第二阶段：右侧显示对/错，对全组词打对错；有错显示「共错 x 个，再练一次」，点击后仅对错误词重新进入第二阶段，直到全部做对。
- 全部做对后进入完成界面，可选「学下一组」或「重新练习这组」。
- 所有组识记结束后进入「学后检测」（`/reinforce`），对全部识记词打对错并提交。
- `npx tsc --noEmit` 通过。

### 2026-09-15 · 已掌握单词从词书剔除

- 已学会（学前检测「会」→ `KNOWN`）和已掌握（学后强化全对 → `MASTERED`）的单词，从当前用户的学前检测列表中剔除，不再重复出现。
- 学前检测查询过滤 `progress` 中无 `KNOWN`/`MASTERED` 的单词；词书主页显示「剩余 X / 总词数」。
- 学前检测空状态区分「词书没单词」与「全部背完」两种提示。
- 验证：4447 词中剔除 7 个已掌握，剩余 4440。`npx tsc --noEmit` 通过。

### 2026-09-15 · 修复单词识记误入两千多个单词

- 修复 `/api/pretest/submit` 重测时的状态残留：原逻辑只删除本次提交的 wordId 旧记录，多次重测会残留早期「不会」标记，导致识记列表膨胀到 2000+。
- 改为接收 `bookId`，提交时先清空该用户在该词书下的全部旧进度，再写入本次结果；并校验提交的 wordId 确属该词书。
- 清理 dev.db 中 alex 的 4614 条脏进度记录（历史测试残留），重新做学前检测即可。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

### 2026-09-15 · 完成单词识记与学后强化

- 完成「单词识记」：复用学前检测的单词展示样式（发音 / 释义 / 音标开关 / 笔记），去掉对号、错号按钮，改为五个一组展示，底部提供「下一组」按钮，学完全部单词后进入「学后强化」。
- 完成「学后强化」：展示方式与学前检测一致（含对号 / 错号），只针对单词识记部分的词做检测；全对结束本次学习，有错则回到单词识记继续巩固。
- 新增 API `POST /api/review/submit`：提交学后强化结果，会 → `MASTERED`，不会 → 保持 `UNKNOWN` 回到识记。
- 状态流转：学前检测（会 → `KNOWN`，不会 → `UNKNOWN`）→ 单词识记（`UNKNOWN`）→ 学后强化（会 → `MASTERED`，不会 → 回识记）。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

### 2026-09-15 · 修复 Prisma / SQLite 构建错误

- 修复 SQLite 不支持 Prisma `enum` 导致的 `P1012` Schema 校验错误。
- 将 `User.role` 和 `Invitation.status` 改为字符串字段，并在 API 层继续校验合法值。
- 增加角色标准化处理，避免无效角色进入 JWT session。
- 补齐 `bcryptjs`、`jose`、`@prisma/client` 等认证和数据库依赖。
- 重新生成 Prisma Client。
- 初始化本地 SQLite 数据库并执行种子数据。
- 将 `db:push` 调整为 `prisma db push --skip-generate`，避免 Windows 开发服务器占用 Prisma Client 文件时触发 `EPERM`。
- 已验证首页、登录接口、当前用户接口、教师工作台和生产构建均可正常访问。

### 2026-09-15 · 修复词书导入并验证背单词流程

- 修复 `prisma.userBook` 未生成导致的运行时错误：停用占用 Prisma Client 的 Next dev 进程后重新执行 `prisma generate`、`prisma db push`。
- 更新 `prisma/import-dictionary.ts`：自动识别 `>` / 逗号分隔符；支持自动解压 `relation_book_word.zip`；使用 `ON CONFLICT ... DO UPDATE` 实现可重复导入；去重同书同词关系并跳过缺失词条引用。
- 导入 DictionaryData：词书 583 本、单词 70,164 条、有效书词关系 1,006,922 条。
- 修正词书分类为固定六类：小学 / 中学 / 高中 / 考研 / 考博 / 出国，并将 DictionaryData 的原始顶层分类归入对应大类。
- 验证登录、词书选择/更换、当前词书读取、学前检测列表、单词笔记保存、全对/有错提交结果、单词识记框架页。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

### 2026-09-15 · 词书细分筛选与学前检测分页

- 词书选择在六大类基础上增加二级筛选：小学/中学/高中按年级、类型和出版社筛选；考研按四级/六级/专四/专八/考研英语等筛选；出国按托福/雅思/GRE/GMAT/SAT/ACT/托业/BEC 等筛选。
- 学前检测改为每页 30 个单词，支持上一页/下一页、按页提交，全部页提交后汇总全对/有错结果。
- `lib/books.ts` 输出新的 `groups` 结构，`book-picker.tsx` 增加二级筛选 UI。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

### 2026-09-15 · 年级-出版社层级、提交已标记单词与释义排版

- 将原「中学」分类名称改为「初中」。
- 小学/初中/高中词书改为「年级/类型 → 出版社」的层级筛选，出版社不再和年级并列展示。
- 学前检测改为提交已标记单词：用户可跨页标记，最后点击「提交已学单词」一次性提交并进入下一阶段。
- 优化释义展示：按中文分号、斜杠和词性标记拆行，使用圆点列表式排版，避免长释义连成一团。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

### 2026-09-15 · 修复词性切分与补充当前词书缺失释义

- 修复 `pron.`、`adv.` 等词性被二次切开的问题：词性切分改为消费式正则，不再把 `pron` 切成 `pro` + `n`，也不再切坏 `adv`。
- 在 `prisma/import-dictionary.ts` 中增加手动释义兜底表，为当前词书缺失的 110 个常见词补齐中文释义。
- 重新执行词书导入，当前词书缺失释义数量已归零。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

### 2026-09-15 · 释义清洗：只保留真正的词典释义

- 在 `prisma/import-dictionary.ts` 中新增 `cleanTranslation()`。
- 清洗规则：按 `；` / `/` 拆分释义，只保留以 `n.`、`v.`、`vt.`、`vi.`、`adj.`、`adv.`、`prep.`、`pron.` 等词性标记开头的片段。
- 自动丢弃 `Italy,意大利`、`India,印度`、`In,元素铟(indium)`、缩写机构全称等非词典释义片段。
- 去掉 `[军]`、`[植]`、`[医]` 等方括号标记和 `(=...)` 等冗余解释。
- 重新导入词书后，当前词书释义缺失数仍为 0，`it` 只显示 `pron.它`，`in` 只保留真正的词典释义。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

### 2026-09-15 · 全库统一释义清洗

- 确认 `cleanTranslation()` 在导入阶段对全库 70,164 个单词统一执行，不按词书、不按单个单词打补丁。
- 全库审计结果：27,081 个单词有清洗后的有效词典释义；43,083 个单词因源数据没有有效词性释义而保持为空。
- `Italy,意大利`、`India,印度`、`Intelligent Network` 等脏片段在全库中的数量为 0。
- 手动补充释义作为全局兜底表使用，任何词书遇到相同单词都会生效。

### 2026-09-15 · 接入 ECDICT 作为主词典数据源

- 下载并接入 [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT) 的 `ecdict.csv`。
- 新增 `prisma/build-ecdict-translations.py`，将 ECDICT 转换为 `dictionary-data/ecdict.translations.tsv`。
- 导入脚本改为优先使用 ECDICT 清洗后的中文释义，`word_translation.csv` 仅作为回退来源。
- 重新导入全库后，有释义词数从 27,081 提升到 32,616，`Italy,意大利` / `India,印度` / `Intelligent Network` 等脏片段仍为 0。
- `npx tsc --noEmit` 与 `npm run build` 均通过。

## 1. 项目简介

Lingua 是一个面向全阶段英语学习的学习空间，计划覆盖：

- 背单词
- 语法学习
- 阅读学习
- 教师端与学生端
- 教师绑定多个学生
- 教师切换到学生视角，陪伴学生学习
- 后续扩展 Web、App、微信小程序多端体验

当前优先实现 Web 端，技术方案为：

- Next.js
- React
- TypeScript
- Tailwind CSS 设计理念（当前第一版尚未接入 Tailwind 编译链，使用 CSS 变量和模块化全局样式实现视觉基础）
- Lucide React 图标

## 2. 当前开发进度

### 已完成

- [x] 初始化 Next.js App Router 项目
- [x] 配置 TypeScript
- [x] 配置 React 19 与 Next.js 15
- [x] 接入 Lucide React 图标
- [x] 完成品牌化登录首页
- [x] 支持教师端 / 学生端身份切换
- [x] 添加演示账号登录校验
- [x] 添加密码显示 / 隐藏交互
- [x] 添加登录错误提示
- [x] 完成教师端工作台
- [x] 完成学生端工作台
- [x] 完成左侧导航栏
- [x] 添加词汇、语法、阅读、学生管理等功能入口
- [x] 完成教师切换到学生视角的演示交互
- [x] 完成教师学生概况卡片
- [x] 完成最近动态和待关注学生模块
- [x] 完成学生今日学习任务模块
- [x] 完成学习进度、连续学习天数、周表现等可视化卡片
- [x] 完成移动端响应式布局
- [x] 完成移动端侧边栏抽屉交互
- [x] 完成基础空状态页面
- [x] 通过 `npm run build` 构建检查（第一版前端）
- [x] 搭建后端服务（Next.js API 路由，与前端同仓）
- [x] 接入 SQLite + Prisma 数据库（用户 / 绑定关系 / 邀请码）
- [x] 实现正式用户注册、登录与 JWT 鉴权（httpOnly Cookie）
- [x] 实现教师绑定学生的真实流程
- [x] 实现学生邀请、接受邀请和解绑
- [x] 词书数据模型与导入脚本（DictionaryData 词书/单词/关系 + ECDICT 释义 → SQLite）
- [x] 词书选择（六大类 → 年级/类型 → 出版社 → 记忆当前词书，可更换）
- [x] 学前检测（每页 30 词、发音、笔记、对错标记、提交已标记单词、释义/音标开关）
- [x] 释义清洗（只保留词性释义，过滤专有名词、缩写、非词典内容）
- [x] 单词识记（五个一组、组级强化学习、学完全部进入学后检测）
- [x] 学后检测（针对识记词重新检测，全对掌握 / 有错回到学前检测）
- [x] 已掌握单词从词书剔除（会 → MASTERED）
- [x] 错题本（收录学后检测答错的单词，列表展示、移除错题）

### 当前版本未完成

以下内容暂时是前端演示数据或占位入口，尚未接入真实业务：

- [ ] 间隔重复算法（当前用 UNKNOWN / MASTERED 的简单状态流转）
- [ ] 真实语法课程内容
- [ ] 真实阅读文章、题目和答案解析
- [ ] 学习记录持久化
- [ ] 教师端数据统计接口
- [ ] 文件上传、课程编辑和内容管理
- [ ] Web、App、微信小程序共用 API
- [ ] 消息通知和学习提醒
- [ ] 将现有视觉样式逐步迁移为 Tailwind utility class（如确定采用 Tailwind 作为长期方案）

## 3. 账号体系

登录已接入真实鉴权：账号密码存储于数据库，密码使用 bcrypt 哈希，登录后签发 JWT 并写入 httpOnly Cookie，`/dashboard` 下的路由由 middleware 统一保护。

预置演示账号（`npm run db:seed` 生成，密码均为 `123456`）：

| 身份 | 账号 | 密码 | 姓名 |
| --- | --- | --- | --- |
| 教师 | `teacher` | `123456` | 林老师 |
| 学生 | `alex` | `123456` | Alex Chen |
| 学生 | `mia` | `123456` | Mia Wang |

也可以直接在注册页选择「学生 / 教师」身份创建新账号。登录成功后跳转到对应角色工作台（教师 `/dashboard/teacher`、学生 `/dashboard/student`）。

预置邀请码：`LINGUA01`（由教师 `teacher` 发出，可直接用于测试学生绑定流程）。

## 4. 本地运行

### 安装依赖

```bash
npm install
```

安装完成后会自动执行 `prisma generate` 生成数据库客户端。

### 初始化数据库

首次运行需创建 SQLite 数据库并写入演示数据：

```bash
npm run db:push   # 依据 prisma/schema.prisma 生成表结构
npm run db:seed   # 写入演示账号与邀请码
```

### 导入词书数据

1. 先 clone 词书数据仓库到本地（或放入 `./dictionary-data` 目录，或通过 `DICTIONARY_DATA_DIR` 指定目录）：

```bash
git clone https://github.com/LinXueyuanStdio/DictionaryData dictionary-data
```

2. 下载 ECDICT 主词典并转换为导入脚本可读的 TSV：

```bash
# 将 ecdict.csv 放到 dictionary-data/ 下
python prisma/build-ecdict-translations.py
```

3. 运行导入脚本。DictionaryData 仍负责词书、单词与关系；ECDICT 负责中文释义，原 `word_translation.csv` 作为回退来源：

```bash
npm run db:import
```

### 启动开发服务器

```bash
npm run dev
```

打开：

```text
http://localhost:3000
```

### 生产构建

```bash
npm run build
```

### 启动生产版本

```bash
npm run start
```

## 5. 目录结构

```text
english-learning/
├─ app/
│  ├─ api/                # 后端 API（Next.js Route Handlers）
│  │  ├─ auth/            # 注册 / 登录 / 登出 / 当前用户
│  │  ├─ invitations/     # 邀请码生成、列表、接受
│  │  ├─ students/        # 教师查询学生、解绑学生
│  │  └─ teachers/        # 学生查询绑定教师
│  ├─ login/page.tsx      # 登录页
│  ├─ register/page.tsx   # 注册页
│  ├─ dashboard/          # 受保护工作台
│  │  ├─ layout.tsx       # 鉴权 + 侧边栏壳
│  │  ├─ teacher/         # 教师端工作台、学生管理
│  │  └─ student/         # 学生端工作台、背单词（词书选择/学前检测/识记）
│  ├─ globals.css         # 全局样式、设计变量、响应式布局
│  ├─ layout.tsx          # 根布局与页面 metadata
│  └─ page.tsx            # 首页重定向（按登录态跳转）
├─ components/            # 共享 UI 组件
├─ lib/                   # prisma 单例、JWT、鉴权工具
├─ prisma/
│  ├─ schema.prisma       # 数据模型
│  ├─ seed.ts             # 演示数据
│  ├─ import-dictionary.ts # 词书/单词/关系导入 + ECDICT 释义清洗
│  └─ build-ecdict-translations.py # 将 ECDICT CSV 转为导入用 TSV
├─ dictionary-data/        # 词书、单词、关系及 ECDICT 释义数据
├─ middleware.ts          # 路由保护
├─ .env                   # DATABASE_URL、JWT_SECRET
├─ next.config.ts         # Next.js 配置
├─ package.json           # 项目依赖与脚本
├─ tsconfig.json          # TypeScript 配置
└─ DEVELOPMENT.md         # 本开发文档
```

## 6. 页面和交互说明

### 6.1 登录 / 注册页

登录页与注册页共用左侧品牌视觉：

- 登录：账号 + 密码，校验通过后跳转到对应角色工作台；错误时提示。
- 注册：选择「学生 / 教师」身份，填写姓名、账号、密码；注册成功自动登录。

密码输入框均支持显示 / 隐藏。注册时密码至少 6 位、账号至少 3 个字符。

### 6.2 教师端工作台

教师端默认展示：

- 本周学习概览（含真实学生人数）
- 学生概况卡片（来自数据库的真实学生）
- 最近动态（占位，待接入学习记录）
- 添加学生入口（跳转学生管理页）

教师端侧边栏入口：

- 工作台
- 学生管理
- 词汇学习
- 语法学习
- 阅读学习
- 学习目标
- 设置
- 帮助中心

### 6.3 教师陪学视角

教师端左下方提供「学生管理」快捷入口，点击进入学生管理页。原「陪伴学生学习」的演示切换（固定进入 Alex 视角）已移除，后续在阶段二实现「选择具体学生进入陪学视角」。

### 6.4 学生端工作台

学生端默认展示：

- 今日学习计划
- 今日词汇 / 语法 / 阅读任务（演示数据）
- 本周完成度
- 连续学习天数
- 我的老师（已绑定教师 + 输入邀请码绑定）

学生端侧边栏入口：

- 工作台
- 背单词
- 错题本
- 语法学习
- 阅读学习
- 学习记录
- 学习目标
- 设置
- 帮助中心

### 6.5 教师端学生管理

教师端「学生管理」页（`/dashboard/teacher/students`）：

- 生成邀请码（8 位大写字母 + 数字，去除易混淆字符）。
- 查看待使用 / 已使用的邀请码。
- 查看已绑定学生列表。
- 解绑学生（二次确认）。

### 6.6 学生端绑定老师

学生端工作台「我的老师」卡片：

- 展示已绑定的教师。
- 输入邀请码即可与教师建立绑定（幂等，重复绑定同一教师不会产生重复关系）。

### 6.7 背单词（学生端）

背单词形成完整闭环：学前检测 → 单词识记 → 学后检测 → 已掌握的单词从词书剔除，未掌握的回到学前检测重新学习。

**词书选择**（`/dashboard/student/vocabulary/books`）：

- 按分类展示：小学 / 初中 / 高中 / 考研 / 考博 / 出国。
- 小学/初中/高中按「年级/类型 → 出版社」层级筛选；考研按四级/六级/专四/专八/考研英语等筛选；出国按托福/雅思/GRE/GMAT/SAT/ACT/托业/BEC 等筛选。
- 选定后记录到 `UserBook`，下次直接使用；入口页提供「更换词书」按钮。

**学前检测**（`/dashboard/student/vocabulary/pretest`）：

- 单词以列表呈现，每页 30 个，支持上一页/下一页。
- 用户可跨页标记会/不会，最后点击「提交已学单词」一次性提交已标记单词并进入下一阶段。
- 每个单词行：小喇叭（浏览器语音合成朗读）、笔记（弹窗编辑，持久化到 `UserWordNote`）、对号（会）、错号（不会）。
- 侧边功能键：释义（显示中文意思）、音标（显示音标）。
- 释义数据优先来自 ECDICT，并在导入阶段统一清洗；`word_translation.csv` 仅作为回退来源。
- 提交后：会 → `MASTERED`（已掌握，从词书剔除），不会 → `UNKNOWN`（进入单词识记）。
- 已掌握（MASTERED）的单词不会再出现在学前检测中；词书主页显示「剩余 X / 总词数」。

**单词识记**（`/dashboard/student/vocabulary/review`）：

- 复用学前检测的单词展示样式（发音、释义/音标开关、笔记），去掉对号/错号。
- 五个一组展示，底部提供「下一组」按钮和「强化学习」按钮。
- 「强化学习」只针对本组单词，分两阶段：第一阶段右侧只有对号（点对号该词消失，表示这轮会了）；第二阶段右侧显示对/错，全部标记后确认，有错显示「共错 x 个，再练一次」（仅对错误词重练），直到全部做对。
- 强化学习完成后可选「学下一组」或「重新练习这组」。
- 所有组识记结束后进入「学后检测」。

**学后检测**（`/dashboard/student/vocabulary/reinforce`）：

- 展示方式与学前检测一致（含对号/错号），只针对单词识记部分的词做检测。
- 提交后：会 → `MASTERED`（从词书剔除），不会 → 删除进度记录，重新进入学前检测阶段。
- 答错的单词自动收录到错题本。

**错题本**（`/dashboard/student/wrong-words`）：

- 收录学后检测中答错的单词，含答错次数徽标。
- 支持列表展示（发音 / 释义 / 音标开关 / 笔记）、按答错次数降序、移除错题。
- 学后检测答对的单词自动从错题本移除。

## 7. 视觉和设计规范

当前界面采用成熟、克制的学习产品视觉方向：

- 主色：深蓝色，用于品牌背景和学习概览
- 强调色：暖橙色，用于按钮、状态和主要行动
- 辅助色：紫色、青绿色，用于区分不同学习模块
- 页面背景：浅灰白，突出内容卡片
- 圆角：以 8px、10px、12px、16px 为主要层级
- 字体：DM Sans + Noto Sans SC
- 图标：Lucide React

核心 CSS 变量位于 `app/globals.css`：

```css
:root {
  --ink: #1c2333;
  --muted: #7b8498;
  --line: #e9ebf0;
  --paper: #f7f8fa;
  --navy: #18243b;
  --orange: #e97845;
  --purple: #8572d5;
  --teal: #4bafaa;
}
```

新增页面或组件时，应优先复用现有色彩变量、按钮样式、卡片样式和进度条样式，避免出现新的无意义颜色。

> 说明：项目目标技术栈包含 Tailwind CSS，但第一版为了快速完成视觉验证，暂时将样式集中在 `app/globals.css`。后续接入 Tailwind 时，应保持现有设计变量和视觉层级不变，优先做样式实现方式迁移，不改变业务交互。

## 8. 已验证结果

截至 2026-09-15，已验证：

- `npm install` 成功
- `npx prisma generate` 成功
- `npm run db:push` 与 `npm run db:seed` 成功
- `python prisma/build-ecdict-translations.py` 成功
- `npm run db:import` 成功
- `npx tsc --noEmit` 成功
- `npm run build` 成功
- 教师账号 / 学生账号登录逻辑
- 教师视角切换到学生视角
- 教师生成邀请码 → 学生接受 → 教师列表可见
- 教师解绑学生
- 词书选择：六大类、年级/出版社层级筛选、当前词书记忆与更换
- 学前检测：每页 30 词、跨页标记、提交已标记单词、会→MASTERED、不会→UNKNOWN
- 单词笔记保存与读取
- 单词识记：五个一组、组级强化学习（对号→对错→再练一次→完成分支）
- 学后检测：会→MASTERED、不会→回学前检测并收录错题
- 已掌握单词从词书剔除（剩余词数实时反映）
- 错题本：收录、列表展示、移除错题
- 释义清洗：当前词书缺失释义为 0，`it` / `in` 等脏释义已清除
- ECDICT 全库导入后，有释义词数提升至 32,616，脏片段为 0

## 9. 已知限制

### 数据层

用户、师生绑定、邀请码、词书、单词、词书-单词关系、当前词书、单词笔记、单词学习状态、错题本均已落库（SQLite + Prisma）。

中文释义当前优先使用 ECDICT 清洗结果，原 DictionaryData 释义作为回退。全库 70,164 个单词中，32,616 个有有效词性释义；其余单词在 ECDICT 和原词典中均缺少干净释义，暂时保持为空。学习动态、任务内容仍为前端演示数据，刷新后重置。

### 登录和权限

注册、登录、JWT 鉴权、路由保护与师生绑定已接入。后续仍需补充：

- 邮箱 / 手机验证、找回密码
- 密码强度策略与登录限流
- 邀请码过期时间与撤销
- 更细粒度的角色与权限控制

### 内容模块

词汇、语法、阅读等入口当前显示基础占位页，后续需要拆分为独立业务模块和数据结构。

### 多端复用

当前版本只面向 Web。App 和微信小程序应在 API、账号体系、课程数据结构稳定后再开始开发，避免重复实现业务逻辑。

## 10. 后续开发计划

### 阶段一：真实账户和数据层 ✅（已完成）

1. 确定后端方案：Next.js API 路由（同仓）+ SQLite + Prisma。
2. 数据模型：用户（User）、师生绑定（TeacherStudent）、邀请码（Invitation）。
3. 实现注册、登录、退出、JWT session 持久化（httpOnly Cookie）。
4. 实现路由保护 middleware 与角色隔离。
5. 实现教师生成邀请码、学生接受邀请、教师解绑学生。
6. 待办：将学习任务 / 学习记录等演示数据迁移为 API 数据。

### 阶段二：教师管理能力

1. ✅ 学生列表页。
2. ✅ 生成邀请码。
3. ✅ 解绑学生。
4. [ ] 邀请链接（除邀请码外）与邀请码撤销 / 过期。
5. [ ] 选择具体学生进入陪学视角（当前已简化为跳转学生管理）。
6. [ ] 查看单个学生的学习数据和成长趋势。

### 阶段三：词汇学习

1. ✅ 词库、单词、释义、音标数据结构（Word / WordBook / BookWord）。
2. ✅ 词书选择、学前检测、单词发音（浏览器语音合成）、单词笔记、释义清洗与 ECDICT 词典接入。
3. ✅ 单词识记（五个一组、组级强化学习）。
4. ✅ 学后检测（针对识记词重新检测，全对掌握 / 有错回学前检测）。
5. ✅ 已掌握单词从词书剔除、错题本。
6. [ ] 间隔重复算法与学习记录持久化。
7. [ ] 教师布置词汇任务。

### 阶段四：语法和阅读

1. 语法知识点目录。
2. 语法讲解、例句和练习题。
3. 阅读文章、词汇标注和题目。
4. 自动批改与答案解析。
5. 教师布置课程和查看完成情况。

### 阶段五：学习数据和多端

1. 学习记录和统计接口。
2. 教师端数据看板。
3. 消息通知与学习提醒。
4. 提取跨端共享的 API 和类型定义。
5. 开始 App 和微信小程序端适配。

## 11. 开发约定

- 页面和组件优先使用 TypeScript。
- 业务状态尽量靠近使用它的组件管理，跨页面状态稳定后再引入统一状态管理。
- 新增功能入口时，同时补充空状态，避免点击后出现空白页面。
- 新增组件时保持移动端可用，至少检查 420px、760px 和桌面宽度。
- 不要在代码中硬编码账号、密码或密钥，敏感配置统一放 `.env`。
- 每完成一个模块，都应运行 `npm run build` 做一次构建检查。
- 涉及内容、学习记录和用户关系的接口，优先先确定数据模型，再开始编写页面。

## 12. 后端 API 与数据模型

### 数据模型（SQLite + Prisma）

- `User`：用户（教师 / 学生共用一张表），含 username（唯一）、passwordHash（bcrypt）、name、role（TEACHER / STUDENT）。
- `TeacherStudent`：师生绑定关系，`(teacherId, studentId)` 唯一。
- `Invitation`：邀请码，含 code（唯一）、teacherId、status（ACTIVE / ACCEPTED / REVOKED）、studentId、acceptedAt。
- `WordBook`：词书（含分类层级，parentId 指向分类）。
- `Word`：单词（text、音标 UK/US、词频、难度、中文释义 translation）。
- `BookWord`：词书 - 单词关系，`(bookId, wordId)` 唯一。
- `UserBook`：用户当前词书，`userId` 唯一。
- `UserWordNote`：用户单词笔记，`(userId, wordId)` 唯一。
- `UserWordProgress`：用户单词学习状态（UNKNOWN / MASTERED，其中 MASTERED 表示已掌握），`(userId, wordId)` 唯一。
- `UserWrongWord`：用户错题本（学后检测答错的单词），含 wrongCount / lastWrongAt / bookId，`(userId, wordId)` 唯一。

### API 一览

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 注册并自动登录 | 公开 |
| POST | `/api/auth/login` | 登录 | 公开 |
| POST | `/api/auth/logout` | 登出 | 登录 |
| GET | `/api/auth/me` | 当前用户 | 登录 |
| GET | `/api/invitations` | 我的邀请码列表 | 教师 |
| POST | `/api/invitations` | 生成邀请码 | 教师 |
| POST | `/api/invitations/accept` | 学生接受邀请 | 学生 |
| GET | `/api/students` | 绑定学生列表 | 教师 |
| DELETE | `/api/students/:id` | 解绑学生 | 教师 |
| GET | `/api/teachers` | 绑定教师列表 | 学生 |
| GET | `/api/books` | 词书分类树（含二级筛选） | 登录 |
| GET | `/api/books/current` | 当前词书 | 登录 |
| POST | `/api/books/current` | 选择 / 更换词书 | 登录 |
| GET | `/api/books/:id/words` | 某词书的单词（含笔记与状态） | 登录 |
| PUT | `/api/words/:id/note` | 保存 / 更新单词笔记 | 登录 |
| POST | `/api/pretest/submit` | 提交学前检测结果 | 学生 |
| POST | `/api/review/submit` | 提交学后强化结果（会→MASTERED，不会→回学前检测并收录错题） | 学生 |
| GET | `/api/wrong-words` | 错题本列表 | 学生 |
| DELETE | `/api/wrong-words/:wordId` | 移除错题 | 学生 |

鉴权机制：登录后签发 JWT，写入 httpOnly Cookie（`lingua_token`）；`/dashboard` 下的页面由 `middleware.ts` 校验登录态，API 内部通过 `getCurrentUser()` 二次校验并做角色隔离。
