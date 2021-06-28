import axios from 'axios'
import {getConfig} from './metabase-auth'
import {
  compareItem,
  convertToPlainCollection,
  readCardsPlain,
  readCollections,
  readDashboardsPlain,
  writeCard,
  writeDashboard
} from './repository'

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
    collection_id: collection_id[env] === 'root' ? null : collection_id[env]
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

async function updateCard({url, token, q, env, folder}) {
  const {
    id,
    visualization_settings,
    description,
    archived,
    collection_position,
    result_metadata,
    enable_embedding,
    embedding_params,
    name,
    dataset_query,
    display,
    collection_id
  } = q
  const collectionUrl = url + `/api/card/${id[env]}`
  await axios.put(collectionUrl, {
    visualization_settings,
    description,
    archived,
    collection_position,
    result_metadata,
    enable_embedding,
    embedding_params,
    name,
    dataset_query,
    display,
    collection_id: collection_id[env] === 'root' ? null : collection_id[env]
  }, getConfig(token))
}

export async function publishQueries({url, token, remoteQueries, env, folder}) {
  const localQueries = readCardsPlain(folder)
  for (let q of localQueries) {
    const envId = q.id[env]
    if (envId) {
      const remoteCard = remoteQueries.filter(c => c.id[env] === envId)[0]
      if (needUpdateCard(q, remoteCard, env)) {
        console.log('update', q, remoteCard)
        await updateCard({url, token, q, env, folder})
      }
    } else {
      console.log('create', q)
      await createCard({url, token, q, env, folder})
    }
  }
}
