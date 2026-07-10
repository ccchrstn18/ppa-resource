import { NextResponse } from 'next/server'

const FLOAT_TOKEN = process.env.FLOAT_TOKEN
const BASE_URL = 'https://api.float.com'

async function fetchPage(endpoint: string, page: number) {
  const url = endpoint.includes('?')
    ? `${BASE_URL}/${endpoint}&page=${page}&per-page=200`
    : `${BASE_URL}/${endpoint}?page=${page}&per-page=200`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${FLOAT_TOKEN}`,
      Accept: 'application/json',
    },
    next: { revalidate: 300 }
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

const REGION_ORDER = ['UK', 'UAE', 'FR']

export async function GET() {
  try {
    const projects = await fetchAllPages('v3/projects')

    const accountsRes = await fetch(
      `${BASE_URL}/v3/accounts?page=1&per-page=200`,
      {
        headers: {
          Authorization: `Bearer ${FLOAT_TOKEN}`,
          Accept: 'application/json',
        },
        next: { revalidate: 300 }
      }
    )
    const accountsData = await accountsRes.json()
    const accounts = Array.isArray(accountsData) ? accountsData : []

    const people = await fetchAllPages('v3/people')

    const peopleRegionMap = new Map<number, string>()
    people.forEach((p: any) => {
      const tags = Array.isArray(p.tags) ? p.tags : []
      const regionTag = tags.find((t: any) => {
        const name = typeof t === 'string' ? t : t?.name
        return ['UK', 'UAE', 'FR'].includes(name)
      })
      if (regionTag) {
        const region = typeof regionTag === 'string' ? regionTag : regionTag.name
        peopleRegionMap.set(p.people_id, region)
      }
    })

    const active = projects.filter((p: any) => {
      const tags = Array.isArray(p.tags) ? p.tags : []
      return tags.some((t: any) => {
        const name = typeof t === 'string' ? t : t?.name
        return name === 'Active'
      })
    })

    const shaped = active.map((p: any) => ({
      project_id: p.project_id,
      name: p.name,
      project_code: p.project_code ?? null,
      region: peopleRegionMap.get(p.project_manager) ?? null,
    }))

    shaped.sort((a: any, b: any) => {
      const ri =
        (REGION_ORDER.indexOf(a.region) === -1 ? 99 : REGION_ORDER.indexOf(a.region)) -
        (REGION_ORDER.indexOf(b.region) === -1 ? 99 : REGION_ORDER.indexOf(b.region))
      if (ri !== 0) return ri
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json(shaped)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}