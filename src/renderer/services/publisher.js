import {loadAll} from './metabase-to-tool'
import {auth} from './metabase-auth'
import {publishCollections} from './publishCollections'
import {publishQueries} from './publishQueries'
import {publishDashboards} from './publishDashboards'

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
