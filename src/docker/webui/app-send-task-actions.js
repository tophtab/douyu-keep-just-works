(function () {
  function createSendTaskActions(deps) {
    var byId = deps.byId;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var getRawConfig = deps.getRawConfig;
    var getManagedConfig = deps.getManagedConfig;
    var getManagedFans = deps.getManagedFans;
    var refreshOverviewSurface = deps.refreshOverviewSurface;
    var KEEPALIVE_ACTIONS = window.DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS.create(deps);
    var DOUBLE_ACTIONS = window.DOUYU_KEEP_WEBUI_DOUBLE_TASK_ACTIONS.create(deps);

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
      return KEEPALIVE_ACTIONS.saveKeepaliveConfig(options);
    }

    function disableKeepaliveConfig() {
      return KEEPALIVE_ACTIONS.disableKeepaliveConfig();
    }

    function saveDoubleConfig(options) {
      return DOUBLE_ACTIONS.saveDoubleConfig(options);
    }

    function disableDoubleConfig() {
      return DOUBLE_ACTIONS.disableDoubleConfig();
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

    return {
      saveKeepaliveConfig: saveKeepaliveConfig,
      disableKeepaliveConfig: disableKeepaliveConfig,
      saveDoubleConfig: saveDoubleConfig,
      disableDoubleConfig: disableDoubleConfig,
      saveExpiringGiftConfig: saveExpiringGiftConfig,
      disableExpiringGiftConfig: disableExpiringGiftConfig
    };
  }

  window.DOUYU_KEEP_WEBUI_SEND_TASK_ACTIONS = {
    create: createSendTaskActions
  };
})();
