(function () {
  function createTaskActions(deps) {
    var SIMPLE_ACTIONS = window.DOUYU_KEEP_WEBUI_SIMPLE_TASK_ACTIONS.create(deps);
    var SEND_ACTIONS = window.DOUYU_KEEP_WEBUI_SEND_TASK_ACTIONS.create(deps);

    return {
      saveCollectConfig: SIMPLE_ACTIONS.saveCollectConfig,
      disableCollectConfig: SIMPLE_ACTIONS.disableCollectConfig,
      saveYubaConfig: SIMPLE_ACTIONS.saveYubaConfig,
      disableYubaConfig: SIMPLE_ACTIONS.disableYubaConfig,
      saveKeepaliveConfig: SEND_ACTIONS.saveKeepaliveConfig,
      disableKeepaliveConfig: SEND_ACTIONS.disableKeepaliveConfig,
      saveDoubleConfig: SEND_ACTIONS.saveDoubleConfig,
      saveExpiringGiftConfig: SEND_ACTIONS.saveExpiringGiftConfig,
      disableExpiringGiftConfig: SEND_ACTIONS.disableExpiringGiftConfig,
      disableDoubleConfig: SEND_ACTIONS.disableDoubleConfig
    };
  }

  window.DOUYU_KEEP_WEBUI_TASK_ACTIONS = {
    create: createTaskActions
  };
})();
