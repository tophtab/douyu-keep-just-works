(function () {
  var TAB_ROUTE_MAP = __DOCKER_WEBUI_PAGE_ROUTES_JSON__;
  var PAGE_META = {
    overview: {
      title: '概况',
      subtitle: '先看基础状态，再确认当前粉丝牌列表。'
    },
    login: {
      title: '登录',
      subtitle: '管理登录状态、手填 Cookie 和 CookieCloud 同步。'
    },
    collect: {
      title: '领取任务',
      subtitle: '查看领取任务状态，并维护领取任务的启停和调度。'
    },
    yuba: {
      title: '鱼吧签到',
      subtitle: '通过纯 HTTP 请求签到全部已关注鱼吧，并查看任务状态。'
    },
    keepalive: {
      title: '保活任务',
      subtitle: '查看保活状态，并维护随粉丝牌同步的房间配置。'
    },
    'double-card': {
      title: '双倍任务',
      subtitle: '查看双倍状态，并维护参与勾选与分配值。'
    },
    'expiring-gift': {
      title: '临期任务',
      subtitle: '在礼物接近过期时，只按临期候选数量释放背包礼物。'
    },
    logs: {
      title: '运行日志',
      subtitle: '查看系统、领取、鱼吧签到、保活、双倍和临期任务的执行记录。'
    }
  };

  function normalizePagePath(path) {
    if (!path || path === '/') {
      return '/';
    }
    return path.replace(/\/+$/, '') || '/';
  }

  function getTabByPath(path) {
    var normalizedPath = normalizePagePath(path);
    var tabs = Object.keys(TAB_ROUTE_MAP);
    var i;
    for (i = 0; i < tabs.length; i += 1) {
      if (TAB_ROUTE_MAP[tabs[i]] === normalizedPath) {
        return tabs[i];
      }
    }
    return 'overview';
  }

  function getPathByTab(tab) {
    return TAB_ROUTE_MAP[tab] || TAB_ROUTE_MAP.overview;
  }

  function syncPathWithTab(tab, replace) {
    if (!window.history || !window.history.pushState || !window.history.replaceState) {
      return;
    }

    var nextPath = getPathByTab(tab);
    var currentPath = normalizePagePath(window.location.pathname);
    if (currentPath === nextPath && window.location.pathname === nextPath) {
      return;
    }

    try {
      if (replace) {
        window.history.replaceState(null, '', nextPath);
        return;
      }
      window.history.pushState(null, '', nextPath);
    } catch (error) {
      // Ignore history API failures and keep the UI usable.
    }
  }

  function consumeWebPasswordFromUrl() {
    var result = { present: false, password: '' };
    if (!window.location || !window.location.search) {
      return result;
    }

    try {
      var currentUrl = new URL(window.location.href);
      if (!currentUrl.searchParams.has('web-password')) {
        return result;
      }

      result.present = true;
      result.password = currentUrl.searchParams.get('web-password') || '';
      currentUrl.searchParams.delete('web-password');

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
      }
    } catch (error) {
      // If URL parsing fails, fall back to the normal login form.
    }

    return result;
  }

  var DEFAULT_RAW_CONFIG = {
    cookie: '',
    manualCookies: {
      main: '',
      yuba: ''
    },
    cookieCloud: {
      active: false,
      endpoint: '',
      uuid: '',
      password: '',
      cron: '0 5 0 * * *',
      cryptoType: 'legacy'
    },
    ui: { themeMode: 'system' },
    collectGift: { active: true, cron: '0 10 3,5 * * *' },
    yubaCheckIn: { active: false, cron: '0 23 0 * * *', mode: 'followed' },
    keepalive: { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} },
    doubleCard: { active: true, cron: '0 20 17,20,22,23 * * *', model: 1, giftScope: 'glowStick', send: {}, enabled: {} },
    expiringGift: { active: false, cron: '0 45 23 * * *', thresholdHours: 24, model: 1, send: {} }
  };

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

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSystemPrefersDark() {
    if (!window.matchMedia) {
      return true;
    }
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (error) {
      return true;
    }
  }

  function setThemeMeta(resolvedTheme) {
    var themeColor = byId('theme-color-meta');
    var colorScheme = byId('color-scheme-meta');
    if (themeColor) {
      themeColor.setAttribute('content', resolvedTheme === 'dark' ? '#000000' : '#f4ede4');
    }
    if (colorScheme) {
      colorScheme.setAttribute('content', resolvedTheme === 'dark' ? 'dark' : 'light');
    }
  }

  function isThemeMode(value) {
    return value === 'system' || value === 'light' || value === 'dark';
  }

  function setThemeButtonState(mode) {
    var buttons = document.querySelectorAll('.theme-option[data-theme-mode]');
    var i;
    for (i = 0; i < buttons.length; i += 1) {
      var button = buttons[i];
      var active = button.getAttribute('data-theme-mode') === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function formatDate(value) {
    if (!value) {
      return '无';
    }
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    try {
      return new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date).replace(/\\//g, '-');
    } catch (error) {
      return date.toISOString();
    }
  }

  function toast(message, ok) {
    var node = byId('toast');
    var liveNode = byId('toast-live');
    if (liveNode) {
      liveNode.textContent = '';
      window.setTimeout(function () {
        liveNode.textContent = message;
      }, 0);
    }
    node.textContent = message;
    node.style.display = 'block';
    node.style.background = ok ? '#15803d' : '#dc2626';
    node.setAttribute('aria-hidden', 'false');
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(function () {
      node.style.display = 'none';
      node.setAttribute('aria-hidden', 'true');
    }, 3200);
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

  function buildStatusPill(label, kind) {
    return '<span class="pill ' + kind + '">' + escapeHtml(label) + '</span>';
  }

  function buildSummaryCell(label, value) {
    return '<div class="summary-cell"><div class="mini-label">' + escapeHtml(label) + '</div><div class="mini-value">' + escapeHtml(value) + '</div></div>';
  }

  function buildOverviewGiftSummary(countValue, expireValue) {
    return ''
      + '<div class="strip-metric"><div class="mini-label">当前荧光棒</div><div class="mini-value">' + escapeHtml(countValue) + '</div></div>'
      + '<div class="strip-metric"><div class="mini-label">过期时间</div><div class="mini-value">' + escapeHtml(expireValue) + '</div></div>';
  }

  function formatRemainingTime(expireTime) {
    if (!expireTime) {
      return '-';
    }
    var remainingMs = expireTime - Date.now();
    var remainingHours = Math.max(0, remainingMs / (60 * 60 * 1000));
    if (remainingHours >= 48) {
      return (remainingHours / 24).toFixed(1).replace(/\.0$/, '') + ' 天';
    }
    return remainingHours.toFixed(1).replace(/\.0$/, '') + ' 小时';
  }

  function getExpiringThresholdHours() {
    var thresholdNode = byId('expiring-threshold-hours');
    var inputValue = thresholdNode ? Number(thresholdNode.value) : NaN;
    if (Number.isFinite(inputValue) && inputValue > 0) {
      return inputValue;
    }
    var rawConfig = getRawConfig();
    var config = getManagedConfig().expiringGift || rawConfig.expiringGift || {};
    var value = Number(config.thresholdHours || 24);
    return Number.isFinite(value) && value > 0 ? value : 24;
  }

  function describeBackpackRow(row, thresholdHours) {
    var count = Number(row && row.count || 0);
    var expireTime = Number(row && row.expireTime || 0);
    if (count <= 0) {
      return { inThreshold: false, autoRelease: false };
    }
    if (!expireTime) {
      return { inThreshold: false, autoRelease: false };
    }
    var inThreshold = expireTime - Date.now() <= thresholdHours * 60 * 60 * 1000;
    return { inThreshold: inThreshold, autoRelease: inThreshold };
  }

  function buildTableCell(label, html, className, titleText) {
    var attrs = ' data-label="' + escapeHtml(label) + '"';
    if (className) {
      attrs += ' class="' + escapeHtml(className) + '"';
    }
    if (titleText) {
      attrs += ' title="' + escapeHtml(titleText) + '"';
    }
    return '<td' + attrs + '>' + html + '</td>';
  }

  function buildTableHeadCell(label, className) {
    var attrs = ' scope="col"';
    if (className) {
      attrs += ' class="' + escapeHtml(className) + '"';
    }
    return '<th' + attrs + '>' + escapeHtml(label) + '</th>';
  }

  function buildTextCell(label, value, className) {
    var text = value == null || value === '' ? '-' : String(value);
    return buildTableCell(label, escapeHtml(text), className || 'text-cell', text);
  }

  function buildNumericCell(label, value) {
    return buildTableCell(label, escapeHtml(value == null || value === '' ? '-' : value), 'num-cell');
  }

  function buildBackpackRowsTable(giftStatus) {
    if (!giftStatus) {
      if (state.fansStatusDetailsLoading) {
        return '<div class="empty">正在加载背包明细…</div>';
      }
      return '<div class="empty">尚未加载背包明细。点击顶部“刷新”后会展示可见礼物行。</div>';
    }
    if (giftStatus.error) {
      return '<div class="empty">背包明细暂不可用：' + escapeHtml(giftStatus.error) + '</div>';
    }
    var rows = giftStatus.rows || [];
    if (!rows.length) {
      return '<div class="empty">当前背包没有可展示的礼物行。</div>';
    }

    var thresholdHours = getExpiringThresholdHours();
    var body = [];
    var i;
    for (i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var rowState = describeBackpackRow(row, thresholdHours);
      body.push('<tr>');
      body.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
      body.push(buildTextCell('礼物', row.name || '未知礼物'));
      body.push(buildNumericCell('ID', row.giftId));
      body.push(buildNumericCell('数量', row.count));
      body.push(buildTableCell('过期时间', escapeHtml(row.expireTime ? formatDate(row.expireTime) : '-'), 'date-cell'));
      body.push(buildTableCell('剩余', escapeHtml(formatRemainingTime(row.expireTime)), 'num-cell'));
      body.push(buildTableCell('临期', buildStatusPill(rowState.inThreshold ? '是' : '否', rowState.inThreshold ? 'warn' : 'off'), 'status-cell control-cell'));
      body.push(buildTableCell('自动释放', buildStatusPill(rowState.autoRelease ? '释放' : '跳过', rowState.autoRelease ? 'ok' : 'off'), 'status-cell control-cell'));
      body.push('</tr>');
    }

    return ''
      + '<div class="table-shell"><table class="table table-fixed backpack-table"><colgroup><col><col><col><col><col><col><col><col></colgroup><thead><tr>'
      + buildTableHeadCell('序号', 'index-head')
      + buildTableHeadCell('礼物')
      + buildTableHeadCell('ID', 'num-head')
      + buildTableHeadCell('数量', 'num-head')
      + buildTableHeadCell('过期时间', 'date-head')
      + buildTableHeadCell('剩余', 'num-head')
      + buildTableHeadCell('临期', 'control-head')
      + buildTableHeadCell('自动释放', 'control-head')
      + '</tr></thead><tbody>' + body.join('') + '</tbody></table></div>';
  }

  function buildSummaryStatusCell(label, enabled, enabledText, disabledText) {
    var active = Boolean(enabled);
    return ''
      + '<div class="strip-metric">'
      + '<div class="mini-label">' + escapeHtml(label) + '</div>'
      + '<div class="mini-value">' + buildStatusPill(active ? enabledText : disabledText, active ? 'ok' : 'off') + '</div>'
      + '</div>';
  }

  function buildLoadingTaskCard(title) {
    return '<div class="task-card-head"><div><div class="section-kicker">任务状态</div><h3 class="task-card-title">' + escapeHtml(title) + '</h3></div></div><div class="task-card-pills">' + buildStatusPill('等待加载', 'off') + '</div><div class="summary-grid">' + buildSummaryCell('上次执行', '-') + buildSummaryCell('下次执行', '-') + buildSummaryCell('运行状态', '-') + '</div>';
  }

  function buildTaskCard(title, configured, status, extraLabel, extraValue) {
    var enabledLabel = configured ? '已启动' : '未启动';
    var runningLabel = configured ? (status.running ? '调度中' : '已停止') : '未启用';
    return ''
      + '<div class="task-card-head"><div><div class="section-kicker">任务状态</div><h3 class="task-card-title">' + escapeHtml(title) + '</h3></div></div>'
      + '<div class="task-card-pills">'
      + buildStatusPill(enabledLabel, configured ? 'ok' : 'off')
      + buildStatusPill(runningLabel, configured ? (status.running ? 'warn' : 'off') : 'off')
      + '</div>'
      + '<div class="summary-grid">'
      + buildSummaryCell('上次执行', formatDate(status.lastRun))
      + buildSummaryCell('下次执行', formatDate(status.nextRun))
      + buildSummaryCell(extraLabel, extraValue)
      + '</div>';
  }

  function buildLoginStatusCard(overview, fansCount) {
    if (!overview) {
      return '<div class="task-card-head"><div><div class="section-kicker">登录状态</div><h3 class="task-card-title">登录</h3></div></div><div class="task-card-pills">' + buildStatusPill('等待加载', 'off') + '</div><div class="summary-grid">' + buildSummaryCell('系统就绪', '-') + buildSummaryCell('粉丝牌', '-') + buildSummaryCell('来源', '-') + '</div>';
    }

    var rawConfig = getRawConfig();
    var sourceReady = hasCookieSourceConfigured(rawConfig);

    return ''
      + '<div class="task-card-head"><div><div class="section-kicker">登录状态</div><h3 class="task-card-title">登录</h3></div></div>'
      + '<div class="task-card-pills">'
      + buildStatusPill(overview.cookieSaved ? '已就绪' : '未配置', overview.cookieSaved ? 'ok' : 'off')
      + buildStatusPill(overview.ready ? '可运行' : '待配置', overview.ready ? 'warn' : 'off')
      + '</div>'
      + '<div class="summary-grid">'
      + buildSummaryCell('系统就绪', overview.ready ? '已就绪' : '待配置')
      + buildSummaryCell('粉丝牌', sourceReady ? ((state.managedLoading || state.fansStatusLoading) ? '同步中' : (fansCount + ' 个')) : '未同步')
      + buildSummaryCell('来源', getCookieSourceLabel(overview, rawConfig))
      + '</div>';
  }

  function renderCookieCheck() {
    var note = byId('cookie-cloud-note');
    if (!note) {
      return;
    }
    note.textContent = buildCookieCheckText(state.cookieCheck);
  }

  function renderCronPreview(targetId, key) {
    var target = byId(targetId);
    var preview = state.cronPreview[key];
    if (!target || !preview) {
      return;
    }
    if (!preview.value) {
      target.textContent = '填写 cron 后显示未来三次执行时间。';
      return;
    }
    if (preview.loading) {
      target.textContent = '正在计算未来执行时间…';
      return;
    }
    if (preview.error) {
      target.textContent = 'cron 校验失败：' + preview.error;
      return;
    }
    if (!preview.runs.length) {
      target.textContent = '暂未生成未来执行时间。';
      return;
    }
    target.textContent = '未来三次：' + preview.runs.map(function (item) {
      return formatDate(item);
    }).join(' / ');
  }

  function loadCronPreview(key, cron, targetId) {
    var value = String(cron || '').trim();
    state.cronPreviewSeq[key] += 1;
    var requestSeq = state.cronPreviewSeq[key];

    if (!value) {
      state.cronPreview[key] = createEmptyCronPreview();
      renderCronPreview(targetId, key);
      return Promise.resolve();
    }

    state.cronPreview[key] = {
      value: value,
      runs: [],
      error: '',
      loading: true
    };
    renderCronPreview(targetId, key);

    return requestJson('/api/cron-preview?value=' + encodeURIComponent(value)).then(function (data) {
      if (state.cronPreviewSeq[key] !== requestSeq) {
        return;
      }
      state.cronPreview[key] = {
        value: value,
        runs: data.runs || [],
        error: '',
        loading: false
      };
      renderCronPreview(targetId, key);
    }).catch(function (error) {
      if (state.cronPreviewSeq[key] !== requestSeq) {
        return;
      }
      state.cronPreview[key] = {
        value: value,
        runs: [],
        error: error.message,
        loading: false
      };
      renderCronPreview(targetId, key);
    });
  }

  function ensureCronPreview(key, cron, targetId) {
    var value = String(cron || '').trim();
    var preview = state.cronPreview[key];
    if (!preview || preview.value !== value) {
      return loadCronPreview(key, value, targetId);
    }
    renderCronPreview(targetId, key);
    if (preview.loading || preview.error || preview.runs.length) {
      return Promise.resolve();
    }
    return loadCronPreview(key, value, targetId);
  }

  function buildFansStatusTable(items) {
    var colgroup = '<colgroup><col><col><col><col><col><col><col><col></colgroup>';
    var header = '<tr>'
      + buildTableHeadCell('序号', 'index-head')
      + buildTableHeadCell('主播名称')
      + buildTableHeadCell('房间号', 'num-head')
      + buildTableHeadCell('等级', 'num-head')
      + buildTableHeadCell('排名', 'num-head')
      + buildTableHeadCell('今日亲密度', 'num-head')
      + buildTableHeadCell('亲密度', 'num-head')
      + buildTableHeadCell('双倍状态', 'control-head')
      + '</tr>';
    var rows = [];
    var i;
    for (i = 0; i < items.length; i += 1) {
      var item = items[i];
      rows.push('<tr>');
      rows.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
      rows.push(buildTextCell('主播名称', item.name || '未知主播'));
      rows.push(buildNumericCell('房间号', item.roomId));
      rows.push(buildNumericCell('等级', item.level));
      rows.push(buildNumericCell('排名', item.rank));
      rows.push(buildNumericCell('今日亲密度', item.today));
      rows.push(buildNumericCell('亲密度', item.intimacy));
      var doubleStatus = typeof item.doubleActive === 'boolean'
        ? buildStatusPill(item.doubleActive ? '双倍中' : '未开启', item.doubleActive ? 'ok' : 'off')
        : buildStatusPill('检测中', 'warn');
      rows.push(buildTableCell('双倍状态', doubleStatus, 'status-cell'));
      rows.push('</tr>');
    }
    return '<div class="table-shell"><table class="table table-fixed fans-status-table">' + colgroup + '<thead>' + header + '</thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function buildYubaStatusTable(items) {
    var colgroup = '<colgroup><col><col><col><col><col><col><col></colgroup>';
    var header = '<tr>'
      + buildTableHeadCell('序号', 'index-head')
      + buildTableHeadCell('鱼吧名称')
      + buildTableHeadCell('鱼吧ID', 'num-head')
      + buildTableHeadCell('等级', 'num-head')
      + buildTableHeadCell('排名', 'num-head')
      + buildTableHeadCell('经验值', 'num-head')
      + buildTableHeadCell('签到状态', 'control-head')
      + '</tr>';
    var rows = [];
    var i;
    for (i = 0; i < items.length; i += 1) {
      var item = items[i];
      var isSigned = typeof item.isSigned === 'number' ? item.isSigned : -1;
      var currentExp = item.groupExp != null ? String(item.groupExp) : '-';
      var nextExp = item.nextLevelExp != null ? String(item.nextLevelExp) : '-';
      var expText = currentExp + '/' + nextExp;
      rows.push('<tr>');
      rows.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
      rows.push(buildTextCell('鱼吧名称', item.groupName || '未知鱼吧'));
      rows.push(buildNumericCell('鱼吧ID', item.groupId));
      rows.push(buildNumericCell('等级', item.groupLevel != null ? item.groupLevel : '-'));
      rows.push(buildNumericCell('排名', item.rank > 0 ? item.rank : '-'));
      rows.push(buildTableCell('经验值', escapeHtml(expText), 'num-cell'));
      rows.push(buildTableCell('签到状态', item.error
        ? buildStatusPill('获取失败', 'warn') + '<div class="helper error-cell" style="margin-top:6px">' + escapeHtml(item.error) + '</div>'
        : buildStatusPill(isSigned > 0 ? '已签到' : '未签到', isSigned > 0 ? 'ok' : 'off'), 'status-cell'));
      rows.push('</tr>');
    }
    return '<div class="table-shell"><table class="table table-fixed yuba-status-table">' + colgroup + '<thead>' + header + '</thead><tbody>' + rows.join('') + '</tbody></table></div>';
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

  function renderCollectPage() {
    var config = getRawConfig();
    byId('collect-task-card').innerHTML = state.overview
      ? buildTaskCard(
        '领取',
        state.overview.collectGiftConfigured,
        state.overview.status.collectGift,
        '执行方式',
        state.overview.collectGiftConfigured ? '独立任务' : '等待启用'
      )
      : buildLoadingTaskCard('领取');
    byId('collect-enable').checked = isTaskActive(config.collectGift);
    byId('collect-cron').value = config.collectGift ? config.collectGift.cron : '0 10 3,5 * * *';
    void ensureCronPreview('collectGift', byId('collect-cron').value, 'collect-cron-preview');
  }

  function renderYubaPage() {
    renderRefreshButton();
    var rawConfig = getRawConfig();
    var config = rawConfig.yubaCheckIn || { active: false, cron: '0 23 0 * * *', mode: 'followed' };
    byId('yuba-task-card').innerHTML = state.overview
      ? buildTaskCard(
        '鱼吧签到',
        state.overview.yubaCheckInConfigured,
        state.overview.status.yubaCheckIn,
        '模式',
        config.mode === 'followed' ? '签到全部已关注鱼吧' : String(config.mode || '-')
      )
      : buildLoadingTaskCard('鱼吧签到');
    byId('yuba-enable').checked = isTaskActive(config);
    byId('yuba-cron').value = config.cron || '0 23 0 * * *';
    byId('yuba-mode').value = config.mode || 'followed';
    void ensureCronPreview('yubaCheckIn', byId('yuba-cron').value, 'yuba-cron-preview');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('yuba-note').textContent = '请先保存 Cookie 或启用 CookieCloud。鱼吧签到依赖当前账号的鱼吧登录态，以及主站 Cookie 中可组成 dy-token 的 acf 字段。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">保存鱼吧登录态后，这里会展示已关注鱼吧的等级、经验和签到状态。</div>';
      return;
    }

    if (String(config.mode || 'followed') !== 'followed') {
      byId('yuba-note').textContent = '当前模式无效，请重新保存鱼吧签到配置。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">当前模式无效，无法展示鱼吧状态列表。</div>';
      return;
    }

    if (state.yubaStatusLoading && !state.yubaStatusLoaded) {
      byId('yuba-note').textContent = '正在加载已关注鱼吧列表…';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">请稍候，鱼吧等级和经验列表正在更新。</div>';
      return;
    }

    if (state.yubaStatusError && !state.yubaStatusLoaded) {
      byId('yuba-note').textContent = '鱼吧列表加载失败。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">加载鱼吧列表失败：' + escapeHtml(state.yubaStatusError) + '。请点击顶部“刷新”重试。</div>';
      return;
    }

    if (!state.yubaStatusLoaded) {
      byId('yuba-note').textContent = '当前会通过 HTTP 接口拉取全部已关注鱼吧，再逐个检测签到状态并执行签到。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">正在准备加载鱼吧列表，也可以点击刷新手动加载。</div>';
      ensureYubaStatusForActiveTab();
      return;
    }

    if (!state.yubaStatus.length) {
      byId('yuba-note').textContent = '当前没有可展示的已关注鱼吧。';
      byId('yuba-table-wrap').innerHTML = '<div class="empty">当前没有可展示的已关注鱼吧数据。</div>';
      return;
    }

    byId('yuba-note').textContent = (state.yubaStatusLoading ? '正在后台更新，当前显示上次结果。' : '') + '当前已加载 ' + state.yubaStatus.length + ' 个已关注鱼吧，可直接查看等级、经验、排名和今日签到状态。';
    byId('yuba-table-wrap').innerHTML = buildYubaStatusTable(state.yubaStatus);
  }

  function renderKeepalivePage() {
    renderRefreshButton();
    var rawConfig = getRawConfig();
    var config = getManagedConfig().keepalive || rawConfig.keepalive || { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} };
    var fans = getManagedFans();
    byId('keepalive-task-card').innerHTML = state.overview
      ? buildTaskCard('保活', state.overview.keepaliveConfigured, state.overview.status.keepalive, '房间数', state.overview.keepaliveRooms)
      : buildLoadingTaskCard('保活');
    byId('keepalive-enable').checked = isTaskActive(getManagedConfig().keepalive || rawConfig.keepalive);
    byId('keepalive-cron').value = config.cron || '0 0 8 */6 * *';
    byId('keepalive-model').value = String(config.model || 2);
    void ensureCronPreview('keepalive', byId('keepalive-cron').value, 'keepalive-cron-preview');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('keepalive-note').textContent = '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成保活房间列表。';
      byId('keepalive-table-wrap').innerHTML = '<div class="empty">保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。</div>';
      return;
    }

    if (state.managedLoading && !fans.length) {
      byId('keepalive-note').textContent = '正在同步粉丝牌与保活配置…';
      byId('keepalive-table-wrap').innerHTML = '<div class="empty">请稍候…</div>';
      return;
    }

    if (!fans.length) {
      if (state.fansListError) {
        byId('keepalive-note').textContent = '粉丝牌列表加载失败。';
        byId('keepalive-table-wrap').innerHTML = '<div class="empty">加载粉丝牌列表失败：' + escapeHtml(state.fansListError) + '。请点击顶部“刷新”重试。</div>';
        return;
      }
      byId('keepalive-note').textContent = hasLoadedFansList() ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。';
      byId('keepalive-table-wrap').innerHTML = hasLoadedFansList()
        ? '<div class="empty">已同步，但当前账号没有可用粉丝牌数据。</div>'
        : '<div class="empty">正在准备加载粉丝牌列表，也可以点击刷新手动加载。</div>';
      ensureFansListForActiveTab();
      return;
    }

    byId('keepalive-note').textContent = (state.managedLoading ? '正在后台同步，当前显示上次结果。' : '') + '当前已同步 ' + fans.length + ' 个粉丝牌房间。';
    byId('keepalive-table-wrap').innerHTML = buildSendTable(fans, config, false, 'keepalive-value');
  }

  function setDoubleModeEmptyState(helpText, previewText) {
    if (byId('double-mode-help')) {
      byId('double-mode-help').textContent = helpText;
    }
    if (byId('double-ratio-preview')) {
      byId('double-ratio-preview').textContent = previewText;
    }
    if (byId('double-ratio-tools')) {
      byId('double-ratio-tools').style.display = Number(byId('double-model').value || 1) === 1 ? '' : 'none';
    }
  }

  function renderDoublePage() {
    renderRefreshButton();
    var rawConfig = getRawConfig();
    var config = getManagedConfig().doubleCard || rawConfig.doubleCard || { active: true, cron: '0 20 17,20,22,23 * * *', model: 1, giftScope: 'glowStick', send: {}, enabled: {} };
    var fans = getManagedFans();
    byId('double-task-card').innerHTML = state.overview
      ? buildTaskCard('双倍', state.overview.doubleCardConfigured, state.overview.status.doubleCard, '房间数', state.overview.doubleCardRooms)
      : buildLoadingTaskCard('双倍');
    byId('double-enable').checked = isTaskActive(getManagedConfig().doubleCard || rawConfig.doubleCard);
    byId('double-cron').value = config.cron || '0 20 17,20,22,23 * * *';
    byId('double-model').value = String(config.model || 1);
    byId('double-gift-scope').value = config.giftScope === 'limitedTime' ? 'limitedTime' : 'glowStick';
    void ensureCronPreview('doubleCard', byId('double-cron').value, 'double-cron-preview');

    if (!hasCookieSourceConfigured(rawConfig)) {
      byId('double-note').textContent = '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成双倍房间列表。';
      byId('double-table-wrap').innerHTML = '<div class="empty">保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。</div>';
      setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '保存登录凭证并同步粉丝牌后，这里会显示当前权重预览。');
      return;
    }

    if (state.managedLoading && !fans.length) {
      byId('double-note').textContent = '正在同步粉丝牌与双倍配置…';
      byId('double-table-wrap').innerHTML = '<div class="empty">请稍候…</div>';
      setDoubleModeEmptyState('正在同步双倍任务配置。', '同步完成后，这里会显示当前权重预览。');
      return;
    }

    if (!fans.length) {
      var doubleFansLoaded = hasLoadedFansList();
      if (state.fansListError) {
        byId('double-note').textContent = '粉丝牌列表加载失败。';
        byId('double-table-wrap').innerHTML = '<div class="empty">加载粉丝牌列表失败：' + escapeHtml(state.fansListError) + '。请点击顶部“刷新”重试。</div>';
        setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', '粉丝牌列表加载失败，刷新成功后会显示当前权重预览。');
        return;
      }
      byId('double-note').textContent = doubleFansLoaded ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。';
      byId('double-table-wrap').innerHTML = doubleFansLoaded
        ? '<div class="empty">已同步，但当前账号没有可用粉丝牌数据。</div>'
        : '<div class="empty">正在准备加载粉丝牌列表，也可以点击刷新手动加载。</div>';
      setDoubleModeEmptyState('按权重模式会在当前开双倍的房间之间重新分配。', doubleFansLoaded ? '当前没有可用于预览的粉丝牌房间。' : '粉丝牌列表加载后，这里会显示当前权重预览。');
      ensureFansListForActiveTab();
      return;
    }

    var enabledCount = 0;
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var roomKey = String(fans[i].roomId);
      if (config.enabled && config.enabled[roomKey]) {
        enabledCount += 1;
      }
    }
    byId('double-note').textContent = (state.managedLoading ? '正在后台同步，当前显示上次结果。' : '') + '当前已勾选 ' + enabledCount + ' / ' + fans.length + ' 个房间参与双倍。';
    byId('double-table-wrap').innerHTML = buildSendTable(fans, config, true, 'double-value');
    updateDoubleModeUi();
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

  function buildSendTable(fans, config, withEnabled, valueClass, options) {
    var model = Number(config.model || 1);
    var rows = [];
    var i;
    var taskLabel = valueClass === 'double-value'
      ? '双倍'
      : (valueClass === 'expiring-value' ? '临期' : '保活');
    for (i = 0; i < fans.length; i += 1) {
      var fan = fans[i];
      var key = String(fan.roomId);
      var roomLabel = String(fan.name || '未知主播') + '，房间 ' + key;
      var defaultWeight = options && options.firstWeightOnly ? (i === 0 ? 1 : 0) : 1;
      var sendItem = config.send && config.send[key] ? config.send[key] : {
        roomId: fan.roomId,
        number: model === 2 ? 1 : 0,
        weight: model === 1 ? defaultWeight : 0
      };
      var value = model === 2 ? Number(sendItem.number || 0) : Number(sendItem.weight || 0);
      rows.push('<tr>');
      if (withEnabled) {
        rows.push(buildTableCell('参与', '<input type="checkbox" class="double-enabled" name="double-enabled-' + escapeHtml(key) + '" data-room-id="' + escapeHtml(fan.roomId) + '" aria-label="' + escapeHtml('参与双倍任务：' + roomLabel) + '"' + (config.enabled && config.enabled[key] ? ' checked' : '') + '>', 'control-cell'));
      }
      rows.push(buildTableCell('序号', escapeHtml(i + 1), 'index-cell'));
      rows.push(buildTextCell('主播名称', fan.name || '未知主播'));
      rows.push(buildNumericCell('房间号', fan.roomId));
      rows.push(buildNumericCell('等级', fan.level));
      rows.push(buildNumericCell('排名', fan.rank));
      rows.push(buildNumericCell('今日亲密度', fan.today));
      rows.push(buildNumericCell('亲密度', fan.intimacy));
      rows.push(buildTableCell(model === 2 ? '数量' : '权重值', '<input type="number" class="' + valueClass + '" name="' + escapeHtml(valueClass + '-' + key) + '" data-room-id="' + escapeHtml(fan.roomId) + '" data-level="' + escapeHtml(fan.level) + '" min="0" step="1" inputmode="numeric" aria-label="' + escapeHtml(taskLabel + (model === 2 ? '数量：' : '权重值：') + roomLabel) + '" value="' + escapeHtml(value) + '">', 'control-cell'));
      rows.push('</tr>');
    }

    var colCount = withEnabled ? 9 : 8;
    var colgroup = '<colgroup>';
    for (var ci = 0; ci < colCount; ci += 1) {
      if (withEnabled && ci === 0) {
        colgroup += '<col style="width:68px">';
      } else if ((!withEnabled && ci === 0) || (withEnabled && ci === 1)) {
        colgroup += '<col style="width:56px">';
      } else if ((!withEnabled && ci === 1) || (withEnabled && ci === 2)) {
        colgroup += '<col style="width:156px">';
      } else if ((!withEnabled && ci === 2) || (withEnabled && ci === 3)) {
        colgroup += '<col style="width:104px">';
      } else if ((!withEnabled && ci === 7) || (withEnabled && ci === 8)) {
        colgroup += '<col style="width:112px">';
      } else {
        colgroup += '<col style="width:94px">';
      }
    }
    colgroup += '</colgroup>';

    var header = '<tr>';
    if (withEnabled) {
      header += buildTableHeadCell('参与', 'control-head');
    }
    header += buildTableHeadCell('序号', 'index-head')
      + buildTableHeadCell('主播名称')
      + buildTableHeadCell('房间号', 'num-head')
      + buildTableHeadCell('等级', 'num-head')
      + buildTableHeadCell('排名', 'num-head')
      + buildTableHeadCell('今日亲密度', 'num-head')
      + buildTableHeadCell('亲密度', 'num-head')
      + buildTableHeadCell(model === 2 ? '数量' : '权重值', 'control-head')
      + '</tr>';

    var tableClass = 'table table-fixed';
    if (valueClass === 'keepalive-value') tableClass += ' keepalive-table';
    else if (valueClass === 'double-value') tableClass += ' double-table';
    else if (valueClass === 'expiring-value') tableClass += ' expiring-table';

    return '<div class="table-shell"><table class="' + tableClass + '">' + colgroup + '<thead>' + header + '</thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  function formatRatioPercent(value) {
    var rounded = Math.round(value * 10) / 10;
    return String(rounded.toFixed(1)).replace(/\.0$/, '') + '%';
  }

  function updateDoubleTableHeaderLabel(model) {
    var header = document.querySelector('#double-table-wrap thead th:last-child');
    if (!header) {
      return;
    }
    header.textContent = model === 2 ? '数量' : '权重值';
  }

  function getDoubleFormSnapshot() {
    var fans = getManagedFans();
    var model = Number(byId('double-model').value || 1);
    var entries = [];
    var i;

    for (i = 0; i < fans.length; i += 1) {
      var fan = fans[i];
      var roomId = String(fan.roomId);
      var enabledNode = document.querySelector('.double-enabled[data-room-id="' + roomId + '"]');
      var inputNode = document.querySelector('.double-value[data-room-id="' + roomId + '"]');
      var rawValue = inputNode ? Number(inputNode.value) : 0;
      entries.push({
        fan: fan,
        roomId: roomId,
        enabled: Boolean(enabledNode && enabledNode.checked),
        value: Number.isFinite(rawValue) ? rawValue : 0
      });
    }

    return {
      model: model,
      entries: entries
    };
  }

  function updateDoubleModeUi() {
    var helpNode = byId('double-mode-help');
    var previewNode = byId('double-ratio-preview');
    var toolsNode = byId('double-ratio-tools');
    if (!helpNode || !previewNode || !toolsNode) {
      return;
    }

    var snapshot = getDoubleFormSnapshot();
    var enabledEntries = snapshot.entries.filter(function (entry) {
      return entry.enabled;
    });

    updateDoubleTableHeaderLabel(snapshot.model);

    if (snapshot.model === 2) {
      helpNode.textContent = '按固定数量时，会只在当前开双倍的房间里使用你填写的数量。没有房间开双倍时本次不送；只有 1 个房间开双倍时本次全部送给它。';
      previewNode.textContent = '固定数量模式保留现有行为。如果你想平均分配，切回“按权重”后点击“参与房间全部设为 1”即可。';
      toolsNode.style.display = 'none';
      return;
    }

    toolsNode.style.display = '';
    helpNode.textContent = '按权重模式不要求总和等于 100。多个房间同时开双倍时，只会在这些房间里按权重值重新分配。';

    if (!enabledEntries.length) {
      previewNode.textContent = '当前还没有勾选参与双倍的房间。';
      return;
    }

    var positiveEntries = enabledEntries.filter(function (entry) {
      return entry.value > 0;
    });
    if (!positiveEntries.length) {
      previewNode.textContent = '当前已勾选房间的权重值全是 0。至少给一个已勾选房间填写大于 0 的权重值。';
      return;
    }

    var totalWeight = positiveEntries.reduce(function (sum, entry) {
      return sum + entry.value;
    }, 0);
    var ratioText = positiveEntries.map(function (entry) {
      return entry.fan.name + '(' + entry.value + ')';
    }).join(' / ');
    var percentText = positiveEntries.map(function (entry) {
      return entry.fan.name + ' ' + formatRatioPercent((entry.value / totalWeight) * 100);
    }).join(' / ');

    previewNode.innerHTML = '当前权重：' + escapeHtml(ratioText) + '<br>折算占比：' + escapeHtml(percentText);
  }

  function applyDoubleRatioPreset(preset) {
    if (Number(byId('double-model').value || 1) !== 1) {
      toast('当前不是按权重模式', false);
      return;
    }

    var inputs = document.querySelectorAll('.double-value');
    var updated = 0;
    var i;
    for (i = 0; i < inputs.length; i += 1) {
      var input = inputs[i];
      var roomId = String(input.getAttribute('data-room-id'));
      var checkbox = document.querySelector('.double-enabled[data-room-id="' + roomId + '"]');
      if (!checkbox || !checkbox.checked) {
        continue;
      }
      input.value = preset === 'level'
        ? String(Math.max(Number(input.getAttribute('data-level') || 1), 1))
        : '1';
      updated += 1;
    }

    if (updated === 0) {
      toast('请先勾选参与双倍的房间', false);
      return;
    }

    updateDoubleModeUi();
    toast(preset === 'level' ? '已按粉丝牌等级填入权重值' : '已将参与房间全部设为 1', true);
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

  function syncCookieCloudToLoginCookies(showToast, rethrowError) {
    var rawConfig = getRawConfig();
    if (!getCookieCloudConfig(rawConfig).active) {
      return Promise.resolve(null);
    }

    return requestJson('/api/cookie-source/persist', {
      method: 'POST'
    }).then(function (data) {
      if (data && data.data && data.data.config) {
        state.rawConfig = data.data.config;
      }
      if (data && data.data && data.data.updated) {
        clearCookieBackedData();
      }
      renderLoginPage();
      if (showToast) {
        toast(data && data.data && data.data.updated ? 'CookieCloud 已同步到本地登录 Cookie' : '本地登录 Cookie 已是最新同步结果', true);
      }
      return data;
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      if (showToast) {
        toast('同步 CookieCloud 到登录 Cookie 失败：' + error.message, false);
      }
      if (rethrowError) {
        throw error;
      }
    });
  }

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

  function loadAuthStatus() {
    var requestSeq = nextAuthRequestSeq();
    return requestJson('/api/auth/status').then(function (data) {
      if (!isLatestAuthRequest(requestSeq)) {
        return state.auth.authenticated;
      }
      state.auth.checked = true;
      state.auth.authenticated = Boolean(data.authenticated);
      state.auth.submitting = false;
      state.auth.error = '';
      renderAuth();
      return state.auth.authenticated;
    }).catch(function (error) {
      if (!isLatestAuthRequest(requestSeq)) {
        return state.auth.authenticated;
      }
      state.auth.checked = true;
      state.auth.authenticated = false;
      state.auth.submitting = false;
      state.auth.error = '检查登录状态失败：' + error.message;
      clearProtectedState();
      renderAuth();
      return false;
    });
  }

  function loginWithPassword(password, options) {
    var loginOptions = options || {};
    if (!password) {
      state.auth.error = '请输入密码';
      renderAuth();
      return Promise.resolve(false);
    }

    var requestSeq = nextAuthRequestSeq();
    state.auth.submitting = true;
    state.auth.error = '';
    renderAuth();

    return requestJson('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    }).then(function () {
      if (!isLatestAuthRequest(requestSeq)) {
        return false;
      }
      state.auth.checked = true;
      state.auth.authenticated = true;
      state.auth.submitting = false;
      state.auth.error = '';
      if (loginOptions.clearPasswordInput !== false) {
        byId('web-password-input').value = '';
      }
      renderAuth();
      return loadProtectedData().then(function () {
        return true;
      });
    }).then(function (didLogin) {
      if (!didLogin) {
        return;
      }
      toast('登录成功', true);
    }).catch(function (error) {
      if (!isLatestAuthRequest(requestSeq)) {
        return;
      }
      state.auth.submitting = false;
      state.auth.authenticated = false;
      state.auth.error = '登录失败：' + error.message;
      renderAuth();
      return false;
    });
  }

  function submitLogin() {
    return loginWithPassword(byId('web-password-input').value);
  }

  function logout() {
    nextAuthRequestSeq();
    requestJson('/api/auth/logout', {
      method: 'POST'
    }).catch(function () {
      return null;
    }).then(function () {
      var passwordNode = byId('web-password-input');
      if (passwordNode) {
        passwordNode.value = '';
      }
      handleUnauthorized();
      state.auth.error = '';
      renderAuth();
      toast('已退出登录', true);
    });
  }

  function loadRawConfig() {
    return requestJson('/api/config/raw').then(function (data) {
      state.rawConfig = data.exists ? data.data : JSON.parse(JSON.stringify(DEFAULT_RAW_CONFIG));
      renderAll();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载配置失败：' + error.message, false);
    });
  }

  function loadOverview() {
    return requestJson('/api/overview').then(function (data) {
      state.overview = data;
      renderOverview();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载概览失败：' + error.message, false);
    });
  }

  function loadLogs() {
    return requestJson('/api/logs').then(function (data) {
      state.logs = data;
      state.logsRefreshedAt = new Date().toISOString();
      renderLogsPage();
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载日志失败：' + error.message, false);
    });
  }

  function syncFans(showToast) {
    var rawConfig = getRawConfig();
    var resource = getResourceRequest('fansSync');
    if (!hasCookieSourceConfigured(rawConfig)) {
      invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus']);
      state.managedLoading = false;
      state.fansStatusLoading = false;
      state.fansStatusDetailsLoading = false;
      toast('请先保存 Cookie 或启用 CookieCloud', false);
      renderAll();
      return Promise.resolve();
    }

    if (resource.pending) {
      return resource.pending;
    }

    var requestSeq = resource.requestSeq + 1;
    resource.requestSeq = requestSeq;
    state.managedLoading = true;
    state.fansListError = '';
    renderAll();
    var pending = requestJson('/api/fans/reconcile', {
      method: 'POST'
    }).then(function (data) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      state.managed = data;
      state.rawConfig = data.config;
      state.managedLoading = false;
      markResourceLoaded('fansList');
      invalidateResourceRequest('fansStatus');
      renderAll();
      if (showToast) {
        toast('粉丝牌与任务配置已同步', true);
      }
    }).catch(function (error) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      state.managedLoading = false;
      state.fansListError = error.message || String(error);
      renderAll();
      toast('同步粉丝牌失败：' + error.message, false);
    });
    return trackResourceRequest(resource, requestSeq, pending);
  }

  function loadFansList(showToast) {
    var rawConfig = getRawConfig();
    var resource = getResourceRequest('fansList');
    if (!hasCookieSourceConfigured(rawConfig)) {
      invalidateResourceRequest('fansList');
      state.managed = null;
      state.managedLoading = false;
      renderAll();
      if (showToast) {
        toast('请先保存 Cookie 或启用 CookieCloud', false);
      }
      return Promise.resolve();
    }

    if (resource.pending) {
      return resource.pending;
    }

    var requestSeq = resource.requestSeq + 1;
    resource.requestSeq = requestSeq;
    state.managedLoading = true;
    state.fansListError = '';
    renderAll();
    var pending = requestJson('/api/fans').then(function (data) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      setManagedFans(data);
      state.managedLoading = false;
      markResourceLoaded('fansList');
      renderAll();
      if (showToast) {
        toast('粉丝牌列表已加载', true);
      }
    }).catch(function (error) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      state.managedLoading = false;
      state.fansListError = error.message || String(error);
      renderAll();
      toast('加载粉丝牌列表失败：' + error.message, false);
    });
    return trackResourceRequest(resource, requestSeq, pending);
  }

  function loadFansStatus(showToast) {
    var rawConfig = getRawConfig();
    var resource = getResourceRequest('fansStatus');
    if (!hasCookieSourceConfigured(rawConfig)) {
      invalidateResourceRequest('fansStatus');
      state.fansStatus = [];
      state.giftStatus = null;
      state.fansStatusLoading = false;
      state.fansStatusLoaded = false;
      state.fansStatusDetailsLoaded = false;
      state.fansStatusDetailsLoading = false;
      renderOverview();
      renderExpiringGiftPage();
      if (showToast) {
        toast('请先保存 Cookie 或启用 CookieCloud', false);
      }
      return Promise.resolve();
    }

    if (resource.pending) {
      return resource.pending;
    }

    var requestSeq = resource.requestSeq + 1;
    resource.requestSeq = requestSeq;
    state.fansStatusLoading = true;
    state.fansStatusDetailsLoading = true;
    renderOverview();
    renderExpiringGiftPage();
    var pending = requestJson('/api/fans/status/base').then(function (data) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      applyFansStatusBase(data);
      renderOverview();
      renderExpiringGiftPage();
      if (data && data.complete) {
        state.fansStatusLoading = false;
        state.fansStatusDetailsLoading = false;
        markResourceLoaded('fansStatus');
        if (state.fansStatus.length) {
          markResourceLoaded('fansList');
        }
        renderOverview();
        renderExpiringGiftPage();
        if (showToast) {
          toast('粉丝牌状态已刷新', true);
        }
        return null;
      }
      return requestJson('/api/fans/status/details');
    }).then(function (data) {
      if (!data || resource.requestSeq !== requestSeq) {
        return;
      }
      applyFansStatusDetails(data);
      state.fansStatusLoading = false;
      state.fansStatusDetailsLoading = false;
      markResourceLoaded('fansStatus');
      if (state.fansStatus.length) {
        markResourceLoaded('fansList');
      }
      renderOverview();
      renderExpiringGiftPage();
      if (showToast) {
        toast('粉丝牌状态已刷新', true);
      }
    }).catch(function (error) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      state.fansStatusLoading = false;
      state.fansStatusDetailsLoading = false;
      if (!state.fansStatusLoaded) {
        state.fansStatus = [];
        state.giftStatus = null;
        state.fansStatusDetailsLoaded = false;
      }
      renderOverview();
      renderExpiringGiftPage();
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('加载粉丝牌状态失败：' + error.message, false);
    });
    return trackResourceRequest(resource, requestSeq, pending);
  }

  function loadYubaStatus(showToast) {
    var rawConfig = getRawConfig();
    var resource = getResourceRequest('yubaStatus');
    if (!hasCookieSourceConfigured(rawConfig)) {
      invalidateResourceRequest('yubaStatus');
      state.yubaStatus = [];
      state.yubaStatusLoaded = false;
      state.yubaStatusLoading = false;
      renderYubaPage();
      if (showToast) {
        toast('请先保存 Cookie 或启用 CookieCloud', false);
      }
      return Promise.resolve();
    }

    if (resource.pending) {
      return resource.pending;
    }

    var requestSeq = resource.requestSeq + 1;
    resource.requestSeq = requestSeq;
    state.yubaStatusLoading = true;
    state.yubaStatusError = '';
    renderYubaPage();
    var pending = requestJson('/api/yuba/status').then(function (data) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      state.yubaStatus = data && data.groups ? data.groups : [];
      state.yubaStatusLoaded = true;
      state.yubaStatusLoading = false;
      markResourceLoaded('yubaStatus');
      renderYubaPage();
      if (showToast) {
        toast('鱼吧状态已刷新', true);
      }
    }).catch(function (error) {
      if (resource.requestSeq !== requestSeq) {
        return;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      state.yubaStatusLoading = false;
      state.yubaStatusError = error.message || String(error);
      if (!state.yubaStatusLoaded) {
        state.yubaStatus = [];
      }
      renderYubaPage();
      toast('加载鱼吧状态失败：' + error.message, false);
    });
    return trackResourceRequest(resource, requestSeq, pending);
  }

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

  function saveCookie() {
    var mainCookie = byId('main-cookie-input').value.trim();
    var yubaCookie = byId('yuba-cookie-input').value.trim();

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manualCookies: {
          main: mainCookie,
          yuba: yubaCookie
        }
      })
    }).then(function () {
      clearCookieBackedData();
      toast('手填 Cookie 已保存', true);
      return refreshOverviewSurface(false);
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存手填 Cookie 失败：' + error.message, false);
    });
  }

  function saveCookieCloud(options) {
    var checkbox = byId('cookie-cloud-enable');
    var shouldEnable = Boolean(options && options.forceEnable) || checkbox.checked;
    if (options && options.forceEnable) {
      checkbox.checked = true;
    }

    var payload = {
      cookieCloud: {
        active: shouldEnable,
        endpoint: byId('cookie-cloud-endpoint').value.trim(),
        uuid: byId('cookie-cloud-uuid').value.trim(),
        cron: byId('cookie-cloud-cron').value.trim(),
        password: byId('cookie-cloud-password').value.trim(),
        cryptoType: 'legacy'
      }
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (data) {
      state.cookieCheck = null;
      if (data && data.data && data.data.config) {
        state.rawConfig = data.data.config;
      }
      clearCookieBackedData();
      if (!options || !options.quietSuccess) {
        toast(shouldEnable ? 'CookieCloud 已保存并启用' : 'CookieCloud 配置已保存', true);
      }
      if (payload.cookieCloud.active) {
        return checkCookieSource(false);
      }
      renderLoginPage();
      return null;
    }).then(function () {
      return refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxTo !== undefined) {
        checkbox.checked = options.revertCheckboxTo;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast((shouldEnable ? '保存并启用 CookieCloud 失败：' : '保存 CookieCloud 失败：') + error.message, false);
    });
  }

  function checkCookieSource(showToast) {
    return syncCookieCloudToLoginCookies(false, true).then(function () {
      return requestJson('/api/cookie-source/check', {
        method: 'POST'
      });
    }).then(function (data) {
      state.cookieCheck = data;
      renderCookieCheck();
      if (showToast !== false) {
        var readyForDyTokenYuba = data.mainCookieReady && data.yubaDyTokenReady;
        toast(readyForDyTokenYuba ? '登录凭证已同步，dy-token 鱼吧请求已就绪' : '登录凭证已同步并校验，请查看缺失项', readyForDyTokenYuba);
      }
      return data;
    }).catch(function (error) {
      if (isUnauthorizedError(error)) {
        return;
      }
      state.cookieCheck = null;
      renderCookieCheck();
      toast('同步并校验登录凭证失败：' + error.message, false);
    });
  }

  function saveCookieCloudToggle(options) {
    saveCookieCloud({
      revertCheckboxTo: options && options.revertCheckboxOnError ? !byId('cookie-cloud-enable').checked : undefined,
      quietSuccess: true
    });
  }

  function saveAndEnableCookieCloud() {
    saveCookieCloud({
      forceEnable: true,
      revertCheckboxTo: byId('cookie-cloud-enable').checked
    });
  }

  function disableCookieCloud() {
    saveCookieCloud({
      revertCheckboxTo: true,
      quietSuccess: true
    });
  }

  function saveCollectConfig(options) {
    byId('collect-enable').checked = true;
    var payload = {
      collectGift: { active: true, cron: byId('collect-cron').value.trim() }
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('领取任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('collect-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用领取任务失败：' + error.message, false);
    });
  }

  function disableCollectConfig() {
    var currentConfig = getRawConfig().collectGift || { active: true, cron: '0 10 3,5 * * *' };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectGift: {
          active: false,
          cron: currentConfig.cron || '0 10 3,5 * * *'
        }
      })
    }).then(function () {
      toast('领取任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('collect-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用领取任务失败：' + error.message, false);
    });
  }

  function saveYubaConfig(options) {
    byId('yuba-enable').checked = true;
    var payload = {
      yubaCheckIn: {
        active: true,
        cron: byId('yuba-cron').value.trim(),
        mode: byId('yuba-mode').value || 'followed'
      }
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('鱼吧签到任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('yuba-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用鱼吧签到任务失败：' + error.message, false);
    });
  }

  function disableYubaConfig() {
    var currentConfig = getRawConfig().yubaCheckIn || { active: false, cron: '0 23 0 * * *', mode: 'followed' };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yubaCheckIn: {
          active: false,
          cron: currentConfig.cron || '0 23 0 * * *',
          mode: currentConfig.mode || 'followed'
        }
      })
    }).then(function () {
      toast('鱼吧签到任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('yuba-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用鱼吧签到任务失败：' + error.message, false);
    });
  }

  function buildSendPayload(valueClass, includeEnabled) {
    var fans = getManagedFans();
    var send = {};
    var model = Number(includeEnabled ? byId('double-model').value : byId('keepalive-model').value);
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var roomId = fans[i].roomId;
      var input = document.querySelector('.' + valueClass + '[data-room-id="' + roomId + '"]');
      var value = input ? Number(input.value) : 0;
      send[String(roomId)] = {
        roomId: roomId,
        giftId: 268,
        number: model === 2 ? value : 0,
        weight: model === 1 ? value : 0,
        count: 0
      };
    }

    var result = {
      active: true,
      cron: includeEnabled ? byId('double-cron').value.trim() : byId('keepalive-cron').value.trim(),
      model: model,
      send: send
    };

    if (includeEnabled) {
      var enabledMap = {};
      var checkboxes = document.querySelectorAll('.double-enabled');
      for (i = 0; i < checkboxes.length; i += 1) {
        enabledMap[String(checkboxes[i].getAttribute('data-room-id'))] = Boolean(checkboxes[i].checked);
      }
      result.enabled = enabledMap;
      result.giftScope = byId('double-gift-scope').value === 'limitedTime' ? 'limitedTime' : 'glowStick';
    }

    return result;
  }

  function buildExpiringGiftPayload() {
    var fans = getManagedFans();
    var send = {};
    var model = Number(byId('expiring-model').value || 1);
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var roomId = fans[i].roomId;
      var input = document.querySelector('.expiring-value[data-room-id="' + roomId + '"]');
      var value = input ? Number(input.value) : 0;
      send[String(roomId)] = {
        roomId: roomId,
        giftId: 268,
        number: model === 2 ? value : 0,
        weight: model === 1 ? value : 0,
        count: 0
      };
    }

    return {
      active: true,
      cron: byId('expiring-cron').value.trim(),
      thresholdHours: Number(byId('expiring-threshold-hours').value || 24),
      model: model,
      send: send
    };
  }

  function saveKeepaliveConfig(options) {
    byId('keepalive-enable').checked = true;
    var payload = {
      keepalive: buildSendPayload('keepalive-value', false)
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('保活任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('keepalive-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用保活任务失败：' + error.message, false);
    });
  }

  function disableKeepaliveConfig() {
    var currentConfig = getManagedConfig().keepalive || getRawConfig().keepalive || { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keepalive: {
          active: false,
          cron: currentConfig.cron || '0 0 8 */6 * *',
          model: Number(currentConfig.model || 2),
          send: currentConfig.send || {}
        }
      })
    }).then(function () {
      toast('保活任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('keepalive-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用保活任务失败：' + error.message, false);
    });
  }

  function saveDoubleConfig(options) {
    byId('double-enable').checked = true;
    var nextConfig = buildSendPayload('double-value', true);
    if (nextConfig.model === 1) {
      var enabledKeys = Object.keys(nextConfig.enabled || {}).filter(function (key) {
        return nextConfig.enabled[key];
      });
      var totalWeight = enabledKeys.reduce(function (sum, key) {
        return sum + (nextConfig.send[key] ? Number(nextConfig.send[key].weight || 0) : 0);
      }, 0);
      if (enabledKeys.length > 0 && totalWeight <= 0) {
        toast('按权重模式至少需要一个已勾选房间填写大于 0 的权重值', false);
        return;
      }
    }

    var payload = {
      doubleCard: nextConfig
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('双倍任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('double-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用双倍任务失败：' + error.message, false);
    });
  }

  function saveExpiringGiftConfig(options) {
    byId('expiring-enable').checked = true;
    var payload = {
      expiringGift: buildExpiringGiftPayload()
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('临期任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('expiring-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用临期任务失败：' + error.message, false);
    });
  }

  function disableExpiringGiftConfig() {
    var currentConfig = getManagedConfig().expiringGift || getRawConfig().expiringGift || { active: false, cron: '0 45 23 * * *', thresholdHours: 24, model: 1, send: {} };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expiringGift: {
          active: false,
          cron: currentConfig.cron || '0 45 23 * * *',
          thresholdHours: Number(currentConfig.thresholdHours || 24),
          model: Number(currentConfig.model || 1),
          send: currentConfig.send || {}
        }
      })
    }).then(function () {
      toast('临期任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('expiring-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用临期任务失败：' + error.message, false);
    });
  }

  function disableDoubleConfig() {
    var currentConfig = getManagedConfig().doubleCard || getRawConfig().doubleCard || { active: true, cron: '0 20 17,20,22,23 * * *', model: 1, giftScope: 'glowStick', send: {}, enabled: {} };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doubleCard: {
          active: false,
          cron: currentConfig.cron || '0 20 17,20,22,23 * * *',
          model: Number(currentConfig.model || 1),
          giftScope: currentConfig.giftScope === 'limitedTime' ? 'limitedTime' : 'glowStick',
          send: currentConfig.send || {},
          enabled: currentConfig.enabled || {}
        }
      })
    }).then(function () {
      toast('双倍任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('double-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用双倍任务失败：' + error.message, false);
    });
  }

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
