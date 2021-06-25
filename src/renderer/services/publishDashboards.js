import {
  compareItem,
  convertToPlainCollection,
  readCollections,
  readDashboardsPlain,
  writeDashboard
} from './repository'
import axios from 'axios'
import {getConfig} from './metabase-auth'

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
      cards: simpleCards(remote.cards),
      collection_id: remote.collection_id[env]
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

export async function publishDashboards({url, token, remoteDashboards, env, folder}) {
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
