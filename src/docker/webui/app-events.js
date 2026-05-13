(function () {
  function createEventBindings(deps) {
    var byId = deps.byId;
    var state = deps.state;
    var setActiveTab = deps.setActiveTab;
    var handleVueNavigation = deps.handleVueNavigation;
    var refreshOverviewSurface = deps.refreshOverviewSurface;
    var saveExpiringGiftConfig = deps.saveExpiringGiftConfig;
    var triggerTask = deps.triggerTask;
    var loadCronPreview = deps.loadCronPreview;
    var disableExpiringGiftConfig = deps.disableExpiringGiftConfig;
    var buildBackpackRowsTable = deps.buildBackpackRowsTable;
    var loadOverview = deps.loadOverview;

    function findActionTarget(node) {
      var current = node;
      while (current && current !== document.body) {
        if (current.getAttribute && current.getAttribute('data-action')) {
          return current;
        }
        current = current.parentNode;
      }
      return null;
    }

    function handleActionClick(event) {
      var target = findActionTarget(event.target);
      if (!target) {
        return;
      }

      var action = target.getAttribute('data-action');
      if (action === 'refresh-overview') {
        refreshOverviewSurface(true);
        return;
      }
      if (action === 'save-expiring') {
        saveExpiringGiftConfig();
        return;
      }
      if (action === 'trigger') {
        triggerTask(target.getAttribute('data-trigger'));
      }
    }

    function handleTaskToggleChange(event, enableTask, disableTask) {
      if (event.target.checked) {
        enableTask({ revertCheckboxOnError: true });
        return;
      }
      disableTask();
    }

    function bindStaticEvents() {
      document.addEventListener('click', handleActionClick);
      document.addEventListener('douyu-keep-webui:navigation', handleVueNavigation);

      byId('expiring-cron').addEventListener('input', function (event) {
        void loadCronPreview('expiringGift', event.target.value, 'expiring-cron-preview');
      });
      byId('expiring-threshold-hours').addEventListener('input', function () {
        byId('expiring-backpack-wrap').innerHTML = buildBackpackRowsTable(state.giftStatus);
      });
      byId('expiring-enable').addEventListener('change', function (event) {
        handleTaskToggleChange(event, saveExpiringGiftConfig, disableExpiringGiftConfig);
      });
    }

    function startAutoRefresh() {
      setInterval(function () {
        if (!state.auth.authenticated) {
          return;
        }
        if (state.activeTab === 'overview') {
          loadOverview();
        }
      }, 5000);
    }

    function start() {
      bindStaticEvents();
      startAutoRefresh();

      setActiveTab(state.activeTab, { syncPath: false, skipLazyLoad: true });
    }

    return {
      start: start
    };
  }

  window.DOUYU_KEEP_WEBUI_EVENTS = {
    create: createEventBindings
  };
})();
