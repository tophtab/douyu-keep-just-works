(function () {
  function createSystemResourceActions(deps) {
    var state = deps.state;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var defaultRawConfig = deps.defaultRawConfig;
    var renderAll = deps.renderAll;
    var renderOverview = deps.renderOverview;
    var renderLogsPage = deps.renderLogsPage;

    function cloneDefaultRawConfig() {
      return JSON.parse(JSON.stringify(defaultRawConfig));
    }

    function loadRawConfig() {
      return requestJson('/api/config/raw').then(function (data) {
        state.rawConfig = data.exists ? data.data : cloneDefaultRawConfig();
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

    return {
      loadRawConfig: loadRawConfig,
      loadOverview: loadOverview,
      loadLogs: loadLogs
    };
  }

  window.DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS = {
    create: createSystemResourceActions
  };
})();
