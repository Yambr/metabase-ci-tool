import {
  convertToPlainCollection,
  readCardsPlain,
  readCollections, readDashboardsPlain,
  writeCard,
  writeCollections, writeDashboard
} from './repository'

function mergeCollection(currentCollections, plainCollections, env) {
  for (let coll of currentCollections) {
    const {dev} = coll.id
    // немного странный код - но нужен)
    const collFromEnv = plainCollections.filter(c => c.id[env] === dev)[0]
    // костыль небольшой - ну пусть будет
    if (collFromEnv) {
      collFromEnv.folder = coll.folder
      if (!coll.id[env]) {
        coll.id[env] = collFromEnv.id[env]
      }

      if (coll.children && coll.children.length) {
        mergeCollection(coll.children, plainCollections, env)
      }
    }
  }
}

async function mergeCollections(folder, plainCollections, env) {
  const currentCollections = readCollections(folder)
  if (currentCollections) {
    mergeCollection(currentCollections, plainCollections, env)

    writeCollections(folder, currentCollections)
  }
}

async function mergeQueries(collections, queries, env, rootFolder) {
  const existingItems = readCardsPlain(rootFolder)

  if (!existingItems.length) { return }

  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const itemsOfColl = queries.filter(c => c.collection_id[env] === id[env])

    for (let i of itemsOfColl) {
      const {name} = i
      const exisitngItem = existingItems.filter(c => c.id.dev === i.id[env])[0]
      if (exisitngItem) {
        exisitngItem.id[env] = i.id[env]
        writeCard(rootFolder, folder, name, exisitngItem)
      }
    }
  }
}

function mergeDashboardCards(remoteCards, localCards, env) {
  for (let c of remoteCards) {
    const localCard = localCards.filter(({id}) => id.dev === c.id[env])[0]
    if (localCard) {
      localCard.id[env] = c.id[env]
      localCard.card_id[env] = c.card_id[env]
    }
  }
}

async function mergeDashboards(collections, dashboards, env, rootFolder) {
  const existingItems = readDashboardsPlain(rootFolder)

  if (!existingItems.length) { return }

  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const itemsOfColl = dashboards.filter(c => c.collection_id[env] === id[env])

    for (let i of itemsOfColl) {
      const {name, cards} = i
      const exisitngItem = existingItems.filter(c => c.id.dev === i.id[env])[0]
      if (exisitngItem) {
        exisitngItem.id[env] = i.id[env]

        mergeDashboardCards(cards, exisitngItem.cards, env)

        writeDashboard(rootFolder, folder, name, exisitngItem)
      }
    }
  }
}

export async function mergeAllByDev({
  collections,
  queries,
  dashboards,
  env,
  folder
}) {
  const plainCollections = convertToPlainCollection(collections)
  await mergeCollections(folder, plainCollections, env)
  await mergeQueries(plainCollections, queries, env, folder)
  await mergeDashboards(plainCollections, dashboards, env, folder)
}
