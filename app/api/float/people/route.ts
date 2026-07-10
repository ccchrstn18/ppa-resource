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
      next: { revalidate: 300 }
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

function mapDepartment(dept: string | null): string | null {
  if (!dept) return null
  const d = dept.toLowerCase()
  if (d === 'electrical') return 'Electrical'
  if (d === 'mechanical') return 'Mechanical'
  if (d === 'bim') return 'BIM'
  if (d === 'building physics') return 'Building Physics'
  if (d === 'ict & security') return 'ICT & Security'
  if (d === 'project management') return 'Project Management'
  if (d === 'business operations') return 'Directors'
  if (d === 'technical') return 'Directors'
  if (d === 'business support') return 'Document Control'
  return null
}

const EXCLUDE_TITLES = [
  'team & office manager',
  'office manager',
  'accountant',
  'finance',
  'marketing',
]

const EXCLUDE_NAMES = [
  'chloe gayle',
]

const REGION_ORDER = ['UK', 'UAE', 'FR']

export async function GET() {
  try {
    const people = await fetchAllPages('v3/people')

    const shaped = people
      .map((p: any) => {
        const tags = Array.isArray(p.tags) ? p.tags : []
        const regionTag = tags.find((t: any) => {
          const name = typeof t === 'string' ? t : t?.name
          return ['UK', 'UAE', 'FR'].includes(name)
        })
        const region = regionTag
          ? (typeof regionTag === 'string' ? regionTag : regionTag.name)
          : null

        const department = mapDepartment(p.department?.name ?? null)

        return {
          people_id: p.people_id,
          name: p.name,
          job_title: p.job_title,
          department,
          region,
          active: p.active,
        }
      })
      .filter((p: any) => {
        if (!p.region) return false
        if (p.active !== 1) return false
        if (!p.department) return false
        if (EXCLUDE_NAMES.includes(p.name?.toLowerCase())) return false
        if (EXCLUDE_TITLES.some(t => p.job_title?.toLowerCase().includes(t))) return false
        return true
      })

    shaped.sort((a: any, b: any) => {
      const ri = REGION_ORDER.indexOf(a.region) - REGION_ORDER.indexOf(b.region)
      if (ri !== 0) return ri
      const di = a.department.localeCompare(b.department)
      if (di !== 0) return di
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json(shaped)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to fetch people' },
      { status: 500 }
    )
  }
}