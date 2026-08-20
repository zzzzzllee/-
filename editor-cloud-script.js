(() => {
  const KEY = 'wechatRecruitmentDraft2026';
  const DRAFT_DB = 'wechatRecruitmentDrafts2026';
  const DRAFT_STORE = 'drafts';
  let content = null;
  let baseContent = null;
  let fallbackContent = null;
  let autosaveTimer = null;
  let draftDbPromise = null;
  let pendingVideo = null;
  let cloudSaving = false;
  let cloudSaveQueued = false;
  let contentRevision = 0;
  let dirty = false;
  let unsubscribeCloud = () => {};
  const pending = {};
  const RECOVERY_KEY = 'wechatRecruitmentPendingCloudImages2026';
  const visual = { selected: null, doc: null, drag: null, pendingDrag: null, suppressClickUntil: 0 };
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const cloneValue = value => {
    if (value === undefined || value === null) return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  };
  const mergeContent = (base, override) => {
    if (override === undefined || override === null) return cloneValue(base);
    if (Array.isArray(override) || typeof override !== 'object') return cloneValue(override);
    const result = cloneValue(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) || {};
    Object.keys(override).forEach(key => { result[key] = mergeContent(result[key], override[key]); });
    return result;
  };
  const prioritizeGainCards = content => {
    if (!content?.gains || !Array.isArray(content.gains.cards)) return content;
    const priority = ["综测分", "饭票福利", "志愿时长"];
    const rank = title => { const index = priority.indexOf(String(title || "").trim()); return index < 0 ? priority.length : index; };
    content.gains.cards = content.gains.cards.map((card, index) => ({ card, index })).sort((a, b) => rank(a.card?.title) - rank(b.card?.title) || a.index - b.index).map(item => item.card);
    return content;
  };
  const mergePublishedContent = (base, override) => {
    const result = mergeContent(base, override || {});
    if (override && !override.introPhotoWall && base?.photoWall && result.photoWall) {
      result.photoWall.title = base.photoWall.title;
      result.photoWall.hint = base.photoWall.hint;
      result.photoWall.captions = [...(base.photoWall.captions || [])];
    }
    return prioritizeGainCards(result);
  };
  const isDataUrl = value => /^data:image\//i.test(String(value || ''));
  const isPlaceholderAsset = value => { const src = String(value || ''); return !src || /photo-placeholder|qr-(west|north)-(group|signup)-placeholder/i.test(src); };
  const readCloudImageRecovery = () => { try { return JSON.parse(localStorage.getItem(RECOVERY_KEY) || '{}'); } catch { return {}; } };
  const writeCloudImageRecovery = value => { try { localStorage.setItem(RECOVERY_KEY, JSON.stringify(value || {})); } catch {} };
  const rememberCloudImageRecovery = (key, url) => { const recovery = readCloudImageRecovery(); recovery[key] = url; writeCloudImageRecovery(recovery); };
  const clearCloudImageRecovery = contentValue => { const recovery = readCloudImageRecovery(); let changed = false; Object.keys(recovery).forEach(key => { if (contentValue?.images?.[key] && recovery[key] === contentValue.images[key]) { delete recovery[key]; changed = true; } }); if (changed) writeCloudImageRecovery(recovery); };
  const getPath = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const setPath = (object, path, value) => {
    const parts = path.split('.');
    let current = object;
    parts.slice(0, -1).forEach(key => { if (!current[key] || typeof current[key] !== 'object') current[key] = {}; current = current[key]; });
    current[parts[parts.length - 1]] = value;
  };
  const field = (label, path, value, full = false, area = false) => `<div class="field ${full ? 'full' : ''}"><label>${esc(label)}</label>${area ? `<textarea data-path="${esc(path)}">${esc(value)}</textarea>` : `<input data-path="${esc(path)}" value="${esc(value)}">`}</div>`;
  const text = (path, fallback = '') => getPath(content, path) ?? fallback;
  const normalizeRolesGalleryHint = value => { const raw = String(value || '').trim(); const defaultHint = '从调音台、灯光控台到舞台、后台与观众席，熟悉每一件设备、每一处场地，才能让演出稳稳发生。'; return !raw || raw === '从设备、排练到现场协作，每一张都是真实发生的准备' ? defaultHint : raw; };
  const arr = (path, fallback = []) => Array.isArray(getPath(content, path)) ? getPath(content, path) : fallback;
  const imageNames = {
    hero1: '首屏滑动照片 · 第 1 张', hero2: '首屏滑动照片 · 第 2 张', hero3: '首屏滑动照片 · 第 3 张', hero4: '首屏滑动照片 · 第 4 张', hero5: '首屏滑动照片 · 第 5 张', hero6: '首屏滑动照片 · 第 6 张', skillAudio:'技能岗位 · 音控', skillLight:'技能岗位 · 灯控', skillDJ:'技能岗位 · 打碟', skillSpotlight:'技能岗位 · 追光', skillStageControl:'技能岗位 · 场控', detail1: '旧版岗位图 · 备用 1', detail2: '旧版岗位图 · 备用 2',
    moment1: '青春照片墙 · 左上', moment2: '青春照片墙 · 右上', moment3: '青春照片墙 · 左下', moment4: '青春照片墙 · 右下',
    qrWestGroup: '西区 · 咨询群二维码', qrWestSignup: '西区 · 报名表二维码', qrNorthGroup: '北区 · 咨询群二维码', qrNorthSignup: '北区 · 报名表二维码',
    introPhotoWall1: '开场幕后相册 · 第 1 张', introPhotoWall2: '开场幕后相册 · 第 2 张', introPhotoWall3: '开场幕后相册 · 第 3 张', introPhotoWall4: '开场幕后相册 · 第 4 张', introPhotoWall5: '开场幕后相册 · 第 5 张', introPhotoWall6: '开场幕后相册 · 第 6 张',
    photoWall1: '结尾团队相册 · 第 1 张', photoWall2: '结尾团队相册 · 第 2 张', photoWall3: '结尾团队相册 · 第 3 张', photoWall4: '结尾团队相册 · 第 4 张', photoWall5: '结尾团队相册 · 第 5 张', photoWall6: '结尾团队相册 · 第 6 张',
    rolesGallery1: '设备与场地展示 · 第 1 张', rolesGallery2: '设备与场地展示 · 第 2 张', rolesGallery3: '设备与场地展示 · 第 3 张', rolesGallery4: '设备与场地展示 · 第 4 张', rolesGallery5: '设备与场地展示 · 第 5 张', rolesGallery6: '设备与场地展示 · 第 6 张', intro: '备用旧图 · 原开场单图', closing: '备用旧图 · 原结尾合照'
  };
  const imageGroups = [
    {title:'01 · 首屏手动横向滑动照片',note:'每张图片都可以填写对应说明。手机左右滑一次切换一张，页面不会自动播放。',items:[{key:'hero1',captionPath:'heroGallery.captions.0'},{key:'hero2',captionPath:'heroGallery.captions.1'},{key:'hero3',captionPath:'heroGallery.captions.2'},{key:'hero4',captionPath:'heroGallery.captions.3'},{key:'hero5',captionPath:'heroGallery.captions.4'},{key:'hero6',captionPath:'heroGallery.captions.5'}]},
    {title:'02 · 开场幕后翻页相册',note:'仅用于开场幕后板块。第 1 张到第 6 张就是手机左右滑动顺序，图片和说明均与结尾相册独立。',items:[{key:'introPhotoWall1',captionPath:'introPhotoWall.captions.0'},{key:'introPhotoWall2',captionPath:'introPhotoWall.captions.1'},{key:'introPhotoWall3',captionPath:'introPhotoWall.captions.2'},{key:'introPhotoWall4',captionPath:'introPhotoWall.captions.3'},{key:'introPhotoWall5',captionPath:'introPhotoWall.captions.4'},{key:'introPhotoWall6',captionPath:'introPhotoWall.captions.5'}]},
    {title:'03 · 五个技能岗位图片',note:'按音控、灯控、打碟、追光、场控排列，每个岗位一张图。',items:[{key:'skillAudio'},{key:'skillLight'},{key:'skillDJ'},{key:'skillSpotlight'},{key:'skillStageControl'}]},
    {title:'04 · “一场演出，正在许多细节里发生”设备与场地展',note:'建议按设备 1、设备 2、设备 3、场地 1、场地 2、场地 3 排列；图片只展示画面，不添加文字备注。',items:[{key:'rolesGallery1'},{key:'rolesGallery2'},{key:'rolesGallery3'},{key:'rolesGallery4'},{key:'rolesGallery5'},{key:'rolesGallery6'}]},
    {title:'05 · “青春不设限”四张照片',note:'按左上、右上、左下、右下排列，文字贴纸不会遮图。',items:[{key:'moment1'},{key:'moment2'},{key:'moment3'},{key:'moment4'}]},
    {title:'06 · 结尾团队翻页相册',note:'仅用于“下一张团队合照，也许就有你”板块。第 1 张到第 6 张按手机左右滑动顺序排列。',items:[{key:'photoWall1',captionPath:'photoWall.captions.0'},{key:'photoWall2',captionPath:'photoWall.captions.1'},{key:'photoWall3',captionPath:'photoWall.captions.2'},{key:'photoWall4',captionPath:'photoWall.captions.3'},{key:'photoWall5',captionPath:'photoWall.captions.4'},{key:'photoWall6',captionPath:'photoWall.captions.5'}]},
    {title:'07 · 报名二维码',note:'按西区咨询群、西区报名表、北区咨询群、北区报名表排列。',items:[{key:'qrWestGroup'},{key:'qrWestSignup'},{key:'qrNorthGroup'},{key:'qrNorthSignup'}]},
    {title:'备用旧图',note:'旧版字段，当前页面不直接显示，保留用于兼容以前保存的内容。',items:[{key:'intro'},{key:'closing'}]}
  ];
  const renderImageItem = (item,index) => { const key=item.key,src=content.images?.[key]||'',caption=item.captionPath?text(item.captionPath):''; return '<div class="image-row"><div class="image-order">'+String(index+1).padStart(2,'0')+'</div><img id="img-'+esc(key)+'" src="'+esc(src)+'" alt="'+esc(imageNames[key]||key)+'"><div class="image-fields"><label>'+esc(imageNames[key]||key)+'</label>'+(item.captionPath?'<div class="image-caption"><span>图片说明</span><input data-path="'+esc(item.captionPath)+'" value="'+esc(caption)+'" placeholder="输入这张照片下方的说明"></div>':'')+'<input type="url" class="image-url-input" data-image-url="'+esc(key)+'" value="'+esc(src)+'" placeholder="图片地址（可填写在线图片 URL）"><small>可粘贴图片地址，或选择本机图片上传。</small><input type="file" accept="image/*" data-image="'+esc(key)+'"><div class="token-note image-current">当前地址：'+esc(src)+'</div></div></div>'; };
  const status = (message, error = false) => { const el = $('#status'); if (el) { el.textContent = message; el.className = 'status' + (error ? ' error' : ''); } };
  const cloud = () => window.WechatCloudSync || null;
  const cloudReady = () => Boolean(cloud()?.isConfigured?.() && cloud()?.hasShareKey?.());
  const cloudErrorMessage = error => {
    const code = String(error?.code || '');
    const message = String(error?.message || error || '');
    const lower = message.toLowerCase();
    if (code === '57014' || lower.includes('statement timeout') || lower.includes('timeout')) return '云端响应超时，已保留本机草稿；请稍等几秒后再点“立即保存到云端”。';
    if (lower.includes('row-level security') || lower.includes('shared editing key') || lower.includes('共享编辑密钥')) return '共享编辑密钥与云端内容不匹配，请使用原始共享编辑链接（地址中带 ?share=）。';
    return message;
  };
  const isRetryableSaveError = error => {
    const code = String(error?.code || '');
    const message = String(error?.message || error || '').toLowerCase();
    return code === '57014' || code === '08P01' || /statement timeout|timeout|temporar|network|fetch failed|failed to fetch|connection/i.test(message);
  };
  const mergePendingDraftImages = (cloudContent, localDraft) => {
    if (!cloudContent || !localDraft) return cloudContent || localDraft || {};
    const recovery = readCloudImageRecovery();
    const pendingImages = Object.entries(localDraft.images || {}).filter(([,src]) => isDataUrl(src));
    const recoverableImages = Object.entries(recovery).filter(([key,src]) => isPlaceholderAsset(cloudContent.images?.[key]) && localDraft.images?.[key] === src);
    if (!pendingImages.length && !recoverableImages.length) return cloudContent;
    const merged = cloneValue(cloudContent);
    merged.images = Object.assign({}, merged.images || {});
    pendingImages.forEach(([key,src]) => { merged.images[key] = src; });
    recoverableImages.forEach(([key,src]) => { merged.images[key] = src; });
    syncPhotoWallValue(merged);
    return merged;
  };
  const syncPhotoWallValue = value => {
    if (!value) return;
    ['introPhotoWall', 'photoWall'].forEach(wallKey => {
      const wall = value[wallKey];
      if (!wall) return;
      const keys = Array.isArray(wall.imageKeys) ? wall.imageKeys : [];
      const previous = Array.isArray(wall.images) ? wall.images : [];
      const hasKeyedImages = keys.some(key => Boolean(value.images?.[key]));
      wall.images = keys.map((key, index) => value.images?.[key] || (!hasKeyedImages ? previous[index] : 'assets/photo-placeholder.svg'));
    });
  };
  const syncPhotoWall = () => syncPhotoWallValue(content);
  const renderForm = () => {
    const roles = arr('roles.cards');
    const gains = arr('gains.cards');
    const suitable = arr('suitable.items');
    const qrLabels = arr('apply.qrLabels'); const qrScanLabels = arr('apply.qrScanLabels', qrLabels.map(label => String(label).replace(/[\s\u00b7\u2022]/g, '')));
    let html = '';
    html += `<div class="section"><h2>基础与首屏</h2><div class="grid">${field('网页标题', 'siteTitle', text('siteTitle'), true)}${field('顶部单位名称', 'hero.kicker', text('hero.kicker'))}${field('主标题', 'hero.titleMain', text('hero.titleMain'))}${field('强调标题', 'hero.titleAccent', text('hero.titleAccent'))}${field('副标题', 'hero.sub', text('hero.sub'))}${field('首屏滑动提示', 'heroGallery.hint', text('heroGallery.hint'), true)}</div></div>`;
    html += `<div class="section"><h2>零基础重点提示</h2><div class="grid">${field('醒目标题','barrier.title',text('barrier.title'))}${field('重点大字','barrier.body',text('barrier.body'),true,true)}${field('补充说明','barrier.note',text('barrier.note'),true,true)}</div></div>`;
    html += `<div class="section"><h2>开场：台前很闪，幕后也超酷</h2><div class="grid">${field('标题前半句', 'intro.titleBefore', text('intro.titleBefore'))}${field('标题高亮句', 'intro.titleMark', text('intro.titleMark'))}${field('开场引导文字', 'intro.lead', text('intro.lead'), true, true)}${field('开场照片说明', 'intro.caption', text('intro.caption'), true, true)}${field('开场相册标题', 'introPhotoWall.title', text('introPhotoWall.title'), true)}${field('开场相册滑动提示', 'introPhotoWall.hint', text('introPhotoWall.hint'), true)}</div></div>`;
    html += `<div class="section"><h2>五个技能岗位</h2><div class="grid">${field('板块标题前半句', 'roles.titleBefore', text('roles.titleBefore'), true)}${field('板块高亮句', 'roles.titleMark', text('roles.titleMark'), true)}${field('岗位总说明', 'roles.intro', text('roles.intro'), true, true)}${field('更多岗位提示', 'roles.more', text('roles.more'), true)}</div>`;
    roles.forEach((item, index) => { html += `<div class="card"><div class="card-title">岗位内容 ${index + 1}</div><div class="grid">${field('小标题', `roles.cards.${index}.title`, item.title)}${field('标签', `roles.cards.${index}.tag`, item.tag)}${field('正文', `roles.cards.${index}.body`, item.body, true, true)}</div></div>`; });
    html += '</div>';
    html += `<div class="card"><div class="card-title">幕后图片展</div><div class="grid">${field('图片展标题', 'roles.gallery.title', text('roles.gallery.title'), true)}${field('设备与场地展底部备注', 'roles.gallery.hint', normalizeRolesGalleryHint(text('roles.gallery.hint')), true)}</div><p class="token-note">图片只展示设备和场地，不添加图片文字备注；设备与场地的统一说明写在板块最下方。</p></div></div>`;
    html += `<div class="section"><h2>你会收获</h2><div class="grid">${field('板块标题前半句', 'gains.titleBefore', text('gains.titleBefore'))}${field('板块高亮句', 'gains.titleMark', text('gains.titleMark'))}</div>`;
    gains.forEach((item, index) => { html += `<div class="card"><div class="card-title">收获 ${index + 1}</div><div class="grid">${field('名称', `gains.cards.${index}.title`, item.title)}${field('说明', `gains.cards.${index}.body`, item.body, true, true)}</div></div>`; });
    html += '</div>';
    html += `<div class="section"><h2>宣传片视频</h2><div class="grid">${field('视频板块标题前半句', 'video.titleBefore', text('video.titleBefore', '宣传片，'))}${field('视频板块高亮句', 'video.titleMark', text('video.titleMark', '先看见我们'))}${field('视频介绍', 'video.intro', text('video.intro'), true, true)}${field('视频地址（MP4/WebM）', 'video.url', text('video.url'))}${field('视频封面地址', 'video.poster', text('video.poster', 'assets/style-sky.jpg'))}${field('视频下方说明', 'video.note', text('video.note'), true)}</div></div>`;
    html += `<div class="section"><h2>活动时刻</h2><div class="grid">${field('板块标题前半句', 'moments.titleBefore', text('moments.titleBefore'))}${field('板块高亮句', 'moments.titleMark', text('moments.titleMark'))}${field('第一段正文', 'moments.paragraphs.0', text('moments.paragraphs.0'), true, true)}${field('第二段正文', 'moments.paragraphs.1', text('moments.paragraphs.1'), true, true)}</div></div>`;
    html += `<div class="section"><h2>适合怎样的你</h2><div class="grid">${field('板块标题前半句', 'suitable.titleBefore', text('suitable.titleBefore'))}${field('板块高亮句', 'suitable.titleMark', text('suitable.titleMark'))}`;
    suitable.forEach((item, index) => { html += field(`招新期待 ${index + 1}`, `suitable.items.${index}`, item, true); });
    html += `${field('结尾鼓励语', 'suitable.encourage', text('suitable.encourage'), true, true)}</div></div>`;
    html += `<div class="section"><h2>报名信息</h2><div class="grid">${field('板块标题前半句', 'apply.titleBefore', text('apply.titleBefore'))}${field('板块高亮句', 'apply.titleMark', text('apply.titleMark'))}${field('招新对象', 'apply.object', text('apply.object'), true)}${field('报名时间', 'apply.signupTime', text('apply.signupTime'))}${field('报名截止', 'apply.deadline', text('apply.deadline'))}${field('报名方式说明', 'apply.method', text('apply.method'), true, true)}`;
    qrLabels.forEach((item, index) => { html += field(`二维码标签 ${index + 1}`, `apply.qrLabels.${index}`, item); html += field(`右上角 SCAN 备注 ${index + 1}`, `apply.qrScanLabels.${index}`, qrScanLabels[index] || item); });
    html += '</div></div>';
    html += `<div class="section"><h2>结尾</h2><div class="grid">${field('合照说明', 'closing.photoCaption', text('closing.photoCaption'), true)}${field('结尾正文', 'closing.body', text('closing.body'), true, true)}${field('强调短句', 'closing.emphasis', text('closing.emphasis'))}${field('结尾标题', 'closing.title', text('closing.title'))}${field('落款第一行', 'closing.subLine1', text('closing.subLine1'))}${field('落款第二行', 'closing.subLine2', text('closing.subLine2'))}</div></div>`;
    html += `<div class="section"><h2>结尾翻页相册文字</h2><div class="grid">${field('结尾相册标题', 'photoWall.title', text('photoWall.title'), true)}${field('结尾相册滑动提示', 'photoWall.hint', text('photoWall.hint'), true)}</div><p class="token-note">结尾相册的每张照片说明在下方对应图片旁修改。</p></div>`;
    html += '<div class="section"><h2>图片与二维码 · 按推文出现顺序</h2><p class="token-note image-guide">已按页面板块分组。编号就是手机端展示或滑动顺序。</p>';
    const groupedKeys=new Set(); imageGroups.forEach(group=>{const available=group.items.filter(item=>Object.prototype.hasOwnProperty.call(content.images||{},item.key));if(!available.length)return;available.forEach(item=>groupedKeys.add(item.key));html+='<div class="image-group"><div class="image-group-head"><h3>'+esc(group.title)+'</h3><p>'+esc(group.note)+'</p></div>'+available.map((item,index)=>renderImageItem(item,index)).join('')+'</div>';});
    const extras=Object.keys(content.images||{}).filter(key=>!groupedKeys.has(key));if(extras.length)html+='<div class="image-group"><div class="image-group-head"><h3>其他图片</h3><p>云端额外图片字段。</p></div>'+extras.map((key,index)=>renderImageItem({key},index)).join('')+'</div>'; html += '</div>';
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
  const persistDraft = async () => { syncPhotoWall(); try { await writeIndexedDraft(content); return true; } catch { try { localStorage.setItem(KEY, JSON.stringify(buildSlimDraft())); return true; } catch { status('文字修改已保留在当前页面，但本机草稿保存失败。请配置云端或清理浏览器站点数据。', true); return false; } } };
  const labelVisualSelection = message => { const el=$('#visualSelection'); if(el) el.textContent=message||'可视化编辑：点文字直接改；拖住文字、图片、外框或空白处整体移动'; };
  const selectedLayout = () => visual.selected?.dataset?.layoutId || '';
  const updateRichFromElement = element => { const id=element?.dataset?.richId; if(!id)return; content.richText=content.richText||{}; content.richText[id]=element.innerHTML; scheduleDraft(); };
  const updateLayoutStyle = (element,value) => { element.style.setProperty('--layout-x',(Number(value.x)||0)+'px'); element.style.setProperty('--layout-y',(Number(value.y)||0)+'px'); if(Number(value.z)){element.style.zIndex=String(value.z);if(getComputedStyle(element).position==='static')element.style.position='relative';}else element.style.removeProperty('z-index'); };
  const selectVisual = element => { visual.doc?.querySelectorAll('.editor-selected').forEach(el=>el.classList.remove('editor-selected')); visual.selected=element||null; if(element){element.classList.add('editor-selected');const kind=element.dataset.richId?'文字':'素材';labelVisualSelection('已选中'+kind+'：'+(element.innerText||element.alt||element.dataset.layoutId||'当前元素').trim().slice(0,24));}else labelVisualSelection(); };
  const setupVisualEditor = () => {
    const frame=$('#preview'); const doc=frame?.contentDocument;
    if(!doc?.querySelector('.page'))return;
    visual.doc=doc;
    const win=frame.contentWindow;
    if(win&&!win.__wechatVisualEditorListenerBound){win.__wechatVisualEditorListenerBound=true;win.addEventListener('wechat-content-rendered',()=>armVisualEditor());}
    if(!doc.getElementById('editorVisualStyle')){
      const style=doc.createElement('style'); style.id='editorVisualStyle';
       style.textContent='html,body{overscroll-behavior-y:contain}html .reveal{transition:none!important}[data-rich-id]{outline:1px dashed transparent;cursor:text}[data-rich-id]:hover{outline-color:#f39b8e}.editor-selected{outline:3px solid #ff5b4d!important;outline-offset:3px!important}[data-layout-id]{touch-action:pan-y;pointer-events:auto!important;cursor:move}[data-rich-id][data-layout-id]{cursor:grab}[data-rich-id][data-layout-id]:active{cursor:grabbing}[data-layout-id]:hover{filter:drop-shadow(0 0 3px #ff5b4d)}';
      doc.head.appendChild(style);
    }
doc.querySelectorAll('[data-rich-id]').forEach(el=>{
       el.contentEditable='true'; el.spellcheck=false;
       if(el.dataset.richBound)return;
       el.dataset.richBound='1';
       el.addEventListener('focus',()=>selectVisual(el));
       el.addEventListener('input',()=>updateRichFromElement(el));
       el.addEventListener('pointerdown',event=>{
         if(event.button!==undefined&&event.button!==0)return;
         const id=el.dataset.layoutId; if(!id)return;
         event.stopPropagation();
         content.layout=content.layout||{}; const current=content.layout[id]||{};
         visual.pendingDrag={el,id,startX:event.clientX,startY:event.clientY,x:Number(current.x)||0,y:Number(current.y)||0,z:Number(current.z)||0,pointerId:event.pointerId,pointerType:event.pointerType||'mouse'};
       });
     });
    doc.querySelectorAll('[data-layout-id]').forEach(el=>{
      if(el.dataset.layoutBound)return;
      el.dataset.layoutBound='1';
      el.addEventListener('click',event=>{if(Date.now()<visual.suppressClickUntil){event.preventDefault();event.stopPropagation();return;}if(event.target.closest('[data-rich-id]'))return;event.stopPropagation();selectVisual(el)});
      el.addEventListener('pointerdown',event=>{
        if(event.button!==undefined&&event.button!==0)return;
        if(event.target.closest('[data-rich-id],button,a,input,textarea,select,label,video'))return;
        event.stopPropagation();
        const id=el.dataset.layoutId; content.layout=content.layout||{}; const current=content.layout[id]||{};
        visual.pendingDrag={el,id,startX:event.clientX,startY:event.clientY,x:Number(current.x)||0,y:Number(current.y)||0,z:Number(current.z)||0,pointerId:event.pointerId,pointerType:event.pointerType||'mouse'};
      });
    });
    if(!doc.documentElement.dataset.visualEditorBound){
      doc.documentElement.dataset.visualEditorBound='1';
doc.addEventListener('pointermove',event=>{
         if(!visual.drag&&visual.pendingDrag){
           const pending=visual.pendingDrag;
           if(event.pointerId!==undefined&&pending.pointerId!==undefined&&event.pointerId!==pending.pointerId)return;
           const dx=event.clientX-pending.startX; const dy=event.clientY-pending.startY;
           const isTouch=pending.pointerType==='touch'||event.pointerType==='touch';
           const threshold=isTouch?12:6;
           if(Math.hypot(dx,dy)<threshold)return;
           if(isTouch&&Math.abs(dy)>Math.abs(dx)*1.15){visual.pendingDrag=null;return;}
           visual.pendingDrag=null;
           if(event.cancelable)event.preventDefault();
           try { visual.doc.getSelection?.().removeAllRanges(); } catch {}
           selectVisual(pending.el);
           visual.drag={el:pending.el,id:pending.id,startX:pending.startX,startY:pending.startY,x:pending.x,y:pending.y,z:pending.z,pointerId:pending.pointerId};
           try { pending.el.setPointerCapture?.(pending.pointerId); } catch {}
         }
         const d=visual.drag; if(!d)return;
         if(event.pointerId!==undefined&&d.pointerId!==undefined&&event.pointerId!==d.pointerId)return;
         if(event.cancelable)event.preventDefault();
         const value={x:Math.round(d.x+event.clientX-d.startX),y:Math.round(d.y+event.clientY-d.startY),z:d.z};content.layout[d.id]=value;updateLayoutStyle(d.el,value);
       });
       const finishDrag=event=>{visual.pendingDrag=null;if(!visual.drag)return;const d=visual.drag;visual.drag=null;visual.suppressClickUntil=Date.now()+450;try { d.el.releasePointerCapture?.(event?.pointerId); } catch {}scheduleDraft();};
       doc.addEventListener('pointerup',finishDrag);
       doc.addEventListener('pointercancel',finishDrag);
       doc.addEventListener('click',event=>{if(Date.now()<visual.suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return;}if(!event.target.closest('[data-rich-id],[data-layout-id]'))selectVisual(null)},true);
    }
    labelVisualSelection('手机上下滑动浏览；需要移动元素时，从左右方向起手拖动。轻点文字可直接修改');
  };
  const armVisualEditor = () => [0,120,360,900].forEach(delay=>setTimeout(setupVisualEditor,delay));
  const changeLayer = mode => { const id=selectedLayout(); if(!id){status('请先在右侧预览中点选一张图片或装饰素材。',true);return;} content.layout=content.layout||{};const value={x:0,y:0,z:0,...content.layout[id]};if(mode==='top')value.z=999;else if(mode==='up')value.z=Math.min(999,(Number(value.z)||0)+1);else if(mode==='down')value.z=Math.max(-99,(Number(value.z)||0)-1);else if(mode==='bottom')value.z=-99;else if(mode==='reset')Object.assign(value,{x:0,y:0,z:0});content.layout[id]=value;updateLayoutStyle(visual.selected,value);scheduleDraft(); };
  const bindVisualTools = () => { $('#boldBtn').onclick=()=>{const doc=visual.doc;if(!doc)return;doc.execCommand('bold',false,null);const active=doc.activeElement?.closest?.('[data-rich-id]')||visual.selected;if(active?.dataset?.richId)updateRichFromElement(active);};$('#topBtn').onclick=()=>changeLayer('top');$('#upBtn').onclick=()=>changeLayer('up');$('#downBtn').onclick=()=>changeLayer('down');$('#bottomBtn').onclick=()=>changeLayer('bottom');$('#resetLayoutBtn').onclick=()=>changeLayer('reset'); };

  const pushPreview = () => { const frame = $('#preview'); if (frame?.contentWindow) { frame.contentWindow.postMessage({ type: 'wechat-recruitment-preview', content }, '*'); armVisualEditor(); } };
  const refreshPreview = () => { const frame = $('#preview'); if (frame) { frame.onload = () => pushPreview(); frame.src = 'index.html?editorPreview=1&preview=' + Date.now(); } };
  const uploadPendingAssets = async () => {
    if (!cloudReady()) return;
    for (const [key, src] of Object.entries(content.images || {})) {
      if (!isDataUrl(src) || pending[key]?.file) continue;
      const blob = await fetch(src).then(response => response.blob());
      const extension = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      pending[key] = { file: new File([blob], key + '.' + extension, { type: blob.type || 'image/png' }) };
    }
    const uploads = Object.entries(pending).filter(([, item]) => item?.file);
    for (const [key, item] of uploads) {
      status('???????' + key);
      const url = await cloud().uploadAsset(item.file, 'image-' + key);
      if (pending[key] === item) {
        content.images[key] = url;
        rememberCloudImageRecovery(key, url);
        delete pending[key];
      }
    }
    if (pendingVideo?.file) {
      const videoUpload = pendingVideo;
      status('????????');
      content.video = content.video || {};
      const url = await cloud().uploadAsset(videoUpload.file, 'promo-video');
      if (pendingVideo === videoUpload) {
        content.video.url = url;
        pendingVideo = null;
      }
    }
  };
  const saveCloud = async () => {
    if (!cloudReady()) return false;
    if (cloudSaving) { cloudSaveQueued = true; return false; }
    cloudSaving = true;
    cloudSaveQueued = false;
    const startedRevision = contentRevision;
    let saved = false;
    try {
      await uploadPendingAssets();
      syncPhotoWall();
      const payload = cloneValue(content);
      const savedContent = (await cloud().saveContent(payload, cloud().getLastUpdatedAt?.())) || payload;
      baseContent = cloneValue(savedContent);
      clearCloudImageRecovery(savedContent);
      if (contentRevision === startedRevision) {
        content = savedContent;
        dirty = false;
        saved = true;
        await persistDraft();
        status('?????????????????????????????????????');
      } else {
        dirty = true;
        await persistDraft();
        status('??????????????????????????????');
        cloudSaveQueued = true;
      }
    } catch (error) {
      if (isRetryableSaveError(error)) {
        // ????????????????? data URL/?? URL??????????????????????
        cloudSaveQueued = true;
        status('??????????????????????', true);
      } else {
        status('????????????????' + cloudErrorMessage(error), true);
      }
    } finally {
      cloudSaving = false;
      if (cloudSaveQueued) {
        cloudSaveQueued = false;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async () => {
          if (!await persistDraft()) return;
          await saveCloud();
        }, 260);
      }
    }
    return saved;
  };
  const scheduleDraft = () => { contentRevision += 1; dirty = true; clearTimeout(autosaveTimer); autosaveTimer = setTimeout(async () => { if (!await persistDraft()) return; if (cloudReady()) { if (cloudSaving) cloudSaveQueued = true; else await saveCloud(); } else status('\u4fee\u6539\u5df2\u81ea\u52a8\u4fdd\u5b58\u5230\u672c\u673a\uff1b\u914d\u7f6e\u4e91\u7aef\u540e\u5373\u53ef\u591a\u4eba\u540c\u6b65\u3002'); }, 600); };
  const bindFields = () => document.querySelectorAll('[data-path]').forEach(element => element.addEventListener('input', event => { setPath(content, event.target.dataset.path, event.target.value); scheduleDraft(); }));
  const bindImages = () => document.querySelectorAll('[data-image]').forEach(element => element.addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { pending[event.target.dataset.image] = { file, dataUrl: reader.result }; content.images[event.target.dataset.image] = reader.result; const image = $('#img-' + event.target.dataset.image); if (image) image.src = reader.result; const urlInput = document.querySelector(`[data-image-url="${event.target.dataset.image}"]`); if (urlInput) urlInput.value = reader.result; pushPreview(); scheduleDraft(); }; reader.readAsDataURL(file); }));
  const bindImageUrls = () => document.querySelectorAll('[data-image-url]').forEach(element => element.addEventListener('input', event => { const key = event.target.dataset.imageUrl; content.images[key] = event.target.value.trim(); delete pending[key]; const image = $('#img-' + key); if (image) image.src = content.images[key]; pushPreview(); scheduleDraft(); }));
  const ensureVideoUpload = () => { if (document.querySelector('[data-video-upload]')) return; const urlField = document.querySelector('[data-path="video.url"]')?.closest('.field'); if (!urlField) return; const wrapper = document.createElement('div'); wrapper.className = 'field full'; wrapper.innerHTML = '<label>上传宣传片文件</label><input type="file" accept="video/mp4,video/webm,video/ogg" data-video-upload><small>选择视频后会自动上传到云端；未配置云端时请填写可访问的视频地址。</small>'; urlField.parentElement?.appendChild(wrapper); wrapper.querySelector('[data-video-upload]').addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; pendingVideo = { file }; scheduleDraft(); }); };
  const draft = async () => { if (!await persistDraft()) return; pushPreview(); status('本机草稿已保存，右侧预览已刷新。' + (cloudReady() ? '云端也会继续自动同步。' : '')); };
  const copyShareLink = async () => { const value = cloud()?.getShareUrl?.() || window.location.href; try { await navigator.clipboard.writeText(value); status('共享编辑链接已复制：\n' + value); } catch { window.prompt('请复制这个共享编辑链接', value); } };
  const load = async () => {
    try {
      const missingShareKey = Boolean(cloud()?.isConfigured?.() && !cloud()?.hasShareKey?.());
      status(missingShareKey ? '当前链接缺少共享编辑密钥，云端内容可读取，但保存请使用带 ?share= 的共享编辑链接。' : '正在读取云端内容…');
      const response = await fetch('content.json?ts=' + Date.now(), { cache: 'no-store' }); if (!response.ok) throw new Error('HTTP ' + response.status);
      fallbackContent = await response.json(); const cloudContent = cloudReady() ? await cloud().loadContent() : null; const saved = await readDraft();
      const sourceContent = mergePendingDraftImages(cloudContent, saved);
      content = mergePublishedContent(fallbackContent, sourceContent || {}); baseContent = cloneValue(content); syncPhotoWall(); renderForm(); refreshPreview();
      if (cloudReady()) { unsubscribeCloud = cloud().subscribe(incoming => { if (!incoming || cloudSaving) return; if (dirty) { status('检测到其他编辑者的新内容。当前还有未保存修改，请先保存后再接收云端更新。', true); return; } content = mergePublishedContent(fallbackContent || {}, incoming); baseContent = cloneValue(content); syncPhotoWall(); renderForm(); refreshPreview(); status('已收到其他编辑者的最新修改。'); }); status(cloudContent ? '已读取云端最新内容，修改会自动同步。共享链接可复制给其他编辑者。' : '云端暂无内容，第一次保存时会创建并同步。'); }
      else status('云端服务尚未配置：当前使用本机 IndexedDB 草稿。配置后即可多人在线同步。');
    } catch (error) { status('读取推文内容失败：' + error.message, true); }
  };
  bindVisualTools();
  $('#previewBtn').onclick = draft;
  $('#cloudSaveBtn').onclick = async () => { await persistDraft(); if (cloudReady()) await saveCloud(); else if (cloud()?.isConfigured?.()) status('本机草稿已保存，但当前链接缺少共享编辑密钥；请使用原始共享编辑链接。', true); else status('本机草稿已保存；还没有配置云端服务。', true); };
  $('#copyShareBtn').onclick = copyShareLink;
  $('#resetBtn').onclick = async () => { await clearDraft(); location.reload(); };
  load();
})();
