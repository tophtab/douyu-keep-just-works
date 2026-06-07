const assert = require('node:assert/strict')
const { test } = require('node:test')
const { loadTypeScriptModule } = require('./helpers/typescript-module-loader')

test('legacy Yuba group sign keeps code-based success without dy-token data requirements', async () => {
  const requests = []
  const axiosMock = {
    post: async (url, body, options) => {
      requests.push({ url, body, options })
      return {
        data: {
          status_code: 200,
          msg: '',
        },
      }
    },
  }
  const { signYubaGroup } = loadTypeScriptModule('src/core/yuba-check-in.ts', { axios: axiosMock })

  const result = await signYubaGroup(42, 12, 'acf_yb_t=csrf-token; other=kept')

  assert.equal(result, 'signed')
  assert.equal(requests[0].url, 'https://yuba.douyu.com/ybapi/topic/sign')
  assert.match(requests[0].body, /name="group_id"\r\n\r\n42\r\n/)
  assert.match(requests[0].body, /name="cur_exp"\r\n\r\n12\r\n/)
  assert.equal(requests[0].options.headers['X-CSRF-TOKEN'], 'csrf-token')
})

test('dy-token Yuba sign accepts object data success while preserving generated dy-token headers', async () => {
  const requests = []
  const axiosMock = {
    post: async (url, body, options) => {
      requests.push({ url, body, options })
      if (url.endsWith('/wb/v3/fastSign')) {
        return {
          data: {
            status_code: 200,
            error: 0,
            data: 0,
            msg: '',
          },
        }
      }
      if (url.endsWith('/ybapi/topic/sign')) {
        return {
          data: {
            status_code: 0,
            error: 0,
            msg: '',
            data: { signed: true },
          },
        }
      }
      if (url.endsWith('/wb/v3/supplement')) {
        return {
          data: {
            status_code: 200,
            error: 0,
            data: { supplementary_cards: 0 },
          },
        }
      }
      throw new Error(`Unexpected Yuba request: ${url}`)
    },
  }
  const yubaStatusMock = {
    getFollowedYubaGroupsWithDyToken: async () => [{
      groupId: 42,
      name: '鱼吧42',
      unreadFeedNum: 0,
    }],
  }
  const { executeFollowedYubaCheckInWithDyToken } = loadTypeScriptModule('src/core/yuba-check-in.ts', {
    './yuba-status': yubaStatusMock,
    axios: axiosMock,
  })
  const logs = []
  const mainCookie = 'acf_uid=uid; acf_biz=biz; acf_stk=stk; acf_ct=ct; acf_ltkid=ltk'

  const result = await executeFollowedYubaCheckInWithDyToken('acf_yb_t=yuba-token', mainCookie, message => logs.push(message))
  const signRequest = requests.find(request => request.url.endsWith('/ybapi/topic/sign'))

  assert.deepEqual(result, {
    signedCount: 1,
    alreadySignedCount: 0,
    failedCount: 0,
    stoppedEarly: false,
  })
  assert.equal(signRequest.body, 'group_id=42')
  assert.equal(signRequest.options.headers['dy-token'], 'uid_biz_stk_ct_ltk')
  assert.match(logs.join('\n'), /鱼吧 鱼吧42\(42\) 签到成功/)
})
