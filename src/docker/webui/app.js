(function () {
  var APP_DATA = window.DOUYU_KEEP_WEBUI_DATA;
  var APP_ROUTING = window.DOUYU_KEEP_WEBUI_ROUTING;
  var APP_DOM = window.DOUYU_KEEP_WEBUI_DOM;
  var PAGE_META = APP_DATA.PAGE_META;
  var DEFAULT_RAW_CONFIG = APP_DATA.DEFAULT_RAW_CONFIG;
  var getTabByPath = APP_ROUTING.getTabByPath;
  var syncPathWithTab = APP_ROUTING.syncPathWithTab;
  var consumeWebPasswordFromUrl = APP_ROUTING.consumeWebPasswordFromUrl;
  var byId = APP_DOM.byId;
  var escapeHtml = APP_DOM.escapeHtml;
  var getSystemPrefersDark = APP_DOM.getSystemPrefersDark;
  var setThemeMeta = APP_DOM.setThemeMeta;
  var isThemeMode = APP_DOM.isThemeMode;
  var setThemeButtonState = APP_DOM.setThemeButtonState;
  var formatDate = APP_DOM.formatDate;
  var toast = APP_DOM.toast;

  function createEmptyCronPreview() {
    return {
      value: '',
      runs: [],
      error: '',
      loading: false
    };
  }

  function createResourceRequest() {
    return {
      pending: null,
      fetchedAt: 0,
      requestSeq: 0
    };
  }

  var state = {
    activeTab: getTabByPath(window.location.pathname),
    auth: {
      requestSeq: 0,
      checked: false,
      authenticated: false,
      submitting: false,
      error: ''
    },
    rawConfig: null,
    overview: null,
    managed: null,
    cookieCheck: null,
    logs: [],
    logsRefreshedAt: null,
    fansStatus: [],
    giftStatus: null,
    yubaStatus: [],
    fansStatusLoading: false,
    fansStatusLoaded: false,
    fansStatusDetailsLoading: false,
    fansStatusDetailsLoaded: false,
    yubaStatusLoading: false,
    yubaStatusLoaded: false,
    fansListError: '',
    yubaStatusError: '',
    managedLoading: false,
    resourceRequests: {
      fansSync: createResourceRequest(),
      fansList: createResourceRequest(),
      fansStatus: createResourceRequest(),
      yubaStatus: createResourceRequest()
    },
    themeMode: 'system',
    cronPreview: {
      cookieCloud: createEmptyCronPreview(),
      collectGift: createEmptyCronPreview(),
      yubaCheckIn: createEmptyCronPreview(),
      keepalive: createEmptyCronPreview(),
      doubleCard: createEmptyCronPreview(),
      expiringGift: createEmptyCronPreview()
    },
    cronPreviewSeq: {
      cookieCloud: 0,
      collectGift: 0,
      yubaCheckIn: 0,
      keepalive: 0,
      doubleCard: 0,
      expiringGift: 0
    }
  };

  function nextAuthRequestSeq() {
    state.auth.requestSeq += 1;
    return state.auth.requestSeq;
  }

  function isLatestAuthRequest(requestSeq) {
    return state.auth.requestSeq === requestSeq;
  }

  function getRawConfig() {
    if (state.rawConfig) {
      return state.rawConfig;
    }
    return JSON.parse(JSON.stringify(DEFAULT_RAW_CONFIG));
  }

  function getCookieCloudConfig(config) {
    var source = config || getRawConfig();
    return source.cookieCloud || {
      active: false,
      endpoint: '',
      uuid: '',
      password: '',
      cron: '0 5 0 * * *',
      cryptoType: 'legacy'
    };
  }

  function getManualCookiesConfig(config) {
    var source = config || getRawConfig();
    return source.manualCookies || {
      main: String(source.cookie || ''),
      yuba: ''
    };
  }

  function hasCookieSourceConfigured(config) {
    var source = config || getRawConfig();
    var cookieCloud = getCookieCloudConfig(source);
    var manualCookies = getManualCookiesConfig(source);
    return Boolean(
      String(manualCookies.main || '').trim()
      || String(manualCookies.yuba || '').trim()
      || (cookieCloud.active && String(cookieCloud.endpoint || '').trim() && String(cookieCloud.uuid || '').trim() && String(cookieCloud.password || '').trim())
    );
  }

  function getCookieSourceLabel(overview, config) {
    var cookieCloud = getCookieCloudConfig(config);
    if (cookieCloud.active) {
      return 'CookieCloud';
    }
    return '手填';
  }

  function buildCookieCheckText(result) {
    if (!result) {
      var config = getRawConfig();
      var cookieCloud = getCookieCloudConfig(config);
      if (!cookieCloud.active) {
        return '启用后会先从 CookieCloud 提取斗鱼主站和鱼吧相关 Cookie，并同步到上方两个本地登录 Cookie 输入框。运行时不会临时再拉 CookieCloud，而是直接使用这里保存的本地快照。';
      }
      if (!String(cookieCloud.endpoint || '').trim() || !String(cookieCloud.uuid || '').trim() || !String(cookieCloud.password || '').trim()) {
        return 'CookieCloud 已启用，但 endpoint / UUID / 密码 还没填完整。';
      }
      return 'CookieCloud 已启用。系统会在启动时同步一次，并按这里配置的同步 Cron 自动刷新本地登录 Cookie。点击“同步并校验”会先同步 CookieCloud，再检查当前结果是否齐全。';
    }

    var sourceLabel = result.source === 'cookieCloud' ? 'CookieCloud' : '手填 Cookie';
    var mainText = result.mainCookieReady
      ? '主站请求就绪'
      : ('主站缺少 ' + (result.missingMainKeys || []).join(', '));
    var yubaText = result.yubaCookieReady
      ? '完整鱼吧 Cookie 就绪'
      : ('完整鱼吧 Cookie 缺少 ' + (result.missingYubaCookieKeys || result.missingYubaKeys || []).join(', '));
    var yubaDyTokenText = result.yubaDyTokenReady
      ? '鱼吧 dy-token 就绪'
      : ('鱼吧 dy-token 缺少 ' + (result.missingYubaDyTokenKeys || []).join(', '));
    var meta = '来源: ' + sourceLabel + '，Cookie 数: ' + (result.cookieCount || 0);
    if (result.updateTime) {
      meta += '，更新时间: ' + formatDate(result.updateTime);
    }
    return meta + '。' + mainText + '；' + yubaDyTokenText + '；' + yubaText + '。';
  }

  function isUnauthorizedError(error) {
    return Boolean(error && error.status === 401);
  }

  function getResourceRequest(key) {
    return state.resourceRequests[key];
  }

  function hasLoadedFansList() {
    return Boolean(getResourceRequest('fansList').fetchedAt);
  }

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

  function clearResourceError(key) {
    if (key === 'fansList') {
      state.fansListError = '';
    }
    if (key === 'yubaStatus') {
      state.yubaStatusError = '';
    }
  }

  function markResourceLoaded(key) {
    clearResourceError(key);
    getResourceRequest(key).fetchedAt = Date.now();
  }

  function invalidateResourceRequest(key) {
    var resource = getResourceRequest(key);
    resource.pending = null;
    resource.fetchedAt = 0;
    resource.requestSeq += 1;
    clearResourceError(key);
  }

  function invalidateResourceRequests(keys) {
    var i;
    for (i = 0; i < keys.length; i += 1) {
      invalidateResourceRequest(keys[i]);
    }
  }

  function trackResourceRequest(resource, requestSeq, pending) {
    var tracked = pending.then(function () {
      if (resource.pending === tracked && resource.requestSeq === requestSeq) {
        resource.pending = null;
      }
    }, function (error) {
      if (resource.pending === tracked && resource.requestSeq === requestSeq) {
        resource.pending = null;
      }
      throw error;
    });
    resource.pending = tracked;
    return tracked;
  }

  function isActiveRefreshLoading() {
    if (state.activeTab === 'overview' || state.activeTab === 'expiring-gift') {
      return state.fansStatusLoading || state.managedLoading;
    }
    if (state.activeTab === 'keepalive' || state.activeTab === 'double-card') {
      return state.managedLoading;
    }
    if (state.activeTab === 'yuba') {
      return state.yubaStatusLoading;
    }
    return false;
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

  function clearProtectedState() {
    invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus', 'yubaStatus']);
    state.rawConfig = null;
    state.overview = null;
    state.managed = null;
    state.cookieCheck = null;
    state.logs = [];
    state.logsRefreshedAt = null;
    state.fansStatus = [];
    state.giftStatus = null;
    state.yubaStatus = [];
    state.fansStatusLoading = false;
    state.fansStatusLoaded = false;
    state.fansStatusDetailsLoading = false;
    state.fansStatusDetailsLoaded = false;
    state.yubaStatusLoading = false;
    state.yubaStatusLoaded = false;
    state.fansListError = '';
    state.yubaStatusError = '';
    state.managedLoading = false;
    renderRefreshButton();
  }

  function clearCookieBackedData() {
    invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus', 'yubaStatus']);
    state.managed = null;
    state.fansStatus = [];
    state.giftStatus = null;
    state.yubaStatus = [];
    state.fansStatusLoading = false;
    state.fansStatusLoaded = false;
    state.fansStatusDetailsLoading = false;
    state.fansStatusDetailsLoaded = false;
    state.yubaStatusLoading = false;
    state.yubaStatusLoaded = false;
    state.fansListError = '';
    state.yubaStatusError = '';
    state.managedLoading = false;
  }

  function renderAuth() {
    var bodyMode = state.auth.authenticated ? 'app' : 'login';
    document.body.setAttribute('data-auth', bodyMode);

    var authShell = byId('auth-shell');
    var appShell = byId('app-shell');
    if (authShell) {
      authShell.style.display = state.auth.authenticated ? 'none' : '';
    }
    if (appShell) {
      appShell.style.display = state.auth.authenticated ? '' : 'none';
    }

    var errorNode = byId('login-error');
    if (errorNode) {
      errorNode.textContent = state.auth.error || '';
      errorNode.style.display = state.auth.error ? 'block' : 'none';
    }

    var submitNode = byId('login-submit');
    if (submitNode) {
      submitNode.disabled = state.auth.submitting;
      submitNode.textContent = state.auth.submitting ? '登录中…' : '登录';
    }

    var passwordNode = byId('web-password-input');
    if (passwordNode) {
      passwordNode.disabled = state.auth.submitting;
    }
  }

  function handleUnauthorized() {
    nextAuthRequestSeq();
    state.auth.checked = true;
    state.auth.authenticated = false;
    state.auth.submitting = false;
    state.auth.error = '登录已失效，请重新输入密码。';
    clearProtectedState();
    renderAuth();
  }

  function getManagedConfig() {
    if (state.managed && state.managed.config) {
      return state.managed.config;
    }
    return getRawConfig();
  }

  function getManagedFans() {
    if (state.managed && state.managed.fans && state.managed.fans.length) {
      return state.managed.fans;
    }
    if (state.fansStatus.length) {
      return state.fansStatus;
    }
    if (state.managed && state.managed.fans) {
      return state.managed.fans;
    }
    return [];
  }

  function setManagedFans(fans) {
    state.managed = {
      config: getManagedConfig(),
      fans: Array.isArray(fans) ? fans : []
    };
  }

  function mergeFansWithExistingStatus(fans) {
    var previousByRoom = {};
    var i;
    for (i = 0; i < state.fansStatus.length; i += 1) {
      previousByRoom[String(state.fansStatus[i].roomId)] = state.fansStatus[i];
    }

    return (Array.isArray(fans) ? fans : []).map(function (fan) {
      var previous = previousByRoom[String(fan.roomId)];
      if (!previous || typeof fan.doubleActive === 'boolean') {
        return fan;
      }
      var merged = Object.assign({}, fan);
      if (typeof previous.doubleActive === 'boolean') {
        merged.doubleActive = previous.doubleActive;
      }
      if (previous.doubleExpireTime) {
        merged.doubleExpireTime = previous.doubleExpireTime;
      }
      return merged;
    });
  }

  function applyFansStatusBase(data) {
    var fans = data && data.fans ? data.fans : [];
    state.fansStatus = mergeFansWithExistingStatus(fans);
    if (data && data.gift && data.complete) {
      state.giftStatus = data.gift;
    }
    setManagedFans(state.fansStatus);
    state.fansStatusLoaded = true;
    state.fansStatusDetailsLoaded = Boolean(data && data.complete);
  }

  function applyFansStatusDetails(data) {
    state.fansStatus = data && data.fans ? data.fans : [];
    state.giftStatus = data && data.gift ? data.gift : null;
    setManagedFans(state.fansStatus);
    state.fansStatusLoaded = true;
    state.fansStatusDetailsLoaded = true;
  }

  function isTaskActive(config) {
    return Boolean(config && config.active !== false);
  }

  function requestJson(url, options) {
    var opts = options || {};
    return fetch(url, opts).then(function (response) {
      return response.text().then(function (text) {
        var data = text ? JSON.parse(text) : {};
        if (!response.ok) {
          var error = new Error(data && data.error ? data.error : '请求失败');
          error.status = response.status;
          if (response.status === 401) {
            handleUnauthorized();
          }
          throw error;
        }
        return data;
      });
    });
  }

  function setActiveTab(tab, options) {
    var nextTab = PAGE_META[tab] ? tab : 'overview';
    var shouldSyncPath = !options || options.syncPath !== false;
    var replacePath = Boolean(options && options.replacePath);
    var skipLazyLoad = Boolean(options && options.skipLazyLoad);

    state.activeTab = nextTab;
    renderRefreshButton();
    var buttons = document.querySelectorAll('.tab-btn');
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      var selected = button.getAttribute('data-tab') === nextTab;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.setAttribute('tabindex', selected ? '0' : '-1');
    }

    var pages = document.querySelectorAll('.page');
    for (i = 0; i < pages.length; i += 1) {
      var page = pages[i];
      var active = page.id === 'page-' + nextTab;
      page.classList.toggle('active', active);
      page.setAttribute('aria-hidden', active ? 'false' : 'true');
      page.hidden = !active;
    }

    byId('page-title').textContent = PAGE_META[nextTab].title;
    byId('page-subtitle').textContent = PAGE_META[nextTab].subtitle;

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
    if (nextTab === 'logs') {
      loadLogs();
    }
  }

  function focusTabByOffset(currentTab, offset) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn[role="tab"]'));
    var currentIndex = buttons.indexOf(currentTab);
    if (currentIndex < 0 || !buttons.length) {
      return;
    }
    var nextIndex = (currentIndex + offset + buttons.length) % buttons.length;
    var nextButton = buttons[nextIndex];
    setActiveTab(nextButton.getAttribute('data-tab'));
    nextButton.focus();
  }

  function focusTabByIndex(index) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.tab-btn[role="tab"]'));
    var nextButton = buttons[index];
    if (!nextButton) {
      return;
    }
    setActiveTab(nextButton.getAttribute('data-tab'));
    nextButton.focus();
  }

  function handleTabKeydown(event) {
    if (!event.target || !event.target.matches || !event.target.matches('.tab-btn[role="tab"]')) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      focusTabByOffset(event.target, 1);
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      focusTabByOffset(event.target, -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusTabByIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      var buttons = document.querySelectorAll('.tab-btn[role="tab"]');
      focusTabByIndex(buttons.length - 1);
    }
  }

  function syncTabWithCurrentPath() {
    var nextTab = getTabByPath(window.location.pathname);
    if (!state.auth.authenticated) {
      state.activeTab = nextTab;
      return;
    }
    setActiveTab(nextTab, { syncPath: false });
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
    loadLogs: loadLogs,
    buildOverviewGiftSummary: buildOverviewGiftSummary,
    buildSummaryStatusCell: buildSummaryStatusCell,
    buildFansStatusTable: buildFansStatusTable,
    buildLoginStatusCard: buildLoginStatusCard,
    buildTaskCard: buildTaskCard,
    buildLoadingTaskCard: buildLoadingTaskCard,
    buildYubaStatusTable: buildYubaStatusTable,
    buildBackpackRowsTable: buildBackpackRowsTable,
    buildSendTable: buildSendTable,
    formatRatioPercent: formatRatioPercent,
    getSystemPrefersDark: getSystemPrefersDark,
    setThemeMeta: setThemeMeta,
    setThemeButtonState: setThemeButtonState,
    isThemeMode: isThemeMode
  });
  var renderCookieCheck = PAGE_RENDERERS.renderCookieCheck;
  var renderCronPreview = PAGE_RENDERERS.renderCronPreview;
  var loadCronPreview = PAGE_RENDERERS.loadCronPreview;
  var ensureCronPreview = PAGE_RENDERERS.ensureCronPreview;
  var renderOverview = PAGE_RENDERERS.renderOverview;
  var renderLogBox = PAGE_RENDERERS.renderLogBox;
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
  var renderTheme = PAGE_RENDERERS.renderTheme;
  var renderAll = PAGE_RENDERERS.renderAll;
  var renderActiveTabPage = PAGE_RENDERERS.renderActiveTabPage;

  var ACTIONS = window.DOUYU_KEEP_WEBUI_ACTIONS.create({
    byId: byId,
    state: state,
    toast: toast,
    requestJson: requestJson,
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
    nextAuthRequestSeq: nextAuthRequestSeq,
    isLatestAuthRequest: isLatestAuthRequest,
    handleUnauthorized: handleUnauthorized,
    renderAuth: renderAuth,
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
  var loadAuthStatus = ACTIONS.loadAuthStatus;
  var loginWithPassword = ACTIONS.loginWithPassword;
  var submitLogin = ACTIONS.submitLogin;
  var logout = ACTIONS.logout;
  var loadRawConfig = ACTIONS.loadRawConfig;
  var loadOverview = ACTIONS.loadOverview;
  var loadLogs = ACTIONS.loadLogs;
  var syncFans = ACTIONS.syncFans;
  var loadFansList = ACTIONS.loadFansList;
  var loadFansStatus = ACTIONS.loadFansStatus;
  var loadYubaStatus = ACTIONS.loadYubaStatus;
  var refreshOverviewSurface = ACTIONS.refreshOverviewSurface;
  var saveCookie = ACTIONS.saveCookie;
  var saveCookieCloud = ACTIONS.saveCookieCloud;
  var checkCookieSource = ACTIONS.checkCookieSource;
  var saveCookieCloudToggle = ACTIONS.saveCookieCloudToggle;
  var saveAndEnableCookieCloud = ACTIONS.saveAndEnableCookieCloud;
  var disableCookieCloud = ACTIONS.disableCookieCloud;
  var triggerTask = ACTIONS.triggerTask;
  var clearLogs = ACTIONS.clearLogs;
  var saveTheme = ACTIONS.saveTheme;

  var TASK_ACTIONS = window.DOUYU_KEEP_WEBUI_TASK_ACTIONS.create({
    byId: byId,
    toast: toast,
    requestJson: requestJson,
    isUnauthorizedError: isUnauthorizedError,
    getRawConfig: getRawConfig,
    getManagedConfig: getManagedConfig,
    getManagedFans: getManagedFans,
    refreshOverviewSurface: refreshOverviewSurface
  });
  var saveCollectConfig = TASK_ACTIONS.saveCollectConfig;
  var disableCollectConfig = TASK_ACTIONS.disableCollectConfig;
  var saveYubaConfig = TASK_ACTIONS.saveYubaConfig;
  var disableYubaConfig = TASK_ACTIONS.disableYubaConfig;
  var saveKeepaliveConfig = TASK_ACTIONS.saveKeepaliveConfig;
  var disableKeepaliveConfig = TASK_ACTIONS.disableKeepaliveConfig;
  var saveDoubleConfig = TASK_ACTIONS.saveDoubleConfig;
  var saveExpiringGiftConfig = TASK_ACTIONS.saveExpiringGiftConfig;
  var disableExpiringGiftConfig = TASK_ACTIONS.disableExpiringGiftConfig;
  var disableDoubleConfig = TASK_ACTIONS.disableDoubleConfig;

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

  document.addEventListener('click', function (event) {
    var target = findActionTarget(event.target);
    if (!target) {
      return;
    }

    var action = target.getAttribute('data-action');
    if (action === 'tab') {
      setActiveTab(target.getAttribute('data-tab'));
      return;
    }
    if (action === 'refresh-overview') {
      refreshOverviewSurface(true);
      return;
    }
    if (action === 'logout') {
      logout();
      return;
    }
    if (action === 'theme-mode') {
      saveTheme(target.getAttribute('data-theme-mode'));
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
  });
  document.addEventListener('keydown', handleTabKeydown);

  function handleTaskToggleChange(event, enableTask, disableTask) {
    if (event.target.checked) {
      enableTask({ revertCheckboxOnError: true });
      return;
    }
    disableTask();
  }

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
  window.addEventListener('popstate', syncTabWithCurrentPath);

  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (state.themeMode === 'system') {
          renderTheme();
        }
      });
    } catch (error) {
      // Ignore older browsers that do not support addEventListener on MediaQueryList.
    }
  }

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
})();
