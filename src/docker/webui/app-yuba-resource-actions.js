(function () {
  function createYubaResourceActions(deps) {
    var state = deps.state;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var getRawConfig = deps.getRawConfig;
    var hasCookieSourceConfigured = deps.hasCookieSourceConfigured;
    var markResourceLoaded = deps.markResourceLoaded;
    var invalidateResourceRequest = deps.invalidateResourceRequest;
    var getResourceRequest = deps.getResourceRequest;
    var trackResourceRequest = deps.trackResourceRequest;
    var renderYubaPage = deps.renderYubaPage;

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

    return {
      loadYubaStatus: loadYubaStatus
    };
  }

  window.DOUYU_KEEP_WEBUI_YUBA_RESOURCE_ACTIONS = {
    create: createYubaResourceActions
  };
})();
