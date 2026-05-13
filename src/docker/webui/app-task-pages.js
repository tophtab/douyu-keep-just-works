(function () {
  function createTaskPageRenderers(deps) {
    var state = deps.state;
    var getRawConfig = deps.getRawConfig;
    var getManagedConfig = deps.getManagedConfig;
    var getManagedFans = deps.getManagedFans;
    var renderRefreshButton = deps.renderRefreshButton;
    var hasLoadedFansList = deps.hasLoadedFansList;
    var ensureFansListForActiveTab = deps.ensureFansListForActiveTab;
    var ensureYubaStatusForActiveTab = deps.ensureYubaStatusForActiveTab;

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

    function renderDoublePage() {
      renderRefreshButton();
      var rawConfig = getRawConfig();
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:double-page', {
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
      document.dispatchEvent(new CustomEvent('douyu-keep-webui:expiring-page', {
        detail: {
          rawConfig: rawConfig,
          managedConfig: getManagedConfig(),
          overview: state.overview,
          fans: getManagedFans(),
          fansListError: state.fansListError,
          fansListLoaded: hasLoadedFansList(),
          fansStatusLoaded: state.fansStatusLoaded,
          fansStatusLoading: state.fansStatusLoading,
          fansStatusDetailsLoading: state.fansStatusDetailsLoading,
          giftStatus: state.giftStatus,
          managedLoading: state.managedLoading
        }
      }));
    }

    return {
      renderCollectPage: renderCollectPage,
      renderYubaPage: renderYubaPage,
      renderKeepalivePage: renderKeepalivePage,
      renderDoublePage: renderDoublePage,
      renderExpiringGiftPage: renderExpiringGiftPage,
    };
  }

  window.DOUYU_KEEP_WEBUI_TASK_PAGES = {
    create: createTaskPageRenderers
  };
})();
