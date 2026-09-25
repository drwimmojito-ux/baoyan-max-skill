# 保研工作台

<p align="center"><img src="assets/logo.png" alt="保研工作台标志" width="160" /></p>

保研工作台是面向个人使用的保研申请管理网页。它集中管理院校项目、申请进度、材料条目及文件、重要日期和面试笔记。填写的数据和上传的文件保存在当前浏览器中。

## 运行方式

1. 下载或克隆本仓库。
2. 在仓库目录启动静态文件服务器后访问首页。直接双击 `index.html` 时，浏览器对 `file://` 的本地存储支持可能不同，不建议用它保存正式材料。
3. 点击“开始我的规划”清除演示数据，建立自己的项目。

项目由原生 HTML、CSS、JavaScript 构成，无构建步骤或第三方运行依赖。当前版本可作为静态站点部署到 GitHub Pages；部署只发布网页代码，使用者填写的项目数据不会随仓库上传。

当前交付是网页预览，文件位于浏览器管理的本地存储空间，不是用户自行选择的磁盘目录。桌面应用及其磁盘目录管理将在界面和操作方式确认后再实现。

## 功能

- 添加、编辑、删除申请项目；在看板卡片上通过“移动到…”选择阶段，支持“待调研 → 准备中”等任意阶段调整。
- 新增或编辑项目后自动清除搜索筛选，避免项目已保存却因筛选条件而不可见；筛选期间会显示匹配数量及清除入口。
- 记录申请类型、日期及备注；搜索项目，查看近期日期和未来七天截止数量。
- 管理材料清单：添加、改名、删除条目；为每个条目上传多个文件，并可更换、下载或删除单个文件。
- 在设置中导出和导入项目与材料清单的 JSON。**JSON 不包含上传文件。**
- 在桌面和窄屏设备上使用响应式界面。
- 在“AI 咨询”页编辑 Markdown 个人资料和问题，可直连用户配置的 OpenAI 兼容 Chat Completions API，也可生成提问交给 Codex Skill。

## 保研咨询 Skill

仓库同时包含 [`skills/baoyan-advisor/SKILL.md`](skills/baoyan-advisor/SKILL.md)、[飞跃手册来源目录](skills/baoyan-advisor/references/feiyue-sources.md) 和供工作台共用的机器可读清单 [`handbooks.json`](skills/baoyan-advisor/references/handbooks.json)。资料目录有 35 个入口：23 个入口与主题已核查、3 个目录已核查但正文受限、9 个候选入口。它是链接索引，不包含手册全文，也不是录取统计样本。

工作台“AI 咨询”有两种方式：

1. **直连模型 API**：在“设置”自行填写 OpenAI Chat Completions 兼容服务的基础地址、模型名和 API Key，再从咨询页发送问题。网页会发送规则摘要和来源链接索引，但不会调用 Codex Skill/Agent，也不会自动读取手册正文；是否能联网取决于 API 服务是否实际提供网页检索。
2. **Codex Skill 交接**：点击生成并复制 Markdown 提问，将它粘贴到能访问本仓库的 Codex 对话。仓库内的 `AGENTS.md` 会引导 Codex 读取 Skill；Skill 按问题检索具体页面，在当前环境支持时可使用子 Agent 并行核查。若 Codex 对话无法访问本仓库，单靠文件路径不能加载 Skill。

个人信息可以直接在对话中发送。若希望在本地另存 Markdown 文件，可复制 [`profile/PROFILE.template.md`](profile/PROFILE.template.md) 为 `profile/PROFILE.md` 后自行填写；该文件已被 Git 忽略，网页不会自动读取它。使用工作台时，把需要使用的资料粘贴到“AI 咨询”页的 Markdown 编辑区；点击“发送给配置的 AI”时，资料会与问题一起发往所配置的 API 服务商。API Key 保存在同一浏览器的 `localStorage`，可由此网站的脚本读取。需要实际核对手册内容时，使用可访问本仓库的 Codex Skill 工作流或具备网页检索的模型服务，并确认具体来源链接。

## 数据与隐私边界

- 项目和材料清单写入当前浏览器的 `localStorage`，键名为 `baoyan-workbench-v1`；咨询页 Markdown 资料和 API 配置分别使用独立键 `baoyan-workbench-profile-markdown-v1` 与 `baoyan-workbench-api-config-v1`；上传文件写入当前浏览器的 IndexedDB，数据库名为 `baoyan-workbench-files-v1`。应用没有账户或自建后端；只有用户主动发送咨询时，浏览器才向已配置的 API 服务请求回答。
- 同一站点在不同浏览器或浏览器配置文件中的数据各自独立；同一浏览器配置文件中的使用者会共用这份数据。因此共用电脑时应使用独立的系统账户或浏览器配置文件。
- 清除站点数据、使用隐私浏览模式、变更站点域名或设备，都可能使原数据和文件无法访问。迁移前应导出清单 JSON，并在材料库逐一下载重要文件。导入 JSON 会替换清单并删除当前浏览器中已有的上传文件。
- 浏览器的 `localStorage` 不提供应用层加密；保存的 API Key 可被此站点脚本读取。不要输入账户密码或高权限密钥，使用可信 API 服务，并在共用设备上清除配置。
- 点击“发送给 AI”会把问题、当前编辑的 Markdown 资料和手册索引直接发送给你填写的 API 服务商；服务商可能收费。GitHub Pages 仅托管网页文件，不会代为保存 API Key。
- 静态托管服务仍可能记录访问网页时的常规网络日志（例如 IP 地址）。
- 演示院校及日期只是界面示例。真实招生要求、截止日期和资格条件应以各院校官方通知为准。

## 后续可选方向

1. **离线优先**：加入 Service Worker，使已打开过的应用在断网时仍可启动。
2. **更强的本地安全**：提供用户自设口令的加密备份；需先明确密钥丢失后的恢复策略。
3. **申请资料模板**：提供可复制的面试问题、邮件草稿及材料检查项，但应与个人记录分开存储。
4. **可验证的信息来源**：若未来加入院校信息检索，应标明来源链接和抓取时间，不把模型生成内容当作官方通知。

## 文件

- `index.html`：网页入口。
- `styles.css`：界面样式。
- `app.js`：页面交互和清单管理。
- `files.js`：浏览器本地文件存储。
- `assets/logo.png`：项目标志原图。
- `assets/logo.ico`：网页和 Windows 可用的图标文件。
- `保研工作台-UI概念图.png`：设计参考图。
- `AGENTS.md`、`skills/baoyan-advisor/`：仓库内保研咨询 Skill 与资料索引。
- `profile/PROFILE.template.md`：可复制的个人信息 Markdown 模板。
- `skills/baoyan-advisor/references/handbooks.json`：工作台与 Skill 共用的手册入口和状态索引。
