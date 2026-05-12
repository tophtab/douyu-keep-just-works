(function () {
  function createPageRenderers(deps) {
    var byId = deps.byId;
    var escapeHtml = deps.escapeHtml;
    var formatDate = deps.formatDate;
    var toast = deps.toast;
    var state = deps.state;
    var buildCookieCheckText = deps.buildCookieCheckText;
    var requestJson = deps.requestJson;
    var getRawConfig = deps.getRawConfig;
    var getCookieCloudConfig = deps.getCookieCloudConfig;
    var getManualCookiesConfig = deps.getManualCookiesConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var getManagedConfig = deps.getManagedConfig;
    var getManagedFans = deps.getManagedFans;
    var isTaskActive = deps.isTaskActive;
    var renderRefreshButton = deps.renderRefreshButton;
    var hasLoadedFansList = deps.hasLoadedFansList;
    var ensureFansListForActiveTab = deps.ensureFansListForActiveTab;
    var ensureYubaStatusForActiveTab = deps.ensureYubaStatusForActiveTab;
    var loadFansStatus = deps.loadFansStatus;
    var loadLogs = deps.loadLogs;
    var buildOverviewGiftSummary = deps.buildOverviewGiftSummary;
    var buildSummaryStatusCell = deps.buildSummaryStatusCell;
    var buildFansStatusTable = deps.buildFansStatusTable;
    var buildLoginStatusCard = deps.buildLoginStatusCard;
    var buildTaskCard = deps.buildTaskCard;
    var buildLoadingTaskCard = deps.buildLoadingTaskCard;
    var buildYubaStatusTable = deps.buildYubaStatusTable;
    var buildBackpackRowsTable = deps.buildBackpackRowsTable;
    var buildSendTable = deps.buildSendTable;
    var formatRatioPercent = deps.formatRatioPercent;
    var getSystemPrefersDark = deps.getSystemPrefersDark;
    var setThemeMeta = deps.setThemeMeta;
    var setThemeButtonState = deps.setThemeButtonState;
    var isThemeMode = deps.isThemeMode;

  function renderCookieCheck() {
    var note = byId('cookie-cloud-note');
    if (!note) {
      return;
    }
    note.textContent = buildCookieCheckText(state.cookieCheck);
  }

  function renderCronPreview(targetId, key) {
    var target = byId(targetId);
    var preview = state.cronPreview[key];
    if (!target || !preview) {
      return;
    }
    if (!preview.value) {
      target.textContent = '填写 cron 后显示未来三次执行时间。';
      return;
    }
    if (preview.loading) {
      target.textContent = '正在计算未来执行时间…';
      return;
    }
    if (preview.error) {
      target.textContent = 'cron 校验失败：' + preview.error;
      return;
    }
    if (!preview.runs.length) {
      target.textContent = '暂未生成未来执行时间。';
      return;
    }
    target.textContent = '未来三次：' + preview.runs.map(function (item) {
      return formatDate(item);
    }).join(' / ');
  }

  function loadCronPreview(key, cron, targetId) {
    var value = String(cron || '').trim();
    state.cronPreviewSeq[key] += 1;
    var requestSeq = state.cronPreviewSeq[key];

    if (!value) {
      state.cronPreview[key] = createEmptyCronPreview();
      renderCronPreview(targetId, key);
      return Promise.resolve();
    }

    state.cronPreview[key] = {
      value: value,
      runs: [],
      error: '',
      loading: true
    };
    renderCronPreview(targetId, key);

    return requestJson('/api/cron-preview?value=' + encodeURIComponent(value)).then(function (data) {
      if (state.cronPreviewSeq[key] !== requestSeq) {
        return;
      }
      state.cronPreview[key] = {
        value: value,
        runs: data.runs || [],
        error: '',
        loading: false
      };
      renderCronPreview(targetId, key);
    }).catch(function (error) {
      if (state.cronPreviewSeq[key] !== requestSeq) {
        return;
      }
      state.cronPreview[key] = {
        value: value,
        runs: [],
        error: error.message,
        loading: false
      };
      renderCronPreview(targetId, key);
    });
  }

  function ensureCronPreview(key, cron, targetId) {
    var value = String(cron || '').trim();
    var preview = state.cronPreview[key];
    if (!preview || preview.value !== value) {
      return loadCronPreview(key, value, targetId);
    }
    renderCronPreview(targetId, key);
    if (preview.loading || preview.error || preview.runs.length) {
      return Promise.resolve();
    }
    return loadCronPreview(key, value, targetId);
  }

  function renderOverview() {
    renderRefreshButton();
    var overview = state.overview;
    var rawConfig = getRawConfig();
    if (!overview) {
      byId('overview-basic-summary').innerHTML = ''
        + '<div class="strip-metric"><div class="mini-label">登录</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">领取</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">保活</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">双倍</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">临期</div><div class="mini-value">-</div></div>'
        + '<div class="strip-metric"><div class="mini-label">鱼吧签到</div><div class="mini-value">-</div></div>';
      byId('overview-gift-summary').innerHTML = buildOverviewGiftSummary('-', '-');
      byId('overview-fans-note').textContent = '正在加载粉丝牌状态…';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">请稍候…</div>';
      return;
    }

    byId('overview-basic-summary').innerHTML = ''
      + buildSummaryStatusCell('登录', overview.cookieSaved, '已就绪', '未配置')
      + buildSummaryStatusCell('领取', overview.collectGiftConfigured, '已开启', '未开启')
      + buildSummaryStatusCell('保活', overview.keepaliveConfigured, '已开启', '未开启')
      + buildSummaryStatusCell('双倍', overview.doubleCardConfigured, '已开启', '未开启')
      + buildSummaryStatusCell('临期', overview.expiringGiftConfigured, '已开启', '未开启')
      + buildSummaryStatusCell('鱼吧签到', overview.yubaCheckInConfigured, '已开启', '未开启');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('overview-gift-summary').innerHTML = buildOverviewGiftSummary('未配置', '未配置');
      byId('overview-fans-note').textContent = '请先保存 Cookie 或启用 CookieCloud，概况页才会显示粉丝牌列表。';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty empty-with-action">保存 Cookie 或启用 CookieCloud 后再点击顶部“刷新”，这里会直接展示粉丝牌与双倍状态。<div class="empty-action"><button class="btn btn-primary" type="button" data-action="tab" data-tab="login">前往登录</button></div></div>';
      return;
    }

    if ((state.managedLoading || state.fansStatusLoading) && !state.fansStatusLoaded) {
      byId('overview-gift-summary').innerHTML = buildOverviewGiftSummary('同步中', '同步中');
      byId('overview-fans-note').textContent = '正在同步粉丝牌状态…';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">请稍候，列表正在更新。</div>';
      return;
    }

    if (!state.fansStatusLoaded) {
      byId('overview-gift-summary').innerHTML = buildOverviewGiftSummary('待刷新', '待刷新');
      byId('overview-fans-note').textContent = '点击顶部“刷新”可重新加载粉丝牌状态。';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">尚未加载粉丝牌状态。</div>';
      return;
    }

    var detailsUpdating = state.fansStatusDetailsLoading && !state.fansStatusDetailsLoaded;
    var giftSummaryCount = detailsUpdating && !state.giftStatus
      ? '检测中'
      : (state.giftStatus && state.giftStatus.error
          ? '未知'
          : String(state.giftStatus && typeof state.giftStatus.count === 'number' ? state.giftStatus.count + ' 个' : '0 个'));
    var giftSummaryExpire = detailsUpdating && !state.giftStatus
      ? '检测中'
      : (state.giftStatus && state.giftStatus.error
          ? '未知'
          : (state.giftStatus && state.giftStatus.expireTime ? formatDate(state.giftStatus.expireTime) : '无'));

    byId('overview-gift-summary').innerHTML = buildOverviewGiftSummary(giftSummaryCount, giftSummaryExpire);

    if (!state.fansStatus.length) {
      byId('overview-fans-note').textContent = state.giftStatus && state.giftStatus.error
        ? ('当前没有可展示的粉丝牌数据。背包明细暂不可用：' + state.giftStatus.error)
        : '当前没有可展示的粉丝牌数据。';
      byId('overview-fans-table-wrap').innerHTML = '<div class="empty">当前没有可展示的粉丝牌数据。</div>';
      return;
    }

    var statusPrefix = state.managedLoading || state.fansStatusLoading ? '正在后台更新，当前显示上次结果。' : '';
    var detailText = state.fansStatusDetailsLoading && !state.fansStatusDetailsLoaded
      ? '背包与双倍状态正在补齐。'
      : '右侧已显示荧光棒库存与过期时间。';
    byId('overview-fans-note').textContent = statusPrefix + (state.giftStatus && state.giftStatus.error
      ? ('当前共 ' + state.fansStatus.length + ' 个粉丝牌房间。背包明细暂不可用：' + state.giftStatus.error)
      : ('当前共 ' + state.fansStatus.length + ' 个粉丝牌房间，' + detailText));
    byId('overview-fans-table-wrap').innerHTML = buildFansStatusTable(state.fansStatus);
  }

  function renderLogBox(targetId, logs) {
    var target = byId(targetId);
    if (!logs || !logs.length) {
      target.innerHTML = '<div class="empty">暂无日志</div>';
      return;
    }
    var html = [];
    var i;
    for (i = 0; i < logs.length; i += 1) {
      html.push(
        '<div class="log-line">'
        + '<span class="log-stamp">[' + escapeHtml(formatDate(logs[i].timestamp)) + ']</span>'
        + '<span class="log-tag">' + escapeHtml(logs[i].category) + '</span>'
        + '<span class="log-message">' + escapeHtml(logs[i].message) + '</span>'
        + '</div>'
      );
    }
    target.innerHTML = html.join('');
    target.scrollTop = target.scrollHeight;
  }

  function renderLoginPage() {
    var config = getRawConfig();
    var fansCount = state.fansStatusLoaded ? state.fansStatus.length : getManagedFans().length;
    byId('cookie-login-card').innerHTML = buildLoginStatusCard(state.overview, fansCount);
    var manualCookies = getManualCookiesConfig(config);
    byId('main-cookie-input').value = manualCookies.main || '';
    byId('yuba-cookie-input').value = manualCookies.yuba || '';
    var cookieCloud = getCookieCloudConfig(config);
    byId('cookie-cloud-enable').checked = cookieCloud.active === true;
    byId('cookie-cloud-endpoint').value = cookieCloud.endpoint || '';
    byId('cookie-cloud-uuid').value = cookieCloud.uuid || '';
    byId('cookie-cloud-cron').value = cookieCloud.cron || '0 5 0 * * *';
    byId('cookie-cloud-password').value = cookieCloud.password || '';
    void ensureCronPreview('cookieCloud', byId('cookie-cloud-cron').value, 'cookie-cloud-cron-preview');
    renderCookieCheck();
  }

  function renderCollectPage() {
    var config = getRawConfig();
    byId('collect-task-card').innerHTML = state.overview
      ? buildTaskCard(
        '领取',
        state.overview.collectGiftConfigured,
        state.overview.status.collectGift,
        '执行方式',
        state.overview.collectGiftConfigured ? '独立任务' : '等待启用'
      )
      : buildLoadingTaskCard('领取');
    byId('collect-enable').checked = isTaskActive(config.collectGift);
    byId('collect-cron').value = config.collectGift ? config.collectGift.cron : '0 10 3,5 * * *';
    void ensureCronPreview('collectGift', byId('collect-cron').value, 'collect-cron-preview');
  }

  function renderYubaPage() {
    renderRefreshButton();
    var rawConfig = getRawConfig();
    var config = rawConfig.yubaCheckIn || { active: false, cron: '0 23 0 * * *', mode: 'followed' };
    byId('yuba-task-card').innerHTML = state.overview
      ? buildTaskCard(
        '鱼吧签到',
        state.overview.yubaCheckInConfigured,
        state.overview.status.yubaCheckIn,
        '模式',
        config.mode === 'followed' ? '签到全部已关注鱼吧' : String(config.mode || '-')
      )
      : buildLoadingTaskCard('鱼吧签到');
    byId('yuba-enable').checked = isTaskActive(config);
    byId('yuba-cron').value = config.cron || '0 23 0 * * *';
    byId('yuba-mode').value = config.mode || 'followed';
    void ensureCronPreview('yubaCheckIn', byId('yuba-cron').value, 'yuba-cron-preview');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('yuba-note').textContent = '请先保存 Cookie 或启用 CookieCloud。鱼吧签到依赖当前账号的鱼吧登录态，以及主站 Cookie 中可组成 dy-token 的 acf 字段。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">保存鱼吧登录态后，这里会展示已关注鱼吧的等级、经验和签到状态。</div>';
      return;
    }

    if (String(config.mode || 'followed') !== 'followed') {
      byId('yuba-note').textContent = '当前模式无效，请重新保存鱼吧签到配置。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">当前模式无效，无法展示鱼吧状态列表。</div>';
      return;
    }

    if (state.yubaStatusLoading && !state.yubaStatusLoaded) {
      byId('yuba-note').textContent = '正在加载已关注鱼吧列表…';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">请稍候，鱼吧等级和经验列表正在更新。</div>';
      return;
    }

    if (state.yubaStatusError && !state.yubaStatusLoaded) {
      byId('yuba-note').textContent = '鱼吧列表加载失败。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">加载鱼吧列表失败：' + escapeHtml(state.yubaStatusError) + '。请点击顶部“刷新”重试。</div>';
      return;
    }

    if (!state.yubaStatusLoaded) {
      byId('yuba-note').textContent = '当前会通过 HTTP 接口拉取全部已关注鱼吧，再逐个检测签到状态并执行签到。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">正在准备加载鱼吧列表，也可以点击刷新手动加载。</div>';
      ensureYubaStatusForActiveTab();
      return;
    }

    if (!state.yubaStatus.length) {
      byId('yuba-note').textContent = '当前没有可展示的已关注鱼吧。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">当前没有可展示的已关注鱼吧数据。</div>';
      return;
    }

    byId('yuba-note').textContent = (state.yubaStatusLoading ? '正在后台更新，当前显示上次结果。' : '') + '当前已加载 ' + state.yubaStatus.length + ' 个已关注鱼吧，可直接查看等级、经验、排名和今日签到状态。';
    byId('yuba-table-wrap').innerHTML = buildYubaStatusTable(state.yubaStatus);
  }

  function renderKeepalivePage() {
    renderRefreshButton();
    var rawConfig = getRawConfig();
    var config = getManagedConfig().keepalive || rawConfig.keepalive || { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} };
    var fans = getManagedFans();
    byId('keepalive-task-card').innerHTML = state.overview
      ? buildTaskCard('保活', state.overview.keepaliveConfigured, state.overview.status.keepalive, '房间数', state.overview.keepaliveRooms)
      : buildLoadingTaskCard('保活');
    byId('keepalive-enable').checked = isTaskActive(getManagedConfig().keepalive || rawConfig.keepalive);
    byId('keepalive-cron').value = config.cron || '0 0 8 */6 * *';
    byId('keepalive-model').value = String(config.model || 2);
    void ensureCronPreview('keepalive', byId('keepalive-cron').value, 'keepalive-cron-preview');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('keepalive-note').textContent = '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成保活房间列表。';
      byId('keepalive-table-wrap').innerHTML = '<div class="empty">保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。</div>';
      return;
    }

    if (state.managedLoading && !fans.length) {
      byId('keepalive-note').textContent = '正在同步粉丝牌与保活配置…';
      byId('keepalive-table-wrap').innerHTML = '<div class="empty">请稍候…</div>';
      return;
    }

    if (!fans.length) {
      if (state.fansListError) {
        byId('keepalive-note').textContent = '粉丝牌列表加载失败。';
        byId('keepalive-table-wrap').innerHTML = '<div class="empty">加载粉丝牌列表失败：' + escapeHtml(state.fansListError) + '。请点击顶部“刷新”重试。</div>';
        return;
      }
      byId('keepalive-note').textContent = hasLoadedFansList() ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。';
      byId('keepalive-table-wrap').innerHTML = hasLoadedFansList()
        ? '<div class="empty">已同步，但当前账号没有可用粉丝牌数据。</div>'
        : '<div class="empty">正在准备加载粉丝牌列表，也可以点击刷新手动加载。</div>';
      ensureFansListForActiveTab();
      return;
    }

    byId('keepalive-note').textContent = (state.managedLoading ? '正在后台同步，当前显示上次结果。' : '') + '当前已同步 ' + fans.length + ' 个粉丝牌房间。';
    byId('keepalive-table-wrap').innerHTML = buildSendTable(fans, config, false, 'keepalive-value');
  }

  function setDoubleModeEmptyState(helpText, previewText) {
    if (byId('double-mode-help')) {
      byId('double-mode-help').textContent = helpText;
    }
    if (byId('double-ratio-preview')) {
      byId('double-ratio-preview').textContent = previewText;
    }
    if (byId('double-ratio-tools')) {
      byId('double-ratio-tools').style.display = Number(byId('double-model').value || 1) === 1 ? '' : 'none';
    }
  }

  function renderDoublePage() {
    renderRefreshButton();
    var rawConfig = getRawConfig();
    var config = getManagedConfig().doubleCard || rawConfig.doubleCard || { active: true, cron: '0 20 17,20,22,23 * * *', model: 1, giftScope: 'glowStick', send: {}, enabled: {} };
    var fans = getManagedFans();
    byId('double-task-card').innerHTML = state.overview
      ? buildTaskCard('双倍', state.overview.doubleCardConfigured, state.overview.status.doubleCard, '房间数', state.overview.doubleCardRooms)
      : buildLoadingTaskCard('双倍');
    byId('double-enable').checked = isTaskActive(getManagedConfig().doubleCard || rawConfig.doubleCard);
    byId('double-cron').value = config.cron || '0 20 17,20,22,23 * * *';
    byId('double-model').value = String(config.model || 1);
    byId('double-gift-scope').value = config.giftScope === 'limitedTime' ? 'limitedTime' : 'glowStick';
    void ensureCronPreview('doubleCard', byId('double-cron').value, 'double-cron-preview');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('double-note').textContent = '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成双倍房间列表。';
      byId('double-table-wrap').innerHTML = '<div class="empty">保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。</div>';
      setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '保存登录凭证并同步粉丝牌后，这里会显示当前权重预览。');
      return;
    }

    if (state.managedLoading && !fans.length) {
      byId('double-note').textContent = '正在同步粉丝牌与双倍配置…';
      byId('double-table-wrap').innerHTML = '<div class="empty">请稍候…</div>';
      setDoubleModeEmptyState('正在同步双倍任务配置。', '同步完成后，这里会显示当前权重预览。');
      return;
    }

    if (!fans.length) {
      var doubleFansLoaded = hasLoadedFansList();
      if (state.fansListError) {
        byId('double-note').textContent = '粉丝牌列表加载失败。';
        byId('double-table-wrap').innerHTML = '<div class="empty">加载粉丝牌列表失败：' + escapeHtml(state.fansListError) + '。请点击顶部“刷新”重试。</div>';
        setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '粉丝牌列表加载失败，刷新成功后会显示当前权重预览。');
        return;
      }
      byId('double-note').textContent = doubleFansLoaded ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。';
      byId('double-table-wrap').innerHTML = doubleFansLoaded
        ? '<div class="empty">已同步，但当前账号没有可用粉丝牌数据。</div>'
        : '<div class="empty">正在准备加载粉丝牌列表，也可以点击刷新手动加载。</div>';
      setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', doubleFansLoaded ? '当前没有可用于预览的粉丝牌房间。' : '粉丝牌列表加载后，这里会显示当前权重预览。');
      ensureFansListForActiveTab();
      return;
    }

    var enabledCount = 0;
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var roomKey = String(fans[i].roomId);
      if (config.enabled && config.enabled[roomKey]) {
        enabledCount += 1;
      }
    }
    byId('double-note').textContent = (state.managedLoading ? '正在后台同步，当前显示上次结果。' : '') + '当前已勾选 ' + enabledCount + ' / ' + fans.length + ' 个房间参与双倍。';
    byId('double-table-wrap').innerHTML = buildSendTable(fans, config, true, 'double-value');
    updateDoubleModeUi();
  }

  function renderExpiringGiftPage() {
    renderRefreshButton();
    var rawConfig = getRawConfig();
    var config = getManagedConfig().expiringGift || rawConfig.expiringGift || { active: false, cron: '0 45 23 * * *', thresholdHours: 24, model: 1, send: {} };
    var fans = getManagedFans();
    byId('expiring-task-card').innerHTML = state.overview
      ? buildTaskCard(
        '临期',
        state.overview.expiringGiftConfigured,
        state.overview.status.expiringGift,
        '阈值',
        String(config.thresholdHours || 24) + ' 小时'
      )
      : buildLoadingTaskCard('临期');
    byId('expiring-enable').checked = isTaskActive(getManagedConfig().expiringGift || rawConfig.expiringGift);
    byId('expiring-cron').value = config.cron || '0 45 23 * * *';
    byId('expiring-threshold-hours').value = String(config.thresholdHours || 24);
    byId('expiring-model').value = String(config.model || 1);
    void ensureCronPreview('expiringGift', byId('expiring-cron').value, 'expiring-cron-preview');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('expiring-note').textContent = '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也无法读取背包礼物和过期时间。';
      byId('expiring-backpack-wrap').innerHTML = '<div class="empty">保存 Cookie 或启用 CookieCloud 后，这里会展示背包临期明细。</div>';
      byId('expiring-table-wrap').innerHTML = '<div class="empty">保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现临期赠送房间列表。</div>';
      return;
    }

    if (state.managedLoading && !fans.length) {
      byId('expiring-note').textContent = '正在同步粉丝牌与临期配置…';
      byId('expiring-backpack-wrap').innerHTML = '<div class="empty">请稍候，背包明细会在同步后展示。</div>';
      byId('expiring-table-wrap').innerHTML = '<div class="empty">请稍候…</div>';
      return;
    }

    if (!fans.length) {
      var expiringFansLoaded = state.fansStatusLoaded || hasLoadedFansList();
      byId('expiring-note').textContent = expiringFansLoaded ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。';
      byId('expiring-backpack-wrap').innerHTML = buildBackpackRowsTable(state.giftStatus);
      byId('expiring-table-wrap').innerHTML = expiringFansLoaded
        ? '<div class="empty">已同步，但当前账号没有可用粉丝牌数据。</div>'
        : '<div class="empty">正在准备加载粉丝牌列表，也可以点击刷新手动加载。</div>';
      return;
    }

    byId('expiring-note').textContent = (state.managedLoading || state.fansStatusLoading ? '正在后台更新，当前显示上次结果。' : '') + '当前已同步 ' + fans.length + ' 个粉丝牌房间。临期任务会按背包行筛选进入阈值且有明确过期时间的礼物，并按房间配置释放。';
    byId('expiring-backpack-wrap').innerHTML = buildBackpackRowsTable(state.giftStatus);
    byId('expiring-table-wrap').innerHTML = buildSendTable(fans, config, false, 'expiring-value', { firstWeightOnly: true });
  }

  function updateDoubleTableHeaderLabel(model) {
    var header = document.querySelector('#double-table-wrap thead th:last-child');
    if (!header) {
      return;
    }
    header.textContent = model === 2 ? '数量' : '权重值';
  }

  function getDoubleFormSnapshot() {
    var fans = getManagedFans();
    var model = Number(byId('double-model').value || 1);
    var entries = [];
    var i;

    for (i = 0; i < fans.length; i += 1) {
      var fan = fans[i];
      var roomId = String(fan.roomId);
      var enabledNode = document.querySelector('.double-enabled[data-room-id="' + roomId + '"]');
      var inputNode = document.querySelector('.double-value[data-room-id="' + roomId + '"]');
      var rawValue = inputNode ? Number(inputNode.value) : 0;
      entries.push({
        fan: fan,
        roomId: roomId,
        enabled: Boolean(enabledNode && enabledNode.checked),
        value: Number.isFinite(rawValue) ? rawValue : 0
      });
    }

    return {
      model: model,
      entries: entries
    };
  }

  function updateDoubleModeUi() {
    var helpNode = byId('double-mode-help');
    var previewNode = byId('double-ratio-preview');
    var toolsNode = byId('double-ratio-tools');
    if (!helpNode || !previewNode || !toolsNode) {
      return;
    }

    var snapshot = getDoubleFormSnapshot();
    var enabledEntries = snapshot.entries.filter(function (entry) {
      return entry.enabled;
    });

    updateDoubleTableHeaderLabel(snapshot.model);

    if (snapshot.model === 2) {
      helpNode.textContent = '按固定数量时，会只在当前开双倍的房间里使用你填写的数量。没有房间开双倍时本次不送；只有 1 个房间开双倍时本次全部送给它。';
      previewNode.textContent = '固定数量模式保留现有行为。如果你想平均分配，切回“按权重”后点击“参与房间全部设为 1”即可。';
      toolsNode.style.display = 'none';
      return;
    }

    toolsNode.style.display = '';
    helpNode.textContent = '按权重模式不要求总和等于 100。多个房间同时开双倍时，只会在这些房间里按权重值重新分配。';

    if (!enabledEntries.length) {
      previewNode.textContent = '当前还没有勾选参与双倍的房间。';
      return;
    }

    var positiveEntries = enabledEntries.filter(function (entry) {
      return entry.value > 0;
    });
    if (!positiveEntries.length) {
      previewNode.textContent = '当前已勾选房间的权重值全是 0。至少给一个已勾选房间填写大于 0 的权重值。';
      return;
    }

    var totalWeight = positiveEntries.reduce(function (sum, entry) {
      return sum + entry.value;
    }, 0);
    var ratioText = positiveEntries.map(function (entry) {
      return entry.fan.name + '(' + entry.value + ')';
    }).join(' / ');
    var percentText = positiveEntries.map(function (entry) {
      return entry.fan.name + ' ' + formatRatioPercent((entry.value / totalWeight) * 100);
    }).join(' / ');

    previewNode.innerHTML = '当前权重：' + escapeHtml(ratioText) + '<br>折算占比：' + escapeHtml(percentText);
  }

  function applyDoubleRatioPreset(preset) {
    if (Number(byId('double-model').value || 1) !== 1) {
      toast('当前不是按权重模式', false);
      return;
    }

    var inputs = document.querySelectorAll('.double-value');
    var updated = 0;
    var i;
    for (i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      var roomId = String(input.getAttribute('data-room-id'));
      var checkbox = document.querySelector('.double-enabled[data-room-id="' + roomId + '"]');
      if (!checkbox || !checkbox.checked) {
        continue;
      }
      input.value = preset === 'level'
        ? String(Math.max(Number(input.getAttribute('data-level') || 1), 1))
        : '1';
      updated += 1;
    }

    if (updated === 0) {
      toast('请先勾选参与双倍的房间', false);
      return;
    }

    updateDoubleModeUi();
    toast(preset === 'level' ? '已按粉丝牌等级填入权重值' : '已将参与房间全部设为 1', true);
  }

  function renderLogsPage() {
    var refreshedAt = state.logsRefreshedAt ? formatDate(state.logsRefreshedAt) : '尚未刷新';
    byId('logs-summary').textContent = '当前 ' + (state.logs ? state.logs.length : 0) + ' 条日志，仅保留最近 500 条。最近刷新：' + refreshedAt;
    renderLogBox('full-log-box', state.logs || []);
  }

  function renderTheme() {
    var config = getRawConfig();
    var mode = 'system';
    if (config.ui && isThemeMode(config.ui.themeMode)) {
      mode = config.ui.themeMode;
    }
    state.themeMode = mode;
    setThemeButtonState(mode);
    var resolved = mode === 'system' ? (getSystemPrefersDark() ? 'dark' : 'light') : mode;
    document.body.setAttribute('data-theme', resolved);
    setThemeMeta(resolved);
    byId('theme-note').textContent = mode === 'system'
      ? '当前跟随系统，系统为 ' + (getSystemPrefersDark() ? '深色' : '浅色')
      : '当前固定为 ' + (mode === 'dark' ? '深色' : '浅色') + ' 模式';
  }

  function renderAll() {
    renderTheme();
    renderOverview();
    renderLoginPage();
    renderCollectPage();
    renderYubaPage();
    renderKeepalivePage();
    renderDoublePage();
    renderExpiringGiftPage();
    renderLogsPage();
  }

  function renderActiveTabPage() {
    if (state.activeTab === 'overview') {
      renderOverview();
    } else if (state.activeTab === 'login') {
      renderLoginPage();
    } else if (state.activeTab === 'collect') {
      renderCollectPage();
    } else if (state.activeTab === 'yuba') {
      renderYubaPage();
    } else if (state.activeTab === 'keepalive') {
      renderKeepalivePage();
    } else if (state.activeTab === 'double-card') {
      renderDoublePage();
    } else if (state.activeTab === 'expiring-gift') {
      renderExpiringGiftPage();
    } else if (state.activeTab === 'logs') {
      renderLogsPage();
    }
  }


    return {
      renderCookieCheck: renderCookieCheck,
      renderCronPreview: renderCronPreview,
      loadCronPreview: loadCronPreview,
      ensureCronPreview: ensureCronPreview,
      renderOverview: renderOverview,
      renderLogBox: renderLogBox,
      renderLoginPage: renderLoginPage,
      renderCollectPage: renderCollectPage,
      renderYubaPage: renderYubaPage,
      renderKeepalivePage: renderKeepalivePage,
      setDoubleModeEmptyState: setDoubleModeEmptyState,
      renderDoublePage: renderDoublePage,
      renderExpiringGiftPage: renderExpiringGiftPage,
      updateDoubleModeUi: updateDoubleModeUi,
      applyDoubleRatioPreset: applyDoubleRatioPreset,
      renderLogsPage: renderLogsPage,
      renderTheme: renderTheme,
      renderAll: renderAll,
      renderActiveTabPage: renderActiveTabPage
    };
  }

  window.DOUYU_KEEP_WEBUI_PAGES = {
    create: createPageRenderers
  };
})();
