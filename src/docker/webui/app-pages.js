(function () {
  function createPageRenderers(deps) {
    var byId = deps.byId;
    var escapeHtml = deps.escapeHtml;
    var formatDate = deps.formatDate;
    var state = deps.state;
    var buildCookieCheckText = deps.buildCookieCheckText;
    var getRawConfig = deps.getRawConfig;
    var getCookieCloudConfig = deps.getCookieCloudConfig;
    var getManualCookiesConfig = deps.getManualCookiesConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var getManagedFans = deps.getManagedFans;
    var renderRefreshButton = deps.renderRefreshButton;
    var loadLogs = deps.loadLogs;
    var buildOverviewGiftSummary = deps.buildOverviewGiftSummary;
    var buildSummaryStatusCell = deps.buildSummaryStatusCell;
    var buildFansStatusTable = deps.buildFansStatusTable;
    var buildLoginStatusCard = deps.buildLoginStatusCard;
    var getSystemPrefersDark = deps.getSystemPrefersDark;
    var setThemeMeta = deps.setThemeMeta;
    var setThemeButtonState = deps.setThemeButtonState;
    var isThemeMode = deps.isThemeMode;

    var CRON_RENDERERS = window.DOUYU_KEEP_WEBUI_PAGE_CRON.create({
      byId: byId,
      formatDate: formatDate,
      state: state,
      createEmptyCronPreview: deps.createEmptyCronPreview,
      requestJson: deps.requestJson
    });
    var renderCronPreview = CRON_RENDERERS.renderCronPreview;
    var loadCronPreview = CRON_RENDERERS.loadCronPreview;
    var ensureCronPreview = CRON_RENDERERS.ensureCronPreview;

    var TASK_PAGE_RENDERERS = window.DOUYU_KEEP_WEBUI_TASK_PAGES.create({
      byId: byId,
      escapeHtml: escapeHtml,
      toast: deps.toast,
      state: state,
      getRawConfig: getRawConfig,
      hasCookieSourceConfigured: hasCookieSourceConfigured,
      getManagedConfig: deps.getManagedConfig,
      getManagedFans: getManagedFans,
      isTaskActive: deps.isTaskActive,
      renderRefreshButton: renderRefreshButton,
      hasLoadedFansList: deps.hasLoadedFansList,
      ensureFansListForActiveTab: deps.ensureFansListForActiveTab,
      ensureYubaStatusForActiveTab: deps.ensureYubaStatusForActiveTab,
      ensureCronPreview: ensureCronPreview,
      buildTaskCard: deps.buildTaskCard,
      buildLoadingTaskCard: deps.buildLoadingTaskCard,
      buildYubaStatusTable: deps.buildYubaStatusTable,
      buildBackpackRowsTable: deps.buildBackpackRowsTable,
      buildSendTable: deps.buildSendTable,
      formatRatioPercent: deps.formatRatioPercent
    });
    var renderCollectPage = TASK_PAGE_RENDERERS.renderCollectPage;
    var renderYubaPage = TASK_PAGE_RENDERERS.renderYubaPage;
    var renderKeepalivePage = TASK_PAGE_RENDERERS.renderKeepalivePage;
    var setDoubleModeEmptyState = TASK_PAGE_RENDERERS.setDoubleModeEmptyState;
    var renderDoublePage = TASK_PAGE_RENDERERS.renderDoublePage;
    var renderExpiringGiftPage = TASK_PAGE_RENDERERS.renderExpiringGiftPage;
    var updateDoubleModeUi = TASK_PAGE_RENDERERS.updateDoubleModeUi;
    var applyDoubleRatioPreset = TASK_PAGE_RENDERERS.applyDoubleRatioPreset;

    function renderCookieCheck() {
      var note = byId('cookie-cloud-note');
      if (!note) {
        return;
      }
      note.textContent = buildCookieCheckText(state.cookieCheck);
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
