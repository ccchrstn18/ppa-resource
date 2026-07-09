const FLOAT_TOKEN = process.env.FLOAT_TOKEN
const BASE_URL = 'https://api.float.com'

async function fetchPage(endpoint: string, page: number) {
  const url = `${BASE_URL}/${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}&per-page=200`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${FLOAT_TOKEN}`,
      Accept: 'application/json',
    },
    next: { revalidate: 3600 } // cache for 1 hour
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

async function fetchAllPages(endpoint: string) {
  const results = []
  let page = 1
  while (true) {
    const data = await fetchPage(endpoint, page)
    if (data.length === 0) break
    results.push(...data)
    page++
  }
  return results
}

export async function getPeople() {
  const active = await fetchAllPages('v3/people')
  const inactive = await fetchAllPages('v3/people?active=0')
  const all = [...active, ...inactive]
  // deduplicate
  const seen = new Set()
  return all.filter(p => {
    if (seen.has(p.people_id)) return false
    seen.add(p.people_id)
    return true
  })
}

export async function getProjects() {
  const active = await fetchAllPages('v3/projects')
  const archived = await fetchAllPages('v3/projects?active=0')
  const all = [...active, ...archived]
  const seen = new Set()
  return all.filter(p => {
    if (seen.has(p.project_id)) return false
    seen.add(p.project_id)
    return true
  })
}