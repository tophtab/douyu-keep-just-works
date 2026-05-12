(function () {
  function createActions(deps) {
    var byId = deps.byId;
    var state = deps.state;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var getRawConfig = deps.getRawConfig;
    var getCookieCloudConfig = deps.getCookieCloudConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var clearCookieBackedData = deps.clearCookieBackedData;
    var nextAuthRequestSeq = deps.nextAuthRequestSeq;
    var isLatestAuthRequest = deps.isLatestAuthRequest;
    var handleUnauthorized = deps.handleUnauthorized;
    var renderAuth = deps.renderAuth;
    var renderAll = deps.renderAll;
    var renderLoginPage = deps.renderLoginPage;
    var renderCookieCheck = deps.renderCookieCheck;
    var renderKeepalivePage = deps.renderKeepalivePage;
    var renderDoublePage = deps.renderDoublePage;
    var renderExpiringGiftPage = deps.renderExpiringGiftPage;
    var renderTheme = deps.renderTheme;
    var setActiveTab = deps.setActiveTab;
    var isThemeMode = deps.isThemeMode;

    var RESOURCE_ACTIONS = window.DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS.create({
      state: state,
      toast: toast,
      requestJson: requestJson,
      isUnauthorizedError: isUnauthorizedError,
      defaultRawConfig: deps.defaultRawConfig,
      getRawConfig: getRawConfig,
      hasCookieSourceConfigured: hasCookieSourceConfigured,
      setManagedFans: deps.setManagedFans,
      markResourceLoaded: deps.markResourceLoaded,
      invalidateResourceRequest: deps.invalidateResourceRequest,
      invalidateResourceRequests: deps.invalidateResourceRequests,
      getResourceRequest: deps.getResourceRequest,
      trackResourceRequest: deps.trackResourceRequest,
      applyFansStatusBase: deps.applyFansStatusBase,
      applyFansStatusDetails: deps.applyFansStatusDetails,
      renderAll: renderAll,
      renderOverview: deps.renderOverview,
      renderLogsPage: deps.renderLogsPage,
      renderExpiringGiftPage: renderExpiringGiftPage,
      renderYubaPage: deps.renderYubaPage
    });
    var loadRawConfig = RESOURCE_ACTIONS.loadRawConfig;
    var loadOverview = RESOURCE_ACTIONS.loadOverview;
    var loadLogs = RESOURCE_ACTIONS.loadLogs;
    var syncFans = RESOURCE_ACTIONS.syncFans;
    var loadFansList = RESOURCE_ACTIONS.loadFansList;
    var loadFansStatus = RESOURCE_ACTIONS.loadFansStatus;
    var loadYubaStatus = RESOURCE_ACTIONS.loadYubaStatus;
    var refreshOverviewSurface = RESOURCE_ACTIONS.refreshOverviewSurface;

    function loadProtectedData() {
      return Promise.all([
        loadRawConfig(),
        loadOverview(),
        loadLogs()
      ]).then(function () {
        return syncCookieCloudToLoginCookies(false);
      }).then(function () {
        var rawConfig = getRawConfig();
        if (hasCookieSourceConfigured(rawConfig)) {
          var reloads = [];
          if (state.activeTab === 'overview' || state.activeTab === 'expiring-gift') {
            reloads.push(loadFansStatus(false));
          }
          if (state.activeTab === 'keepalive' || state.activeTab === 'double-card') {
            reloads.push(loadFansList(false));
          }
          if (state.activeTab === 'yuba') {
            reloads.push(loadYubaStatus(false));
          }
          if (reloads.length) {
            return Promise.all(reloads);
          }
        }

        renderAll();
        return Promise.resolve();
      }).then(function () {
        setActiveTab(state.activeTab, { replacePath: true });
      });
    }

    var AUTH_ACTIONS = window.DOUYU_KEEP_WEBUI_AUTH_ACTIONS.create({
      byId: byId,
      state: state,
      toast: toast,
      requestJson: requestJson,
      nextAuthRequestSeq: nextAuthRequestSeq,
      isLatestAuthRequest: isLatestAuthRequest,
      clearProtectedState: deps.clearProtectedState,
      handleUnauthorized: handleUnauthorized,
      renderAuth: renderAuth,
      loadProtectedData: loadProtectedData
    });
    var loadAuthStatus = AUTH_ACTIONS.loadAuthStatus;
    var loginWithPassword = AUTH_ACTIONS.loginWithPassword;
    var submitLogin = AUTH_ACTIONS.submitLogin;
    var logout = AUTH_ACTIONS.logout;

    var COOKIE_ACTIONS = window.DOUYU_KEEP_WEBUI_COOKIE_ACTIONS.create({
      byId: byId,
      state: state,
      toast: toast,
      requestJson: requestJson,
      isUnauthorizedError: isUnauthorizedError,
      getRawConfig: getRawConfig,
      getCookieCloudConfig: getCookieCloudConfig,
      clearCookieBackedData: clearCookieBackedData,
      renderLoginPage: renderLoginPage,
      renderCookieCheck: renderCookieCheck,
      refreshOverviewSurface: refreshOverviewSurface
    });
    var syncCookieCloudToLoginCookies = COOKIE_ACTIONS.syncCookieCloudToLoginCookies;
    var saveCookie = COOKIE_ACTIONS.saveCookie;
    var saveCookieCloud = COOKIE_ACTIONS.saveCookieCloud;
    var checkCookieSource = COOKIE_ACTIONS.checkCookieSource;
    var saveCookieCloudToggle = COOKIE_ACTIONS.saveCookieCloudToggle;
    var saveAndEnableCookieCloud = COOKIE_ACTIONS.saveAndEnableCookieCloud;
    var disableCookieCloud = COOKIE_ACTIONS.disableCookieCloud;

    function triggerTask(type) {
      requestJson('/api/trigger/' + type, {
        method: 'POST'
      }).then(function () {
        toast('执行完成', true);
        var reloads = [
          loadOverview(),
          loadLogs()
        ];
        if (state.activeTab === 'overview' || type === 'collectGift' || type === 'keepalive' || type === 'doubleCard' || type === 'expiringGift') {
          reloads.push(loadFansStatus(false));
        }
        if (state.activeTab === 'yuba' || type === 'yubaCheckIn') {
          reloads.push(loadYubaStatus(false));
        }
        Promise.all(reloads).then(function () {
          if (state.activeTab === 'keepalive') {
            renderKeepalivePage();
          }
          if (state.activeTab === 'double-card') {
            renderDoublePage();
          }
          if (state.activeTab === 'expiring-gift') {
            renderExpiringGiftPage();
          }
        });
      }).catch(function (error) {
        if (isUnauthorizedError(error)) {
          return;
        }
        toast('执行失败：' + error.message, false);
      });
    }

    function clearLogs() {
      requestJson('/api/logs', {
        method: 'DELETE'
      }).then(function () {
        toast('日志已清空', true);
        loadLogs();
        loadOverview();
      }).catch(function (error) {
        if (isUnauthorizedError(error)) {
          return;
        }
        toast('清空日志失败：' + error.message, false);
      });
    }

    function saveTheme(mode) {
      if (!isThemeMode(mode)) {
        return;
      }
      requestJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui: { themeMode: mode } })
      }).then(function () {
        var config = getRawConfig();
        if (!config.ui) {
          config.ui = {};
        }
        config.ui.themeMode = mode;
        state.rawConfig = config;
        renderTheme();
      }).catch(function (error) {
        if (isUnauthorizedError(error)) {
          return;
        }
        toast('保存主题失败：' + error.message, false);
      });
    }

    return {
      syncCookieCloudToLoginCookies: syncCookieCloudToLoginCookies,
      loadProtectedData: loadProtectedData,
      loadAuthStatus: loadAuthStatus,
      loginWithPassword: loginWithPassword,
      submitLogin: submitLogin,
      logout: logout,
      loadRawConfig: loadRawConfig,
      loadOverview: loadOverview,
      loadLogs: loadLogs,
      syncFans: syncFans,
      loadFansList: loadFansList,
      loadFansStatus: loadFansStatus,
      loadYubaStatus: loadYubaStatus,
      refreshOverviewSurface: refreshOverviewSurface,
      saveCookie: saveCookie,
      saveCookieCloud: saveCookieCloud,
      checkCookieSource: checkCookieSource,
      saveCookieCloudToggle: saveCookieCloudToggle,
      saveAndEnableCookieCloud: saveAndEnableCookieCloud,
      disableCookieCloud: disableCookieCloud,
      triggerTask: triggerTask,
      clearLogs: clearLogs,
      saveTheme: saveTheme
    };
  }

  window.DOUYU_KEEP_WEBUI_ACTIONS = {
    create: createActions
  };
})();
