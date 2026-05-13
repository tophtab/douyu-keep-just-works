(function () {
  function createSimpleTaskActions(deps) {
    var byId = deps.byId;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var getRawConfig = deps.getRawConfig;
    var refreshOverviewSurface = deps.refreshOverviewSurface;
    var COLLECT_ACTIONS = window.DOUYU_KEEP_WEBUI_COLLECT_TASK_ACTIONS.create(deps);

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

    return {
      saveCollectConfig: COLLECT_ACTIONS.saveCollectConfig,
      disableCollectConfig: COLLECT_ACTIONS.disableCollectConfig,
      saveYubaConfig: saveYubaConfig,
      disableYubaConfig: disableYubaConfig
    };
  }

  window.DOUYU_KEEP_WEBUI_SIMPLE_TASK_ACTIONS = {
    create: createSimpleTaskActions
  };
})();
