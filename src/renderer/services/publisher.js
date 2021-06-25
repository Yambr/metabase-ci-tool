import {
  convertToPlainCollection, readCardsPlain,
  readCollectionCards, readCollectionDashboards,
  readCollections, readDashboardsPlain, writeCard,
  writeCollections, writeDashboard
} from './repository'
import {loadAll} from './metabase-to-tool'
import axios from 'axios'
import {auth, getConfig} from './metabase-auth'

function compareItem(fields, local, remote) {
  for (let i of fields) {
    if (JSON.stringify(local[i]) !== JSON.stringify(remote[i])) {
      return true
    }
  }
  return false
}

function needUpdateColl(local, remote) {
  const fields = ['archived', 'color', 'description', 'name', 'namespace']
  return compareItem(fields, local, remote)
}

async function createColl({url, token, col, env, folder}) {
  const {
    name,
    color,
    description,
    parent_id,
    namespace
  } = col
  const collectionUrl = url + '/api/collection'
  const {data} = await axios.post(collectionUrl, {
    name,
    color,
    description,
    parent_id,
    namespace
  }, getConfig(token))

  col.id[env] = data.id
  const cards = readCollectionCards(folder, col)
  for (let c of cards) {
    c.collection_id[env] = data.id
    writeCard(folder, col.folder, c.name, c)
  }
  const dashboards = readCollectionDashboards(folder, col)
  for (let c of dashboards) {
    c.collection_id[env] = data.id
    writeDashboard(folder, col.folder, c.name, c)
  }
}

async function publishCollections({url, token, remoteCollections, env, folder}) {
  const localCollections = readCollections(folder)
  const realColls = convertToPlainCollection(localCollections)
  const remoteColls = convertToPlainCollection(remoteCollections)

  for (let col of realColls) {
    if (col.personal_owner_id) {
      continue
    }
    const envId = col.id[env]
    if (envId) {
      const remoteColl = remoteColls.filter(c => c.id[env] === envId)[0]
      if (needUpdateColl(col, remoteColl)) {
        console.log('update', col, remoteColl)
      }
    } else {
      console.log('create', col)
      await createColl({url, token, col, env, folder})
    }
  }
  writeCollections(folder, localCollections)
}

function needUpdateCard(local, remote, env) {
  const fields = ['visualization_settings', 'description', 'collection_position', 'name', 'dataset_query', 'display', 'collection_id']
  return compareItem(fields,
    {
      ...local,
      collection_id: local.collection_id[env]
    },
    {
      ...remote,
      collection_id: local.collection_id[env]
    })
}

async function createCard({url, token, q, env, folder}) {
  const {
    visualization_settings,
    description,
    collection_position,
    result_metadata,
    name,
    dataset_query,
    display,
    collection_id
  } = q
  const collectionUrl = url + '/api/card/'
  const {data} = await axios.post(collectionUrl, {
    visualization_settings,
    description,
    collection_position,
    result_metadata,
    name,
    dataset_query,
    display,
    collection_id: collection_id[env]
  }, getConfig(token))

  q.id[env] = data.id

  const collections = convertToPlainCollection(readCollections(folder))
  const qcoll = collections.filter(c => c.id.dev === q.collection_id.dev)[0]
  writeCard(folder, qcoll.folder, q.name, q)

  const dashboards = readDashboardsPlain(folder)
  for (let d of dashboards) {
    let reSave = false
    const {cards} = d
    for (let c of cards) {
      if (c.card_id && c.card_id.dev === q.id.dev) {
        c.card_id[env] = data.id
        reSave = true
      }
    }
    if (reSave) {
      const dcoll = collections.filter(c => c.id.dev === d.collection_id.dev)[0]
      writeDashboard(folder, dcoll.folder, d.name, d)
    }
  }
}

