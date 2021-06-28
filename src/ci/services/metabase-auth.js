import axios from 'axios'

export async function auth({url, username, password}) {
  const authUrl = url + '/api/session'
  const {data} = await axios.post(authUrl, {
    username,
    password
  })
  return data
}

export function getConfig(token) {
  return {
    headers: {
      'X-Metabase-Session': token
    }
  }
}
