(function () {
  function createStateModule(deps) {
    var defaultRawConfig = deps.defaultRawConfig;
    var initialTab = deps.initialTab;

    function createResourceRequest() {
      return {
        pending: null,
        fetchedAt: 0,
        requestSeq: 0
      };
    }

    var state = {
      activeTab: initialTab,
      auth: {
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
      }
    };

    function getRawConfig() {
      if (state.rawConfig) {
        return state.rawConfig;
      }
      return JSON.parse(JSON.stringify(defaultRawConfig));
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

    return {
      state: state,
      getRawConfig: getRawConfig,
      getCookieCloudConfig: getCookieCloudConfig,
      getManualCookiesConfig: getManualCookiesConfig,
      hasCookieSourceConfigured: hasCookieSourceConfigured,
      getCookieSourceLabel: getCookieSourceLabel,
      buildCookieCheckText: buildCookieCheckText,
      isUnauthorizedError: isUnauthorizedError,
      getResourceRequest: getResourceRequest,
      hasLoadedFansList: hasLoadedFansList,
      markResourceLoaded: markResourceLoaded,
      invalidateResourceRequest: invalidateResourceRequest,
      invalidateResourceRequests: invalidateResourceRequests,
      trackResourceRequest: trackResourceRequest,
      isActiveRefreshLoading: isActiveRefreshLoading
    };
  }

  window.DOUYU_KEEP_WEBUI_STATE = {
    create: createStateModule
  };
}());
