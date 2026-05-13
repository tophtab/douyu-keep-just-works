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
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:yuba-page', {
        detail: {
          rawConfig: getRawConfig(),
          overview: state.overview,
          yubaStatus: state.yubaStatus,
          yubaStatusError: state.yubaStatusError,
          yubaStatusLoaded: state.yubaStatusLoaded,
          yubaStatusLoading: state.yubaStatusLoading
        }
      }));
      ensureYubaStatusForActiveTab();
    }

    function renderKeepalivePage() {
      renderRefreshButton();
      var rawConfig = getRawConfig();
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:keepalive-page', {
        detail: {
          rawConfig: rawConfig,
          managedConfig: getManagedConfig(),
          overview: state.overview,
          fans: getManagedFans(),
          managedLoading: state.managedLoading,
          fansListError: state.fansListError,
          fansListLoaded: hasLoadedFansList()
        }
      }));
      ensureFansListForActiveTab();
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
