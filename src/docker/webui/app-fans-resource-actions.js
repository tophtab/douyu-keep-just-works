(function () {
  function createFansResourceActions(deps) {
    var state = deps.state;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var getRawConfig = deps.getRawConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var setManagedFans = deps.setManagedFans;
    var markResourceLoaded = deps.markResourceLoaded;
    var invalidateResourceRequest = deps.invalidateResourceRequest;
    var invalidateResourceRequests = deps.invalidateResourceRequests;
    var getResourceRequest = deps.getResourceRequest;
    var trackResourceRequest = deps.trackResourceRequest;
    var applyFansStatusBase = deps.applyFansStatusBase;
    var applyFansStatusDetails = deps.applyFansStatusDetails;
    var renderAll = deps.renderAll;
    var renderOverview = deps.renderOverview;
    var renderExpiringGiftPage = deps.renderExpiringGiftPage;

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

    return {
      syncFans: syncFans,
      loadFansList: loadFansList,
      loadFansStatus: loadFansStatus
    };
  }

  window.DOUYU_KEEP_WEBUI_FANS_RESOURCE_ACTIONS = {
    create: createFansResourceActions
  };
})();
