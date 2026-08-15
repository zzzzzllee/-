# Supabase 配置与共享编辑链接

这份推文现在支持“共享链接免登录”的在线编辑模式。GitHub Pages 只负责托管页面，文字和图片的最新版本由 Supabase 保存。

## 一、创建 Supabase 项目

1. 在 Supabase 创建一个免费项目。
2. 打开 SQL Editor，把仓库里的 `supabase-schema.sql` 全部执行一次。
3. 在 Project Settings → API 里复制 **Project URL** 和 **anon public key**。
4. 用这两个值填写仓库根目录的 `cloud-config.js`：

```js
window.WECHAT_CLOUD_CONFIG = {
  url: 'https://你的项目.supabase.co',
  anonKey: '你的 anon public key',
  contentId: 'wechat-recruitment-2026',
  bucket: 'wechat-recruitment-assets'
};
```

只填写 anon public key，不能填写 service_role key。配置文件可以公开放在 GitHub Pages；共享编辑密钥才是编辑入口。

## 二、使用共享编辑链接

打开 `editor.html` 时，如果没有 `share` 参数，编辑器会自动生成一个随机共享密钥并把它放进当前地址。点击“复制共享编辑链接”，把复制出的完整地址发给需要共同编辑的人。

普通阅读页面仍然是：

```text
https://zzzzzllee.github.io/-/
```

共享编辑页面的形式是：

```text
https://zzzzzllee.github.io/-/editor.html?share=随机密钥
```

拿到共享链接的人无需登录即可编辑。共享链接泄露就等同于编辑权限泄露；如需停止旧链接，重新生成新的 `share` 链接并只发给新成员。

## 三、图片、二维码和宣传片

- 文字、二维码标签、图片地址、视频地址修改后约 600ms 自动保存。
- 选择图片会先保留在本机 IndexedDB；配置 Supabase 后会自动上传到 Storage，并把公开地址写入内容 JSON。
- 选择 MP4/WebM 宣传片会上传到 Storage；也可以直接填写浏览器可访问的视频地址。
- 推文首页优先读取云端最新内容，云端暂时不可用时回退到仓库中的 `content.json`。

## 四、权限说明

这个方案不需要 GitHub Token，也不需要 GitHub 账号密码。前端不包含 Supabase service-role key。共享密钥通过请求头参与数据库和 Storage 的 RLS 策略；同一字段同时修改时采用最后一次保存优先，不提供逐字级 CRDT 合并。
