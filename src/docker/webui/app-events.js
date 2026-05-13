(function () {
  function createEventBindings(deps) {
    var state = deps.state;
    var setActiveTab = deps.setActiveTab;
    var handleVueNavigation = deps.handleVueNavigation;
    var refreshOverviewSurface = deps.refreshOverviewSurface;
    var triggerTask = deps.triggerTask;
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
      if (action === 'trigger') {
        triggerTask(target.getAttribute('data-trigger'));
      }
    }

    function bindStaticEvents() {
      document.addEventListener('click', handleActionClick);
      document.addEventListener('douyu-keep-webui:navigation', handleVueNavigation);
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
