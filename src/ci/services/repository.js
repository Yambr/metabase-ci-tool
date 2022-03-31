import fs from 'fs'
import path from 'path'
import mkDirByPathSync from '../../utils/mkdir-p.ts'

export const encoding = 'utf8'
const collectionsFile = 'collections.json'

const cardsFolder = 'cards'
const dashboardsFolder = 'dashboards'

export function readCollections(folder) {
  const filePath = path.join(folder, collectionsFile)
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, encoding))
  }
  return []
}

export function writeCollections(folder, currentCollections) {
  const filePath = path.join(folder, collectionsFile)
  fs.writeFileSync(filePath, JSON.stringify(currentCollections, null, 2), encoding)
}

export function convertToPlainCollection(collections, plainCollections = undefined) {
  if (!plainCollections) {
    plainCollections = []
  }
  for (let i of collections) {
    plainCollections.push(i)
    if (i.children && i.children) {
      convertToPlainCollection(i.children, plainCollections)
    }
  }
  return plainCollections
}

function readFolder(itemsPath) {
  if (!fs.existsSync(itemsPath)) { return [] }
  const files = fs.readdirSync(itemsPath)

  const existingItems = files.filter(c => {
    const filePath = path.join(itemsPath, c)
    return c.endsWith('.json') && fs.statSync(filePath).isFile()
  }).map(c => {
    const filePath = path.join(itemsPath, c)
    return JSON.parse(fs.readFileSync(filePath, encoding))
  })
  return existingItems
}

export function readCollectionCards(folder, collection) {
  return readCollectionItems(folder, collection, cardsFolder)
}
export function readCollectionDashboards(folder, collection) {
  return readCollectionItems(folder, collection, dashboardsFolder)
}

function readCollectionItems(folder, collection, subFolder) {
  const itemsPath = path.join(folder, collection.folder, subFolder)
  const cards = readFolder(itemsPath)
  return cards
}

function readItems(folder, subFolder) {
  const collections = convertToPlainCollection(readCollections(folder))

  return collections.map(collection => {
    const items = readCollectionItems(folder, collection, subFolder)
    return {
      collection,
      items
    }
  })
}

export function readCardsPlain(folder) {
  const items = readItems(folder, cardsFolder).map(c => c.items)
  return [].concat(...items)
}

export function readDashboardsPlain(folder) {
  const items = readItems(folder, dashboardsFolder).map(c => c.items)
  return [].concat(...items)
}

function itemName({id, name}) {
  const {dev} = id
  return `${name} (${dev})`
}

export function writeCard(rootFolder, folder, data) {
  writeItem(rootFolder, folder, data, cardsFolder)

  const { dataset_query } = data
  if (dataset_query && dataset_query.type === 'native') {
    const {query} = dataset_query.native
    const cardsPath = path.join(rootFolder, folder, cardsFolder)
    const queryPath = path.join(cardsPath, `${itemName(data).replace(/[/\\?%*:|"<>]/g, '-')}(readonly).sql`)
    fs.writeFileSync(queryPath, query, encoding)
  }
}

export function writeDashboard(rootFolder, folder, data) {
  writeItem(rootFolder, folder, data, dashboardsFolder)
}
function writeItem(rootFolder, folder, data, subFolder) {
  const name = itemName(data)
  const itemsPath = path.join(rootFolder, folder, subFolder)
  const existFilePath = path.join(itemsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
  fs.writeFileSync(existFilePath, JSON.stringify(data, null, 2), encoding)
}

export function removeCard(rootFolder, folder, name) {
  removeItem(rootFolder, folder, name, cardsFolder)
}
export function removeDashboard(rootFolder, folder, name) {
  removeItem(rootFolder, folder, name, dashboardsFolder)
}

function removeItem(rootFolder, folder, name, subFolder) {
  const itemsPath = path.join(rootFolder, folder, subFolder)
  const existFilePath = path.join(itemsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
  if (fs.existsSync(existFilePath)) {
    fs.unlinkSync(existFilePath)
  }
}

export function cardsPathExists(rootFolder, folder) {
  itemsPathExists(rootFolder, folder, cardsFolder)
}

function cleanItems(cardsPath) {
  const files = fs.readdirSync(cardsPath)
  for (let i of files.filter(c => {
    return (c.endsWith('.sql') || c.endsWith('.json')) && fs.statSync(path.join(cardsPath, c)).isFile()
  })) {
    fs.unlinkSync(path.join(cardsPath, i))
  }
}

export function cleanCards(rootFolder, folder) {
  const itemsPath = path.join(rootFolder, folder, cardsFolder)
  cleanItems(itemsPath)
}
export function cleanDashboards(rootFolder, folder) {
  const itemsPath = path.join(rootFolder, folder, dashboardsFolder)
  cleanItems(itemsPath)
}

export function dashboardsPathExists(rootFolder, folder) {
  itemsPathExists(rootFolder, folder, dashboardsFolder)
}

function itemsPathExists(rootFolder, folder, subFolder) {
  const itemsPath = path.join(rootFolder, folder, subFolder)
  if (!fs.existsSync(itemsPath)) {
    mkDirByPathSync(itemsPath)
  }
}

export function extractSharedId(currentItems, env, id) {
  const element = currentItems.filter(c => c.id[env] === id)[0]
  const sharedId = element ? element.id : {[env]: id}
  return sharedId
}

export function compareItem(fields, local, remote) {
  for (let i of fields) {
    if (JSON.stringify(local[i]) !== JSON.stringify(remote[i])) {
      return true
    }
  }
  return false
}
