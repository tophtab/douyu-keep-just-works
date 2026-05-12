(function () {
  function createProtectedState(deps) {
    var state = deps.state;
    var invalidateResourceRequests = deps.invalidateResourceRequests;
    var renderRefreshButton = deps.renderRefreshButton;

    function resetCookieBackedState() {
      invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus', 'yubaStatus']);
      state.managed = null;
      state.fansStatus = [];
      state.giftStatus = null;
      state.yubaStatus = [];
      state.fansStatusLoading = false;
      state.fansStatusLoaded = false;
      state.fansStatusDetailsLoading = false;
      state.fansStatusDetailsLoaded = false;
      state.yubaStatusLoading = false;
      state.yubaStatusLoaded = false;
      state.fansListError = '';
      state.yubaStatusError = '';
      state.managedLoading = false;
    }

    function clearProtectedState() {
      resetCookieBackedState();
      state.rawConfig = null;
      state.overview = null;
      state.cookieCheck = null;
      state.logs = [];
      state.logsRefreshedAt = null;
      renderRefreshButton();
    }

    function clearCookieBackedData() {
      resetCookieBackedState();
    }

    return {
      clearProtectedState: clearProtectedState,
      clearCookieBackedData: clearCookieBackedData
    };
  }

  window.DOUYU_KEEP_WEBUI_PROTECTED_STATE = {
    create: createProtectedState
  };
})();
