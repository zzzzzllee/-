# 多人共享在线编辑器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有静态招新推文改造成无需登录、通过共享链接多人在线编辑，并把文字、图片、二维码、视频和布局内容自动保存到 Supabase，刷新、换设备后仍能读取最新版本。

**Architecture:** 浏览器继续使用纯静态 HTML，不引入构建工具。Supabase Postgres 保存完整内容 JSON，Storage 保存图片文件，Realtime 广播内容变更；共享链接中的随机 `share` 密钥作为编辑权限。首页优先读取云端内容，编辑器自动保存云端，Supabase 不可用时退回 IndexedDB 和本地静态内容。

**Tech Stack:** 原生 HTML/CSS/JavaScript、Supabase CDN（`@supabase/supabase-js`）、Supabase Postgres、Storage、Realtime、GitHub Pages。

## Global Constraints

- 不使用 GitHub Token、GitHub 登录或账号密码。
- 前端只能使用 Supabase anon public key，禁止放置 service-role key。
- 普通首页只读；只有带 `editor.html?share=<共享密钥>` 的链接可以编辑。
- 同一字段同时编辑采用最后一次保存优先；不实现逐字 CRDT。
- 自动保存使用约 600ms 防抖；云端不可用时必须保留 IndexedDB 本机草稿。
- 二维码、视频和图片内容必须通过现有编辑器可修改。

---

### Task 1: 建立云端配置与数据库结构

**Files:**
- Create: `cloud-config.js`
- Create: `cloud-sync.js`
- Create: `supabase-schema.sql`
- Modify: `README.md`
- Test: `work/check-cloud-files.ps1`

**Interfaces:**
- `cloud-config.js` 导出/暴露 `window.WECHAT_CLOUD_CONFIG`，包含 `url`、`anonKey`、`contentId`、`bucket`。
- `cloud-sync.js` 暴露 `window.WechatCloudSync`，提供 `isConfigured()`、`loadContent()`、`saveContent(content)`、`uploadAsset(file, path)`、`subscribe(callback)`、`getShareKey()`。
- `supabase-schema.sql` 创建 `wechat_contents` 表、公开读取/写入所需 RLS 策略、Storage bucket 与对象策略。

- [ ] **Step 1: 写配置和接口检查脚本**
- [ ] **Step 2: 运行检查，确认新接口尚未存在并记录预期失败**
- [ ] **Step 3: 实现配置、Supabase 初始化、内容读写、图片上传、Realtime 订阅和共享密钥校验**
- [ ] **Step 4: 写出数据库初始化 SQL 与配置说明**
- [ ] **Step 5: 运行接口检查并提交 `feat: add shared cloud sync foundation`**

---

### Task 2: 改造编辑器为共享链接自动保存

**Files:**
- Modify: `editor.html`
- Test: `work/check-editor-cloud-hooks.ps1`

**Interfaces:**
- 编辑器保留现有本机 IndexedDB 草稿逻辑，云端保存成功后更新同步状态。
- 页面加载时先读取云端内容；没有共享密钥时显示只读/未授权提示。
- 文本、图片、二维码、视频和表单字段的修改都进入统一的 `scheduleCloudSave()`。
- 图片上传先传 Storage，再把公开 URL 写入内容 JSON；上传失败时继续保留本机草稿。
- Realtime 收到别的编辑者更新时刷新表单和预览，不覆盖当前未保存输入。
- 页面底部保留“编辑入口 · 在线编辑”，顶部不再显示 GitHub 发布、Token、打印/导出功能。

- [ ] **Step 1: 盘点现有编辑器状态、事件和保存入口**
- [ ] **Step 2: 添加共享链接解析、云端加载与同步状态 UI**
- [ ] **Step 3: 将所有字段变更接入自动保存与 Realtime 更新**
- [ ] **Step 4: 将图片/视频/二维码上传接入 Storage，失败时回退 IndexedDB**
- [ ] **Step 5: 运行脚本检查关键钩子并提交 `feat: make editor collaborative`**

---

### Task 3: 改造首页读取云端内容

**Files:**
- Modify: `index.html`
- Test: `work/check-homepage-cloud-hooks.ps1`

**Interfaces:**
- 首页打开后调用 `WechatCloudSync.loadContent()`，成功则渲染云端最新内容。
- 未配置 Supabase、网络失败或云端内容不存在时回退当前 `content.json`。
- 首页不显示编辑控件，不暴露共享密钥。

- [ ] **Step 1: 添加云端脚本引用**
- [ ] **Step 2: 将内容加载入口改为云端优先、静态内容兜底**
- [ ] **Step 3: 运行首页关键钩子检查并提交 `feat: load published content from cloud`**

---

### Task 4: 加入初始化与使用说明

**Files:**
- Create: `docs/supabase-setup.md`
- Modify: `README.md`
- Modify: `content.json`

**Interfaces:**
- 文档明确列出 Supabase 项目 URL、anon key、SQL 执行、Storage 设置、共享链接生成和初始化内容的步骤。
- 配置为空时页面必须正常显示当前静态推文。
- 不在仓库中提交真实密钥；提供 `cloud-config.example.js`。

- [ ] **Step 1: 添加配置示例和中文配置文档**
- [ ] **Step 2: 用当前 `content.json` 生成一次可执行初始化说明**
- [ ] **Step 3: 运行静态资源检查并提交 `docs: add supabase setup guide`**

---

### Task 5: 验证、部署与记录

**Files:**
- Create: `work/verify-shared-editor.ps1`
- Modify: `logs/online-shared-editor.md`

**Interfaces:**
- 验证脚本检查 JavaScript 语法、关键 DOM/云端钩子、`git diff --check`。
- 使用两个浏览器页面打开同一共享链接，验证一端改文案另一端可收到更新。
- 验证图片上传、刷新、换设备读取；验证云端不可用时 IndexedDB 回退。
- 推送远程 `main`，验证 GitHub Pages 首页和编辑器返回 200。

- [ ] **Step 1: 运行静态检查和语法检查**
- [ ] **Step 2: 启动本地静态服务并进行双页面验证**
- [ ] **Step 3: 检查在线部署状态和页面内容**
- [ ] **Step 4: 更新中文日志，提交并推送 `feat: add shared online editing`**
- [ ] **Step 5: 输出共享编辑链接和普通阅读链接，并明确是否已配置 Supabase**
