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

    function buildDoublePayload() {
      var fans = getManagedFans();
      var send = {};
      var model = Number(byId('double-model').value);
      var i;
      for (i = 0; i < fans.length; i += 1) {
        var roomId = fans[i].roomId;
        var input = document.querySelector('.double-value[data-room-id="' + roomId + '"]');
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
        cron: byId('double-cron').value.trim(),
        model: model,
        send: send
      };

      var enabledMap = {};
      var checkboxes = document.querySelectorAll('.double-enabled');
      for (i = 0; i < checkboxes.length; i += 1) {
        enabledMap[String(checkboxes[i].getAttribute('data-room-id'))] = Boolean(checkboxes[i].checked);
      }
      result.enabled = enabledMap;
      result.giftScope = byId('double-gift-scope').value === 'limitedTime' ? 'limitedTime' : 'glowStick';

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
      return KEEPALIVE_ACTIONS.saveKeepaliveConfig(options);
    }

    function disableKeepaliveConfig() {
      return KEEPALIVE_ACTIONS.disableKeepaliveConfig();
    }

    function saveDoubleConfig(options) {
      byId('double-enable').checked = true;
      var nextConfig = buildDoublePayload();
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
