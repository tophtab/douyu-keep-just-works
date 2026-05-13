(function () {
  var APP_DATA = window.DOUYU_KEEP_WEBUI_DATA;
  var APP_ROUTING = window.DOUYU_KEEP_WEBUI_ROUTING;
  var APP_DOM = window.DOUYU_KEEP_WEBUI_DOM;
  var PAGE_META = APP_DATA.PAGE_META;
  var DEFAULT_RAW_CONFIG = APP_DATA.DEFAULT_RAW_CONFIG;
  var getTabByPath = APP_ROUTING.getTabByPath;
  var syncPathWithTab = APP_ROUTING.syncPathWithTab;
  var byId = APP_DOM.byId;
  var escapeHtml = APP_DOM.escapeHtml;
  var formatDate = APP_DOM.formatDate;
  var toast = APP_DOM.toast;

  var STATE_HELPERS = window.DOUYU_KEEP_WEBUI_STATE.create({
    defaultRawConfig: DEFAULT_RAW_CONFIG,
    initialTab: getTabByPath(window.location.pathname),
    formatDate: formatDate
  });
  var state = STATE_HELPERS.state;
  var createEmptyCronPreview = STATE_HELPERS.createEmptyCronPreview;
  var getRawConfig = STATE_HELPERS.getRawConfig;
  var getCookieCloudConfig = STATE_HELPERS.getCookieCloudConfig;
  var getManualCookiesConfig = STATE_HELPERS.getManualCookiesConfig;
  var hasCookieSourceConfigured = STATE_HELPERS.hasCookieSourceConfigured;
  var getCookieSourceLabel = STATE_HELPERS.getCookieSourceLabel;
  var buildCookieCheckText = STATE_HELPERS.buildCookieCheckText;
  var isUnauthorizedError = STATE_HELPERS.isUnauthorizedError;
  var getResourceRequest = STATE_HELPERS.getResourceRequest;
  var hasLoadedFansList = STATE_HELPERS.hasLoadedFansList;
  var markResourceLoaded = STATE_HELPERS.markResourceLoaded;
  var invalidateResourceRequest = STATE_HELPERS.invalidateResourceRequest;
  var invalidateResourceRequests = STATE_HELPERS.invalidateResourceRequests;
  var trackResourceRequest = STATE_HELPERS.trackResourceRequest;
  var isActiveRefreshLoading = STATE_HELPERS.isActiveRefreshLoading;

  function shouldLoadFansListForActiveTab() {
    var activeNeedsFansList = state.activeTab === 'keepalive' || state.activeTab === 'double-card';
    var resource = getResourceRequest('fansList');
    return Boolean(
      activeNeedsFansList
      && hasCookieSourceConfigured(getRawConfig())
      && !getManagedFans().length
      && !hasLoadedFansList()
      && !state.fansListError
      && !state.managedLoading
      && !resource.pending
    );
  }

  function ensureFansListForActiveTab() {
    if (shouldLoadFansListForActiveTab()) {
      loadFansList(false);
    }
  }

  function shouldLoadYubaStatusForActiveTab() {
    var rawConfig = getRawConfig();
    var config = getManagedConfig().yubaCheckIn || rawConfig.yubaCheckIn || { mode: 'followed' };
    var resource = getResourceRequest('yubaStatus');
    return Boolean(
      state.activeTab === 'yuba'
      && hasCookieSourceConfigured(rawConfig)
      && String(config.mode || 'followed') === 'followed'
      && !state.yubaStatusLoaded
      && !state.yubaStatusLoading
      && !state.yubaStatusError
      && !resource.pending
    );
  }

  function ensureYubaStatusForActiveTab() {
    if (shouldLoadYubaStatusForActiveTab()) {
      loadYubaStatus(false);
    }
  }

  function renderRefreshButton() {
    var refreshButton = document.querySelector('[data-action="refresh-overview"]');
    if (!refreshButton) {
      return;
    }
    var loading = isActiveRefreshLoading();
    refreshButton.disabled = loading;
    refreshButton.setAttribute('aria-busy', loading ? 'true' : 'false');
    refreshButton.setAttribute('title', loading ? '正在刷新' : '刷新');
  }

  function handleVueAuthState(event) {
    var detail = event && event.detail ? event.detail : {};
    state.auth.checked = true;
    state.auth.authenticated = Boolean(detail.authenticated);
    state.auth.submitting = false;
    if (state.auth.authenticated) {
      state.auth.error = '';
    }
  }
  document.addEventListener('douyu-keep-webui:auth-state', handleVueAuthState);
  state.auth.checked = true;
  state.auth.authenticated = document.body.getAttribute('data-auth') === 'app';

  function handleUnauthorized() {
    document.dispatchEvent(new CustomEvent('douyu-keep-webui:unauthorized'));
  }

  var PROTECTED_STATE = window.DOUYU_KEEP_WEBUI_PROTECTED_STATE.create({
    state: state,
    invalidateResourceRequests: invalidateResourceRequests,
    renderRefreshButton: renderRefreshButton
  });
  var clearProtectedState = PROTECTED_STATE.clearProtectedState;
  var clearCookieBackedData = PROTECTED_STATE.clearCookieBackedData;

  var MANAGED_DATA = window.DOUYU_KEEP_WEBUI_MANAGED_DATA.create({
    state: state,
    getRawConfig: getRawConfig
  });
  var getManagedConfig = MANAGED_DATA.getManagedConfig;
  var getManagedFans = MANAGED_DATA.getManagedFans;
  var setManagedFans = MANAGED_DATA.setManagedFans;
  var applyFansStatusBase = MANAGED_DATA.applyFansStatusBase;
  var applyFansStatusDetails = MANAGED_DATA.applyFansStatusDetails;

  function isTaskActive(config) {
    return Boolean(config && config.active !== false);
  }

  var requestJson = window.DOUYU_KEEP_WEBUI_REQUEST.create({
    handleUnauthorized: handleUnauthorized
  }).requestJson;

  function setActiveTab(tab, options) {
    var nextTab = PAGE_META[tab] ? tab : 'overview';
    var shouldSyncPath = !options || options.syncPath !== false;
    var replacePath = Boolean(options && options.replacePath);
    var skipLazyLoad = Boolean(options && options.skipLazyLoad);

    state.activeTab = nextTab;
    renderRefreshButton();

    if (shouldSyncPath) {
      syncPathWithTab(nextTab, replacePath);
    }

    renderActiveTabPage();

    if (skipLazyLoad) {
      return;
    }

    if (nextTab === 'overview' && hasCookieSourceConfigured(getRawConfig()) && !state.fansStatusLoaded) {
      loadFansStatus(false);
    }
    if (nextTab === 'expiring-gift' && hasCookieSourceConfigured(getRawConfig()) && !state.fansStatusLoaded) {
      loadFansStatus(false);
    }
    ensureFansListForActiveTab();
    ensureYubaStatusForActiveTab();
  }

  function handleVueNavigation(event) {
    var detail = event && event.detail ? event.detail : {};
    if (!state.auth.authenticated) {
      state.activeTab = PAGE_META[detail.tab] ? detail.tab : 'overview';
      return;
    }
    setActiveTab(detail.tab, {
      syncPath: false,
      skipLazyLoad: Boolean(detail.skipLazyLoad)
    });
  }

  var RENDER_HELPERS = window.DOUYU_KEEP_WEBUI_RENDER.create({
    byId: byId,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    state: state,
    getRawConfig: getRawConfig,
    getManagedConfig: getManagedConfig,
    hasCookieSourceConfigured: hasCookieSourceConfigured,
    getCookieSourceLabel: getCookieSourceLabel
  });
  var buildStatusPill = RENDER_HELPERS.buildStatusPill;
  var buildSummaryCell = RENDER_HELPERS.buildSummaryCell;
  var buildOverviewGiftSummary = RENDER_HELPERS.buildOverviewGiftSummary;
  var getExpiringThresholdHours = RENDER_HELPERS.getExpiringThresholdHours;
  var buildBackpackRowsTable = RENDER_HELPERS.buildBackpackRowsTable;
  var buildSummaryStatusCell = RENDER_HELPERS.buildSummaryStatusCell;
  var buildLoadingTaskCard = RENDER_HELPERS.buildLoadingTaskCard;
  var buildTaskCard = RENDER_HELPERS.buildTaskCard;
  var buildLoginStatusCard = RENDER_HELPERS.buildLoginStatusCard;
  var buildFansStatusTable = RENDER_HELPERS.buildFansStatusTable;
  var buildYubaStatusTable = RENDER_HELPERS.buildYubaStatusTable;
  var buildSendTable = RENDER_HELPERS.buildSendTable;
  var formatRatioPercent = RENDER_HELPERS.formatRatioPercent;

  var PAGE_RENDERERS = window.DOUYU_KEEP_WEBUI_PAGES.create({
    byId: byId,
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    toast: toast,
    state: state,
    createEmptyCronPreview: createEmptyCronPreview,
    buildCookieCheckText: buildCookieCheckText,
    requestJson: requestJson,
    getRawConfig: getRawConfig,
    getCookieCloudConfig: getCookieCloudConfig,
    getManualCookiesConfig: getManualCookiesConfig,
    hasCookieSourceConfigured: hasCookieSourceConfigured,
    getManagedConfig: getManagedConfig,
    getManagedFans: getManagedFans,
    isTaskActive: isTaskActive,
    renderRefreshButton: renderRefreshButton,
    hasLoadedFansList: hasLoadedFansList,
    ensureFansListForActiveTab: ensureFansListForActiveTab,
    ensureYubaStatusForActiveTab: ensureYubaStatusForActiveTab,
    loadFansStatus: loadFansStatus,
    buildOverviewGiftSummary: buildOverviewGiftSummary,
    buildSummaryStatusCell: buildSummaryStatusCell,
    buildFansStatusTable: buildFansStatusTable,
    buildLoginStatusCard: buildLoginStatusCard,
    buildTaskCard: buildTaskCard,
    buildLoadingTaskCard: buildLoadingTaskCard,
    buildYubaStatusTable: buildYubaStatusTable,
    buildBackpackRowsTable: buildBackpackRowsTable,
    buildSendTable: buildSendTable,
    formatRatioPercent: formatRatioPercent
  });
  var renderCookieCheck = PAGE_RENDERERS.renderCookieCheck;
  var renderCronPreview = PAGE_RENDERERS.renderCronPreview;
  var loadCronPreview = PAGE_RENDERERS.loadCronPreview;
  var ensureCronPreview = PAGE_RENDERERS.ensureCronPreview;
  var renderOverview = PAGE_RENDERERS.renderOverview;
  var renderLoginPage = PAGE_RENDERERS.renderLoginPage;
  var renderCollectPage = PAGE_RENDERERS.renderCollectPage;
  var renderYubaPage = PAGE_RENDERERS.renderYubaPage;
  var renderKeepalivePage = PAGE_RENDERERS.renderKeepalivePage;
  var setDoubleModeEmptyState = PAGE_RENDERERS.setDoubleModeEmptyState;
  var renderDoublePage = PAGE_RENDERERS.renderDoublePage;
  var renderExpiringGiftPage = PAGE_RENDERERS.renderExpiringGiftPage;
  var updateDoubleModeUi = PAGE_RENDERERS.updateDoubleModeUi;
  var applyDoubleRatioPreset = PAGE_RENDERERS.applyDoubleRatioPreset;
  var renderLogsPage = PAGE_RENDERERS.renderLogsPage;
  var renderAll = PAGE_RENDERERS.renderAll;
  var renderActiveTabPage = PAGE_RENDERERS.renderActiveTabPage;

  var ACTIONS = window.DOUYU_KEEP_WEBUI_ACTIONS.create({
    byId: byId,
    state: state,
    toast: toast,
    requestJson: requestJson,
    defaultRawConfig: DEFAULT_RAW_CONFIG,
    isUnauthorizedError: isUnauthorizedError,
    getRawConfig: getRawConfig,
    getCookieCloudConfig: getCookieCloudConfig,
    hasCookieSourceConfigured: hasCookieSourceConfigured,
    getManagedConfig: getManagedConfig,
    getManagedFans: getManagedFans,
    setManagedFans: setManagedFans,
    markResourceLoaded: markResourceLoaded,
    invalidateResourceRequest: invalidateResourceRequest,
    invalidateResourceRequests: invalidateResourceRequests,
    getResourceRequest: getResourceRequest,
    trackResourceRequest: trackResourceRequest,
    clearCookieBackedData: clearCookieBackedData,
    clearProtectedState: clearProtectedState,
    applyFansStatusBase: applyFansStatusBase,
    applyFansStatusDetails: applyFansStatusDetails,
    renderAll: renderAll,
    renderLoginPage: renderLoginPage,
    renderCookieCheck: renderCookieCheck,
    renderOverview: renderOverview,
    renderLogsPage: renderLogsPage,
    renderKeepalivePage: renderKeepalivePage,
    renderDoublePage: renderDoublePage,
    renderExpiringGiftPage: renderExpiringGiftPage,
    renderYubaPage: renderYubaPage,
    setActiveTab: setActiveTab
  });
  var syncCookieCloudToLoginCookies = ACTIONS.syncCookieCloudToLoginCookies;
  var loadProtectedData = ACTIONS.loadProtectedData;
  var loadRawConfig = ACTIONS.loadRawConfig;
  var loadOverview = ACTIONS.loadOverview;
  var loadLogs = ACTIONS.loadLogs;
  var syncFans = ACTIONS.syncFans;
  var loadFansList = ACTIONS.loadFansList;
  var loadFansStatus = ACTIONS.loadFansStatus;
  var loadYubaStatus = ACTIONS.loadYubaStatus;
  var refreshOverviewSurface = ACTIONS.refreshOverviewSurface;
  var triggerTask = ACTIONS.triggerTask;

  var TASK_ACTIONS = window.DOUYU_KEEP_WEBUI_TASK_ACTIONS.create({
    byId: byId,
    toast: toast,
    requestJson: requestJson,
    isUnauthorizedError: isUnauthorizedError,
    getRawConfig: getRawConfig,
    getManagedConfig: getManagedConfig,
    getManagedFans: getManagedFans,
    refreshOverviewSurface: refreshOverviewSurface,
    loadOverview: loadOverview,
    loadLogs: loadLogs,
    loadFansStatus: loadFansStatus
  });
  var saveYubaConfig = TASK_ACTIONS.saveYubaConfig;
  var disableYubaConfig = TASK_ACTIONS.disableYubaConfig;
  var saveKeepaliveConfig = TASK_ACTIONS.saveKeepaliveConfig;
  var disableKeepaliveConfig = TASK_ACTIONS.disableKeepaliveConfig;
  var saveDoubleConfig = TASK_ACTIONS.saveDoubleConfig;
  var saveExpiringGiftConfig = TASK_ACTIONS.saveExpiringGiftConfig;
  var disableExpiringGiftConfig = TASK_ACTIONS.disableExpiringGiftConfig;
  var disableDoubleConfig = TASK_ACTIONS.disableDoubleConfig;

  window.DOUYU_KEEP_WEBUI_EVENTS.create({
    byId: byId,
    state: state,
    setActiveTab: setActiveTab,
    handleVueNavigation: handleVueNavigation,
    refreshOverviewSurface: refreshOverviewSurface,
    loadOverview: loadOverview,
    saveYubaConfig: saveYubaConfig,
    disableYubaConfig: disableYubaConfig,
    saveKeepaliveConfig: saveKeepaliveConfig,
    disableKeepaliveConfig: disableKeepaliveConfig,
    saveDoubleConfig: saveDoubleConfig,
    disableDoubleConfig: disableDoubleConfig,
    saveExpiringGiftConfig: saveExpiringGiftConfig,
    disableExpiringGiftConfig: disableExpiringGiftConfig,
    applyDoubleRatioPreset: applyDoubleRatioPreset,
    triggerTask: triggerTask,
    loadCronPreview: loadCronPreview,
    buildBackpackRowsTable: buildBackpackRowsTable,
    updateDoubleModeUi: updateDoubleModeUi,
    loadProtectedData: loadProtectedData
  }).start();

  window.DOUYU_KEEP_WEBUI_LEGACY = {
    clearProtectedState: clearProtectedState,
    loadProtectedData: loadProtectedData
  };
  document.dispatchEvent(new CustomEvent('douyu-keep-webui:legacy-ready'));
})();
