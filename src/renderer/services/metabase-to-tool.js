import axios from 'axios'
import {auth, getConfig} from './metabase-auth'
import {convertToPlainCollection, readCardsPlain, readCollections, readDashboardsPlain} from './repository'

export async function loadAll({url, username, password, env, folder}) {
  const {id} = await auth({url, username, password})

  const collections = await loadCollections({url, token: id, env, folder})
  const plainCollections = convertToPlainCollection(collections)

  const queries = await loadQueries(plainCollections, {url, token: id, env, folder})

  const dashboards = await loadDashboards(plainCollections, {url, token: id, env, folder})

  return {
    collections,
    queries,
    dashboards
  }
}

async function loadCollections({url, token, env, folder}) {
  const collectionUrl = url + '/api/collection/tree'
  const colls = await axios.get(collectionUrl, getConfig(token))
  const commonCollections = colls.data.filter(c => c.personal_owner_id === null)

  const rootCollUrl = url + '/api/collection/root'
  const rootCol = await axios.get(rootCollUrl, getConfig(token))

  const currentCollections = readCollections(folder)
  const plainCollections = convertToPlainCollection(currentCollections)

  const collections = prepareCollection([rootCol.data].concat(commonCollections), plainCollections, env)
  return collections
}

function extractSharedId(currentItems, env, id) {
  const element = currentItems.filter(c => c.id[env] === id)[0]
  const sharedId = element ? element.id : {[env]: id}
  return sharedId
}

function prepareCollection(colls, currentPlainCollections, env, parentId) {
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
      children = prepareCollection(children, currentPlainCollections, env, id)
    }
    const sharedId = extractSharedId(currentPlainCollections, env, id)
    const coll = {
      id: sharedId,
      name,
      color,
      description,
      namespace,
      children,
      archived
    }

    if (parentId) {
      const sharedParentId = extractSharedId(currentPlainCollections, env, parentId)
      coll.parent_id = sharedParentId
    }
    return coll
  })
}

async function loadQueries(collections, {url, token, env, folder}) {
  const collectionUrl = url + '/api/card'
  const {data} = await axios.get(collectionUrl, getConfig(token))
  const commonQueries = data.filter(c => !c.collection || c.collection.personal_owner_id === null)

  const existingCards = readCardsPlain(folder)
  const existingCollections = readCollections(folder)

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
    const sharedId = extractSharedId(existingCards, env, id)
    const sharedCollectionId = extractSharedId(existingCollections, env, collId)
    const card = {
      visualization_settings,
      description,
      archived,
      collection_position,
      result_metadata,
      enable_embedding,
      embedding_params,
      dataset_query,
      id: sharedId,
      display,
      name,
      collection_id: sharedCollectionId
    }
    const coll = collections.filter(({id}) => id[env] === collId)[0]
    if (coll) {
      queries.push(card)
    }
  }

  return queries
}

async function loadDashboards(collections, {url, token, env, folder}) {
  const collectionUrl = url + '/api/dashboard'
  const {data} = await axios.get(collectionUrl, getConfig(token))

  const existingDashboards = readDashboardsPlain(folder)
  const existingCards = readCardsPlain(folder)

  const dashboards = []
  for (let {
    id, collection_id
  } of data) {
    const collId = collection_id || 'root'
    const coll = collections.filter(({id}) => id[env] === collId)[0]
    const existingItem = existingDashboards.filter(d => d.id[env] === id[env])[0]
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

      const existingDahboardCards = existingItem ? existingItem.cards : []

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
        const sharedId = extractSharedId(existingDahboardCards, env, id)
        const sharedCardId = extractSharedId(existingCards, env, card_id)

        return {
          row,
          col,
          card_id: sharedCardId,
          id: sharedId,
          parameter_mappings,
          series,
          sizeX,
          sizeY,
          visualization_settings
        }
      })

      const sharedId = extractSharedId(existingDashboards, env, id)
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
        id: sharedId,
        name,
        collection_id: coll.id
      }
      dashboards.push(dashboard)
    }
  }

  return dashboards
}
