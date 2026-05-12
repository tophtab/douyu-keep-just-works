(function () {
  window.DOUYU_KEEP_WEBUI_DATA = {
    PAGE_META: {
      overview: {
        title: '概况',
        subtitle: '先看基础状态，再确认当前粉丝牌列表。'
      },
      login: {
        title: '登录',
        subtitle: '管理登录状态、手填 Cookie 和 CookieCloud 同步。'
      },
      collect: {
        title: '领取任务',
        subtitle: '查看领取任务状态，并维护领取任务的启停和调度。'
      },
      yuba: {
        title: '鱼吧签到',
        subtitle: '通过纯 HTTP 请求签到全部已关注鱼吧，并查看任务状态。'
      },
      keepalive: {
        title: '保活任务',
        subtitle: '查看保活状态，并维护随粉丝牌同步的房间配置。'
      },
      'double-card': {
        title: '双倍任务',
        subtitle: '查看双倍状态，并维护参与勾选与分配值。'
      },
      'expiring-gift': {
        title: '临期任务',
        subtitle: '在礼物接近过期时，只按临期候选数量释放背包礼物。'
      },
      logs: {
        title: '运行日志',
        subtitle: '查看系统、领取、鱼吧签到、保活、双倍和临期任务的执行记录。'
      }
    },
    DEFAULT_RAW_CONFIG: {
      cookie: '',
      manualCookies: {
        main: '',
        yuba: ''
      },
      cookieCloud: {
        active: false,
        endpoint: '',
        uuid: '',
        password: '',
        cron: '0 5 0 * * *',
        cryptoType: 'legacy'
      },
      ui: { themeMode: 'system' },
      collectGift: { active: true, cron: '0 10 3,5 * * *' },
      yubaCheckIn: { active: false, cron: '0 23 0 * * *', mode: 'followed' },
      keepalive: { active: true, cron: '0 0 8 */6 * *', model: 2, send: {} },
      doubleCard: { active: true, cron: '0 20 17,20,22,23 * * *', model: 1, giftScope: 'glowStick', send: {}, enabled: {} },
      expiringGift: { active: false, cron: '0 45 23 * * *', thresholdHours: 24, model: 1, send: {} }
    }
  };
})();
