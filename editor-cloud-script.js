(() => {
  const KEY = 'wechatRecruitmentDraft2026';
  const DRAFT_DB = 'wechatRecruitmentDrafts2026';
  const DRAFT_STORE = 'drafts';
  let content = null;
  let baseContent = null;
  let autosaveTimer = null;
  let draftDbPromise = null;
  let pendingVideo = null;
  let cloudSaving = false;
  let dirty = false;
  let unsubscribeCloud = () => {};
  const pending = {};
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cloneValue = value => {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const isDataUrl = value => /^data:image\//i.test(String(value || ''));
  const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const setPath = (object, path, value) => {
    const parts = path.split('.');
    let current = object;
    parts.slice(0, -1).forEach(key => { if (!current[key] || typeof current[key] !== 'object') current[key] = {}; current = current[key]; });
    current[parts[parts.length - 1]] = value;
  };
  const field = (label, path, value, full = false, area = false) => `<div class="field ${full ? 'full' : ''}"><label>${esc(label)}</label>${area ? `<textarea data-path="${esc(path)}">${esc(value)}</textarea>` : `<input data-path="${esc(path)}" value="${esc(value)}">`}</div>`;
  const text = (path, fallback = '') => getPath(content, path) ?? fallback;
  const arr = (path, fallback = []) => Array.isArray(getPath(content, path)) ? getPath(content, path) : fallback;
  const imageNames = {
    hero1: '首页主图 1', hero2: '首页主图 2', hero3: '首页主图 3', intro: '开场图片', detail1: '细节图片 1', detail2: '细节图片 2',
    moment1: '活动照片 1', moment2: '活动照片 2', moment3: '活动照片 3', moment4: '活动照片 4', closing: '结尾合照',
    qrWestGroup: '西区咨询群二维码', qrWestSignup: '西区报名二维码', qrNorthGroup: '北区咨询群二维码', qrNorthSignup: '北区报名二维码',
    photoWall1: '照片墙 1', photoWall2: '照片墙 2', photoWall3: '照片墙 3', photoWall4: '照片墙 4', photoWall5: '照片墙 5', photoWall6: '照片墙 6', rolesGallery1: '演出展览图 1', rolesGallery2: '演出展览图 2', rolesGallery3: '演出展览图 3', rolesGallery4: '演出展览图 4', rolesGallery5: '演出展览图 5', rolesGallery6: '演出展览图 6'
  };
  const status = (message, error = false) => { const el = $('#status'); if (el) { el.textContent = message; el.className = 'status' + (error ? ' error' : ''); } };
  const cloud = () => window.WechatCloudSync || null;
  const cloudReady = () => Boolean(cloud()?.isConfigured?.() && cloud()?.hasShareKey?.());
  const syncPhotoWall = () => {
    if (!content) return;
    content.photoWall = content.photoWall || {};
    const keys = Array.isArray(content.photoWall.imageKeys) ? content.photoWall.imageKeys : [];
    content.photoWall.images = keys.map(key => content.images?.[key]).filter(Boolean);
  };
  const renderForm = () => {
    const roles = arr('roles.cards');
    const gains = arr('gains.cards');
    const suitable = arr('suitable.items');
    const qrLabels = arr('apply.qrLabels');
    let html = '';
    html += `<div class="section"><h2>基础与首屏</h2><div class="grid">${field('网页标题', 'siteTitle', text('siteTitle'), true)}${field('顶部单位名称', 'hero.kicker', text('hero.kicker'))}${field('主标题', 'hero.titleMain', text('hero.titleMain'))}${field('强调标题', 'hero.titleAccent', text('hero.titleAccent'))}${field('副标题', 'hero.sub', text('hero.sub'))}</div></div>`;
    html += `<div class="section"><h2>开场</h2><div class="grid">${field('标题前半句', 'intro.titleBefore', text('intro.titleBefore'))}${field('标题高亮句', 'intro.titleMark', text('intro.titleMark'))}${field('开场引导文字', 'intro.lead', text('intro.lead'), true, true)}${field('开场图片说明', 'intro.caption', text('intro.caption'), true)}</div></div>`;
    html += `<div class="section"><h2>我们做什么</h2><div class="grid">${field('板块标题前半句', 'roles.titleBefore', text('roles.titleBefore'), true)}${field('板块高亮句', 'roles.titleMark', text('roles.titleMark'), true)}</div>`;
    roles.forEach((item, index) => { html += `<div class="card"><div class="card-title">岗位内容 ${index + 1}</div><div class="grid">${field('小标题', `roles.cards.${index}.title`, item.title)}${field('标签', `roles.cards.${index}.tag`, item.tag)}${field('正文', `roles.cards.${index}.body`, item.body, true, true)}</div></div>`; });
    html += '</div>';
    const galleryCaptions = arr('roles.gallery.captions');
    html += `<div class="card"><div class="card-title">幕后图片展</div><div class="grid">${field('图片展标题', 'roles.gallery.title', text('roles.gallery.title'), true)}${field('图片展提示', 'roles.gallery.hint', text('roles.gallery.hint'), true)}`;
    galleryCaptions.forEach((item, index) => { html += field(`展览图片说明 ${index + 1}`, `roles.gallery.captions.${index}`, item, true); });
    html += '</div></div></div>';
    html += `<div class="section"><h2>你会收获</h2><div class="grid">${field('板块标题前半句', 'gains.titleBefore', text('gains.titleBefore'))}${field('板块高亮句', 'gains.titleMark', text('gains.titleMark'))}</div>`;
    gains.forEach((item, index) => { html += `<div class="card"><div class="card-title">收获 ${index + 1}</div><div class="grid">${field('名称', `gains.cards.${index}.title`, item.title)}${field('说明', `gains.cards.${index}.body`, item.body, true, true)}</div></div>`; });
    html += '</div>';
    html += `<div class="section"><h2>宣传片视频</h2><div class="grid">${field('视频板块标题前半句', 'video.titleBefore', text('video.titleBefore', '宣传片，'))}${field('视频板块高亮句', 'video.titleMark', text('video.titleMark', '先看见我们'))}${field('视频介绍', 'video.intro', text('video.intro'), true, true)}${field('视频地址（MP4/WebM）', 'video.url', text('video.url'))}${field('视频封面地址', 'video.poster', text('video.poster', 'assets/style-sky.jpg'))}${field('视频下方说明', 'video.note', text('video.note'), true)}</div></div>`;
    html += `<div class="section"><h2>活动时刻</h2><div class="grid">${field('板块标题前半句', 'moments.titleBefore', text('moments.titleBefore'))}${field('板块高亮句', 'moments.titleMark', text('moments.titleMark'))}${field('第一段正文', 'moments.paragraphs.0', text('moments.paragraphs.0'), true, true)}${field('第二段正文', 'moments.paragraphs.1', text('moments.paragraphs.1'), true, true)}</div></div>`;
    html += `<div class="section"><h2>适合怎样的你</h2><div class="grid">${field('板块标题前半句', 'suitable.titleBefore', text('suitable.titleBefore'))}${field('板块高亮句', 'suitable.titleMark', text('suitable.titleMark'))}`;
    suitable.forEach((item, index) => { html += field(`招新期待 ${index + 1}`, `suitable.items.${index}`, item, true); });
    html += `${field('结尾鼓励语', 'suitable.encourage', text('suitable.encourage'), true, true)}</div></div>`;
    html += `<div class="section"><h2>报名信息</h2><div class="grid">${field('板块标题前半句', 'apply.titleBefore', text('apply.titleBefore'))}${field('板块高亮句', 'apply.titleMark', text('apply.titleMark'))}${field('招新对象', 'apply.object', text('apply.object'), true)}${field('报名时间', 'apply.signupTime', text('apply.signupTime'))}${field('报名截止', 'apply.deadline', text('apply.deadline'))}${field('报名方式说明', 'apply.method', text('apply.method'), true, true)}`;
    qrLabels.forEach((item, index) => { html += field(`二维码标签 ${index + 1}`, `apply.qrLabels.${index}`, item); });
    html += '</div></div>';
    html += `<div class="section"><h2>结尾</h2><div class="grid">${field('合照说明', 'closing.photoCaption', text('closing.photoCaption'), true)}${field('结尾正文', 'closing.body', text('closing.body'), true, true)}${field('强调短句', 'closing.emphasis', text('closing.emphasis'))}${field('结尾标题', 'closing.title', text('closing.title'))}${field('落款第一行', 'closing.subLine1', text('closing.subLine1'))}${field('落款第二行', 'closing.subLine2', text('closing.subLine2'))}</div></div>`;
    html += `<div class="section"><h2>照片墙</h2><div class="grid">${field('照片墙标题', 'photoWall.title', text('photoWall.title'), true)}${field('照片墙提示', 'photoWall.hint', text('photoWall.hint'), true)}`;
    arr('photoWall.captions').forEach((item, index) => { html += field(`照片说明 ${index + 1}`, `photoWall.captions.${index}`, item, true); });
    html += '</div></div>';
    html += '<div class="section"><h2>图片与二维码</h2><p class="token-note">选择新图片后会自动保存到本机；配置云端后会自动上传并同步给其他编辑者。</p>';
    Object.entries(content.images || {}).forEach(([key, src]) => { html += `<div class="image-row"><img id="img-${esc(key)}" src="${esc(src)}" alt="${esc(imageNames[key] || key)}"><div><label>${esc(imageNames[key] || key)}</label><br><input type="url" class="image-url-input" data-image-url="${esc(key)}" value="${esc(src)}" placeholder="图片地址（可填写在线图片 URL）"><small>可直接修改图片地址，也可以选择本机图片上传。</small><input type="file" accept="image/*" data-image="${esc(key)}"><div class="token-note">当前地址：${esc(src)}</div></div></div>`; });
    html += '</div>';
    $('#form').innerHTML = html;
    bindFields(); bindImages(); bindImageUrls(); ensureVideoUpload();
  };
  const openDraftDb = () => new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('IndexedDB 不可用')); return; }
    const request = indexedDB.open(DRAFT_DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(DRAFT_STORE)) request.result.createObjectStore(DRAFT_STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本机草稿数据库'));
  });
  const getDraftDb = () => { if (!draftDbPromise) draftDbPromise = openDraftDb().catch(error => { draftDbPromise = null; throw error; }); return draftDbPromise; };
  const idbRequest = (mode, run) => getDraftDb().then(db => new Promise((resolve, reject) => { const transaction = db.transaction(DRAFT_STORE, mode); const request = run(transaction.objectStore(DRAFT_STORE)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error || new Error('本机草稿操作失败')); transaction.onerror = () => reject(transaction.error || new Error('本机草稿事务失败')); }));
  const writeIndexedDraft = value => idbRequest('readwrite', store => store.put(cloneValue(value), KEY));
  const readIndexedDraft = () => idbRequest('readonly', store => store.get(KEY));
  const deleteIndexedDraft = () => idbRequest('readwrite', store => store.delete(KEY));
  const readLegacyDraft = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const readDraft = async () => { try { const saved = await readIndexedDraft(); if (saved) return saved; } catch {} const legacy = readLegacyDraft(); if (legacy) { try { await writeIndexedDraft(legacy); localStorage.removeItem(KEY); } catch {} } return legacy; };
  const clearDraft = async () => { try { await deleteIndexedDraft(); } catch {} try { localStorage.removeItem(KEY); } catch {} };
  const buildSlimDraft = () => { const draft = cloneValue(content); const original = baseContent || {}; Object.keys(draft.images || {}).forEach(key => { if (isDataUrl(draft.images[key])) draft.images[key] = original.images?.[key] || ''; }); syncPhotoWallValue(draft); return draft; };
  const syncPhotoWallValue = value => { if (value?.photoWall?.imageKeys) value.photoWall.images = value.photoWall.imageKeys.map(key => value.images?.[key]).filter(Boolean); };
  const persistDraft = async () => { syncPhotoWall(); try { await writeIndexedDraft(content); return true; } catch { try { localStorage.setItem(KEY, JSON.stringify(buildSlimDraft())); return true; } catch { status('文字修改已保留在当前页面，但本机草稿保存失败。请配置云端或清理浏览器站点数据。', true); return false; } } };
  const pushPreview = () => { const frame = $('#preview'); if (frame?.contentWindow) frame.contentWindow.postMessage({ type: 'wechat-recruitment-preview', content }, '*'); };
  const refreshPreview = () => { const frame = $('#preview'); if (frame) { frame.onload = pushPreview; frame.src = 'index.html?preview=' + Date.now(); } };
  const uploadPendingAssets = async () => {
    if (!cloudReady()) return;
    for (const [key, src] of Object.entries(content.images || {})) {
      if (!isDataUrl(src) || pending[key]?.file) continue;
      const blob = await fetch(src).then(response => response.blob());
      const extension = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      pending[key] = { file: new File([blob], `${key}.${extension}`, { type: blob.type || 'image/png' }) };
    }
    for (const [key, item] of Object.entries(pending)) {
      if (!item?.file) continue;
      status(`正在上传图片：${key}`);
      content.images[key] = await cloud().uploadAsset(item.file, `image-${key}`);
      delete pending[key];
    }
    if (pendingVideo?.file) {
      status('正在上传宣传片…');
      content.video = content.video || {};
      content.video.url = await cloud().uploadAsset(pendingVideo.file, 'promo-video');
      pendingVideo = null;
    }
  };
  const saveCloud = async () => {
    if (!cloudReady() || cloudSaving) return false;
    cloudSaving = true;
    try { await uploadPendingAssets(); syncPhotoWall(); content = (await cloud().saveContent(content)) || content; baseContent = cloneValue(content); dirty = false; await persistDraft(); status('已自动保存到云端，其他打开同一共享链接的人会收到更新。'); return true; }
    catch (error) { status('本机草稿已保存，但云端同步失败：' + (error.message || error), true); return false; }
    finally { cloudSaving = false; }
  };
  const scheduleDraft = () => { dirty = true; clearTimeout(autosaveTimer); autosaveTimer = setTimeout(async () => { if (!await persistDraft()) return; if (cloudReady()) await saveCloud(); else status('修改已自动保存到本机；配置云端后即可多人同步。'); }, 600); };
  const bindFields = () => document.querySelectorAll('[data-path]').forEach(element => element.addEventListener('input', event => { setPath(content, event.target.dataset.path, event.target.value); scheduleDraft(); }));
  const bindImages = () => document.querySelectorAll('[data-image]').forEach(element => element.addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { pending[event.target.dataset.image] = { file, dataUrl: reader.result }; content.images[event.target.dataset.image] = reader.result; const image = $('#img-' + event.target.dataset.image); if (image) image.src = reader.result; const urlInput = document.querySelector(`[data-image-url="${event.target.dataset.image}"]`); if (urlInput) urlInput.value = reader.result; pushPreview(); scheduleDraft(); }; reader.readAsDataURL(file); }));
  const bindImageUrls = () => document.querySelectorAll('[data-image-url]').forEach(element => element.addEventListener('input', event => { const key = event.target.dataset.imageUrl; content.images[key] = event.target.value.trim(); delete pending[key]; const image = $('#img-' + key); if (image) image.src = content.images[key]; pushPreview(); scheduleDraft(); }));
  const ensureVideoUpload = () => { if (document.querySelector('[data-video-upload]')) return; const urlField = document.querySelector('[data-path="video.url"]')?.closest('.field'); if (!urlField) return; const wrapper = document.createElement('div'); wrapper.className = 'field full'; wrapper.innerHTML = '<label>上传宣传片文件</label><input type="file" accept="video/mp4,video/webm,video/ogg" data-video-upload><small>选择视频后会自动上传到云端；未配置云端时请填写可访问的视频地址。</small>'; urlField.parentElement?.appendChild(wrapper); wrapper.querySelector('[data-video-upload]').addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; pendingVideo = { file }; scheduleDraft(); }); };
  const draft = async () => { if (!await persistDraft()) return; pushPreview(); status('本机草稿已保存，右侧预览已刷新。' + (cloudReady() ? '云端也会继续自动同步。' : '')); };
  const copyShareLink = async () => { const value = cloud()?.getShareUrl?.() || window.location.href; try { await navigator.clipboard.writeText(value); status('共享编辑链接已复制：\n' + value); } catch { window.prompt('请复制这个共享编辑链接', value); } };
  const load = async () => {
    try {
      if (cloud() && !cloud().hasShareKey()) { const generated = new URL(cloud().createShareLink()).searchParams.get('share'); cloud().setShareKey(generated, true); }
      status('正在读取云端内容…');
      const response = await fetch('content.json?ts=' + Date.now(), { cache: 'no-store' }); if (!response.ok) throw new Error('HTTP ' + response.status);
      const fallback = await response.json(); const cloudContent = cloudReady() ? await cloud().loadContent() : null; const saved = cloudContent ? null : await readDraft();
      baseContent = cloneValue(cloudContent || fallback); content = cloneValue(cloudContent || saved || fallback); renderForm(); refreshPreview();
      if (cloudReady()) { unsubscribeCloud = cloud().subscribe(incoming => { if (!incoming || cloudSaving) return; if (dirty) { status('检测到其他编辑者的新内容。当前还有未保存修改，请先保存后再接收云端更新。', true); return; } content = cloneValue(incoming); baseContent = cloneValue(incoming); renderForm(); refreshPreview(); status('已收到其他编辑者的最新修改。'); }); status(cloudContent ? '已读取云端最新内容，修改会自动同步。共享链接可复制给其他编辑者。' : '云端暂无内容，第一次保存时会创建并同步。'); }
      else status('云端服务尚未配置：当前使用本机 IndexedDB 草稿。配置后即可多人在线同步。');
    } catch (error) { status('读取推文内容失败：' + error.message, true); }
  };
  $('#previewBtn').onclick = draft;
  $('#cloudSaveBtn').onclick = async () => { await persistDraft(); if (cloudReady()) await saveCloud(); else status('本机草稿已保存；还没有配置云端服务。', true); };
  $('#copyShareBtn').onclick = copyShareLink;
  $('#resetBtn').onclick = async () => { await clearDraft(); location.reload(); };
  load();
})();
