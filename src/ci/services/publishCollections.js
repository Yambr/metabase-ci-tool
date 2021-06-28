import {
  compareItem,
  convertToPlainCollection,
  readCollectionCards,
  readCollectionDashboards,
  readCollections,
  writeCard,
  writeCollections,
  writeDashboard
} from './repository'
import axios from 'axios'
import {getConfig} from './metabase-auth'

function needUpdateColl(local, remote) {
  // todo parent_id
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
    parent_id: parent_id ? parent_id[env] : null,
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

async function updateColl({url, token, col, env, folder}) {
  const {
    id,
    name,
    color,
    description,
    archived,
    parent_id,
    namespace
  } = col
  const collectionUrl = url + `/api/collection/${id[env]}`
  await axios.put(collectionUrl, {
    name,
    color,
    description,
    archived,
    parent_id: parent_id ? parent_id[env] : null,
    namespace
  }, getConfig(token))
}

export async function publishCollections({url, token, remoteCollections, env, folder}) {
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
        await updateColl({url, token, col, env, folder})
      }
    } else {
      console.log('create', col)
      await createColl({url, token, col, env, folder})
    }
  }
  writeCollections(folder, localCollections)
}
