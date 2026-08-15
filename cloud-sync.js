(() => {
  const defaults = { contentId: 'wechat-recruitment-2026', bucket: 'wechat-recruitment-assets' };
  const config = Object.assign({}, defaults, window.WECHAT_CLOUD_CONFIG || {});
  let shareKey = new URL(window.location.href).searchParams.get('share') || config.shareKey || '';
  let client = null;
  let realtimeChannel = null;
  const configured = Boolean(config.url && config.anonKey && window.supabase?.createClient);

  const initClient = () => {
    if (!configured) { client = null; return; }
    client = window.supabase.createClient(config.url, config.anonKey, {
      global: { headers: { 'x-share-key': shareKey } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
  };
  initClient();

  const randomShareKey = () => {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  };
  const publicAssetUrl = path => client.storage.from(config.bucket).getPublicUrl(path).data.publicUrl;
  const loadContent = async () => {
    if (!client) return null;
    const { data, error } = await client.from('wechat_contents').select('content_json,updated_at').eq('content_id', config.contentId).maybeSingle();
    if (error) throw error;
    return data?.content_json || null;
  };
  const saveContent = async content => {
    if (!client) throw new Error('云端服务尚未配置，请先填写 cloud-config.js');
    if (!shareKey) throw new Error('缺少共享编辑密钥，请使用带 ?share= 的编辑链接');
    const { data, error } = await client.from('wechat_contents').upsert({
      content_id: config.contentId,
      content_json: content,
      share_key: shareKey,
      published: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'content_id' }).select('content_json,updated_at').single();
    if (error) throw error;
    return data?.content_json || content;
  };
  const uploadAsset = async (file, kind = 'image') => {
    if (!client) throw new Error('云端服务尚未配置');
    if (!shareKey) throw new Error('缺少共享编辑密钥');
    const safeName = String(file?.name || 'upload.bin').toLowerCase().replace(/[^a-z0-9._-]/g, '-') || 'upload.bin';
    const path = `${config.contentId}/${shareKey}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const { error } = await client.storage.from(config.bucket).upload(path, file, { cacheControl: '31536000', contentType: file.type || undefined, upsert: false });
    if (error) throw error;
    return publicAssetUrl(path);
  };
  const subscribe = callback => {
    if (!client) return () => {};
    realtimeChannel = client.channel(`wechat-content-${config.contentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wechat_contents', filter: `content_id=eq.${config.contentId}` }, payload => {
        if (payload.eventType !== 'DELETE' && payload.new?.content_json) callback(payload.new.content_json, payload.new.updated_at);
      }).subscribe();
    return () => { if (realtimeChannel) client.removeChannel(realtimeChannel); realtimeChannel = null; };
  };
  const setShareKey = (next, replaceUrl = false) => {
    shareKey = String(next || '');
    if (replaceUrl) {
      const nextUrl = new URL(window.location.href);
      if (shareKey) nextUrl.searchParams.set('share', shareKey); else nextUrl.searchParams.delete('share');
      history.replaceState({}, '', nextUrl.toString());
    }
    initClient();
  };
  const getShareUrl = () => {
    const nextUrl = new URL(window.location.href);
    if (shareKey) nextUrl.searchParams.set('share', shareKey);
    return nextUrl.toString();
  };
  window.WechatCloudSync = {
    config,
    isConfigured: () => configured,
    hasShareKey: () => Boolean(shareKey),
    getShareKey: () => shareKey,
    setShareKey,
    getShareUrl,
    createShareLink: () => { const next = randomShareKey(); const nextUrl = new URL(window.location.href); nextUrl.searchParams.set('share', next); return nextUrl.toString(); },
    loadContent, saveContent, uploadAsset, subscribe
  };
})();
