const assert = require('node:assert/strict')
const { readFileSync, statSync } = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const repoRoot = path.resolve(__dirname, '..')

function readRepoFile(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

function readPngSize(relativePath) {
  const data = readFileSync(path.join(repoRoot, relativePath))
  assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG')
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  }
}

test('fnOS package follows the Docker application contracts', () => {
  // Guardrail: these static files are the installable fnOS package interface.
  const manifest = readRepoFile('packaging/fnos/manifest')
  const compose = readRepoFile('packaging/fnos/app/docker/docker-compose.yaml')
  const resource = JSON.parse(readRepoFile('packaging/fnos/config/resource'))
  const privilege = JSON.parse(readRepoFile('packaging/fnos/config/privilege'))
  const entry = JSON.parse(readRepoFile('packaging/fnos/app/ui/config'))
  const mainPath = path.join(repoRoot, 'packaging/fnos/cmd/main')
  const main = readFileSync(mainPath, 'utf8')
  const lifecycleScripts = [
    'install_init',
    'install_callback',
    'upgrade_init',
    'upgrade_callback',
    'uninstall_init',
    'uninstall_callback',
    'config_init',
    'config_callback',
  ]

  assert.match(manifest, /^appname=douyu-keep-just-works$/m)
  assert.match(manifest, /^version=__VERSION__$/m)
  assert.match(manifest, /^platform=all$/m)
  assert.match(manifest, /^service_port=51417$/m)
  assert.match(manifest, /^desktop_applaunchname=douyu-keep-just-works\.main$/m)
  assert.match(compose, /image: tophtab\/douyu-keep-just-works:__DOCKER_TAG__/)
  assert.match(compose, /container_name: douyu-keep-just-works/)
  assert.match(compose, /"\$\{TRIM_SERVICE_PORT\}:51417"/)
  assert.match(compose, /"\$\{TRIM_PKGVAR\}:\/app\/config"/)
  assert.doesNotMatch(compose, /:latest/)

  assert.deepEqual(resource['docker-project'].projects, [
    { name: 'douyu-keep-just-works', path: 'docker' },
  ])
  assert.equal(privilege.defaults['run-as'], 'package')
  assert.equal(entry['.url']['douyu-keep-just-works.main'].port, '51417')
  assert.equal(entry['.url']['douyu-keep-just-works.main'].protocol, 'http')
  assert.match(main, /CONTAINER_NAME="douyu-keep-just-works"/)
  assert.match(main, /docker inspect --format '\{\{\.State\.Running\}\}'/)
  assert.match(main, /exit 3/)
  assert.notEqual(statSync(mainPath).mode & 0o111, 0)
  for (const script of lifecycleScripts) {
    const scriptPath = path.join(repoRoot, 'packaging/fnos/cmd', script)
    assert.match(readFileSync(scriptPath, 'utf8'), /^#!\/bin\/bash/)
    assert.notEqual(statSync(scriptPath).mode & 0o111, 0)
  }

  assert.deepEqual(readPngSize('packaging/fnos/ICON.PNG'), { width: 512, height: 512 })
  assert.deepEqual(readPngSize('packaging/fnos/ICON_256.PNG'), { width: 256, height: 256 })
  assert.deepEqual(readPngSize('packaging/fnos/app/ui/images/icon_64.png'), { width: 64, height: 64 })
  assert.deepEqual(readPngSize('packaging/fnos/app/ui/images/icon_256.png'), { width: 256, height: 256 })
})

test('fnOS release waits for the tagged multi-architecture Docker image', () => {
  // Guardrail: release ordering prevents an FPK from pointing at a missing image.
  const dockerWorkflow = readRepoFile('.github/workflows/docker.yml')
  const fnosWorkflow = readRepoFile('.github/workflows/fnos-fpk.yml')

  assert.match(dockerWorkflow, /fnos-fpk:\n[\s\S]*needs:\n\s+- validate\n\s+- release-manifest/)
  assert.match(dockerWorkflow, /fnos-fpk:[\s\S]*uses: \.\/\.github\/workflows\/fnos-fpk\.yml/)
  assert.match(dockerWorkflow, /fnos-fpk:[\s\S]*release_tag: \$\{\{ github\.ref_name \}\}/)
  assert.match(fnosWorkflow, /workflow_call:/)
  assert.match(fnosWorkflow, /workflow_dispatch:/)
  assert.match(fnosWorkflow, /pull_request:[\s\S]*packaging\/fnos\/\*\*/)
  assert.match(fnosWorkflow, /validate-package:[\s\S]*node --test test\/fnos-packaging-contract\.test\.js/)
  assert.match(fnosWorkflow, /validate-package:\n\s+if: inputs\.release_tag == ''/)
  assert.match(fnosWorkflow, /build:\n\s+if: inputs\.release_tag != ''/)
  assert.match(fnosWorkflow, /\^\[vV\]\(\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\)\$/)
  assert.match(fnosWorkflow, /docker buildx imagetools inspect --raw/)
  assert.match(fnosWorkflow, /grep -qx 'linux\/amd64'/)
  assert.match(fnosWorkflow, /grep -qx 'linux\/arm64'/)
  assert.match(fnosWorkflow, /54b97fa7b70968c4d05c79840f5daeff508957d0bb2062fdb0376d00d9615c93/)
  assert.match(fnosWorkflow, /sha256sum -c -/)
  assert.match(fnosWorkflow, /fnpack" build --directory \./)
  assert.match(fnosWorkflow, /gh release create "\$RELEASE_TAG" --verify-tag/)
  assert.match(fnosWorkflow, /gh release upload "\$RELEASE_TAG"[\s\S]*--clobber/)
})
