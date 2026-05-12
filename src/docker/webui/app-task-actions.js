(function () {
  function createTaskActions(deps) {
    var byId = deps.byId;
    var toast = deps.toast;
    var requestJson = deps.requestJson;
    var isUnauthorizedError = deps.isUnauthorizedError;
    var getRawConfig = deps.getRawConfig;
    var getManagedConfig = deps.getManagedConfig;
    var getManagedFans = deps.getManagedFans;
    var refreshOverviewSurface = deps.refreshOverviewSurface;

  function saveCollectConfig(options) {
    byId('collect-enable').checked = true;
    var payload = {
      collectGift: { active: true, cron: byId('collect-cron').value.trim() }
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('领取任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('collect-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用领取任务失败：' + error.message, false);
    });
  }

  function disableCollectConfig() {
    var currentConfig = getRawConfig().collectGift || { active: true, cron: '0 10 3,5 * * *' };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectGift: {
          active: false,
          cron: currentConfig.cron || '0 10 3,5 * * *'
        }
      })
    }).then(function () {
      toast('领取任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('collect-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用领取任务失败：' + error.message, false);
    });
  }

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

  function buildSendPayload(valueClass, includeEnabled) {
    var fans = getManagedFans();
    var send = {};
    var model = Number(includeEnabled ? byId('double-model').value : byId('keepalive-model').value);
    var i;
    for (i = 0; i < fans.length; i += 1) {
      var roomId = fans[i].roomId;
      var input = document.querySelector('.' + valueClass + '[data-room-id="' + roomId + '"]');
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
      cron: includeEnabled ? byId('double-cron').value.trim() : byId('keepalive-cron').value.trim(),
      model: model,
      send: send
    };

    if (includeEnabled) {
      var enabledMap = {};
      var checkboxes = document.querySelectorAll('.double-enabled');
      for (i = 0; i < checkboxes.length; i += 1) {
        enabledMap[String(checkboxes[i].getAttribute('data-room-id'))] = Boolean(checkboxes[i].checked);
      }
      result.enabled = enabledMap;
      result.giftScope = byId('double-gift-scope').value === 'limitedTime' ? 'limitedTime' : 'glowStick';
    }

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
    byId('keepalive-enable').checked = true;
    var payload = {
      keepalive: buildSendPayload('keepalive-value', false)
    };

    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function () {
      toast('保活任务已保存并启用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      if (options && options.revertCheckboxOnError) {
        byId('keepalive-enable').checked = false;
      }
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('保存并启用保活任务失败：' + error.message, false);
    });
  }

  function disableKeepaliveConfig() {
    var currentConfig = getManagedConfig().keepalive || getRawConfig().keepalive || { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} };
    requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keepalive: {
          active: false,
          cron: currentConfig.cron || '0 0 8 */6 * *',
          model: Number(currentConfig.model || 2),
          send: currentConfig.send || {}
        }
      })
    }).then(function () {
      toast('保活任务已停用', true);
      refreshOverviewSurface(false);
    }).catch(function (error) {
      byId('keepalive-enable').checked = true;
      if (isUnauthorizedError(error)) {
        return;
      }
      toast('停用保活任务失败：' + error.message, false);
    });
  }

  function saveDoubleConfig(options) {
    byId('double-enable').checked = true;
    var nextConfig = buildSendPayload('double-value', true);
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


    return {
      saveCollectConfig: saveCollectConfig,
      disableCollectConfig: disableCollectConfig,
      saveYubaConfig: saveYubaConfig,
      disableYubaConfig: disableYubaConfig,
      saveKeepaliveConfig: saveKeepaliveConfig,
      disableKeepaliveConfig: disableKeepaliveConfig,
      saveDoubleConfig: saveDoubleConfig,
      saveExpiringGiftConfig: saveExpiringGiftConfig,
      disableExpiringGiftConfig: disableExpiringGiftConfig,
      disableDoubleConfig: disableDoubleConfig
    };
  }

  window.DOUYU_KEEP_WEBUI_TASK_ACTIONS = {
    create: createTaskActions
  };
})();
