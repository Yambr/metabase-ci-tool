import path from 'path'
import fs from 'fs'
import {
  cardsPathExists, cleanCards, cleanDashboards,
  convertToPlainCollection, dashboardsPathExists,
  readCardsPlain,
  readCollections, readDashboardsPlain,
  removeCard, removeDashboard, writeCard,
  writeCollections, writeDashboard
} from '../../ci/services/repository'

export const encoding = 'utf8'

function createCollectionFolders(collections, rootFolder, parentFolder, currentCollections) {
  for (let item of collections) {
    const {id, name, children, archived, personal_owner_id} = item
    if (archived) {
      continue
    }
    const {dev} = id
    const existingCollection = currentCollections.filter(c => c.id.dev === dev)[0]
    const personalFolder = path.join(parentFolder, 'personal')
    if (!fs.existsSync(personalFolder)) {
      fs.mkdirSync(personalFolder)
    }
    const fPath = personal_owner_id ? path.join(parentFolder, 'personal', name) : path.join(parentFolder, name)
    if (existingCollection) {
      const oldPath = path.join(rootFolder, existingCollection.folder)
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
        fs.mkdirSync(fPath)
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

  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const itemsOfColl = queries.filter(c => c.collection_id[env] === id[env])
    cardsPathExists(rootFolder, folder)
    cleanCards(rootFolder, folder)
    for (let i of itemsOfColl) {
      const {id, name} = i
      const exisitngItem = existingItems.filter(c => c.id[env] === id[env])[0]
      // возможно тут и в исходной коллеции стоит поискать
      if (exisitngItem) {
        removeCard(rootFolder, folder, exisitngItem.name)
      }
      writeCard(rootFolder, folder, name, i)
    }
  }
}

async function saveDashboards(collections, dashboards, env, rootFolder) {
  const existingItems = readDashboardsPlain(rootFolder)

  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const itemsOfColl = dashboards.filter(c => c.collection_id[env] === id[env])
    dashboardsPathExists(rootFolder, folder)
    cleanDashboards(rootFolder, folder)
    for (let i of itemsOfColl) {
      const {id, name} = i
      const exisitngItem = existingItems.filter(c => c.id[env] === id[env])[0]
      // возможно тут и в исходной коллеции стоит поискать
      if (exisitngItem) {
        removeDashboard(rootFolder, folder, exisitngItem.name)
      }
      writeDashboard(rootFolder, folder, name, i)
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
