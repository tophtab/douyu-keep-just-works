const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('Node runtime version is aligned across package metadata, Docker, CI, and docs', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const dockerfile = readRepoFile('Dockerfile')
  const workflow = readRepoFile('.github/workflows/docker.yml')
  const contributing = readRepoFile('CONTRIBUTING.md')

  assert.equal(packageJson.engines?.node, '>=24 <25')
  assert.match(dockerfile, /^FROM node:24-slim AS builder$/m)
  assert.match(dockerfile, /^FROM node:24-slim AS runtime$/m)
  assert.match(workflow, /^\s+node-version: 24$/m)
  assert.match(contributing, /- Node\.js 24/)
  assert.doesNotMatch(contributing, /Node\.js 18/)
})

test('npm test remains a contract-test plus Docker-build quality gate', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const contributing = readRepoFile('CONTRIBUTING.md')

  assert.equal(packageJson.scripts?.['test:contracts'], 'node --test test/*.test.js')
  assert.equal(packageJson.scripts?.test, 'npm run test:contracts && npm run build:docker')
  assert.match(contributing, /contract tests and then the Docker\s+TypeScript build/)
})

test('Docker WebUI split source files are still injected into the served HTML shell', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'))
  const webui = readRepoFile('src/docker/webui.ts')
  const indexHtml = readRepoFile('src/docker/webui/index.html')
  const app = readRepoFile('src/docker/webui/app.js')

  assert.match(packageJson.scripts?.['build:docker'], /cp -R src\/docker\/webui build\/docker\/docker\/webui/)
  assert.match(webui, /WEBUI_TEMPLATE_PATH = path\.join\(__dirname, 'webui', 'index\.html'\)/)
  assert.match(webui, /WEBUI_STYLES_PATH = path\.join\(__dirname, 'webui', 'styles\.css'\)/)
  assert.match(webui, /WEBUI_SCRIPT_PATH = path\.join\(__dirname, 'webui', 'app\.js'\)/)
  assert.match(webui, /replaceToken\(html, '__WEBUI_STYLES__', readStyles\(\)\)/)
  assert.match(webui, /replaceToken\(html, '__WEBUI_SCRIPT__', readScript\(\)\)/)
  assert.match(webui, /replaceToken\(html, '__DOCKER_WEBUI_PAGE_ROUTES_JSON__', JSON\.stringify\(DOCKER_WEBUI_PAGE_ROUTES\)\)/)

  assert.match(indexHtml, /__WEBUI_STYLES__/)
  assert.match(indexHtml, /__WEBUI_SCRIPT__/)
  assert.match(app, /__DOCKER_WEBUI_PAGE_ROUTES_JSON__/)
})
