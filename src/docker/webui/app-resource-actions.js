(function () {
  function createResourceActions(deps) {
    var state = deps.state;
    var toast = deps.toast;
    var getRawConfig = deps.getRawConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var invalidateResourceRequests = deps.invalidateResourceRequests;
    var renderAll = deps.renderAll;

    var SYSTEM_ACTIONS = window.DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS.create(deps);
    var FANS_ACTIONS = window.DOUYU_KEEP_WEBUI_FANS_RESOURCE_ACTIONS.create(deps);
    var YUBA_ACTIONS = window.DOUYU_KEEP_WEBUI_YUBA_RESOURCE_ACTIONS.create(deps);
    var loadRawConfig = SYSTEM_ACTIONS.loadRawConfig;
    var loadOverview = SYSTEM_ACTIONS.loadOverview;
    var loadLogs = SYSTEM_ACTIONS.loadLogs;
    var syncFans = FANS_ACTIONS.syncFans;
    var loadFansList = FANS_ACTIONS.loadFansList;
    var loadFansStatus = FANS_ACTIONS.loadFansStatus;
    var loadYubaStatus = YUBA_ACTIONS.loadYubaStatus;

    function refreshOverviewSurface(showToast) {
      return loadRawConfig().then(function () {
        if (!state.auth.authenticated) {
          return;
        }
        var rawConfig = getRawConfig();
        if (!hasCookieSourceConfigured(rawConfig)) {
          invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus', 'yubaStatus']);
          state.managed = null;
          state.fansStatus = [];
          state.giftStatus = null;
          state.managedLoading = false;
          state.fansStatusLoading = false;
          state.fansStatusLoaded = false;
          state.fansStatusDetailsLoaded = false;
          state.fansStatusDetailsLoading = false;
          state.yubaStatus = [];
          state.yubaStatusLoaded = false;
          state.yubaStatusLoading = false;
          renderAll();
          return loadOverview().then(function () {
            if (showToast) {
              toast('状态已刷新', true);
            }
          });
        }

        var reloads = [
          loadOverview()
        ];
        if (state.activeTab === 'overview' || state.activeTab === 'expiring-gift') {
          reloads.push(loadFansStatus(false));
        } else if (state.activeTab === 'keepalive' || state.activeTab === 'double-card') {
          reloads.push(loadFansList(false));
        } else if (state.activeTab === 'yuba') {
          reloads.push(loadYubaStatus(false));
        } else if (state.activeTab === 'logs') {
          reloads.push(loadLogs());
        }

        return Promise.all(reloads).then(function () {
          if (showToast) {
            toast('状态已刷新', true);
          }
        });
      });
    }

    return {
      loadRawConfig: loadRawConfig,
      loadOverview: loadOverview,
      loadLogs: loadLogs,
      syncFans: syncFans,
      loadFansList: loadFansList,
      loadFansStatus: loadFansStatus,
      loadYubaStatus: loadYubaStatus,
      refreshOverviewSurface: refreshOverviewSurface
    };
  }

  window.DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS = {
    create: createResourceActions
  };
})();
