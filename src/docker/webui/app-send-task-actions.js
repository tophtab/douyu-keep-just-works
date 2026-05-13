(function () {
  function createSendTaskActions(deps) {
    var KEEPALIVE_ACTIONS = window.DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS.create(deps);
    var DOUBLE_ACTIONS = window.DOUYU_KEEP_WEBUI_DOUBLE_TASK_ACTIONS.create(deps);
    var EXPIRING_ACTIONS = window.DOUYU_KEEP_WEBUI_EXPIRING_TASK_ACTIONS.create(deps);

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
      return EXPIRING_ACTIONS.saveExpiringGiftConfig(options);
    }

    function disableExpiringGiftConfig() {
      return EXPIRING_ACTIONS.disableExpiringGiftConfig();
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
