import { cpSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

const standaloneRoot = path.join(repoRoot, '.next', 'standalone')
const standaloneStaticRoot = path.join(standaloneRoot, '.next')

function copyIfPresent(sourceRelativePath, destinationAbsolutePath) {
  const sourceAbsolutePath = path.join(repoRoot, sourceRelativePath)
  if (!existsSync(sourceAbsolutePath)) {
    return
  }

  mkdirSync(path.dirname(destinationAbsolutePath), { recursive: true })
  cpSync(sourceAbsolutePath, destinationAbsolutePath, {
    force: true,
    recursive: true,
  })
}

mkdirSync(standaloneStaticRoot, { recursive: true })
copyIfPresent(path.join('.next', 'static'), path.join(standaloneStaticRoot, 'static'))
copyIfPresent('public', path.join(standaloneRoot, 'public'))

await import(pathToFileURL(path.join(standaloneRoot, 'server.js')).href)
