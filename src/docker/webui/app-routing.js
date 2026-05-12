(function () {
  var TAB_ROUTE_MAP = __DOCKER_WEBUI_PAGE_ROUTES_JSON__;

  function normalizePagePath(path) {
    if (!path || path === '/') {
      return '/';
    }
    return path.replace(/\/+$/, '') || '/';
  }

  function getTabByPath(path) {
    var normalizedPath = normalizePagePath(path);
    var tabs = Object.keys(TAB_ROUTE_MAP);
    var i;
    for (i = 0; i < tabs.length; i += 1) {
      if (TAB_ROUTE_MAP[tabs[i]] === normalizedPath) {
        return tabs[i];
      }
    }
    return 'overview';
  }

  function getPathByTab(tab) {
    return TAB_ROUTE_MAP[tab] || TAB_ROUTE_MAP.overview;
  }

  function syncPathWithTab(tab, replace) {
    if (!window.history || !window.history.pushState || !window.history.replaceState) {
      return;
    }

    var nextPath = getPathByTab(tab);
    var currentPath = normalizePagePath(window.location.pathname);
    if (currentPath === nextPath && window.location.pathname === nextPath) {
      return;
    }

    try {
      if (replace) {
        window.history.replaceState(null, '', nextPath);
        return;
      }
      window.history.pushState(null, '', nextPath);
    } catch (error) {
      // Ignore history API failures and keep the UI usable.
    }
  }

  function consumeWebPasswordFromUrl() {
    var result = { present: false, password: '' };
    if (!window.location || !window.location.search) {
      return result;
    }

    try {
      var currentUrl = new URL(window.location.href);
      if (!currentUrl.searchParams.has('web-password')) {
        return result;
      }

      result.present = true;
      result.password = currentUrl.searchParams.get('web-password') || '';
      currentUrl.searchParams.delete('web-password');

      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', currentUrl.pathname + currentUrl.search + currentUrl.hash);
      }
    } catch (error) {
      // If URL parsing fails, fall back to the normal login form.
    }

    return result;
  }

  window.DOUYU_KEEP_WEBUI_ROUTING = {
    normalizePagePath: normalizePagePath,
    getTabByPath: getTabByPath,
    getPathByTab: getPathByTab,
    syncPathWithTab: syncPathWithTab,
    consumeWebPasswordFromUrl: consumeWebPasswordFromUrl
  };
})();