async function publishQueries({url, token, remoteQueries, env, folder}) {
  const localQueries = readCardsPlain(folder)
  for (let q of localQueries) {
    const envId = q.id[env]
    if (envId) {
      const remoteCard = remoteQueries.filter(c => c.id[env] === envId)[0]
      if (needUpdateCard(q, remoteCard, env)) {
        console.log('update', q, remoteCard)
      }
    } else {
      console.log('create', q)
      await createCard({url, token, q, env, folder})
    }
  }
}

function simpleCards(cards) {
  // todo parameter_mappings
  return cards.map(({row, col, series, sizeX, sizeY, visualization_settings}) => {
    return {
      row, col, series, sizeX, sizeY, visualization_settings
    }
  })
}

function needUpdateDashboard(local, remote, env) {
  const fields = [
    'parameters',
    'points_of_interest',
    'description',
    'archived',
    'collection_position',
    'show_in_getting_started',
    'enable_embedding',
    'caveats',
    'embedding_params',
    'position',
    'cards',
    'name',
    'collection_id']

  return compareItem(fields,
    {
      ...local,
      cards: simpleCards(local.cards),
      collection_id: local.collection_id[env]
    },
    {
      ...remote,
      cards: simpleCards(local.cards),
      collection_id: local.collection_id[env]
    })
}

async function createDashboard({url, token, d, env, folder}) {
  const {
    name,
    collection_id,
    cards
  } = d
  const collectionUrl = url + '/api/dashboard/'
  const {data} = await axios.post(collectionUrl, {
    name,
    collection_id: collection_id[env]
  }, getConfig(token))

  d.id[env] = data.id
  for (let c of cards) {
    const createCardUrl = url + `/api/dashboard/${d.id[env]}/cards`
    const {data} = await axios.post(createCardUrl, {cardId: c.card_id ? c.card_id[env] : null}, getConfig(token))
    c.id[env] = data.id
  }

  const updateCardsUrl = url + `/api/dashboard/${d.id[env]}/cards`
  const putCards = cards.map(c => {
    const sc = {
      ...c,
      id: c.id[env]
    }
    if (c.card_id) {
      sc.card_id = c.card_id[env]
    }
    return sc
  })
  console.log(putCards)
  await axios.put(updateCardsUrl, {cards: putCards}, getConfig(token))

  const {
    description,
    parameters,
    collection_position,
    points_of_interest,
    archived,
    show_in_getting_started,
    enable_embedding,
    caveats,
    embedding_params,
    position
  } = d
  const updateDashboardUrl = url + '/api/dashboard/' + d.id[env]
  await axios.put(updateDashboardUrl, {
    description,
    parameters,
    collection_position,
    points_of_interest,
    archived,
    show_in_getting_started,
    enable_embedding,
    caveats,
    embedding_params,
    position,
    ordered_cards: cards
  }, getConfig(token))

  const collections = convertToPlainCollection(readCollections(folder))
  const dcoll = collections.filter(c => c.id.dev === d.collection_id.dev)[0]
  writeDashboard(folder, dcoll.folder, d.name, d)
}

async function publishDashboards({url, token, remoteDashboards, env, folder}) {
  const localDashboards = readDashboardsPlain(folder)
  for (let d of localDashboards) {
    const envId = d.id[env]
    if (envId) {
      const remoteCard = remoteDashboards.filter(c => c.id[env] === envId)[0]
      if (needUpdateDashboard(d, remoteCard, env)) {
        console.log('update', d, remoteCard)
      }
    } else {
      console.log('create', d)
      await createDashboard({url, token, d, env, folder})
    }
  }
}

export async function publish({url, username, password, env, folder}) {
  const {
    collections,
    queries,
    dashboards
  } = await loadAll({url, username, password, env, folder})

  const {id} = await auth({url, username, password})
  await publishCollections({url, token: id, remoteCollections: collections, env, folder})

  await publishQueries({url, token: id, remoteQueries: queries, env, folder})
  await publishDashboards({url, token: id, remoteDashboards: dashboards, env, folder})

  console.log(collections,
    queries,
    dashboards)
}
