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
    var getManagedConfig = deps.getManagedConfig;
    var getManagedFans = deps.getManagedFans;
    var setManagedFans = deps.setManagedFans;
    var markResourceLoaded = deps.markResourceLoaded;
    var invalidateResourceRequest = deps.invalidateResourceRequest;
    var invalidateResourceRequests = deps.invalidateResourceRequests;
    var getResourceRequest = deps.getResourceRequest;
    var trackResourceRequest = deps.trackResourceRequest;
    var clearCookieBackedData = deps.clearCookieBackedData;
    var clearProtectedState = deps.clearProtectedState;
    var applyFansStatusBase = deps.applyFansStatusBase;
    var applyFansStatusDetails = deps.applyFansStatusDetails;
    var nextAuthRequestSeq = deps.nextAuthRequestSeq;
    var isLatestAuthRequest = deps.isLatestAuthRequest;
    var handleUnauthorized = deps.handleUnauthorized;
    var renderAuth = deps.renderAuth;
    var renderAll = deps.renderAll;
    var renderLoginPage = deps.renderLoginPage;
    var renderCookieCheck = deps.renderCookieCheck;
    var renderOverview = deps.renderOverview;
    var renderLogsPage = deps.renderLogsPage;
    var renderKeepalivePage = deps.renderKeepalivePage;
    var renderDoublePage = deps.renderDoublePage;
    var renderExpiringGiftPage = deps.renderExpiringGiftPage;
    var renderYubaPage = deps.renderYubaPage;
    var setActiveTab = deps.setActiveTab;

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
