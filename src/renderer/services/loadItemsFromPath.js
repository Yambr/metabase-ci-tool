import fs from 'fs'
import path from 'path'
import axios from 'axios'

const configFile = 'metabase-ci.config'
const collectionsFile = 'collections.json'

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

async function auth({url, username, password}) {
  const authUrl = url + '/api/session'
  const {data} = await axios.post(authUrl, {
    username,
    password
  })
  return data
}

function createCollectionFolders(collections, rootFolder, parentFolder, currentCollections) {
  for (let item of collections) {
    const {id, name, children, archived} = item
    if (archived) {
      continue
    }
    const {dev} = id
    const existingCollection = currentCollections.filter(c => c.id.dev === dev)[0]
    const fPath = path.join(parentFolder, name)
    if (existingCollection) {
      const oldPath = path.join(rootFolder, existingCollection.folder)
      if (fs.existsSync(oldPath)) {
        if (oldPath !== fPath) {
          fs.renameSync(oldPath, fPath)
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
  const filePath = path.join(folder, collectionsFile)
  let currentCollections
  if (fs.existsSync(filePath)) {
    currentCollections = JSON.parse(fs.readFileSync(filePath, encoding))
  } else {
    currentCollections = undefined
  }

  createCollectionFolders(collections, folder, folder, currentCollections)

  fs.writeFileSync(filePath, JSON.stringify(collections, null, 2), encoding)
}

function collectPlainCollections(collections, plainCollections) {
  for (let i of collections) {
    plainCollections.push(i)
    if (i.children && i.children) {
      collectPlainCollections(i.children, plainCollections)
    }
  }
}

async function saveQueries(collections, queries, env, rootFolder) {
  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const queriesOfColl = queries.filter(c => c.collection_id[env] === id[env])
    const cardsPath = path.join(rootFolder, folder, 'cards')

    if (!fs.existsSync(cardsPath)) {
      fs.mkdirSync(cardsPath)
    }
    const files = fs.readdirSync(cardsPath)
    for (let i of files.filter(c => {
      return c.endsWith('.sql') && fs.statSync(path.join(cardsPath, c)).isFile()
    })) {
      fs.unlinkSync(path.join(cardsPath, i))
    }
    const existingCards = files.filter(c => {
      return c.endsWith('.json') && fs.statSync(path.join(cardsPath, c)).isFile()
    }).map(c => {
      return JSON.parse(fs.readFileSync(path.join(cardsPath, c), encoding))
    })

    for (let q of queriesOfColl) {
      const {id, name} = q
      const {dev} = id
      const exisitngQ = existingCards.filter(c => c.id.dev === dev)

      const filePath = path.join(cardsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)

      if (exisitngQ) {
        const existFilePath = path.join(cardsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
        fs.unlinkSync(existFilePath)
      }
      fs.writeFileSync(filePath, JSON.stringify(q, null, 2), encoding)

      if (q.dataset_query && q.dataset_query.type === 'native') {
        const {query} = q.dataset_query.native
        const queryPath = path.join(cardsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}(readonly).sql`)
        fs.writeFileSync(queryPath, query, encoding)
      }
    }
  }
}

async function saveDashboards(collections, dashboards, env, rootFolder) {
  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const dashboardsPath = path.join(rootFolder, folder, 'dashboards')
    if (!fs.existsSync(dashboardsPath)) {
      fs.mkdirSync(dashboardsPath)
    }

    const existingDashboards = loadItemsFromPath(dashboardsPath)

    const dashboardsOfColl = dashboards.filter(c => c.collection_id[env] === id[env])
    for (let d of dashboardsOfColl) {
      const {id, name} = d
      const {dev} = id
      const exisitngD = existingDashboards.filter(c => c.id.dev === dev)

      const filePath = path.join(dashboardsPath, `${d.name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)

      if (exisitngD) {
        const existFilePath = path.join(dashboardsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
        fs.unlinkSync(existFilePath)
      }

      fs.writeFileSync(filePath, JSON.stringify(d, null, 2), encoding)
    }
  }
}

export async function loadAll({url, username, password, env}) {
  const {id} = await auth({url, username, password})
  const collections = await loadCollections({url, token: id, env})

  const plainCollections = []
  collectPlainCollections(collections, plainCollections)

  const queries = await loadQueries(plainCollections, {url, token: id, env})

  const dashboards = await loadDashboards(plainCollections, {url, token: id, env})

  return {
    collections,
    plainCollections,
    queries,
    dashboards
  }
}

function getConfig(token) {
  return {
    headers: {
      'X-Metabase-Session': token
    }
  }
}

export async function saveAll({
  collections,
  plainCollections,
  queries,
  dashboards,
  env,
  folder
}) {
  await saveCollections(folder, collections)
  await saveQueries(plainCollections, queries, env, folder)
  await saveDashboards(plainCollections, dashboards, env, folder)
}

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
  const filePath = path.join(folder, collectionsFile)
  if (fs.existsSync(filePath)) {
    const currentCollections = JSON.parse(fs.readFileSync(filePath, encoding))
    mergeCollection(currentCollections, plainCollections, env)
    fs.writeFileSync(filePath, JSON.stringify(currentCollections, null, 2), encoding)
  }
}

function loadItemsFromPath(cardsPath) {
  const files = fs.readdirSync(cardsPath)
  const existingCards = files.filter(c => {
    return c.endsWith('.json') && fs.statSync(path.join(cardsPath, c)).isFile()
  }).map(c => {
    return JSON.parse(fs.readFileSync(path.join(cardsPath, c), encoding))
  })
  return existingCards
}

async function mergeQueries(collections, queries, env, rootFolder) {
  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const queriesOfColl = queries.filter(c => c.collection_id[env] === id[env])
    const cardsPath = path.join(rootFolder, folder, 'cards')

    if (fs.existsSync(cardsPath)) {
      const existingCards = loadItemsFromPath(cardsPath)

      for (let q of queriesOfColl) {
        const {id, name} = q
        const exisitngQ = existingCards.filter(c => c.id.dev === q.id[env])[0]
        if (exisitngQ) {
          exisitngQ.id[env] = id[env]
          const existFilePath = path.join(cardsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
          fs.writeFileSync(existFilePath, JSON.stringify(exisitngQ, null, 2), encoding)
        }
      }
    }
  }
}

async function mergeDashboards(collections, dashboards, env, rootFolder) {
  for (let {archived, id, folder} of collections) {
    if (archived) {
      continue
    }
    const dashboardsOfColl = dashboards.filter(c => c.collection_id[env] === id[env])
    const dashboardsPath = path.join(rootFolder, folder, 'dashboards')

    if (fs.existsSync(dashboardsPath)) {
      const existingDashboards = loadItemsFromPath(dashboardsPath)

      for (let d of dashboardsOfColl) {
        const {name} = d
        const exisitngD = existingDashboards.filter(c => c.id.dev === d.id[env])[0]
        if (exisitngD) {
          exisitngD.id[env] = id[env]
          const existFilePath = path.join(dashboardsPath, `${name.replace(/[/\\?%*:|"<>]/g, '-')}.json`)
          fs.writeFileSync(existFilePath, JSON.stringify(exisitngD, null, 2), encoding)
        }
      }
    }
  }
}

export async function mergeAll({
  plainCollections,
  queries,
  dashboards,
  env,
  folder
}) {
  await mergeCollections(folder, plainCollections, env)
  await mergeQueries(plainCollections, queries, env, folder)
  await mergeDashboards(plainCollections, dashboards, env, folder)
}

function convertCollection(colls, env, parentId) {
  return colls.map(({
    id,
    name,
    color,
    description,
    namespace,
    children,
    archived
  }) => {
    if (children && children.length) {
      children = convertCollection(children, env, id)
    }
    const coll = {
      id: {[env]: id},
      name,
      color,
      description,
      namespace,
      children,
      archived
    }
    if (parentId) {
      coll.parent_id = {
        [env]: parentId
      }
    }
    return coll
  })
}

export async function loadCollections({url, token, env}) {
  const collectionUrl = url + '/api/collection/tree'
  const colls = await axios.get(collectionUrl, getConfig(token))
  const commonCollections = colls.data.filter(c => c.personal_owner_id === null)

  const rootCollUrl = url + '/api/collection/root'
  const rootCol = await axios.get(rootCollUrl, getConfig(token))
  const collections = convertCollection([rootCol.data].concat(commonCollections), env)
  return collections
}

export async function loadQueries(collections, {url, token, env}) {
  const collectionUrl = url + '/api/card'
  const {data} = await axios.get(collectionUrl, getConfig(token))
  const commonQueries = data.filter(c => !c.collection || c.collection.personal_owner_id === null)

  const queries = []
  for (let {
    visualization_settings,
    description,
    archived,
    collection_position,
    result_metadata,
    enable_embedding,
    embedding_params,
    dataset_query,
    id,
    display,
    name, collection
  } of commonQueries) {
    const collId = collection ? collection.id : 'root'
    const card = {
      visualization_settings,
      description,
      archived,
      collection_position,
      result_metadata,
      enable_embedding,
      embedding_params,
      dataset_query,
      id: {
        [env]: id
      },
      display,
      name,
      collection_id: {
        [env]: collId
      }
    }
    const coll = collections.filter(({id}) => id[env] === collId)[0]
    if (coll) {
      queries.push(card)
    }
  }

  return queries
}

export async function loadDashboards(collections, {url, token, env}) {
  const collectionUrl = url + '/api/dashboard'
  const {data} = await axios.get(collectionUrl, getConfig(token))

  const dashboards = []
  for (let {
    id, collection_id
  } of data) {
    const collId = collection_id || 'root'
    const coll = collections.filter(({id}) => id[env] === collId)[0]
    if (coll) {
      const collectionUrl = url + '/api/dashboard/' + id
      const details = await axios.get(collectionUrl, getConfig(token))
      const {
        parameters,
        points_of_interest,
        description,
        archived,
        collection_position,
        show_in_getting_started,
        enable_embedding,
        caveats,
        embedding_params,
        position,
        ordered_cards,
        name
      } = details.data

      const cards = ordered_cards.map(({
        row,
        col,
        card_id,
        id,
        parameter_mappings,
        series,
        sizeX,
        sizeY,
        visualization_settings
      }) => {
        return {
          row,
          col,
          card_id: {
            [env]: card_id
          },
          id: {
            [env]: id
          },
          parameter_mappings,
          series,
          sizeX,
          sizeY,
          visualization_settings
        }
      })

      const dashboard = {
        parameters,
        points_of_interest,
        description,
        archived,
        collection_position,
        show_in_getting_started,
        enable_embedding,
        caveats,
        embedding_params,
        position,
        cards,
        id: {
          [env]: id
        },
        name,
        collection_id: {
          [env]: collId
        }
      }
      dashboards.push(dashboard)
    }
  }

  return dashboards
}
