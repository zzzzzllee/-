# Recruitment Read-only Page and Visual Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 2026 级招新公开页改成纯观看页面，并把编辑能力集中到支持富文本、拖动和层级调整的在线编辑器。

**Architecture:** 公开页继续由 content.json 与 Supabase 云端内容渲染；新增 richText 和 layout 两个兼容字段作为可视化覆盖层。编辑器通过同源 iframe 操作预览 DOM，把文字 HTML 和素材位置写回统一内容对象，再复用现有云端保存。

**Tech Stack:** 静态 HTML/CSS/JavaScript、Supabase JavaScript Client v2、GitHub Pages。

## Global Constraints

- 普通公开页面不能出现任何编辑入口或本地编辑能力。
- 手机端优先，现有 Supabase RLS 与共享密钥机制保持不变。
- 前端只能使用 publishable key，不能加入 service_role。

---

### Task 1: 重写内容与岗位展示
- [ ] 更新 content.json 中岗位、收获、轻松日常和零基础文案。
- [ ] 在 index.html 渲染五张带图片的岗位技能卡。
- [ ] 加入白狼、猫头鹰首屏装饰与重点零基础提示卡。

### Task 2: 公开页只读化和手机排版
- [ ] 删除公开页文件选择器、编辑入口、重播和保存功能。
- [ ] 删除公开页点击换图代码和可编辑属性。
- [ ] 调整相册提示、岗位卡和收获区手机样式。

### Task 3: 可视化编辑器
- [ ] 增加预览选择、直接文字编辑和加粗工具。
- [ ] 增加图片/装饰拖动与置顶、上移、下移、置底、复位。
- [ ] 将 richText/layout 持久化并应用到公开页。

### Task 4: 验证与发布
- [ ] 校验 JSON、JavaScript 语法和只读页面关键字。
- [ ] 用浏览器自动化检查 375px 手机版和编辑器交互。
- [ ] 保存中文修改日志，提交并推送 GitHub Pages。
