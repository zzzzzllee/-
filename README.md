# 2026级新生招新推文：GitHub Pages 在线编辑版

这个文件夹是一套可以长期在线运行的招新推文：

- `index.html`：公开展示页面；
- `editor.html`：在线编辑页面；
- `content.json`：文字、报名时间、二维码说明和图片路径；
- `assets/`：推文图片；
- `.github/workflows/pages.yml`：提交后自动发布到 GitHub Pages。

## 一、第一次上线

1. 在 GitHub 新建一个 **Public（公开）** 仓库，例如 `recruitment-2026`。
2. 把本文件夹内的全部文件上传到仓库根目录，或用 Git 推送。
3. 在仓库的 **Settings → Pages** 中，将发布方式设为 **GitHub Actions**。
4. 等待 Actions 完成，公开地址通常是：
   `https://你的用户名.github.io/仓库名/`
5. 打开公开地址后，在地址后加 `editor.html`，进入在线编辑器。

## 二、在线修改并长期更新

1. 打开 `editor.html`。
2. 填写 GitHub 用户名、仓库名和分支（通常是 `main`）。
3. 创建一个 Fine-grained personal access token：只选择这个仓库，并给 **Contents: Read and write** 权限。
4. 将 Token 填到编辑器中。Token 只放在当前浏览器会话里，不会写入代码。
5. 修改文字、报名时间、报名截止时间，或选择新图片/二维码。
6. 点“保存本机草稿并预览”检查效果。
7. 点“发布到 GitHub”，编辑器会把图片上传到 `assets/uploads/`，把文字和路径保存到 `content.json`。
8. GitHub Actions 自动重新发布，公开页面会同步更新。

## 三、二维码替换

当前四个二维码是白色占位图。在线编辑器中的四个二维码上传框可以直接替换为真实二维码；发布后会自动更新公开页面。

## 四、安全提醒

- 不要把 Token 写进 `index.html`、`editor.html` 或 `content.json`。
- Token 只授权目标仓库，不要授予整个账号的全部权限。
- 用完后可以在 GitHub 删除或撤销 Token。
- 公开仓库里的内容和图片任何人都可以看到，请不要上传隐私资料。

## 五、如果页面没有马上变化

GitHub Pages 首次部署或更新可能需要等待一会儿；先查看仓库 Actions 是否显示成功，再刷新页面。编辑器发布后会自动带时间戳刷新预览。
'
## 六、电脑关机后能否使用

可以。GitHub Pages 发布完成后，公开推文页面和在线编辑器都在 GitHub 上运行，不依赖你自己的电脑或本地 Python 服务。电脑关机、睡眠或离线时，手机仍然可以打开：

- `https://你的用户名.github.io/仓库名/`：查看公开推文；
- `https://你的用户名.github.io/仓库名/editor.html`：手机在线修改和发布。

注意：临时 Cloudflare 分享地址依赖本地电脑服务，只适合预览，不适合长期使用。长期网址必须使用 GitHub Pages 或其他云端静态托管。
'