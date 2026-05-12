(function () {
  function createManagedData(deps) {
    var state = deps.state;
    var getRawConfig = deps.getRawConfig;

    function getManagedConfig() {
      if (state.managed && state.managed.config) {
        return state.managed.config;
      }
      return getRawConfig();
    }

    function getManagedFans() {
      if (state.managed && state.managed.fans && state.managed.fans.length) {
        return state.managed.fans;
      }
      if (state.fansStatus.length) {
        return state.fansStatus;
      }
      if (state.managed && state.managed.fans) {
        return state.managed.fans;
      }
      return [];
    }

    function setManagedFans(fans) {
      state.managed = {
        config: getManagedConfig(),
        fans: Array.isArray(fans) ? fans : []
      };
    }

    function mergeFansWithExistingStatus(fans) {
      var previousByRoom = {};
      var i;
      for (i = 0; i < state.fansStatus.length; i += 1) {
        previousByRoom[String(state.fansStatus[i].roomId)] = state.fansStatus[i];
      }

      return (Array.isArray(fans) ? fans : []).map(function (fan) {
        var previous = previousByRoom[String(fan.roomId)];
        if (!previous || typeof fan.doubleActive === 'boolean') {
          return fan;
        }
        var merged = Object.assign({}, fan);
        if (typeof previous.doubleActive === 'boolean') {
          merged.doubleActive = previous.doubleActive;
        }
        if (previous.doubleExpireTime) {
          merged.doubleExpireTime = previous.doubleExpireTime;
        }
        return merged;
      });
    }

    function applyFansStatusBase(data) {
      var fans = data && data.fans ? data.fans : [];
      state.fansStatus = mergeFansWithExistingStatus(fans);
      if (data && data.gift && data.complete) {
        state.giftStatus = data.gift;
      }
      setManagedFans(state.fansStatus);
      state.fansStatusLoaded = true;
      state.fansStatusDetailsLoaded = Boolean(data && data.complete);
    }

    function applyFansStatusDetails(data) {
      state.fansStatus = data && data.fans ? data.fans : [];
      state.giftStatus = data && data.gift ? data.gift : null;
      setManagedFans(state.fansStatus);
      state.fansStatusLoaded = true;
      state.fansStatusDetailsLoaded = true;
    }

    return {
      getManagedConfig: getManagedConfig,
      getManagedFans: getManagedFans,
      setManagedFans: setManagedFans,
      applyFansStatusBase: applyFansStatusBase,
      applyFansStatusDetails: applyFansStatusDetails
    };
  }

  window.DOUYU_KEEP_WEBUI_MANAGED_DATA = {
    create: createManagedData
  };
})();
