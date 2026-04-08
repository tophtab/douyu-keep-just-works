import puppeteer from 'puppeteer'

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36 Edg/115.0.1901.188'

export async function collectGiftViaPage(cookie: string): Promise<void> {
  let browser
  try {
    const args = ['--disable-gpu', '--disable-dev-shm-usage']
    const puppeteerArgs = process.env.PUPPETEER_ARGS
    if (puppeteerArgs) {
      args.push(...puppeteerArgs.split(/\s+/).filter(Boolean))
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args,
    })

    const page = await browser.newPage()
    await page.setUserAgent(USER_AGENT)

    // Parse cookie string and set individual cookies
    const cookies = cookie.split(';').map((c) => {
      const [name, ...rest] = c.trim().split('=')
      return {
        name: name.trim(),
        value: rest.join('=').trim(),
        domain: '.douyu.com',
      }
    }).filter(c => c.name && c.value)

    await page.setCookie(...cookies)
    await page.goto('https://www.douyu.com/4120796', { waitUntil: 'domcontentloaded' })
    await new Promise(resolve => setTimeout(resolve, 10000))
  } catch (error) {
    console.error('领取荧光棒失败:', error)
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
    }
  }
}
