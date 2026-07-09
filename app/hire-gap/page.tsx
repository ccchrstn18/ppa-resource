'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Project {
  project_id: number
  name: string
  project_code: string | null
}

interface GapRow {
  discipline: string
  required: number
  actual: number
  gap: number
  grades: { grade: string, count: number }[]
}

interface PortfolioItem {
  project: Project
  totalRequired: number
  totalDeployed: number
  totalVacancies: number
  gaps: { discipline: string, gap: number }[]
}

const DISCIPLINES = [
  'Electrical',
  'Mechanical',
  'BIM',
  'Building Physics',
  'ICT & Security',
  'Project Management',
  'Document Control',
  'Directors',
]

function getDisciplineFromDept(dept: string | null): string {
  if (!dept) return 'Other'
  const d = dept.toLowerCase()
  if (d === 'electrical') return 'Electrical'
  if (d === 'mechanical') return 'Mechanical'
  if (d === 'bim') return 'BIM'
  if (d === 'building physics') return 'Building Physics'
  if (d === 'ict & security') return 'ICT & Security'
  if (d.includes('project') || d.includes('management')) return 'Project Management'
  if (d.includes('document') || d.includes('support')) return 'Document Control'
  if (d.includes('director') || d.includes('operations') || d.includes('technical')) return 'Directors'
  return 'Other'
}

function getGradeFromTitle(title: string | null): string {
  if (!title) return 'Other'
  const t = title.toLowerCase()
  if (t.includes('director')) return 'Director'
  if (t.includes('senior design project manager') || t.includes('design project manager')) return 'Design Manager'
  if (t.includes('lead')) return 'Lead'
  if (t.includes('principal')) return 'Principal'
  if (t.includes('senior') || t.includes('sr')) return 'Senior'
  if (t.includes('intermediate')) return 'Intermediate'
  if (t.includes('junior')) return 'Junior'
  if (t.includes('graduate') || t.includes('grad')) return 'Graduate'
  if (t.includes('technician') || t.includes('tech')) return 'Technician'
  if (t.includes('coordinator')) return 'Coordinator'
  if (t.includes('controller')) return 'Controller'
  if (t.includes('manager')) return 'Manager'
  if (t.includes('engineer')) return 'Engineer'
  return 'Other'
}

const GRADE_ORDER = [
  'Director', 'Design Manager', 'Manager', 'Lead', 'Principal',
  'Senior', 'Engineer', 'Coordinator', 'Controller',
  'Intermediate', 'Technician', 'Junior', 'Graduate', 'Other'
]

function getGapColor(gap: number) {
  if (gap <= 0) return '#22c55e'
  if (gap === 1) return '#e8a020'
  return '#EE0000'
}

function getGapBg(gap: number) {
  if (gap <= 0) return 'rgba(34,197,94,0.08)'
  if (gap === 1) return 'rgba(232,160,32,0.08)'
  return 'rgba(238,0,0,0.08)'
}

