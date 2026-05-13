(function () {
  function createPageRenderers(deps) {
    var state = deps.state;
    var getRawConfig = deps.getRawConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var getManagedFans = deps.getManagedFans;
    var renderRefreshButton = deps.renderRefreshButton;

    var TASK_PAGE_RENDERERS = window.DOUYU_KEEP_WEBUI_TASK_PAGES.create({
      state: state,
      getRawConfig: getRawConfig,
      hasCookieSourceConfigured: hasCookieSourceConfigured,
      getManagedConfig: deps.getManagedConfig,
      getManagedFans: getManagedFans,
      renderRefreshButton: renderRefreshButton,
      hasLoadedFansList: deps.hasLoadedFansList,
      ensureFansListForActiveTab: deps.ensureFansListForActiveTab,
      ensureYubaStatusForActiveTab: deps.ensureYubaStatusForActiveTab
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
