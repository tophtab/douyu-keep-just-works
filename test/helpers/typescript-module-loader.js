const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const repoRoot = path.resolve(__dirname, '../..')

function resolveRelativeTypeScriptPath(fromPath, request) {
  const basePath = path.normalize(path.join(path.dirname(fromPath), request))
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js'),
  ]

  for (const candidate of candidates) {
    const absoluteCandidate = path.join(repoRoot, candidate)
    if (fs.existsSync(absoluteCandidate) && fs.statSync(absoluteCandidate).isFile()) {
      return candidate
    }
  }

  return `${basePath}.ts`
}

function loadTypeScriptModule(relativePath, mocks = {}, cache = new Map()) {
  const normalizedPath = path.normalize(relativePath)
  const cacheKey = `${normalizedPath}\0${Object.keys(mocks).sort().join('\0')}`
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey).exports
  }

  const filename = path.join(repoRoot, normalizedPath)
  const source = fs.readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const loadedModule = new Module(filename, module.parent)
  loadedModule.filename = filename
  loadedModule.paths = Module._nodeModulePaths(path.dirname(filename))
  cache.set(cacheKey, loadedModule)
  const requireFromModule = loadedModule.require.bind(loadedModule)

  loadedModule.require = function localRequire(name) {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) {
      return mocks[name]
    }
    if (name.startsWith('.')) {
      return loadTypeScriptModule(resolveRelativeTypeScriptPath(normalizedPath, name), mocks, cache)
    }
    return requireFromModule(name)
  }

  loadedModule._compile(output, filename)
  return loadedModule.exports
}

module.exports = {
  loadTypeScriptModule,
  repoRoot,
}
