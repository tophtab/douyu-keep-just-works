(function () {
  function createEventBindings(deps) {
    var byId = deps.byId;
    var state = deps.state;
    var consumeWebPasswordFromUrl = deps.consumeWebPasswordFromUrl;
    var renderAuth = deps.renderAuth;
    var setActiveTab = deps.setActiveTab;
    var handleVueNavigation = deps.handleVueNavigation;
    var refreshOverviewSurface = deps.refreshOverviewSurface;
    var logout = deps.logout;
    var loadLogs = deps.loadLogs;
    var clearLogs = deps.clearLogs;
    var saveCookie = deps.saveCookie;
    var saveAndEnableCookieCloud = deps.saveAndEnableCookieCloud;
    var checkCookieSource = deps.checkCookieSource;
    var saveCollectConfig = deps.saveCollectConfig;
    var saveYubaConfig = deps.saveYubaConfig;
    var saveKeepaliveConfig = deps.saveKeepaliveConfig;
    var saveDoubleConfig = deps.saveDoubleConfig;
    var saveExpiringGiftConfig = deps.saveExpiringGiftConfig;
    var applyDoubleRatioPreset = deps.applyDoubleRatioPreset;
    var triggerTask = deps.triggerTask;
    var submitLogin = deps.submitLogin;
    var loadCronPreview = deps.loadCronPreview;
    var saveCookieCloudToggle = deps.saveCookieCloudToggle;
    var disableCookieCloud = deps.disableCookieCloud;
    var disableCollectConfig = deps.disableCollectConfig;
    var disableYubaConfig = deps.disableYubaConfig;
    var disableKeepaliveConfig = deps.disableKeepaliveConfig;
    var disableDoubleConfig = deps.disableDoubleConfig;
    var disableExpiringGiftConfig = deps.disableExpiringGiftConfig;
    var buildBackpackRowsTable = deps.buildBackpackRowsTable;
    var updateDoubleModeUi = deps.updateDoubleModeUi;
    var loadOverview = deps.loadOverview;
    var loginWithPassword = deps.loginWithPassword;
    var loadAuthStatus = deps.loadAuthStatus;
    var loadProtectedData = deps.loadProtectedData;

    function findActionTarget(node) {
      var current = node;
      while (current && current !== document.body) {
        if (current.getAttribute && current.getAttribute('data-action')) {
          return current;
        }
        current = current.parentNode;
      }
      return null;
    }

    function handleActionClick(event) {
      var target = findActionTarget(event.target);
      if (!target) {
        return;
      }

      var action = target.getAttribute('data-action');
      if (action === 'refresh-overview') {
        refreshOverviewSurface(true);
        return;
      }
      if (action === 'logout') {
        logout();
        return;
      }
      if (action === 'refresh-logs') {
        loadLogs();
        return;
      }
      if (action === 'clear-logs') {
        clearLogs();
        return;
      }
      if (action === 'save-cookie') {
        saveCookie();
        return;
      }
      if (action === 'save-cookie-cloud') {
        saveAndEnableCookieCloud();
        return;
      }
      if (action === 'check-cookie-source') {
        checkCookieSource();
        return;
      }
      if (action === 'save-collect') {
        saveCollectConfig();
        return;
      }
      if (action === 'save-yuba') {
        saveYubaConfig();
        return;
      }
      if (action === 'save-keepalive') {
        saveKeepaliveConfig();
        return;
      }
      if (action === 'save-double') {
        saveDoubleConfig();
        return;
      }
      if (action === 'save-expiring') {
        saveExpiringGiftConfig();
        return;
      }
      if (action === 'double-fill-equal') {
        applyDoubleRatioPreset('equal');
        return;
      }
      if (action === 'double-fill-level') {
        applyDoubleRatioPreset('level');
        return;
      }
      if (action === 'trigger') {
        triggerTask(target.getAttribute('data-trigger'));
      }
    }

    function handleTaskToggleChange(event, enableTask, disableTask) {
      if (event.target.checked) {
        enableTask({ revertCheckboxOnError: true });
        return;
      }
      disableTask();
    }

    function bindStaticEvents() {
      document.addEventListener('click', handleActionClick);
      document.addEventListener('douyu-keep-webui:navigation', handleVueNavigation);

      byId('login-form').addEventListener('submit', function (event) {
        event.preventDefault();
        submitLogin();
      });
      byId('collect-cron').addEventListener('input', function (event) {
        void loadCronPreview('collectGift', event.target.value, 'collect-cron-preview');
      });
      byId('collect-enable').addEventListener('change', function (event) {
        handleTaskToggleChange(event, saveCollectConfig, disableCollectConfig);
      });
      byId('cookie-cloud-cron').addEventListener('input', function (event) {
        void loadCronPreview('cookieCloud', event.target.value, 'cookie-cloud-cron-preview');
      });
      byId('cookie-cloud-enable').addEventListener('change', function (event) {
        handleTaskToggleChange(event, saveCookieCloudToggle, disableCookieCloud);
      });
      byId('yuba-cron').addEventListener('input', function (event) {
        void loadCronPreview('yubaCheckIn', event.target.value, 'yuba-cron-preview');
      });
      byId('yuba-enable').addEventListener('change', function (event) {
        handleTaskToggleChange(event, saveYubaConfig, disableYubaConfig);
      });
      byId('keepalive-cron').addEventListener('input', function (event) {
        void loadCronPreview('keepalive', event.target.value, 'keepalive-cron-preview');
      });
      byId('keepalive-enable').addEventListener('change', function (event) {
        handleTaskToggleChange(event, saveKeepaliveConfig, disableKeepaliveConfig);
      });
      byId('double-cron').addEventListener('input', function (event) {
        void loadCronPreview('doubleCard', event.target.value, 'double-cron-preview');
      });
      byId('double-enable').addEventListener('change', function (event) {
        handleTaskToggleChange(event, saveDoubleConfig, disableDoubleConfig);
      });
      byId('expiring-cron').addEventListener('input', function (event) {
        void loadCronPreview('expiringGift', event.target.value, 'expiring-cron-preview');
      });
      byId('expiring-threshold-hours').addEventListener('input', function () {
        byId('expiring-backpack-wrap').innerHTML = buildBackpackRowsTable(state.giftStatus);
      });
      byId('expiring-enable').addEventListener('change', function (event) {
        handleTaskToggleChange(event, saveExpiringGiftConfig, disableExpiringGiftConfig);
      });
      byId('double-model').addEventListener('change', updateDoubleModeUi);
      document.addEventListener('input', function (event) {
        if (event.target && event.target.classList && event.target.classList.contains('double-value')) {
          updateDoubleModeUi();
        }
      });
      document.addEventListener('change', function (event) {
        if (event.target && event.target.classList && event.target.classList.contains('double-enabled')) {
          updateDoubleModeUi();
        }
      });
    }

    function startAutoRefresh() {
      setInterval(function () {
        if (!state.auth.authenticated) {
          return;
        }
        if (state.activeTab === 'overview') {
          loadOverview();
        }
        if (state.activeTab === 'logs' && byId('logs-auto-refresh').checked) {
          loadLogs();
        }
      }, 5000);
    }

    function start() {
      bindStaticEvents();
      startAutoRefresh();

      renderAuth();
      setActiveTab(state.activeTab, { syncPath: false, skipLazyLoad: true });
      var webPasswordLogin = consumeWebPasswordFromUrl();
      if (webPasswordLogin.present) {
        loginWithPassword(webPasswordLogin.password, { clearPasswordInput: false });
        return;
      }
      loadAuthStatus().then(function (authenticated) {
        if (!authenticated) {
          return;
        }
        return loadProtectedData();
      });
    }

    return {
      start: start
    };
  }

  window.DOUYU_KEEP_WEBUI_EVENTS = {
    create: createEventBindings
  };
})();
