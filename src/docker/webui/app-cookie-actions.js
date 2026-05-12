(function () {
  function createCookieActions(deps) {
    var byId = deps.byId;
    var state = deps.state;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var getRawConfig = deps.getRawConfig;
    var getCookieCloudConfig = deps.getCookieCloudConfig;
    var clearCookieBackedData = deps.clearCookieBackedData;
    var renderLoginPage = deps.renderLoginPage;
    var renderCookieCheck = deps.renderCookieCheck;
    var refreshOverviewSurface = deps.refreshOverviewSurface;

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

    return {
      syncCookieCloudToLoginCookies: syncCookieCloudToLoginCookies,
      saveCookie: saveCookie,
      saveCookieCloud: saveCookieCloud,
      checkCookieSource: checkCookieSource,
      saveCookieCloudToggle: saveCookieCloudToggle,
      saveAndEnableCookieCloud: saveAndEnableCookieCloud,
      disableCookieCloud: disableCookieCloud
    };
  }

  window.DOUYU_KEEP_WEBUI_COOKIE_ACTIONS = {
    create: createCookieActions
  };
}());
