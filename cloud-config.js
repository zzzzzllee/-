/*
 * Supabase 前端配置。
 * 只填写 Project URL 和 anon public key；绝对不要把 service_role key 放到这里。
 * 留空时网站会继续使用 content.json 和 IndexedDB 本机草稿，不会报错。
 */
window.WECHAT_CLOUD_CONFIG = Object.assign({
  url: 'https://lbaoqsxmpvqxpbogvpyj.supabase.co',
  anonKey: 'sb_publishable_TDghBXmCLqjUnYXu7Xqhmg_97K8hvTU',
  contentId: 'wechat-recruitment-2026',
  bucket: 'wechat-recruitment-assets'
}, window.WECHAT_CLOUD_CONFIG || {});
