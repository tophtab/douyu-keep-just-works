(function () {
  function createSimpleTaskActions(deps) {
    var COLLECT_ACTIONS = window.DOUYU_KEEP_WEBUI_COLLECT_TASK_ACTIONS.create(deps);
    var YUBA_ACTIONS = window.DOUYU_KEEP_WEBUI_YUBA_TASK_ACTIONS.create(deps);

    return {
      saveCollectConfig: COLLECT_ACTIONS.saveCollectConfig,
      disableCollectConfig: COLLECT_ACTIONS.disableCollectConfig,
      saveYubaConfig: YUBA_ACTIONS.saveYubaConfig,
      disableYubaConfig: YUBA_ACTIONS.disableYubaConfig
    };
  }

  window.DOUYU_KEEP_WEBUI_SIMPLE_TASK_ACTIONS = {
    create: createSimpleTaskActions
  };
})();
