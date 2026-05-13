(function () {
  function createTaskPageRenderers(deps) {
    var byId = deps.byId;
    var escapeHtml = deps.escapeHtml;
    var state = deps.state;
    var getRawConfig = deps.getRawConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var getManagedConfig = deps.getManagedConfig;
    var getManagedFans = deps.getManagedFans;
    var isTaskActive = deps.isTaskActive;
    var renderRefreshButton = deps.renderRefreshButton;
    var hasLoadedFansList = deps.hasLoadedFansList;
    var ensureFansListForActiveTab = deps.ensureFansListForActiveTab;
    var ensureYubaStatusForActiveTab = deps.ensureYubaStatusForActiveTab;
    var ensureCronPreview = deps.ensureCronPreview;
    var buildTaskCard = deps.buildTaskCard;
    var buildLoadingTaskCard = deps.buildLoadingTaskCard;
    var buildYubaStatusTable = deps.buildYubaStatusTable;
    var buildBackpackRowsTable = deps.buildBackpackRowsTable;
    var buildSendTable = deps.buildSendTable;

    var DOUBLE_PAGE = window.DOUYU_KEEP_WEBUI_DOUBLE_TASK_PAGE.create(deps);
    var setDoubleModeEmptyState = DOUBLE_PAGE.setDoubleModeEmptyState;
    var renderDoublePage = DOUBLE_PAGE.renderDoublePage;
    var updateDoubleModeUi = DOUBLE_PAGE.updateDoubleModeUi;
    var applyDoubleRatioPreset = DOUBLE_PAGE.applyDoubleRatioPreset;

    function renderCollectPage() {
      var config = getRawConfig();
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:collect-page', {
        detail: {
          rawConfig: config,
          overview: state.overview
        }
      }));
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

    return {
      renderCollectPage: renderCollectPage,
      renderYubaPage: renderYubaPage,
      renderKeepalivePage: renderKeepalivePage,
      setDoubleModeEmptyState: setDoubleModeEmptyState,
      renderDoublePage: renderDoublePage,
      renderExpiringGiftPage: renderExpiringGiftPage,
      updateDoubleModeUi: updateDoubleModeUi,
      applyDoubleRatioPreset: applyDoubleRatioPreset
    };
  }

  window.DOUYU_KEEP_WEBUI_TASK_PAGES = {
    create: createTaskPageRenderers
  };
})();
