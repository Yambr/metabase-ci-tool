import path from 'path'
import fs from 'fs'
import sanitize from 'sanitize-filename'
import {
  cardsPathExists, cleanCards, cleanDashboards,
  convertToPlainCollection, dashboardsPathExists,
  readCardsPlain,
  readCollections, readDashboardsPlain,
  removeCard, removeDashboard, writeCard,
  writeCollections, writeDashboard
} from './repository'
import mkDirByPathSync from '../../utils/mkdir-p.ts'

export const encoding = 'utf8'

function createCollectionFolders(collections, rootFolder, parentFolder, currentCollections) {
  for (let item of collections.sort((c) => c.folder)) {
    const {id, children, archived, personal_owner_id} = item
    const {dev} = id
    const name = `${item.name} (${dev})`
    const existingCollection = currentCollections.filter(c => c.id.dev === dev)[0]
    const personalFolder = path.join(parentFolder, 'personal')
    if (!fs.existsSync(personalFolder)) {
      fs.mkdirSync(personalFolder)
    }
    const archivedFolder = path.join(rootFolder, 'archived')
    if (!fs.existsSync(archivedFolder)) {
      fs.mkdirSync(archivedFolder)
    }
    const fPath = personal_owner_id
      ? path.join(rootFolder, 'personal', sanitize(name))
      : archived
        ? path.join(rootFolder, 'archived', sanitize(name))
        : path.join(parentFolder, sanitize(name))
    if (existingCollection) {
      const oldPath = sanitize(path.join(rootFolder, sanitize(existingCollection.folder)))
      if (fs.existsSync(oldPath)) {
        if (oldPath !== fPath) {
          if (fs.existsSync(fPath)) {
            console.error(`${fPath} already exists! cant rename`)
          } else {
            fs.renameSync(oldPath, fPath)
          }
        }
      } else {
        if (!fs.existsSync(fPath)) {
          fs.mkdirSync(fPath)
        }
      }
    } else {
      if (!fs.existsSync(fPath)) {
        mkDirByPathSync(fPath)
      }
    }

    item.folder = path.relative(rootFolder, fPath)
    if (children && children.length) {
      createCollectionFolders(children, rootFolder, fPath, currentCollections)
    }
  }
}

async function saveCollections(folder, collections) {
  const currentCollections = readCollections(folder)

  createCollectionFolders(collections, folder, folder, currentCollections)

  writeCollections(folder, collections)
}

async function saveQueries(collections, queries, env, rootFolder) {
  const existingItems = readCardsPlain(rootFolder)

  for (let {id, folder} of collections) {
    const itemsOfColl = queries.filter(c => c.collection_id[env] === id[env])
    cardsPathExists(rootFolder, folder)
    cleanCards(rootFolder, folder)
    for (let i of itemsOfColl) {
      const {id} = i
      const exisitngItem = existingItems.filter(c => c.id[env] === id[env])[0]
      // возможно тут и в исходной коллеции стоит поискать
      if (exisitngItem) {
        removeCard(rootFolder, folder, exisitngItem.name)
      }
      writeCard(rootFolder, folder, i)
    }
  }
}

async function saveDashboards(collections, dashboards, env, rootFolder) {
  const existingItems = readDashboardsPlain(rootFolder)

  for (let {id, folder} of collections) {
    const itemsOfColl = dashboards.filter(c => c.collection_id[env] === id[env])
    dashboardsPathExists(rootFolder, folder)
    cleanDashboards(rootFolder, folder)
    for (let i of itemsOfColl) {
      const {id} = i
      const exisitngItem = existingItems.filter(c => c.id[env] === id[env])[0]
      // возможно тут и в исходной коллеции стоит поискать
      if (exisitngItem) {
        removeDashboard(rootFolder, folder, exisitngItem.name)
      }
      writeDashboard(rootFolder, folder, i)
    }
  }
}

export async function saveAll({
  collections,
  queries,
  dashboards,
  env,
  folder
}) {
  const plainCollections = convertToPlainCollection(collections)
  await saveCollections(folder, collections)
  await saveQueries(plainCollections, queries, env, folder)
  await saveDashboards(plainCollections, dashboards, env, folder)
}
