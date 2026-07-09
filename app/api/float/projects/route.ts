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
      next: { revalidate: 0 }
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
    const projects = await fetchAllPages('v3/projects')

    // only include projects tagged Active
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
    }))

    return NextResponse.json(shaped)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}