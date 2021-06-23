import path from 'path'
import fs from 'fs'
const configFile = 'metabase-ci.config'
const encoding = 'utf8'

export function readRepository(folder) {
  const filePath = path.join(folder, configFile)
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, encoding))
  }
  return undefined
}

export function writeSettings(folder, settings) {
  const filePath = path.join(folder, configFile)
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), encoding)
}
