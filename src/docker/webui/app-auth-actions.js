(function () {
  function createAuthActions(deps) {
    var byId = deps.byId;
    var state = deps.state;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var nextAuthRequestSeq = deps.nextAuthRequestSeq;
    var isLatestAuthRequest = deps.isLatestAuthRequest;
    var clearProtectedState = deps.clearProtectedState;
    var handleUnauthorized = deps.handleUnauthorized;
    var renderAuth = deps.renderAuth;
    var loadProtectedData = deps.loadProtectedData;

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

    return {
      loadAuthStatus: loadAuthStatus,
      loginWithPassword: loginWithPassword,
      submitLogin: submitLogin,
      logout: logout
    };
  }

  window.DOUYU_KEEP_WEBUI_AUTH_ACTIONS = {
    create: createAuthActions
  };
})();
