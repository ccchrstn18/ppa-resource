import { NextResponse } from 'next/server'

const FLOAT_TOKEN = process.env.FLOAT_TOKEN
const BASE_URL = 'https://api.float.com'

async function fetchPage(endpoint: string, page: number) {
  const res = await fetch(
    `${BASE_URL}/${endpoint}?page=${page}&per-page=200`,
    {
      headers: {
        Authorization: `Bearer ${FLOAT_TOKEN}`,
        Accept: 'application/json',
      },
      next: { revalidate: 3600 }
    }
  )
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

export async function GET() {
  try {
    const people = await fetchAllPages('v3/people')

    const shaped = people
      .filter((p: any) => p.active === 1)
      .map((p: any) => {
        const tags = Array.isArray(p.tags) ? p.tags : []
        const regionTag = tags.find((t: any) => {
          const name = typeof t === 'string' ? t : t?.name
          return ['UK', 'UAE', 'FR'].includes(name)
        })
        const region = regionTag
          ? (typeof regionTag === 'string' ? regionTag : regionTag.name)
          : null

        return {
          people_id: p.people_id,
          name: p.name,
          job_title: p.job_title,
          department: p.department?.name ?? null,
          region,
        }
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    return NextResponse.json(shaped)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 }
    )
  }
}