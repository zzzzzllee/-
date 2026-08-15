(() => {
  const defaults = { contentId: 'wechat-recruitment-2026', bucket: 'wechat-recruitment-assets' };
  const config = Object.assign({}, defaults, window.WECHAT_CLOUD_CONFIG || {});
  let shareKey = new URL(window.location.href).searchParams.get('share') || config.shareKey || '';
  let client = null;
  let realtimeChannel = null;
  let lastUpdatedAt = '';
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
  const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const isRetryable = error => {
    const code = String(error?.code || '');
    const message = String(error?.message || error || '').toLowerCase();
    return code === '57014' || code === '08P01' || /statement timeout|timeout|temporar|network|fetch failed|failed to fetch|connection/i.test(message);
  };
  const publicAssetUrl = path => client.storage.from(config.bucket).getPublicUrl(path).data.publicUrl;
  const loadContent = async () => {
    if (!client) return null;
    const { data, error } = await client.from('wechat_contents').select('content_json,updated_at').eq('content_id', config.contentId).maybeSingle();
    if (error) throw error;
    lastUpdatedAt = data?.updated_at || '';
    return data?.content_json || null;
  };
  const saveContentOnce = async content => {
    const values = { content_json: content, published: true, updated_at: new Date().toISOString() };
    const { data: updated, error: updateError } = await client
      .from('wechat_contents')
      .update(values)
      .eq('content_id', config.contentId)
      .eq('share_key', shareKey)
      .select('content_json,updated_at')
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) { lastUpdatedAt = updated.updated_at || values.updated_at; return updated.content_json || content; }

    const { data: inserted, error: insertError } = await client
      .from('wechat_contents')
      .insert({ content_id: config.contentId, ...values, share_key: shareKey })
      .select('content_json,updated_at')
      .maybeSingle();
    if (insertError) {
      if (String(insertError.code || '') === '23505') {
        throw new Error('共享编辑密钥与云端内容不匹配，请使用原始共享编辑链接。');
      }
      throw insertError;
    }
    lastUpdatedAt = inserted?.updated_at || values.updated_at;
    return inserted?.content_json || content;
  };
  const saveContent = async content => {
    if (!client) throw new Error('云端服务尚未配置，请先填写 cloud-config.js');
    if (!shareKey) throw new Error('当前编辑器缺少共享编辑密钥，请使用带 ?share= 的共享编辑链接。');
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await saveContentOnce(content); }
      catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === 2) break;
        await sleep(500 * (attempt + 1));
      }
    }
    throw lastError;
  };
  const uploadAsset = async (file, kind = 'image') => {
    if (!client) throw new Error('云端服务尚未配置');
    if (!shareKey) throw new Error('当前编辑器缺少共享编辑密钥');
    const safeName = String(file?.name || 'upload.bin').toLowerCase().replace(/[^a-z0-9._-]/g, '-') || 'upload.bin';
    const path = `${config.contentId}/${shareKey}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await client.storage.from(config.bucket).upload(path, file, { cacheControl: '31536000', contentType: file.type || undefined, upsert: true });
      if (!error) return publicAssetUrl(path);
      lastError = error;
      if (!isRetryable(error) || attempt === 2) break;
      await sleep(700 * (attempt + 1));
    }
    throw lastError;
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
    getLastUpdatedAt: () => lastUpdatedAt,
    setShareKey,
    getShareUrl,
    createShareLink: () => { const next = randomShareKey(); const nextUrl = new URL(window.location.href); nextUrl.searchParams.set('share', next); return nextUrl.toString(); },
    loadContent, saveContent, uploadAsset, subscribe
  };
})();