function getMonday(date: Date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

export default function HireGapPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [demand, setDemand] = useState<Record<string, number>>({})
  const [gapRows, setGapRows] = useState<GapRow[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [portfolioLoading, setPortfolioLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [updatedBy, setUpdatedBy] = useState('Christian Domingo')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [weekStart] = useState<Date>(getMonday(new Date()))

  useEffect(() => {
    fetch('/api/float/projects')
      .then(r => r.json())
      .then(data => {
        setProjects(data)
        loadPortfolio(data)
      })
  }, [])

  useEffect(() => {
    if (!selectedProject) return
    loadData(selectedProject)
  }, [selectedProject])

  async function loadPortfolio(projectList: Project[]) {
    setPortfolioLoading(true)
    try {
      const { data: allDemand } = await supabase
        .from('project_demand')
        .select('*')

      const { data: allEffort } = await supabase
        .from('weekly_effort')
        .select('people_id, project_id, effort_pct')
        .eq('week_commencing', formatDate(weekStart))
        .gt('effort_pct', 0)

      const peopleRes = await fetch('/api/float/people-list')
      const allPeople = await peopleRes.json()

      const result: PortfolioItem[] = projectList
        .map(project => {
          const demand = (allDemand ?? []).filter((r: any) => r.project_id === project.project_id)
          if (demand.length === 0) return null

          const effortPids = [...new Set(
            (allEffort ?? [])
              .filter((r: any) => r.project_id === project.project_id)
              .map((r: any) => r.people_id)
          )]

          const disciplineCount: Record<string, number> = {}
          effortPids.forEach(pid => {
            const person = allPeople.find((p: any) => p.people_id === pid)
            if (!person) return
            const disc = getDisciplineFromDept(person.department)
            disciplineCount[disc] = (disciplineCount[disc] ?? 0) + 1
          })

          const gaps = demand.map((d: any) => ({
            discipline: d.discipline,
            gap: d.required_hc - (disciplineCount[d.discipline] ?? 0),
          }))

          const totalRequired = demand.reduce((s: number, d: any) => s + d.required_hc, 0)
          const totalDeployed = effortPids.length
          const totalVacancies = gaps.reduce((s: number, g: any) => s + Math.max(0, g.gap), 0)

          return { project, totalRequired, totalDeployed, totalVacancies, gaps }
        })
        .filter(Boolean) as PortfolioItem[]

      setPortfolio(result)
    } catch (e) {
      console.error(e)
    }
    setPortfolioLoading(false)
  }

  async function loadData(projectId: number) {
    setLoading(true)
    try {
      const { data: demandData } = await supabase
        .from('project_demand')
        .select('*')
        .eq('project_id', projectId)

      const demandMap: Record<string, number> = {}
      ;(demandData ?? []).forEach((row: any) => {
        demandMap[row.discipline] = row.required_hc
      })
      setDemand(demandMap)

      const { data: effortData } = await supabase
        .from('weekly_effort')
        .select('people_id, effort_pct')
        .eq('project_id', projectId)
        .eq('week_commencing', formatDate(weekStart))
        .gt('effort_pct', 0)

      const uniquePeopleIds = [...new Set((effortData ?? []).map((r: any) => r.people_id))]

      const peopleRes = await fetch('/api/float/people-list')
      const allPeople = await peopleRes.json()

      const disciplineGrades: Record<string, Record<string, number>> = {}
      uniquePeopleIds.forEach(pid => {
        const person = allPeople.find((p: any) => p.people_id === pid)
        if (!person) return
        const disc = getDisciplineFromDept(person.department)
        const grade = getGradeFromTitle(person.job_title)
        if (!disciplineGrades[disc]) disciplineGrades[disc] = {}
        disciplineGrades[disc][grade] = (disciplineGrades[disc][grade] ?? 0) + 1
      })

      const allDiscs = new Set([
        ...DISCIPLINES.filter(d => demandMap[d] > 0),
        ...Object.keys(disciplineGrades),
      ])

      const rows: GapRow[] = [...allDiscs]
        .filter(d => (demandMap[d] ?? 0) > 0 || Object.keys(disciplineGrades[d] ?? {}).length > 0)
        .map(disc => {
          const required = demandMap[disc] ?? 0
          const gradeMap = disciplineGrades[disc] ?? {}
          const actual = Object.values(gradeMap).reduce((s, v) => s + v, 0)
          const grades = Object.entries(gradeMap)
            .sort(([a], [b]) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))
            .map(([grade, count]) => ({ grade, count }))
          return { discipline: disc, required, actual, gap: required - actual, grades }
        })
        .sort((a, b) => DISCIPLINES.indexOf(a.discipline) - DISCIPLINES.indexOf(b.discipline))

      setGapRows(rows)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!selectedProject) return
    setSaving(true)
    try {
      await supabase.from('project_demand').delete().eq('project_id', selectedProject)
      const rows = Object.entries(demand)
        .filter(([_, v]) => v > 0)
        .map(([discipline, required_hc]) => ({
          project_id: selectedProject,
          discipline,
          required_hc,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
        }))
      if (rows.length > 0) await supabase.from('project_demand').insert(rows)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      await loadData(selectedProject)
      await loadPortfolio(projects)
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  function toggleExpand(disc: string) {
    setExpanded(prev => ({ ...prev, [disc]: !prev[disc] }))
  }

  const totalVacancies = gapRows.reduce((sum, r) => sum + Math.max(0, r.gap), 0)
  const totalDeployed = gapRows.reduce((sum, r) => sum + r.actual, 0)
  const totalRequired = gapRows.reduce((sum, r) => sum + r.required, 0)

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Hire Gap
          </h1>
          <p style={{ color: 'var(--text3)', margin: '4px 0 0', fontSize: 12 }}>
            Required vs deployed headcount · week of {formatDate(weekStart)}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selectedProject && (
            <button
              onClick={() => { setSelectedProject(null); setGapRows([]) }}
              style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '7px 12px',
                color: 'var(--text3)', fontSize: 12, cursor: 'pointer',
              }}
            >
              ← All Projects
            </button>
          )}
          <select
            value={selectedProject ?? ''}
            onChange={e => setSelectedProject(Number(e.target.value))}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '7px 12px', color: 'var(--text)',
              fontSize: 13, minWidth: 220,
            }}
          >
            <option value=''>Select a project...</option>
            {projects.map(p => (
              <option key={p.project_id} value={p.project_id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedProject ? (
        portfolioLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
            Loading portfolio...
          </div>
        ) : portfolio.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text3)', fontSize: 14,
            border: '1px dashed var(--border)', borderRadius: 8,
          }}>
            No projects with headcount requirements set yet.
            Select a project above to set requirements.
          </div>
        ) : (
          <>
            <div style={{
              fontSize: 12, fontWeight: 700, color: 'var(--text2)',
              marginBottom: 12, letterSpacing: '0.06em',
            }}>
              ALL PROJECTS — HIRE GAP SUMMARY
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
            }}>
              {portfolio.map(({ project, totalRequired, totalDeployed, totalVacancies, gaps }) => (
                <div
                  key={project.project_id}
                  onClick={() => setSelectedProject(project.project_id)}
                  style={{
                    background: 'var(--bg2)',
                    border: `1px solid ${totalVacancies > 0 ? '#EE000030' : 'var(--border)'}`,
                    borderRadius: 8, padding: 16, cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', marginBottom: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {project.name}
                      </div>
                      {project.project_code && (
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {project.project_code}
                        </div>
                      )}
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      padding: '3px 8px', borderRadius: 999,
                      background: totalVacancies > 0 ? 'rgba(238,0,0,0.1)' : 'rgba(34,197,94,0.1)',
                      color: totalVacancies > 0 ? '#EE0000' : '#22c55e',
                    }}>
                      {totalVacancies > 0 ? `${totalVacancies} vacancy` : '✓ Staffed'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      Required: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{totalRequired}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      Deployed: <span style={{ fontWeight: 700, color: 'var(--text)' }}>{totalDeployed}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {gaps.filter(g => g.gap !== 0).map(g => (
                      <span key={g.discipline} style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 999,
                        background: g.gap > 0 ? 'rgba(238,0,0,0.08)' : 'rgba(34,197,94,0.08)',
                        color: g.gap > 0 ? '#EE0000' : '#22c55e',
                        fontWeight: 600,
                        border: `1px solid ${g.gap > 0 ? '#EE000030' : '#22c55e30'}`,
                      }}>
                        {g.discipline} {g.gap > 0 ? `+${g.gap}` : g.gap}
                      </span>
                    ))}
                    {gaps.every(g => g.gap === 0) && (
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        All disciplines staffed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {[
              { label: 'Total Required', value: totalRequired, color: 'var(--brand-green)' },
              { label: 'Total Deployed', value: totalDeployed, color: 'var(--brand-green)' },
              {
                label: 'Vacancies',
                value: totalVacancies,
                color: totalVacancies > 0 ? 'var(--brand-red)' : 'var(--brand-green)'
              },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 16px', minWidth: 120,
              }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: 'var(--text3)', margin: '0 0 16px', fontStyle: 'italic' }}>
            Deployed count reflects people with effort logged this week only.
            Required headcount is a project-level target set by the PM.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
            {/* Left — Set Required */}
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 16,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text2)',
                marginBottom: 16, letterSpacing: '0.06em',
              }}>
                SET REQUIRED HEADCOUNT
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {DISCIPLINES.map(disc => (
                  <div key={disc} style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 12,
                  }}>
                    <label style={{ fontSize: 13, color: 'var(--text)', minWidth: 160 }}>
                      {disc}
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => setDemand(prev => ({
                          ...prev, [disc]: Math.max(0, (prev[disc] ?? 0) - 1)
                        }))}
                        style={{
                          width: 28, height: 28, background: 'var(--bg3)',
                          border: '1px solid var(--border)', borderRadius: 4,
                          color: 'var(--text)', cursor: 'pointer', fontSize: 16,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >−</button>
                      <span style={{
                        minWidth: 32, textAlign: 'center',
                        fontSize: 15, fontWeight: 700, color: 'var(--text)',
                      }}>
                        {demand[disc] ?? 0}
                      </span>
                      <button
                        onClick={() => setDemand(prev => ({
                          ...prev, [disc]: (prev[disc] ?? 0) + 1
                        }))}
                        style={{
                          width: 28, height: 28, background: 'var(--brand-green)',
                          border: 'none', borderRadius: 4, color: '#0e1a1f',
                          cursor: 'pointer', fontSize: 16, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                  UPDATED BY
                </label>
                <input
                  type="text" value={updatedBy}
                  onChange={e => setUpdatedBy(e.target.value)}
                  style={{
                    width: '100%', background: 'var(--bg)',
                    border: '1px solid var(--border)', borderRadius: 6,
                    padding: '6px 10px', color: 'var(--text)', fontSize: 12,
                  }}
                />
              </div>
              <button
                onClick={handleSave} disabled={saving}
                style={{
                  width: '100%',
                  background: saved ? '#22c55e' : 'var(--brand-green)',
                  color: '#0e1a1f', border: 'none', borderRadius: 6,
                  padding: '8px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Requirements'}
              </button>
            </div>

            {/* Right — Gap Analysis */}
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 16,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text2)',
                marginBottom: 16, letterSpacing: '0.06em',
              }}>
                GAP ANALYSIS
              </div>

              {gapRows.length === 0 ? (
                <div style={{
                  color: 'var(--text3)', fontSize: 13,
                  textAlign: 'center', padding: '40px 0',
                }}>
                  Set required headcount to see gap analysis
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 70px 70px 100px',
                    gap: 8, padding: '4px 10px',
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--text3)', letterSpacing: '0.06em',
                  }}>
                    <span>DISCIPLINE</span>
                    <span style={{ textAlign: 'center' }}>REQUIRED</span>
                    <span style={{ textAlign: 'center' }}>DEPLOYED</span>
                    <span style={{ textAlign: 'center' }}>GAP</span>
                  </div>

                  {gapRows.map(row => (
                    <div key={row.discipline}>
                      <div
                        onClick={() => row.grades.length > 0 && toggleExpand(row.discipline)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 70px 70px 100px',
                          gap: 8, padding: '10px 10px',
                          background: getGapBg(row.gap),
                          borderRadius: expanded[row.discipline] ? '6px 6px 0 0' : 6,
                          border: `1px solid ${row.gap > 0 ? getGapColor(row.gap) + '30' : 'var(--border)'}`,
                          alignItems: 'center',
                          cursor: row.grades.length > 0 ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {row.grades.length > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                              {expanded[row.discipline] ? '▼' : '▶'}
                            </span>
                          )}
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {row.discipline}
                          </span>
                        </div>
                        <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
                          {row.required}
                        </span>
                        <span style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)' }}>
                          {row.actual}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: getGapColor(row.gap) }}>
                            {row.gap > 0 ? `+${row.gap}` : row.gap === 0 ? '✓' : `${row.gap}`}
                          </span>
                          {row.gap > 0 && (
                            <span style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 999,
                              background: getGapColor(row.gap), color: '#fff', fontWeight: 600,
                            }}>hire</span>
                          )}
                          {row.gap < 0 && (
                            <span style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 999,
                              background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 600,
                            }}>over</span>
                          )}
                        </div>
                      </div>

                      {expanded[row.discipline] && row.grades.length > 0 && (
                        <div style={{
                          border: `1px solid ${row.gap > 0 ? getGapColor(row.gap) + '30' : 'var(--border)'}`,
                          borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden',
                        }}>
                          {row.grades.map((g, i) => (
                            <div key={g.grade} style={{
                              display: 'grid', gridTemplateColumns: '1fr 70px',
                              gap: 8, padding: '7px 10px 7px 28px',
                              background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg2)',
                              fontSize: 12, alignItems: 'center',
                            }}>
                              <span style={{ color: 'var(--text2)' }}>{g.grade}</span>
                              <span style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text)' }}>
                                {g.count} deployed
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}