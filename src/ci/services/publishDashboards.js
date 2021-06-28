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
    collection_id: collection_id[env] === 'root' ? null : collection_id[env]
  }, getConfig(token))

  d.id[env] = data.id
  for (let c of cards) {
    const createCardUrl = url + `/api/dashboard/${d.id[env]}/cards`
    const {data} = await axios.post(createCardUrl, {cardId: c.card_id ? c.card_id[env] : null}, getConfig(token))
    c.id[env] = data.id
  }

  await putCards(url, d, env, cards, token)

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
  writeDashboard(folder, dcoll.folder, d)
}

async function putCards(url, dlocal, env, cards, token) {
  const updateCardsUrl = url + `/api/dashboard/${dlocal.id[env]}/cards`
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
}

async function updateDashboard({url, token, dlocal, dremote, env, folder}) {
  const {
    cards
  } = dlocal

  const remoteCards = dremote.cards

  /* const cardsToUpdate = cards.filter(local => {
    const remote = remoteCards.filter(r => r.id[env] === local.id[env])[0]
    if (remote) {
      const fields = [
        'row',
        'col',
        'parameter_mappings',
        'series',
        'sizeX',
        'sizeY',
        'visualization_settings']
      return compareItem(fields, local, remote)
    }
    return false
  }) */

  const cardsToRemove = remoteCards.filter(c => {
    const local = cards.filter(l => l.id[env] === c.id[env])[0]
    return !local
  })

  for (let c of cardsToRemove) {
    const deleteCardUrl = url + `/api/dashboard/${dlocal.id[env]}/cards?dashcardId=${c.id[env]}`
    await axios.delete(deleteCardUrl, getConfig(token))
  }

  for (let c of cards.filter(c => !c.id[env])) {
    const createCardUrl = url + `/api/dashboard/${dlocal.id[env]}/cards`
    const {data} = await axios.post(createCardUrl, {cardId: c.card_id ? c.card_id[env] : null}, getConfig(token))
    c.id[env] = data.id
  }
  await putCards(url, dlocal, env, cards, token)

  const {
    name,
    collection_id,
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
  } = dlocal
  const updateDashboardUrl = url + '/api/dashboard/' + dlocal.id[env]
  await axios.put(updateDashboardUrl, {
    name,
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
    collection_id: collection_id[env] === 'root' ? null : collection_id[env],
    ordered_cards: cards
  }, getConfig(token))

  const collections = convertToPlainCollection(readCollections(folder))
  const dcoll = collections.filter(c => c.id.dev === dlocal.collection_id.dev)[0]
  writeDashboard(folder, dcoll.folder, dlocal)
}

export async function publishDashboards({url, token, remoteDashboards, env, folder}) {
  const localDashboards = readDashboardsPlain(folder)
  for (let d of localDashboards) {
    const envId = d.id[env]
    if (envId) {
      const remoteDashboard = remoteDashboards.filter(c => c.id[env] === envId)[0]
      if (needUpdateDashboard(d, remoteDashboard, env)) {
        console.log('update', d, remoteDashboard)
        await updateDashboard({url, token, dlocal: d, dremote: remoteDashboard, env, folder})
      }
    } else {
      console.log('create', d)
      await createDashboard({url, token, d, env, folder})
    }
  }
}
