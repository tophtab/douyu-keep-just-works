(function () {
  function createRequestModule(deps) {
    var handleUnauthorized = deps.handleUnauthorized;

    function requestJson(url, options) {
      var opts = options || {};
      return fetch(url, opts).then(function (response) {
        return response.text().then(function (text) {
          var data = text ? JSON.parse(text) : {};
          if (!response.ok) {
            var error = new Error(data && data.error ? data.error : '请求失败');
            error.status = response.status;
            if (response.status === 401) {
              handleUnauthorized();
            }
            throw error;
          }
          return data;
        });
      });
    }

    return {
      requestJson: requestJson
    };
  }

  window.DOUYU_KEEP_WEBUI_REQUEST = {
    create: createRequestModule
  };
})();
