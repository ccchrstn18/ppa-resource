'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Person {
  people_id: number
  name: string
  job_title: string
  department: string | null
  region: string | null
}

interface Project {
  project_id: number
  name: string
  project_code: string | null
}

interface EffortMap {
  [key: string]: number
}

const REGION_ORDER = ['UK', 'UAE', 'FR']

const DEPARTMENT_ORDER = [
  'Directors',
  'Project Management',
  'Electrical',
  'Mechanical',
  'BIM',
  'Building Physics',
  'ICT & Security',
  'Document Control',
  'Other',
]

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

function addWeeks(date: Date, weeks: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getCheckColor(total: number) {
  if (total === 0) return 'var(--text3)'
  if (total <= 100) return '#22c55e'
  if (total <= 120) return 'var(--amber)'
  return 'var(--brand-red)'
}

function getCheckBg(total: number) {
  if (total === 0) return 'transparent'
  if (total <= 100) return 'rgba(34,197,94,0.08)'
  if (total <= 120) return 'rgba(232,160,32,0.08)'
  return 'rgba(238,0,0,0.08)'
}

export default function ResourcePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [effort, setEffort] = useState<EffortMap>({})
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadStatic() {
      try {
        const [peopleRes, projectsRes] = await Promise.all([
          fetch('/api/float/people'),
          fetch('/api/float/projects'),
        ])
        setPeople(await peopleRes.json())
        setProjects(await projectsRes.json())
      } catch (e) {
        console.error(e)
      }
    }
    loadStatic()
  }, [])

  useEffect(() => {
    async function loadEffort() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('weekly_effort')
          .select('*')
          .eq('week_commencing', formatDate(weekStart))
          .eq('week_number', 1)

        const map: EffortMap = {}
        if (data) {
          data.forEach((row: any) => {
            map[`${row.people_id}-${row.project_id}`] = row.effort_pct
          })
        }
        setEffort(map)
      } catch (e) {
        console.error(e)
      }
      setLoading(false)
    }
    loadEffort()
  }, [weekStart])

  function getEffort(people_id: number, project_id: number) {
    return effort[`${people_id}-${project_id}`] || 0
  }

  function setEffortValue(people_id: number, project_id: number, value: number) {
    setEffort(prev => ({
      ...prev,
      [`${people_id}-${project_id}`]: value
    }))
  }

  function getWeekTotal(people_id: number) {
    return projects.reduce((sum, p) => sum + getEffort(people_id, p.project_id), 0)
  }

  function toggleRegion(region: string) {
    setCollapsed(prev => ({ ...prev, [region]: !prev[region] }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      await supabase
        .from('weekly_effort')
        .delete()
        .eq('week_commencing', formatDate(weekStart))
        .eq('week_number', 1)

      const rows: any[] = []
      people.forEach(person => {
        projects.forEach(project => {
          const pct = getEffort(person.people_id, project.project_id)
          if (pct > 0) {
            rows.push({
              people_id: person.people_id,
              project_id: project.project_id,
              week_commencing: formatDate(weekStart),
              week_number: 1,
              effort_pct: pct,
              submitted_by: 'Christian Domingo',
            })
          }
        })
      })

      if (rows.length > 0) {
        await supabase.from('weekly_effort').insert(rows)
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  function prevWeek() { setWeekStart(w => addWeeks(w, -1)) }
  function nextWeek() { setWeekStart(w => addWeeks(w, 1)) }

  const regions = REGION_ORDER.filter(r => people.some(p => p.region === r))
  const overallocated = people.filter(p => getWeekTotal(p.people_id) > 100).length
  const active = people.filter(p => getWeekTotal(p.people_id) > 0).length
  const colSpanTotal = 2 + projects.length + 1

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Weekly Resource Input
          </h1>
          <p style={{ color: 'var(--text3)', margin: '4px 0 0', fontSize: 12 }}>
            % effort per person per project — Monday meeting
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevWeek} style={navBtnStyle}>←</button>
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            minWidth: 180,
            textAlign: 'center',
          }}>
            {formatWeekLabel(weekStart)}
          </div>
          <button onClick={nextWeek} style={navBtnStyle}>→</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saved ? '#22c55e' : 'var(--brand-green)',
              color: '#0e1a1f',
              border: 'none',
              borderRadius: 6,
              padding: '8px 20px',
              fontWeight: 700,
              fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer',
              marginLeft: 8,
            }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Week'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Staff', value: people.length, color: 'var(--brand-green)' },
          { label: 'Active Projects', value: projects.length, color: 'var(--brand-green)' },
          { label: 'Deployed', value: active, color: 'var(--brand-green)' },
          {
            label: 'Overallocated',
            value: overallocated,
            color: overallocated > 0 ? 'var(--brand-red)' : 'var(--brand-green)'
          },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '10px 16px',
            minWidth: 100,
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Matrix */}
      {loading ? (
        <div style={{ color: 'var(--text3)', padding: 40, textAlign: 'center' }}>
          Loading...
        </div>
      ) : (
        <div style={{
          overflowX: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 8,
        }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg2)' }}>
                <th style={{
                  ...thStyle,
                  width: 180,
                  minWidth: 180,
                  textAlign: 'left',
                  verticalAlign: 'top',
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: 'var(--bg2)',
                }}>
                  NAME
                </th>
                <th style={{
                  ...thStyle,
                  width: 160,
                  minWidth: 160,
                  textAlign: 'left',
                  verticalAlign: 'top',
                  position: 'sticky',
                  left: 180,
                  zIndex: 2,
                  background: 'var(--bg2)',
                }}>
                  ROLE
                </th>
                {projects.map(p => (
                  <th
                    key={p.project_id}
                    style={{
                      ...thStyle,
                      fontSize: 10,
                      width: 70,
                      minWidth: 70,
                      maxWidth: 70,
                      padding: '6px 4px',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                      textAlign: 'center',
                      verticalAlign: 'top',
                      color: 'var(--text2)',
                      lineHeight: 1.3,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {p.name.toUpperCase()}
                  </th>
                ))}
                <th style={{
                  ...thStyle,
                  width: 70,
                  textAlign: 'center',
                  verticalAlign: 'top',
                  borderLeft: '2px solid var(--border2)',
                  color: 'var(--text3)',
                  position: 'sticky',
                  right: 0,
                  zIndex: 2,
                  background: 'var(--bg2)',
                }}>
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {regions.map(region => {
                const isCollapsed = collapsed[region] ?? false
                const regionPeople = people.filter(p => p.region === region)
                const departments = Array.from(
                  new Set(regionPeople.map(p => p.department ?? 'Other'))
                ).sort((a, b) => {
                  const ai = DEPARTMENT_ORDER.indexOf(a)
                  const bi = DEPARTMENT_ORDER.indexOf(b)
                  if (ai === -1) return 1
                  if (bi === -1) return -1
                  return ai - bi
                })

                return (
                  <React.Fragment key={region}>
                    {/* Region header */}
                    <tr
                      onClick={() => toggleRegion(region)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td
                        colSpan={colSpanTotal}
                        style={{
                          padding: '10px 16px',
                          background: 'var(--brand-teal)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 13,
                          letterSpacing: '0.12em',
                          borderBottom: '1px solid var(--border)',
                          borderTop: '2px solid var(--border2)',
                          userSelect: 'none',
                        }}
                      >
                        {isCollapsed ? '▶' : '▼'} {region}
                        <span style={{
                          fontSize: 10,
                          fontWeight: 400,
                          marginLeft: 12,
                          opacity: 0.7,
                        }}>
                          {regionPeople.length} people
                        </span>
                      </td>
                    </tr>

                    {!isCollapsed && departments.map(dept => {
                      const deptPeople = regionPeople.filter(
                        p => (p.department ?? 'Other') === dept
                      )

                      return (
                        <React.Fragment key={`${region}-${dept}`}>
                          {/* Department header */}
                          <tr>
                            <td
                              colSpan={colSpanTotal}
                              style={{
                                padding: '5px 16px 5px 32px',
                                background: 'var(--bg3)',
                                color: 'var(--text2)',
                                fontWeight: 700,
                                fontSize: 10,
                                letterSpacing: '0.08em',
                                borderBottom: '1px solid var(--border)',
                                borderLeft: '3px solid var(--brand-teal)',
                              }}
                            >
                              {dept.toUpperCase()}
                            </td>
                          </tr>

                          {/* People rows */}
                          {deptPeople.map((person, i) => {
                            const total = getWeekTotal(person.people_id)
                            return (
                              <tr
                                key={person.people_id}
                                style={{
                                  background: total === 0
                                    ? 'rgba(238,0,0,0.04)'
                                    : i % 2 === 0 ? 'var(--bg)' : 'var(--bg2)',
                                }}
                              >
                                <td style={{
                                  ...tdStyle,
                                  fontWeight: 600,
                                  color: 'var(--text)',
                                  paddingLeft: 48,
                                  position: 'sticky',
                                  left: 0,
                                  background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg2)',
                                  zIndex: 1,
                                }}>
                                  {person.name}
                                </td>
                                <td style={{
                                  ...tdStyle,
                                  color: 'var(--text3)',
                                  fontSize: 11,
                                  position: 'sticky',
                                  left: 180,
                                  background: i % 2 === 0 ? 'var(--bg)' : 'var(--bg2)',
                                  zIndex: 1,
                                }}>
                                  {person.job_title}
                                </td>
                                {projects.map(project => (
                                  <td
                                    key={project.project_id}
                                    style={{
                                      ...tdStyle,
                                      padding: 2,
                                      textAlign: 'center',
                                      width: 70,
                                      minWidth: 70,
                                    }}
                                  >
                                    <input
                                      type="number"
                                      min={0}
                                      max={200}
                                      value={getEffort(person.people_id, project.project_id) || ''}
                                      onChange={e => setEffortValue(
                                        person.people_id,
                                        project.project_id,
                                        Number(e.target.value)
                                      )}
                                      style={{
                                        width: 50,
                                        background: 'transparent',
                                        border: 'none',
                                        textAlign: 'center',
                                        color: 'var(--text)',
                                        fontSize: 12,
                                        padding: '4px 2px',
                                        outline: 'none',
                                      }}
                                      onFocus={e => e.target.style.background = 'var(--bg3)'}
                                      onBlur={e => e.target.style.background = 'transparent'}
                                    />
                                  </td>
                                ))}
                                <td style={{
                                  ...tdStyle,
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  fontSize: 12,
                                  color: getCheckColor(total),
                                  background: getCheckBg(total),
                                  borderLeft: '2px solid var(--border2)',
                                  position: 'sticky',
                                  right: 0,
                                  zIndex: 1,
                                }}>
                                  {total > 0 ? `${total}%` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 12px',
  color: 'var(--text)',
  fontSize: 14,
  cursor: 'pointer',
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  fontWeight: 600,
  color: 'var(--text2)',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}

const tdStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--border)',
  borderRight: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}