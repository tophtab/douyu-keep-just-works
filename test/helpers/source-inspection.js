const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '../..')

function repoPath(relativePath) {
  return path.join(repoRoot, relativePath)
}

function readRepoFile(relativePath) {
  return fs.readFileSync(repoPath(relativePath), 'utf8')
}

function collectRepoFiles(relativeDir) {
  const root = repoPath(relativeDir)
  const entries = fs.readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const child = path.join(relativeDir, entry.name)
    return entry.isDirectory() ? collectRepoFiles(child) : [child]
  })
}

function readDockerServerSources() {
  return fs.readdirSync(repoPath('src/docker'))
    .filter(file => /^server.*\.ts$/.test(file))
    .sort()
    .map(file => readRepoFile(`src/docker/${file}`))
    .join('\n')
}

function getBlockBody(source, declaration) {
  const functionIndex = source.indexOf(declaration)
  assert.notEqual(functionIndex, -1, `Missing ${declaration}`)

  let openBrace = -1
  let lineStart = functionIndex
  while (lineStart < source.length) {
    const lineEnd = source.indexOf('\n', lineStart)
    assert.notEqual(lineEnd, -1, `Missing body for ${declaration}`)
    const line = source.slice(lineStart, lineEnd)
    if (line.trimEnd().endsWith('{')) {
      openBrace = lineStart + line.lastIndexOf('{')
      break
    }
    lineStart = lineEnd + 1
  }
  assert.notEqual(openBrace, -1, `Missing body for ${declaration}`)

  let depth = 0
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(openBrace + 1, index)
      }
    }
  }

  throw new Error(`Unclosed body for ${declaration}`)
}

function getFunctionBody(source, functionName) {
  return getBlockBody(source, `function ${functionName}`)
}

function getAsyncMethodBody(source, methodName) {
  return getBlockBody(source, `async ${methodName}`)
}

module.exports = {
  collectRepoFiles,
  getAsyncMethodBody,
  getBlockBody,
  getFunctionBody,
  readDockerServerSources,
  readRepoFile,
  repoPath,
  repoRoot,
}
