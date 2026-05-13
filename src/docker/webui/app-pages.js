(function () {
  function createPageRenderers(deps) {
    var byId = deps.byId;
    var escapeHtml = deps.escapeHtml;
    var formatDate = deps.formatDate;
    var state = deps.state;
    var getRawConfig = deps.getRawConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var getManagedFans = deps.getManagedFans;
    var renderRefreshButton = deps.renderRefreshButton;

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
  var renderDoublePage = TASK_PAGE_RENDERERS.renderDoublePage;
  var renderExpiringGiftPage = TASK_PAGE_RENDERERS.renderExpiringGiftPage;

    function renderCookieCheck() {
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:login-page', {
        detail: {
          cookieCheck: state.cookieCheck
        }
      }));
    }

    function renderOverview() {
      renderRefreshButton();
      var overview = state.overview;
      var rawConfig = getRawConfig();
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:overview-page', {
        detail: {
          fansStatus: state.fansStatus,
          fansStatusDetailsLoaded: state.fansStatusDetailsLoaded,
          fansStatusDetailsLoading: state.fansStatusDetailsLoading,
          fansStatusLoaded: state.fansStatusLoaded,
          fansStatusLoading: state.fansStatusLoading,
          giftStatus: state.giftStatus,
          hasCookieSourceConfigured: hasCookieSourceConfigured(rawConfig),
          managedLoading: state.managedLoading,
          overview: overview
        }
      }));
    }

    function renderLoginPage() {
      var config = getRawConfig();
      var fansCount = state.fansStatusLoaded ? state.fansStatus.length : getManagedFans().length;
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:login-page', {
        detail: {
          rawConfig: config,
          overview: state.overview,
          fansCount: fansCount,
          cookieCheck: state.cookieCheck
        }
      }));
    }

    function renderLogsPage() {
    }

    function renderAll() {
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
      renderLoginPage: renderLoginPage,
      renderCollectPage: renderCollectPage,
      renderYubaPage: renderYubaPage,
      renderKeepalivePage: renderKeepalivePage,
      renderDoublePage: renderDoublePage,
      renderExpiringGiftPage: renderExpiringGiftPage,
      renderLogsPage: renderLogsPage,
      renderAll: renderAll,
      renderActiveTabPage: renderActiveTabPage
    };
  }

  window.DOUYU_KEEP_WEBUI_PAGES = {
    create: createPageRenderers
  };
})();
