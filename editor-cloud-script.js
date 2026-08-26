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
  let cloudSavePromise = null;
  let cloudSaveRequested = false;
  let contentRevision = 0;
  let dirty = false;
  let unsubscribeCloud = () => {};
  const pending = {};
  const RECOVERY_KEY = 'wechatRecruitmentPendingCloudImages2026';
  const PUBLISHED_SNAPSHOT_KEY = 'wechatRecruitmentCloudSnapshot2026-v2';
  const visual = { selected: null, selectedImage: null, doc: null, drag: null, pendingDrag: null, imageDrag: null, imageResize: null, cropOverlay: null, cropSession: null, cropDrag: null, suppressClickUntil: 0, mode: 'browse' };
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
  const mergeTemplateContent = (template, value) => {
    if (value === undefined || value === null) return cloneValue(template);
    if (Array.isArray(template)) {
      if (!Array.isArray(value) || value.length === 0) return cloneValue(template);
      const length = Math.max(template.length, value.length);
      return Array.from({ length }, (_, index) => mergeTemplateContent(template[index], value[index]));
    }
    if (template && typeof template === 'object' && !Array.isArray(template)) {
      const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      const result = {};
      new Set([...Object.keys(template), ...Object.keys(source)]).forEach(key => { result[key] = mergeTemplateContent(template[key], source[key]); });
      return result;
    }
    if (typeof template === 'string' && typeof value === 'string' && !value.trim()) return template;
    return cloneValue(value);
  };
  const prioritizeGainCards = content => {
    if (!content) return content;
    if (content.roles?.gallery) content.roles.gallery.title = '一场精彩演出有许多细节组成';
    if (content.gains && Array.isArray(content.gains.cards)) {
      const priority = ['真技能', '饭票福利', '综测分', '一群搭子', '校园大场面'];
      const rank = title => { const index = priority.indexOf(String(title || '').trim()); return index < 0 ? priority.length : index; };
      content.gains.cards = content.gains.cards
        .filter(card => String(card?.title || '').trim() !== '志愿时长')
        .map(card => ({ ...card, body: String(card?.body || '').replaceAll('一起', '艺起') }))
        .map((card, index) => ({ card, index }))
        .sort((a, b) => rank(a.card?.title) - rank(b.card?.title) || a.index - b.index)
        .map(item => item.card);
    }
    if (content.moments) {
      content.moments.titleMark = String(content.moments.titleMark || '').replaceAll('一起', '艺起').replace('我们也很会玩', '艺起很会玩');
      if (Array.isArray(content.moments.paragraphs)) content.moments.paragraphs = content.moments.paragraphs.map(text => String(text).replaceAll('一起', '艺起'));
    }
    if (content.suitable) content.suitable.encourage = '我们的宗旨是，态度要好，立场要坚定！';
    return content;
  };
  const mergePublishedContent = (base, override) => {
    const result = mergeTemplateContent(base, override || {});
    if (override && !override.introPhotoWall && base?.photoWall && result.photoWall) {
      result.photoWall.title = base.photoWall.title;
      result.photoWall.hint = base.photoWall.hint;
      result.photoWall.captions = [...(base.photoWall.captions || [])];
    }
    return prioritizeGainCards(result);
  };
  const isDataUrl = value => /^data:image\//i.test(String(value || ''));
  const fileToDataUrl = file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error || new Error('读取图片失败')); reader.readAsDataURL(file); });
  const optimizeUploadedImage = async (file, key) => {
    if (!file || /^qr/i.test(String(key || '')) || /image\/(gif|svg\+xml)/i.test(file.type || '')) return file;
    let source = null;
    let objectUrl = '';
    try {
      if ('createImageBitmap' in window) source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      else {
        objectUrl = URL.createObjectURL(file);
        source = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法解析图片')); image.src = objectUrl; });
      }
      const width = source.width || source.naturalWidth;
      const height = source.height || source.naturalHeight;
      if (!width || !height) return file;
      const maxSide = 1600;
      const ratio = Math.min(1, maxSide / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * ratio));
      const targetHeight = Math.max(1, Math.round(height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return file;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, targetWidth, targetHeight);
      context.drawImage(source, 0, 0, targetWidth, targetHeight);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .82));
      if (!blob || (ratio === 1 && blob.size >= file.size * .96)) return file;
      const stem = String(file.name || key || 'photo').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || String(key || 'photo');
      return new File([blob], stem + '.webp', { type: 'image/webp', lastModified: Date.now() });
    } catch (error) {
      console.warn('图片自动优化失败，保留原图上传：', error);
      return file;
    } finally {
      source?.close?.();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  };
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
    if (code === 'SHARE_KEY_MISMATCH') return '当前编辑链接已失效或不正确，请改用最新的共享编辑链接后再保存。';
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
    let html = '<div class="template-overview"><div class="template-overview-title">已预制完整小板块模板</div><div class="template-chip-list"><span>首屏</span><span>零基础提示</span><span>技能岗位 × 5</span><span>幕后图片展</span><span>收获福利</span><span>宣传片</span><span>活动时刻</span><span>报名信息</span><span>结尾相册</span></div><p>左侧每个板块都已经带好标题、正文、岗位介绍和展示位。直接改文字、替换图片即可；右侧预览会同步刷新。</p></div>';
    html += `<div class="section template-ready"><h2>基础与首屏</h2><div class="grid">${field('网页标题', 'siteTitle', text('siteTitle'), true)}${field('顶部单位名称', 'hero.kicker', text('hero.kicker'))}${field('主标题', 'hero.titleMain', text('hero.titleMain'))}${field('强调标题', 'hero.titleAccent', text('hero.titleAccent'))}${field('副标题', 'hero.sub', text('hero.sub'))}${field('首屏滑动提示', 'heroGallery.hint', text('heroGallery.hint'), true)}</div></div>`;
    html += `<div class="section template-ready"><h2>零基础重点提示</h2><div class="grid">${field('醒目标题','barrier.title',text('barrier.title'))}${field('重点大字','barrier.body',text('barrier.body'),true,true)}${field('补充说明','barrier.note',text('barrier.note'),true,true)}</div></div>`;
    html += `<div class="section template-ready"><h2>开场：台前很闪，幕后也超酷</h2><div class="grid">${field('标题前半句', 'intro.titleBefore', text('intro.titleBefore'))}${field('标题高亮句', 'intro.titleMark', text('intro.titleMark'))}${field('开场引导文字', 'intro.lead', text('intro.lead'), true, true)}${field('开场照片说明', 'intro.caption', text('intro.caption'), true, true)}${field('开场相册标题', 'introPhotoWall.title', text('introPhotoWall.title'), true)}${field('开场相册滑动提示', 'introPhotoWall.hint', text('introPhotoWall.hint'), true)}</div></div>`;
    html += `<div class="section template-ready"><h2>五个技能岗位</h2><div class="grid">${field('板块标题前半句', 'roles.titleBefore', text('roles.titleBefore'), true)}${field('板块高亮句', 'roles.titleMark', text('roles.titleMark'), true)}${field('岗位总说明', 'roles.intro', text('roles.intro'), true, true)}${field('更多岗位提示', 'roles.more', text('roles.more'), true)}</div>`;
    roles.forEach((item, index) => { html += `<div class="card"><div class="card-title">岗位内容 ${index + 1}</div><div class="grid">${field('小标题', `roles.cards.${index}.title`, item.title)}${field('标签', `roles.cards.${index}.tag`, item.tag)}${field('正文', `roles.cards.${index}.body`, item.body, true, true)}</div></div>`; });
    html += '</div>';
    html += `<div class="card"><div class="card-title">幕后图片展</div><div class="grid">${field('图片展标题', 'roles.gallery.title', text('roles.gallery.title'), true)}${field('设备与场地展底部备注', 'roles.gallery.hint', normalizeRolesGalleryHint(text('roles.gallery.hint')), true)}</div><p class="token-note">图片只展示设备和场地，不添加图片文字备注；设备与场地的统一说明写在板块最下方。</p></div></div>`;
    html += `<div class="section template-ready"><h2>你会收获</h2><div class="grid">${field('板块标题前半句', 'gains.titleBefore', text('gains.titleBefore'))}${field('板块高亮句', 'gains.titleMark', text('gains.titleMark'))}</div>`;
    gains.forEach((item, index) => { html += `<div class="card"><div class="card-title">收获 ${index + 1}</div><div class="grid">${field('名称', `gains.cards.${index}.title`, item.title)}${field('说明', `gains.cards.${index}.body`, item.body, true, true)}</div></div>`; });
    html += '</div>';
    html += `<div class="section template-ready"><h2>宣传片视频</h2><div class="grid">${field('视频板块标题前半句', 'video.titleBefore', text('video.titleBefore', '宣传片，'))}${field('视频板块高亮句', 'video.titleMark', text('video.titleMark', '先看见我们'))}${field('视频介绍', 'video.intro', text('video.intro'), true, true)}${field('视频地址（MP4/WebM）', 'video.url', text('video.url'))}${field('视频封面地址', 'video.poster', text('video.poster', 'assets/style-sky.jpg'))}${field('视频下方说明', 'video.note', text('video.note'), true)}</div></div>`;
    html += `<div class="section template-ready"><h2>活动时刻</h2><div class="grid">${field('板块标题前半句', 'moments.titleBefore', text('moments.titleBefore'))}${field('板块高亮句', 'moments.titleMark', text('moments.titleMark'))}${field('第一段正文', 'moments.paragraphs.0', text('moments.paragraphs.0'), true, true)}${field('第二段正文', 'moments.paragraphs.1', text('moments.paragraphs.1'), true, true)}</div></div>`;
    html += `<div class="section template-ready"><h2>适合怎样的你</h2><div class="grid">${field('板块标题前半句', 'suitable.titleBefore', text('suitable.titleBefore'))}${field('板块高亮句', 'suitable.titleMark', text('suitable.titleMark'))}`;
    suitable.forEach((item, index) => { html += field(`招新期待 ${index + 1}`, `suitable.items.${index}`, item, true); });
    html += `${field('结尾鼓励语', 'suitable.encourage', text('suitable.encourage'), true, true)}</div></div>`;
    html += `<div class="section template-ready"><h2>报名信息</h2><div class="grid">${field('板块标题前半句', 'apply.titleBefore', text('apply.titleBefore'))}${field('板块高亮句', 'apply.titleMark', text('apply.titleMark'))}${field('招新对象', 'apply.object', text('apply.object'), true)}${field('报名时间', 'apply.signupTime', text('apply.signupTime'))}${field('报名截止', 'apply.deadline', text('apply.deadline'))}${field('报名方式说明', 'apply.method', text('apply.method'), true, true)}`;
    qrLabels.forEach((item, index) => { html += field(`二维码标签 ${index + 1}`, `apply.qrLabels.${index}`, item); html += field(`右上角 SCAN 备注 ${index + 1}`, `apply.qrScanLabels.${index}`, qrScanLabels[index] || item); });
    html += '</div></div>';
    html += `<div class="section template-ready"><h2>结尾</h2><div class="grid">${field('合照说明', 'closing.photoCaption', text('closing.photoCaption'), true)}${field('结尾正文', 'closing.body', text('closing.body'), true, true)}${field('强调短句', 'closing.emphasis', text('closing.emphasis'))}${field('结尾标题', 'closing.title', text('closing.title'))}${field('落款第一行', 'closing.subLine1', text('closing.subLine1'))}${field('落款第二行', 'closing.subLine2', text('closing.subLine2'))}</div></div>`;
    html += `<div class="section template-ready"><h2>结尾翻页相册文字</h2><div class="grid">${field('结尾相册标题', 'photoWall.title', text('photoWall.title'), true)}${field('结尾相册滑动提示', 'photoWall.hint', text('photoWall.hint'), true)}</div><p class="token-note">结尾相册的每张照片说明在下方对应图片旁修改。</p></div>`;
    html += '<div class="section template-ready"><h2>图片与二维码 · 按推文出现顺序</h2><p class="token-note image-guide">已按页面板块分组。编号就是手机端展示或滑动顺序。</p>';
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
  const selectVisual = element => { visual.doc?.querySelectorAll('.editor-selected').forEach(el=>el.classList.remove('editor-selected')); visual.selected=element||null; if(element){element.classList.add('editor-selected');const kind=element.dataset.richId?'文字':'素材';labelVisualSelection('已选中'+kind+'：'+(element.innerText||element.alt||element.dataset.layoutId||'当前元素').trim().slice(0,24));}else if(visual.mode==='move')labelVisualSelection('移动元素模式：按住文字、QQ 人、图片外框或其他素材拖动'); };
  const clampImageScale = value => Math.max(.3, Math.min(6, Number(value) || 1));
  const normalizeCrop = crop => { if(!crop)return null;let left=Math.max(0,Math.min(.92,Number(crop.left)||0)),top=Math.max(0,Math.min(.92,Number(crop.top)||0)),width=Math.max(.08,Math.min(1-left,Number(crop.width)||1)),height=Math.max(.08,Math.min(1-top,Number(crop.height)||1));return {left:Number(left.toFixed(4)),top:Number(top.toFixed(4)),width:Number(width.toFixed(4)),height:Number(height.toFixed(4))}; };
  const imageAdjustmentValue = key => { const saved=content?.imageAdjustments?.[key]||{};const legacy=clampImageScale(saved.scale);return {x:Number(saved.x)||0,y:Number(saved.y)||0,scale:legacy,scaleX:clampImageScale(saved.scaleX??legacy),scaleY:clampImageScale(saved.scaleY??legacy),crop:normalizeCrop(saved.crop)}; };
  const normalizedImageAdjustment = value => { const legacy=clampImageScale(value?.scale);const result={x:Math.round(Number(value?.x)||0),y:Math.round(Number(value?.y)||0),scaleX:Number(clampImageScale(value?.scaleX??legacy).toFixed(3)),scaleY:Number(clampImageScale(value?.scaleY??legacy).toFixed(3))};const crop=normalizeCrop(value?.crop);if(crop)result.crop=crop;return result; };
  const applyCropStyle = (img,crop) => { if(!img)return;const value=normalizeCrop(crop);['width','height','max-width','max-height','left','top','position','object-fit','object-position'].forEach(name=>img.style.removeProperty(name));if(!value){img.removeAttribute('data-image-cropped');img.style.setProperty('--image-crop-x','0%');img.style.setProperty('--image-crop-y','0%');img.style.setProperty('--image-crop-scale-x','1');img.style.setProperty('--image-crop-scale-y','1');return;}img.dataset.imageCropped='1';img.style.setProperty('--image-crop-x',(-value.left*100/value.width)+'%');img.style.setProperty('--image-crop-y',(-value.top*100/value.height)+'%');img.style.setProperty('--image-crop-scale-x',String(1/value.width));img.style.setProperty('--image-crop-scale-y',String(1/value.height));img.style.setProperty('object-fit','fill','important');img.style.setProperty('object-position','center','important'); };
  const updateImageAdjustmentStyle = (img,value) => { if(!img)return;const normalized=normalizedImageAdjustment(value);applyCropStyle(img,normalized.crop);img.style.setProperty('--image-x',normalized.x+'px');img.style.setProperty('--image-y',normalized.y+'px');img.style.setProperty('--image-scale-x',String(normalized.scaleX));img.style.setProperty('--image-scale-y',String(normalized.scaleY));img.style.setProperty('--image-scale',String((normalized.scaleX+normalized.scaleY)/2)); };
  const imageFrameElement = img => img?.closest?.('.hero-gallery-card,.photo-card,.intro-photo,.detail-photo .frame,.roles-gallery-card,.memory,.skill-card')||img?.parentElement||null;
  const removeCropOverlay = () => { try{visual.cropOverlay?.remove()}catch{}visual.cropOverlay=null;visual.imageResize=null; };
  const updateCropOverlay = () => { const overlay=visual.cropOverlay,img=visual.selectedImage;if(!overlay||!img?.isConnected||visual.mode!=='image'){if(overlay)removeCropOverlay();return;}const frame=imageFrameElement(img);if(!frame?.isConnected){removeCropOverlay();return;}const rect=frame.getBoundingClientRect();if(rect.width<2||rect.height<2||rect.bottom<0||rect.top>(visual.doc?.documentElement?.clientHeight||0)){overlay.classList.remove('is-visible');return;}overlay.style.left=rect.left+'px';overlay.style.top=rect.top+'px';overlay.style.width=rect.width+'px';overlay.style.height=rect.height+'px';overlay.classList.add('is-visible'); };
  const createOrUpdateCropOverlay = img => { if(!img||visual.mode!=='image'){removeCropOverlay();return;}const doc=img.ownerDocument;if(visual.cropOverlay?.ownerDocument!==doc)removeCropOverlay();let overlay=visual.cropOverlay;if(!overlay){overlay=doc.createElement('div');overlay.className='editor-image-crop-overlay';overlay.setAttribute('aria-label','图片裁剪与拉伸边框');overlay.innerHTML=['nw','n','ne','e','se','s','sw','w'].map(handle=>'<button type="button" class="editor-image-crop-handle" data-handle="'+handle+'" aria-label="拖动 '+handle+' 控制点"></button>').join('');doc.body.appendChild(overlay);visual.cropOverlay=overlay;overlay.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();});overlay.querySelectorAll('[data-handle]').forEach(handle=>handle.addEventListener('pointerdown',event=>{if(visual.mode!=='image'||!visual.selectedImage)return;event.preventDefault();event.stopPropagation();const value=imageAdjustmentValue(visual.selectedImage.dataset.imageKey);const frame=imageFrameElement(visual.selectedImage);const rect=frame?.getBoundingClientRect();if(!rect?.width||!rect?.height)return;visual.imageDrag=null;visual.imageResize={img:visual.selectedImage,key:visual.selectedImage.dataset.imageKey,handle:handle.dataset.handle,startX:event.clientX,startY:event.clientY,scaleX:value.scaleX,scaleY:value.scaleY,width:rect.width,height:rect.height,pointerId:event.pointerId,control:handle};try{handle.setPointerCapture?.(event.pointerId)}catch{}}));}updateCropOverlay(); };
  const selectImage = img => { if(visual.cropSession&&img!==visual.cropSession.img)cancelCropSession();visual.doc?.querySelectorAll('.editor-image-selected').forEach(el=>el.classList.remove('editor-image-selected'));visual.selectedImage=img||null;if(img){selectVisual(null);img.classList.add('editor-image-selected');createOrUpdateCropOverlay(img);labelVisualSelection('已选中图片：拖动图片裁剪取景；拖边框控制点可等比缩放或自由拉伸');}else{removeCropOverlay();if(visual.mode==='image')labelVisualSelection('调整图片模式：点选照片，拖动画面裁剪，拖边框控制点拉伸');}const disabled=!visual.selectedImage;['imageZoomOutBtn','imageZoomInBtn','imageFillBtn','imageResetBtn','startCropBtn'].forEach(id=>{const button=$('#'+id);if(button)button.disabled=disabled;});setCropButtons(!!visual.cropSession); };
  const setVisualMode = mode => { if(visual.cropSession&&mode!=='image')cancelCropSession();visual.mode=['browse','text','move','image'].includes(mode)?mode:'browse';visual.drag=null;visual.pendingDrag=null;visual.imageDrag=null;visual.imageResize=null;if(visual.mode!=='image')selectImage(null);if(visual.mode!=='move')selectVisual(null);const tools=$('#visualTools');if(tools)tools.dataset.mode=visual.mode;[['browseModeBtn','browse'],['textModeBtn','text'],['moveModeBtn','move'],['imageModeBtn','image']].forEach(([id,value])=>$('#'+id)?.classList.toggle('is-active',visual.mode===value));if(visual.doc)visual.doc.documentElement.dataset.editorMode=visual.mode;if(visual.mode==='browse')labelVisualSelection('浏览模式：上下滑动页面，左右滑动相册；点文字仍可直接修改');else if(visual.mode==='text')labelVisualSelection('文字编辑模式：点击右侧任意文字后直接输入；左侧输入框也可以修改');else if(visual.mode==='move')labelVisualSelection('移动元素模式：按住文字、QQ 人、图片外框或其他素材拖动');else labelVisualSelection('调整图片模式：点选照片，拖动画面裁剪，拖边框控制点拉伸');selectImage(visual.mode==='image'?visual.selectedImage:null); };
  const commitImageAdjustment = (img,value) => { const key=img?.dataset?.imageKey;if(!key)return;content.imageAdjustments=content.imageAdjustments||{};content.imageAdjustments[key]=normalizedImageAdjustment(value);updateImageAdjustmentStyle(img,content.imageAdjustments[key]);updateCropOverlay();scheduleDraft(); };
  const changeImageZoom = delta => { const img=visual.selectedImage;if(!img){status('请先在右侧预览中点选一张照片。',true);return;}const value=imageAdjustmentValue(img.dataset.imageKey);value.scaleX=clampImageScale(value.scaleX+delta);value.scaleY=clampImageScale(value.scaleY+delta);commitImageAdjustment(img,value); };
  const fillSelectedImage = () => { const img=visual.selectedImage;if(!img){status('请先在右侧预览中点选一张照片。',true);return;}const frameWidth=img.clientWidth,frameHeight=img.clientHeight,imageWidth=img.naturalWidth,imageHeight=img.naturalHeight;if(!frameWidth||!frameHeight||!imageWidth||!imageHeight){status('图片还没有加载完成，请稍后再点一次“一键铺满”。',true);return;}const frameRatio=frameWidth/frameHeight,imageRatio=imageWidth/imageHeight;const scale=Math.max(1,frameRatio/imageRatio,imageRatio/frameRatio);const current=imageAdjustmentValue(img.dataset.imageKey);commitImageAdjustment(img,{x:0,y:0,scaleX:scale,scaleY:scale,crop:current.crop}); };
  const resetSelectedImage = () => { const img=visual.selectedImage;if(!img){status('请先在右侧预览中点选一张照片。',true);return;}const key=img.dataset.imageKey;if(content.imageAdjustments)delete content.imageAdjustments[key];updateImageAdjustmentStyle(img,{x:0,y:0,scaleX:1,scaleY:1});updateCropOverlay();scheduleDraft(); };
  const setCropButtons = active => { const tools=$('#visualTools');tools?.classList.toggle('is-cropping',!!active);const start=$('#startCropBtn'),apply=$('#applyCropBtn'),cancel=$('#cancelCropBtn');if(start)start.disabled=!visual.selectedImage||!!active;if(apply)apply.disabled=!active;if(cancel)cancel.disabled=!active; };
  const removeRealCropOverlay = () => { try{visual.cropSession?.overlay?.remove()}catch{}visual.cropDrag=null;if(visual.cropSession)visual.cropSession.overlay=null; };
  const updateRealCropOverlay = () => { const session=visual.cropSession,overlay=session?.overlay,img=session?.img;if(!session||!overlay||!img?.isConnected)return;const frame=imageFrameElement(img),box=frame?.getBoundingClientRect();if(!box?.width||!box?.height)return;overlay.style.left=box.left+'px';overlay.style.top=box.top+'px';overlay.style.width=box.width+'px';overlay.style.height=box.height+'px';const rect=normalizeCrop(session.rect);session.rect=rect;const selection=overlay.querySelector('.editor-real-crop-selection');selection.style.left=(rect.left*100)+'%';selection.style.top=(rect.top*100)+'%';selection.style.width=(rect.width*100)+'%';selection.style.height=(rect.height*100)+'%'; };
  const createRealCropOverlay = session => { const doc=session.img.ownerDocument;const overlay=doc.createElement('div');overlay.className='editor-real-crop-overlay';overlay.setAttribute('aria-label','真实图片裁剪区域');overlay.innerHTML='<div class="editor-real-crop-selection" data-crop-move aria-label="拖动裁剪区域">'+['nw','n','ne','e','se','s','sw','w'].map(handle=>'<button type="button" class="editor-real-crop-handle crop-handle" data-crop-handle="'+handle+'" aria-label="调整裁剪区域 '+handle+'"></button>').join('')+'</div>';doc.body.appendChild(overlay);session.overlay=overlay;const begin=(event,handle)=>{if(event.button!==undefined&&event.button!==0)return;event.preventDefault();event.stopPropagation();const box=overlay.getBoundingClientRect();visual.cropDrag={handle,startX:event.clientX,startY:event.clientY,start:{...session.rect},width:box.width,height:box.height,pointerId:event.pointerId,control:event.currentTarget};try{event.currentTarget.setPointerCapture?.(event.pointerId)}catch{}};overlay.querySelector('[data-crop-move]').addEventListener('pointerdown',event=>{if(event.target.closest('[data-crop-handle]'))return;begin(event,'move')});overlay.querySelectorAll('[data-crop-handle]').forEach(handle=>handle.addEventListener('pointerdown',event=>begin(event,handle.dataset.cropHandle)));updateRealCropOverlay(); };
  const startCropSession = () => { const img=visual.selectedImage;if(!img){status('请先点选一张要裁剪的照片。',true);return;}if(visual.cropSession)return;const key=img.dataset.imageKey,initial=imageAdjustmentValue(key);visual.cropSession={img,key,initialAdjustment:cloneValue(initial),rect:normalizeCrop(initial.crop)||{left:.08,top:.08,width:.84,height:.84},overlay:null};updateImageAdjustmentStyle(img,{x:0,y:0,scaleX:1,scaleY:1});img.style.setProperty('object-fit','fill','important');removeCropOverlay();createRealCropOverlay(visual.cropSession);setCropButtons(true);labelVisualSelection('裁剪中：拖动框内移动选区，拖四边或四角改变范围，完成后点“应用裁剪”'); };
  const finishCropSession = keepSelection => { const session=visual.cropSession;if(!session)return;removeRealCropOverlay();visual.cropSession=null;setCropButtons(false);if(keepSelection&&visual.selectedImage?.isConnected)createOrUpdateCropOverlay(visual.selectedImage); };
  const applyCropSession = () => { const session=visual.cropSession;if(!session)return;const value={x:0,y:0,scaleX:1,scaleY:1,crop:normalizeCrop(session.rect)};content.imageAdjustments=content.imageAdjustments||{};content.imageAdjustments[session.key]=normalizedImageAdjustment(value);updateImageAdjustmentStyle(session.img,value);finishCropSession(true);scheduleDraft();status('裁剪已应用，原相框尺寸保持不变；记得点“立即保存到云端”。'); };
  const cancelCropSession = () => { const session=visual.cropSession;if(!session)return;updateImageAdjustmentStyle(session.img,session.initialAdjustment);finishCropSession(true);labelVisualSelection('已取消裁剪，图片保持原样。'); };
  const setupVisualEditor = () => {
    const frame=$('#preview'); const doc=frame?.contentDocument;
    if(!doc?.querySelector('.page'))return;
    if(visual.doc&&visual.doc!==doc)removeCropOverlay();
    visual.doc=doc;
    doc.documentElement.dataset.editorMode=visual.mode;
    const win=frame.contentWindow;
    if(win&&!win.__wechatVisualEditorListenerBound){win.__wechatVisualEditorListenerBound=true;win.addEventListener('wechat-content-rendered',()=>armVisualEditor());}
const visualStyle = doc.getElementById('editorVisualStyle') || doc.head.appendChild(Object.assign(doc.createElement('style'), { id: 'editorVisualStyle' }));
     visualStyle.textContent='html,body{overscroll-behavior-y:contain}html .reveal{transition:none!important}[data-rich-id]{outline:1px dashed transparent;cursor:text}[data-rich-id]:hover{outline-color:#f39b8e}.editor-selected,.editor-image-selected{outline:3px solid #ff5b4d!important;outline-offset:3px!important}html[data-editor-mode=move] [data-layout-id]{touch-action:none;pointer-events:auto!important;cursor:move}html[data-editor-mode=move] [data-rich-id][data-layout-id]{cursor:grab;touch-action:none!important;user-select:none!important;-webkit-user-select:none!important}html[data-editor-mode=move] [data-rich-id][data-layout-id]:active{cursor:grabbing}.editor-image-selected{outline:0!important;outline-offset:0!important;box-shadow:0 0 0 3px rgba(255,91,77,.9),0 0 0 6px rgba(255,255,255,.92)!important}html[data-editor-mode=move] [data-layout-id]:hover{filter:drop-shadow(0 0 3px #ff5b4d)}html[data-editor-mode=image] img[data-image-key]{touch-action:none!important;pointer-events:auto!important;cursor:move!important;user-select:none!important;-webkit-user-select:none!important;-webkit-user-drag:none!important}.editor-image-crop-overlay{position:fixed;z-index:2147483000;display:none;box-sizing:border-box;border:3px solid #ff5b4d;box-shadow:0 0 0 2px rgba(255,255,255,.88),0 0 0 5px rgba(255,91,77,.28);pointer-events:none}.editor-image-crop-overlay.is-visible{display:block}.editor-image-crop-handle{position:absolute;width:44px;height:44px;margin:0;padding:0;border:0;background:transparent;pointer-events:auto;touch-action:none;cursor:pointer}.editor-image-crop-handle::after{content:"";position:absolute;left:50%;top:50%;width:12px;height:12px;border:2px solid #26354a;border-radius:3px;background:#ffd84d;box-shadow:0 0 0 2px #fff;transform:translate(-50%,-50%)}.editor-image-crop-handle[data-handle=nw]{left:0;top:0;transform:translate(-50%,-50%);cursor:nwse-resize}.editor-image-crop-handle[data-handle=n]{left:50%;top:0;transform:translate(-50%,-50%);cursor:ns-resize}.editor-image-crop-handle[data-handle=ne]{right:0;top:0;transform:translate(50%,-50%);cursor:nesw-resize}.editor-image-crop-handle[data-handle=e]{right:0;top:50%;transform:translate(50%,-50%);cursor:ew-resize}.editor-image-crop-handle[data-handle=se]{right:0;bottom:0;transform:translate(50%,50%);cursor:nwse-resize}.editor-image-crop-handle[data-handle=s]{left:50%;bottom:0;transform:translate(-50%,50%);cursor:ns-resize}.editor-image-crop-handle[data-handle=sw]{left:0;bottom:0;transform:translate(-50%,50%);cursor:nesw-resize}.editor-image-crop-handle[data-handle=w]{left:0;top:50%;transform:translate(-50%,-50%);cursor:ew-resize}.hero-mascot,.hero-mascot *,.campus-decor,.campus-decor *{pointer-events:auto!important}.hero-mascot,.campus-decor{position:absolute!important;z-index:1200!important;user-select:none!important;-webkit-user-select:none!important;-webkit-user-drag:none!important}.campus-decor{animation:none!important}html[data-editor-mode=move] .hero-mascot,html[data-editor-mode=move] .campus-decor{cursor:grab!important;touch-action:none!important}html[data-editor-mode=move] .hero-mascot:active,html[data-editor-mode=move] .campus-decor:active{cursor:grabbing!important}.hero-mascot img,.campus-decor img{pointer-events:auto!important;-webkit-user-drag:none!important}.hero-owl,.hero-owl *{display:block!important;visibility:visible!important;pointer-events:auto!important}@media(max-width:640px){.hero-mascot img{width:76px!important;max-width:76px!important;max-height:76px!important}}';
     visualStyle.textContent+=' .editor-real-crop-overlay{position:fixed;z-index:2147483646;overflow:hidden;pointer-events:none;border:2px solid #fff;box-shadow:0 0 0 2px #ff5b4d}.editor-real-crop-selection{position:absolute;pointer-events:auto;border:3px solid #ffe45e;box-shadow:0 0 0 9999px rgba(10,20,30,.62);touch-action:none;cursor:move}.editor-real-crop-selection:before,.editor-real-crop-selection:after{content:"";position:absolute;pointer-events:none}.editor-real-crop-selection:before{left:33.333%;top:0;width:33.333%;height:100%;border-left:1px dashed rgba(255,255,255,.8);border-right:1px dashed rgba(255,255,255,.8)}.editor-real-crop-selection:after{left:0;top:33.333%;width:100%;height:33.333%;border-top:1px dashed rgba(255,255,255,.8);border-bottom:1px dashed rgba(255,255,255,.8)}.editor-real-crop-handle{position:absolute;width:18px;height:18px;padding:0;border:3px solid #fff;border-radius:50%;background:#ff5b4d;box-shadow:0 1px 4px rgba(0,0,0,.5);touch-action:none;z-index:2}.editor-real-crop-handle[data-crop-handle=nw]{left:0;top:0;transform:translate(-50%,-50%)}.editor-real-crop-handle[data-crop-handle=n]{left:50%;top:0;transform:translate(-50%,-50%)}.editor-real-crop-handle[data-crop-handle=ne]{right:0;top:0;transform:translate(50%,-50%)}.editor-real-crop-handle[data-crop-handle=e]{right:0;top:50%;transform:translate(50%,-50%)}.editor-real-crop-handle[data-crop-handle=se]{right:0;bottom:0;transform:translate(50%,50%)}.editor-real-crop-handle[data-crop-handle=s]{left:50%;bottom:0;transform:translate(-50%,50%)}.editor-real-crop-handle[data-crop-handle=sw]{left:0;bottom:0;transform:translate(-50%,50%)}.editor-real-crop-handle[data-crop-handle=w]{left:0;top:50%;transform:translate(-50%,-50%)}@media(max-width:640px){.editor-real-crop-handle{width:24px;height:24px}}';
     doc.querySelectorAll('.hero-mascot[data-layout-key],.campus-decor[data-layout-key]').forEach(el=>{
       if(!el.dataset.layoutId)el.dataset.layoutId=el.dataset.layoutKey;
       el.style.setProperty('display','block','important');
       el.style.setProperty('visibility','visible','important');
       el.style.setProperty('pointer-events','auto','important');
       el.style.setProperty('z-index','1200','important');
       el.querySelectorAll('img').forEach(img=>{img.draggable=false;img.style.setProperty('pointer-events','auto','important');img.style.cursor='grab';if(!img.dataset.visualDragBound){img.dataset.visualDragBound='1';img.addEventListener('dragstart',event=>{event.preventDefault();event.stopPropagation();});}});
     });
     doc.querySelectorAll('[data-rich-id]').forEach(el=>{
       el.contentEditable='true'; el.spellcheck=false;
       if(el.dataset.richBound)return;
       el.dataset.richBound='1';
       el.addEventListener('focus',()=>selectVisual(el));
       el.addEventListener('input',()=>updateRichFromElement(el));
       el.addEventListener('pointerdown',event=>{
         if(visual.mode!=='move')return;
         if(event.button!==undefined&&event.button!==0)return;
         const id=el.dataset.layoutId; if(!id)return;
         if(event.cancelable)event.preventDefault();
         event.stopPropagation();
         try { visual.doc.getSelection?.().removeAllRanges(); } catch {}
         content.layout=content.layout||{}; const current=content.layout[id]||{};
         visual.pendingDrag={el,id,startX:event.clientX,startY:event.clientY,x:Number(current.x)||0,y:Number(current.y)||0,z:Number(current.z)||0,pointerId:event.pointerId,pointerType:event.pointerType||'mouse'};
       });
     });
    doc.querySelectorAll('[data-layout-id],.hero-mascot[data-layout-key],.campus-decor[data-layout-key]').forEach(el=>{
      if(el.dataset.layoutBound)return;
      el.dataset.layoutBound='1';
      el.addEventListener('click',event=>{if(visual.mode!=='move')return;if(Date.now()<visual.suppressClickUntil){event.preventDefault();event.stopPropagation();return;}if(event.target.closest('[data-rich-id]'))return;event.stopPropagation();selectVisual(el)});
      el.addEventListener('pointerdown',event=>{
        if(visual.mode!=='move')return;
        if(event.button!==undefined&&event.button!==0)return;
        if(event.target.closest('[data-rich-id],button,a,input,textarea,select,label,video'))return;
        event.stopPropagation();
        if(el.matches('.hero-mascot,.campus-decor') && event.cancelable)event.preventDefault();
        const id=el.dataset.layoutId; content.layout=content.layout||{}; const current=content.layout[id]||{};
        visual.pendingDrag={el,id,startX:event.clientX,startY:event.clientY,x:Number(current.x)||0,y:Number(current.y)||0,z:Number(current.z)||0,pointerId:event.pointerId,pointerType:event.pointerType||'mouse'};
      });
    });
    doc.querySelectorAll('img[data-image-key]').forEach(img=>{
       updateImageAdjustmentStyle(img,imageAdjustmentValue(img.dataset.imageKey));
       img.draggable=false;
       if(img.dataset.imageAdjustBound)return;
       img.dataset.imageAdjustBound='1';
       img.addEventListener('click',event=>{if(visual.mode!=='image')return;event.preventDefault();event.stopPropagation();selectImage(img);});
       img.addEventListener('pointerdown',event=>{
         if(visual.mode!=='image'||visual.cropSession||(event.button!==undefined&&event.button!==0))return;
         event.preventDefault();event.stopPropagation();selectImage(img);
         const value=imageAdjustmentValue(img.dataset.imageKey);
         visual.imageResize=null;visual.imageDrag={img,key:img.dataset.imageKey,startX:event.clientX,startY:event.clientY,x:value.x,y:value.y,scaleX:value.scaleX,scaleY:value.scaleY,pointerId:event.pointerId};
         try{img.setPointerCapture?.(event.pointerId)}catch{}
       });
       img.addEventListener('dragstart',event=>event.preventDefault());
     });
    if(!doc.documentElement.dataset.visualEditorBound){
      doc.documentElement.dataset.visualEditorBound='1';
doc.addEventListener('pointermove',event=>{
          const cropDrag=visual.cropDrag;
          if(cropDrag&&visual.cropSession){if(event.pointerId!==undefined&&cropDrag.pointerId!==undefined&&event.pointerId!==cropDrag.pointerId)return;if(event.cancelable)event.preventDefault();const dx=(event.clientX-cropDrag.startX)/Math.max(1,cropDrag.width),dy=(event.clientY-cropDrag.startY)/Math.max(1,cropDrag.height),start=cropDrag.start,min=.08;let left=start.left,top=start.top,width=start.width,height=start.height,handle=cropDrag.handle;if(handle==='move'){left=Math.max(0,Math.min(1-width,start.left+dx));top=Math.max(0,Math.min(1-height,start.top+dy));}else{if(handle.includes('w')){const right=start.left+start.width;left=Math.max(0,Math.min(right-min,start.left+dx));width=right-left;}if(handle.includes('e'))width=Math.max(min,Math.min(1-start.left,start.width+dx));if(handle.includes('n')){const bottom=start.top+start.height;top=Math.max(0,Math.min(bottom-min,start.top+dy));height=bottom-top;}if(handle.includes('s'))height=Math.max(min,Math.min(1-start.top,start.height+dy));}visual.cropSession.rect=normalizeCrop({left,top,width,height});updateRealCropOverlay();return;}
          const imageResize=visual.imageResize;
          if(imageResize){
            if(event.pointerId!==undefined&&imageResize.pointerId!==undefined&&event.pointerId!==imageResize.pointerId)return;
            if(event.cancelable)event.preventDefault();
            const dx=event.clientX-imageResize.startX,dy=event.clientY-imageResize.startY,handle=imageResize.handle;
            let scaleX=imageResize.scaleX,scaleY=imageResize.scaleY;
            if(handle.length===2){const signX=handle.includes('e')?1:-1,signY=handle.includes('s')?1:-1;const factor=Math.max(.05,1+((signX*dx/imageResize.width)+(signY*dy/imageResize.height))/2);scaleX=clampImageScale(imageResize.scaleX*factor);scaleY=clampImageScale(imageResize.scaleY*factor);}else if(handle==='e'||handle==='w'){const sign=handle==='e'?1:-1;scaleX=clampImageScale(imageResize.scaleX*(1+sign*dx/imageResize.width));}else if(handle==='s'||handle==='n'){const sign=handle==='s'?1:-1;scaleY=clampImageScale(imageResize.scaleY*(1+sign*dy/imageResize.height));}
            const current=imageAdjustmentValue(imageResize.key);const value={x:current.x,y:current.y,scaleX,scaleY,crop:current.crop};content.imageAdjustments=content.imageAdjustments||{};content.imageAdjustments[imageResize.key]=normalizedImageAdjustment(value);updateImageAdjustmentStyle(imageResize.img,value);updateCropOverlay();return;
          }
          const imageDrag=visual.imageDrag;
         if(imageDrag){
           if(event.pointerId!==undefined&&imageDrag.pointerId!==undefined&&event.pointerId!==imageDrag.pointerId)return;
           if(event.cancelable)event.preventDefault();
           const current=imageAdjustmentValue(imageDrag.key);const value={x:Math.round(imageDrag.x+event.clientX-imageDrag.startX),y:Math.round(imageDrag.y+event.clientY-imageDrag.startY),scaleX:imageDrag.scaleX,scaleY:imageDrag.scaleY,crop:current.crop};
           content.imageAdjustments=content.imageAdjustments||{};content.imageAdjustments[imageDrag.key]=value;updateImageAdjustmentStyle(imageDrag.img,value);
           return;
         }
         if(visual.mode!=='move'){visual.pendingDrag=null;visual.drag=null;return;}
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
         const value={x:Math.round(d.x+event.clientX-d.startX),y:Math.round(d.y+event.clientY-d.startY),z:d.z};content.layout[d.id]=value;updateLayoutStyle(d.el,value);scheduleDraft();
       });
       const finishDrag=event=>{if(visual.cropDrag){const d=visual.cropDrag;visual.cropDrag=null;visual.suppressClickUntil=Date.now()+200;try{d.control.releasePointerCapture?.(event?.pointerId)}catch{}return;}if(visual.imageResize){const d=visual.imageResize;visual.imageResize=null;visual.suppressClickUntil=Date.now()+250;try{d.control.releasePointerCapture?.(event?.pointerId)}catch{}scheduleDraft();return;}if(visual.imageDrag){const d=visual.imageDrag;visual.imageDrag=null;visual.suppressClickUntil=Date.now()+250;try{d.img.releasePointerCapture?.(event?.pointerId)}catch{}scheduleDraft();return;}visual.pendingDrag=null;if(!visual.drag)return;const d=visual.drag;visual.drag=null;visual.suppressClickUntil=Date.now()+450;try { d.el.releasePointerCapture?.(event?.pointerId); } catch {}scheduleDraft();};
       doc.addEventListener('pointerup',finishDrag);
       doc.addEventListener('pointercancel',finishDrag);
       doc.addEventListener('scroll',()=>{updateCropOverlay();updateRealCropOverlay();},{passive:true});
       win?.addEventListener('resize',()=>{updateCropOverlay();updateRealCropOverlay();},{passive:true});
       doc.addEventListener('click',event=>{if(Date.now()<visual.suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();return;}if(visual.mode==='image'&&!event.target.closest('img[data-image-key]'))selectImage(null);if(!event.target.closest('[data-rich-id],[data-layout-id]'))selectVisual(null)},true);
    }
     setVisualMode(visual.mode);
  };
  const armVisualEditor = () => [0,120,360,900].forEach(delay=>setTimeout(setupVisualEditor,delay));
  const changeLayer = mode => { const id=selectedLayout(); if(!id){status('请先在右侧预览中点选一张图片或装饰素材。',true);return;} content.layout=content.layout||{};const value={x:0,y:0,z:0,...content.layout[id]};if(mode==='top')value.z=999;else if(mode==='up')value.z=Math.min(999,(Number(value.z)||0)+1);else if(mode==='down')value.z=Math.max(-99,(Number(value.z)||0)-1);else if(mode==='bottom')value.z=-99;else if(mode==='reset')Object.assign(value,{x:0,y:0,z:0});content.layout[id]=value;updateLayoutStyle(visual.selected,value);scheduleDraft(); };
  const bindVisualTools = () => { $('#browseModeBtn').onclick=()=>setVisualMode('browse');$('#textModeBtn').onclick=()=>setVisualMode('text');$('#moveModeBtn').onclick=()=>setVisualMode('move');$('#imageModeBtn').onclick=()=>setVisualMode('image');$('#boldBtn').onclick=()=>{const doc=visual.doc;if(!doc)return;doc.execCommand('bold',false,null);const active=doc.activeElement?.closest?.('[data-rich-id]')||visual.selected;if(active?.dataset?.richId)updateRichFromElement(active);};$('#topBtn').onclick=()=>changeLayer('top');$('#upBtn').onclick=()=>changeLayer('up');$('#downBtn').onclick=()=>changeLayer('down');$('#bottomBtn').onclick=()=>changeLayer('bottom');$('#resetLayoutBtn').onclick=()=>changeLayer('reset');$('#imageZoomOutBtn').onclick=()=>changeImageZoom(-.1);$('#imageZoomInBtn').onclick=()=>changeImageZoom(.1);$('#imageFillBtn').onclick=fillSelectedImage;$('#imageResetBtn').onclick=resetSelectedImage;$('#startCropBtn').onclick=startCropSession;$('#applyCropBtn').onclick=applyCropSession;$('#cancelCropBtn').onclick=cancelCropSession;setVisualMode('browse'); };

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
      status('正在上传图片：' + key);
      const url = await cloud().uploadAsset(item.file, 'image-' + key);
      if (pending[key] === item) {
        content.images[key] = url;
        rememberCloudImageRecovery(key, url);
        delete pending[key];
      }
    }
    if (pendingVideo?.file) {
      const videoUpload = pendingVideo;
      status('正在上传宣传片…');
      content.video = content.video || {};
      const url = await cloud().uploadAsset(videoUpload.file, 'promo-video');
      if (pendingVideo === videoUpload) {
        content.video.url = url;
        pendingVideo = null;
      }
    }
  };
  const performCloudSave = async () => {
    if (!cloudReady()) return false;
    cloudSaving = true;
    const startedRevision = contentRevision;
    let saved = false;
    try {
      await uploadPendingAssets();
      syncPhotoWall();
      const payload = cloneValue(content);
      const savedContent = (await cloud().saveContent(payload, cloud().getLastUpdatedAt?.())) || payload;
      baseContent = cloneValue(savedContent);
      clearCloudImageRecovery(savedContent);
      try { localStorage.setItem(PUBLISHED_SNAPSHOT_KEY, JSON.stringify({ content_json: savedContent, updated_at: cloud().getLastUpdatedAt?.() || new Date().toISOString() })); } catch {}
      if (contentRevision === startedRevision) {
        content = savedContent;
        dirty = false;
        saved = true;
        await clearDraft();
        status('已保存并校验云端同步，另一台设备重新打开即可看到最新内容。');
      } else {
        dirty = true;
        cloudSaveRequested = true;
        await persistDraft();
        status('保存期间又产生了新的修改，已保留并准备再次同步。');
      }
    } catch (error) {
      if (isRetryableSaveError(error)) {
        status('云端暂时未响应，已保留本机草稿，稍后会自动重试。', true);
      } else {
        status('本机草稿已保存，但云端同步失败：' + cloudErrorMessage(error), true);
      }
    } finally {
      cloudSaving = false;
    }
    return saved;
  };
  const saveCloud = () => {
    if (!cloudReady()) return Promise.resolve(false);
    cloudSaveRequested = true;
    if (!cloudSavePromise) {
      cloudSavePromise = (async () => {
        let saved = false;
        while (cloudSaveRequested) {
          cloudSaveRequested = false;
          saved = await performCloudSave();
        }
        return saved;
      })().finally(() => { cloudSavePromise = null; });
    }
    return cloudSavePromise;
  };
  const scheduleDraft = () => { contentRevision += 1; dirty = true; clearTimeout(autosaveTimer); autosaveTimer = setTimeout(async () => { const localSaved = await persistDraft(); if (cloudReady()) await saveCloud(); else status(localSaved ? '修改已自动保存到本机；配置云端后即可多人同步。' : '本机空间不足，当前修改只保留在页面中；请尽快配置云端。', !localSaved); }, 600); };
  const bindFields = () => document.querySelectorAll('[data-path]').forEach(element => element.addEventListener('input', event => { setPath(content, event.target.dataset.path, event.target.value); scheduleDraft(); }));
  const bindImages = () => document.querySelectorAll('[data-image]').forEach(element => element.addEventListener('change', async event => {
    const originalFile = event.target.files?.[0];
    if (!originalFile) return;
    const key = event.target.dataset.image;
    event.target.disabled = true;
    status('正在优化图片，保持比例并加快手机加载…');
    try {
      const file = await optimizeUploadedImage(originalFile, key);
      const dataUrl = await fileToDataUrl(file);
      pending[key] = { file, dataUrl };
      content.images[key] = dataUrl;
      if (content.imageAdjustments) delete content.imageAdjustments[key];
      const image = $('#img-' + key);
      if (image) image.src = dataUrl;
      const urlInput = document.querySelector(`[data-image-url="${key}"]`);
      if (urlInput) urlInput.value = dataUrl;
      pushPreview();
      scheduleDraft();
      status(file === originalFile ? '图片已载入，将按比例铺满相框；可在右侧继续移动、缩放或裁剪。' : '图片已自动压缩并按比例铺满相框；可在右侧继续移动、缩放或裁剪。');
    } catch (error) {
      status('图片读取失败：' + (error?.message || error), true);
    } finally {
      event.target.disabled = false;
    }
  }));
  const bindImageUrls = () => document.querySelectorAll('[data-image-url]').forEach(element => element.addEventListener('input', event => { const key = event.target.dataset.imageUrl; content.images[key] = event.target.value.trim(); delete pending[key]; const image = $('#img-' + key); if (image) image.src = content.images[key]; pushPreview(); scheduleDraft(); }));
  const ensureVideoUpload = () => { if (document.querySelector('[data-video-upload]')) return; const urlField = document.querySelector('[data-path="video.url"]')?.closest('.field'); if (!urlField) return; const wrapper = document.createElement('div'); wrapper.className = 'field full'; wrapper.innerHTML = '<label>上传宣传片文件</label><input type="file" accept="video/mp4,video/webm,video/ogg" data-video-upload><small>选择视频后会自动上传到云端；未配置云端时请填写可访问的视频地址。</small>'; urlField.parentElement?.appendChild(wrapper); wrapper.querySelector('[data-video-upload]').addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; pendingVideo = { file }; scheduleDraft(); }); };
  const draft = async () => { if (!await persistDraft()) return; pushPreview(); status('本机草稿已保存，右侧预览已刷新。' + (cloudReady() ? '云端也会继续自动同步。' : '')); };
  const copyShareLink = async () => { const value = cloud()?.getShareUrl?.() || window.location.href; try { await navigator.clipboard.writeText(value); status('共享编辑链接已复制：\n' + value); } catch { window.prompt('请复制这个共享编辑链接', value); } };
  const load = async () => {
    try {
      const missingShareKey = Boolean(cloud()?.isConfigured?.() && !cloud()?.hasShareKey?.());
      status(missingShareKey ? '当前链接缺少共享编辑密钥，云端内容可读取，但保存请使用带 ?share= 的共享编辑链接。' : '正在打开编辑器…');
      const response = await fetch('content.json?ts=' + Date.now(), { cache: 'no-store' }); if (!response.ok) throw new Error('HTTP ' + response.status);
      fallbackContent = await response.json();
      const saved = await readDraft();
      const initialContent = mergePendingDraftImages(null, saved);
      content = mergePublishedContent(fallbackContent, initialContent || {}); baseContent = cloneValue(content); syncPhotoWall(); renderForm(); refreshPreview();
      if (cloudReady()) {
        status('编辑器已打开，正在读取云端最新内容…');
        unsubscribeCloud = cloud().subscribe(incoming => {
          if (!incoming || cloudSaving) return;
          if (dirty) { status('检测到其他编辑者的新内容。当前还有未保存修改，请先保存后再接收云端更新。', true); return; }
          content = mergePublishedContent(fallbackContent || {}, incoming); baseContent = cloneValue(content); syncPhotoWall(); renderForm(); refreshPreview(); status('已收到其他编辑者的最新修改。');
        });
        cloud().loadContent().then(cloudContent => {
          if (!cloudContent) { status('编辑器已打开；云端暂无内容，第一次保存时会创建并同步。'); return; }
          if (dirty) { status('编辑器已打开；云端有最新内容，但当前还有未保存修改，请先保存后再接收云端更新。', true); return; }
          const sourceContent = mergePendingDraftImages(cloudContent, saved);
          content = mergePublishedContent(fallbackContent || {}, sourceContent || {}); baseContent = cloneValue(content); syncPhotoWall(); renderForm(); refreshPreview(); status('已读取云端最新内容，修改会自动同步。共享链接可复制给其他编辑者。');
        }).catch(error => {
          status('编辑器已打开，但云端读取较慢；当前先显示本机/默认内容，稍后可继续编辑或点击“立即保存到云端”。', true);
          console.warn('编辑器云端内容读取失败：', error);
        });
      } else status('云端服务尚未配置：当前使用本机 IndexedDB 草稿。配置后即可多人在线同步。');
    } catch (error) { status('读取推文内容失败：' + error.message, true); }
  };
  bindVisualTools();
  $('#previewBtn').onclick = draft;
  $('#cloudSaveBtn').onclick = async () => { clearTimeout(autosaveTimer); const localSaved = await persistDraft(); if (cloudReady()) await saveCloud(); else if (cloud()?.isConfigured?.()) status((localSaved ? '本机草稿已保存，但' : '本机草稿保存失败，并且') + '当前链接缺少共享编辑密钥；请使用原始共享编辑链接。', true); else status(localSaved ? '本机草稿已保存；还没有配置云端服务。' : '本机草稿保存失败；还没有配置云端服务。', true); };
  $('#copyShareBtn').onclick = copyShareLink;
  $('#resetBtn').onclick = async () => { await clearDraft(); location.reload(); };
  load();
})();
