'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LoadingSpinner from '@/components/LoadingSpinner'

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

interface OrgNode {
  people_id: number
  project_id: number
  reports_to_id: number | null
  position_label: string | null
  person: Person
}

interface TreeNode extends OrgNode {
  children: TreeNode[]
  x: number
  y: number
}

interface EffortRow {
  people_id: number
  project_id: number
  effort_pct: number
}

interface GapRow {
  discipline: string
  required: number
  actual: number
  gap: number
}

const BOX_W = 180
const BOX_H = 76
const H_GAP = 24
const V_GAP = 70

const GRADE_RANK: Record<string, number> = {
  'project director': 1,
  'director': 1,
  'senior design project manager': 2,
  'design project manager': 2,
  'lead': 3,
  'principal': 4,
  'senior': 5,
  'engineer': 6,
  'intermediate': 7,
  'technician': 7,
  'coordinator': 6,
  'controller': 6,
  'graduate': 8,
  'grad': 8,
}

function getGradeRank(job_title: string | null): number {
  if (!job_title) return 9
  const t = job_title.toLowerCase()
  for (const [key, rank] of Object.entries(GRADE_RANK)) {
    if (t.includes(key)) return rank
  }
  return 9
}

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

function autoAssignReporting(nodes: OrgNode[]): OrgNode[] {
  const findByRole = (keywords: string[]) =>
    nodes.find(n => keywords.some(k => n.person.job_title?.toLowerCase().includes(k)))
  const filterByRole = (keywords: string[]) =>
    nodes.filter(n => keywords.some(k => n.person.job_title?.toLowerCase().includes(k)))

  const pd = findByRole(['project director', 'director'])
  const dms = filterByRole(['senior design project manager', 'design project manager'])
  const bimManager = findByRole(['bim manager'])
  const bimTechs = filterByRole(['bim technician', 'bim tech', 'revit', 'bim mech'])
    .filter(n => n !== bimManager)
  const dcStaff = filterByRole(['document controller', 'controller'])
  const engineers = nodes.filter(n => {
    const t = n.person.job_title?.toLowerCase() ?? ''
    return !['director', 'manager', 'project manager', 'controller', 'bim'].some(k => t.includes(k))
      && ['engineer', 'principal', 'senior', 'lead', 'intermediate', 'junior', 'grad'].some(k => t.includes(k))
  })

  const sortedDC = [...dcStaff].sort((a, b) =>
    getGradeRank(a.person.job_title) - getGradeRank(b.person.job_title))
  const leadDC = sortedDC[0]
  const juniorDCs = sortedDC.slice(1)
  const primaryDM = [...dms].sort((a, b) =>
    getGradeRank(a.person.job_title) - getGradeRank(b.person.job_title))[0]

  return nodes.map(node => {
    if (node === pd) return { ...node, reports_to_id: null }
    if (node === primaryDM) return { ...node, reports_to_id: pd?.people_id ?? null }
    if (dms.includes(node) && node !== primaryDM)
      return { ...node, reports_to_id: primaryDM?.people_id ?? pd?.people_id ?? null }
    if (node === bimManager)
      return { ...node, reports_to_id: primaryDM?.people_id ?? pd?.people_id ?? null }
    if (bimTechs.includes(node))
      return { ...node, reports_to_id: bimManager?.people_id ?? primaryDM?.people_id ?? null }
    if (node === leadDC)
      return { ...node, reports_to_id: primaryDM?.people_id ?? pd?.people_id ?? null }
    if (juniorDCs.includes(node))
      return { ...node, reports_to_id: leadDC?.people_id ?? primaryDM?.people_id ?? null }
    if (engineers.includes(node))
      return { ...node, reports_to_id: primaryDM?.people_id ?? pd?.people_id ?? null }
    return { ...node, reports_to_id: pd?.people_id ?? null }
  })
}

function buildTree(nodes: OrgNode[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  nodes.forEach(n => map.set(n.people_id, { ...n, children: [], x: 0, y: 0 }))
  const roots: TreeNode[] = []
  map.forEach(node => {
    if (!node.reports_to_id || !map.has(node.reports_to_id)) roots.push(node)
    else map.get(node.reports_to_id)!.children.push(node)
  })
  return roots
}

function calcLayout(nodes: TreeNode[], startX = 20, startY = 20): number {
  let x = startX
  nodes.forEach(node => {
    node.y = startY
    if (node.children.length === 0) {
      node.x = x
      x += BOX_W + H_GAP
    } else {
      const before = x
      x = calcLayout(node.children, x, startY + BOX_H + V_GAP)
      const after = x - H_GAP
      node.x = Math.max(before, (before + after) / 2 - BOX_W / 2)
    }
  })
  return x
}

function getAllNodes(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = []
  function walk(nodes: TreeNode[]) {
    nodes.forEach(n => { result.push(n); walk(n.children) })
  }
  walk(roots)
  return result
}

function getLines(roots: TreeNode[]) {
  const lines: { x1: number, y1: number, x2: number, y2: number }[] = []
  function walk(nodes: TreeNode[]) {
    nodes.forEach(node => {
      node.children.forEach(child => {
        lines.push({
          x1: node.x + BOX_W / 2, y1: node.y + BOX_H,
          x2: child.x + BOX_W / 2, y2: child.y,
        })
      })
      walk(node.children)
    })
  }
  walk(roots)
  return lines
}

function getDeptColor(dept: string | null) {
  const d = dept?.toLowerCase() ?? ''
  if (d === 'electrical') return '#1a6a8a'
  if (d === 'mechanical') return '#214E5F'
  if (d === 'bim') return '#5848b8'
  if (d === 'building physics') return '#0f6e56'
  if (d === 'ict & security') return '#854f0b'
  if (d.includes('project') || d.includes('management')) return '#ADC916'
  if (d.includes('director') || d.includes('operations') || d.includes('technical')) return '#214E5F'
  if (d.includes('document') || d.includes('support')) return '#993556'
  return '#888780'
}

function getUtilColor(pct: number) {
  if (pct <= 100) return '#22c55e'
  if (pct <= 120) return '#e8a020'
  return '#EE0000'
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

function addWeeks(date: Date, weeks: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + weeks * 7)
  return d
}

function formatWeekLabel(date: Date) {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function OrganogramPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<number | null>(null)
  const [allPeople, setAllPeople] = useState<Person[]>([])
  const [orgNodes, setOrgNodes] = useState<OrgNode[]>([])
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()))
  const [allEffort, setAllEffort] = useState<EffortRow[]>([])
  const [hireGap, setHireGap] = useState<GapRow[]>([])
  const [editMode, setEditMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [addPersonId, setAddPersonId] = useState<number | ''>('')
  const [addReportsTo, setAddReportsTo] = useState<number | ''>('')
  const [addLabel, setAddLabel] = useState('')
  const [tooltip, setTooltip] = useState<{
    people_id: number, x: number, y: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/float/projects').then(r => r.json()).then(setProjects)
    fetch('/api/float/people-list').then(r => r.json()).then(setAllPeople)
  }, [])

  useEffect(() => {
    if (!selectedProject || allPeople.length === 0) return
    loadOrg(selectedProject)
  }, [selectedProject, allPeople.length])

  useEffect(() => {
    async function loadAllEffort() {
      const { data } = await supabase
        .from('weekly_effort')
        .select('people_id, project_id, effort_pct')
        .eq('week_commencing', formatDate(weekStart))
        .eq('week_number', 1)
      setAllEffort(data ?? [])
    }
    loadAllEffort()
  }, [weekStart])

  async function loadHireGap(projectId: number) {
    try {
      const { data: demandData } = await supabase
        .from('project_demand')
        .select('*')
        .eq('project_id', projectId)

      if (!demandData || demandData.length === 0) {
        setHireGap([])
        return
      }

      const { data: effortData } = await supabase
        .from('weekly_effort')
        .select('people_id')
        .eq('project_id', projectId)
        .eq('week_commencing', formatDate(weekStart))
        .gt('effort_pct', 0)

      const uniquePeopleIds = [...new Set((effortData ?? []).map((r: any) => r.people_id))]
      const peopleRes = await fetch('/api/float/people-list')
      const allPeopleList = await peopleRes.json()

      const disciplineCount: Record<string, number> = {}
      uniquePeopleIds.forEach(pid => {
        const person = allPeopleList.find((p: any) => p.people_id === pid)
        if (!person) return
        const disc = getDisciplineFromDept(person.department)
        disciplineCount[disc] = (disciplineCount[disc] ?? 0) + 1
      })

      const gaps = demandData.map((row: any) => ({
        discipline: row.discipline,
        required: row.required_hc,
        actual: disciplineCount[row.discipline] ?? 0,
        gap: row.required_hc - (disciplineCount[row.discipline] ?? 0),
      }))

      setHireGap(gaps)
    } catch (e) {
      console.error(e)
    }
  }

  async function loadOrg(projectId: number) {
    setLoading(true)
    try {
      const { data: effortData } = await supabase
        .from('weekly_effort')
        .select('people_id')
        .eq('project_id', projectId)
        .gt('effort_pct', 0)

      const peopleIds = [...new Set((effortData ?? []).map((r: any) => r.people_id as number))]

      const { data: orgData } = await supabase
        .from('project_org')
        .select('*')
        .eq('project_id', projectId)

      const reportingMap = new Map<number, { reports_to_id: number | null, position_label: string | null }>()
      ;(orgData ?? []).forEach((row: any) => {
        reportingMap.set(row.people_id, {
          reports_to_id: row.reports_to_id,
          position_label: row.position_label,
        })
      })

      const nodes: OrgNode[] = peopleIds
        .map(pid => {
          const person = allPeople.find(p => p.people_id === pid)
          if (!person) return null
          const saved = reportingMap.get(pid)
          return {
            people_id: pid,
            project_id: projectId,
            reports_to_id: saved?.reports_to_id ?? null,
            position_label: saved?.position_label ?? null,
            person,
          }
        })
        .filter(Boolean) as OrgNode[]

      const hasSavedLines = nodes.some(n => n.reports_to_id !== null)
      const assigned = hasSavedLines ? nodes : autoAssignReporting(nodes)
      setOrgNodes(assigned)

      await loadHireGap(projectId)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!selectedProject) return
    setSaving(true)
    try {
      await supabase.from('project_org').delete().eq('project_id', selectedProject)
      const rows = orgNodes.map(n => ({
        project_id: n.project_id,
        people_id: n.people_id,
        reports_to_id: n.reports_to_id,
        position_label: n.position_label,
      }))
      if (rows.length > 0) await supabase.from('project_org').insert(rows)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error(e)
    }
    setSaving(false)
  }

  function handleAddPerson() {
    if (!addPersonId || !selectedProject) return
    const person = allPeople.find(p => p.people_id === Number(addPersonId))
    if (!person || orgNodes.find(n => n.people_id === Number(addPersonId))) return
    setOrgNodes(prev => [...prev, {
      people_id: Number(addPersonId),
      project_id: selectedProject,
      reports_to_id: addReportsTo ? Number(addReportsTo) : null,
      position_label: addLabel || null,
      person,
    }])
    setAddPersonId('')
    setAddReportsTo('')
    setAddLabel('')
  }

  function handleRemove(people_id: number) {
    setOrgNodes(prev => prev.filter(n => n.people_id !== people_id))
  }

  function handleReportsToChange(people_id: number, reports_to: number | null) {
    setOrgNodes(prev => prev.map(n =>
      n.people_id === people_id ? { ...n, reports_to_id: reports_to } : n
    ))
  }

  function getPersonTotalEffort(people_id: number) {
    return allEffort
      .filter(e => e.people_id === people_id)
      .reduce((sum, e) => sum + e.effort_pct, 0)
  }

  function getPersonProjectBreakdown(people_id: number) {
    return allEffort
      .filter(e => e.people_id === people_id && e.effort_pct > 0)
      .map(e => ({
        project: projects.find(p => p.project_id === e.project_id),
        effort_pct: e.effort_pct,
        project_id: e.project_id,
      }))
      .filter(e => e.project)
  }

  function prevWeek() { setWeekStart(w => addWeeks(w, -1)) }
  function nextWeek() { setWeekStart(w => addWeeks(w, 1)) }

  const roots = buildTree(orgNodes)
  calcLayout(roots)
  const allTreeNodes = getAllNodes(roots)
  const lines = getLines(roots)
  const maxX = allTreeNodes.reduce((m, n) => Math.max(m, n.x + BOX_W + 20), 600)
  const maxY = allTreeNodes.reduce((m, n) => Math.max(m, n.y + BOX_H + 20), 200)

  const tooltipNode = tooltip ? allTreeNodes.find(n => n.people_id === tooltip.people_id) : null
  const tooltipBreakdown = tooltip ? getPersonProjectBreakdown(tooltip.people_id) : []

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', marginBottom: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Project Organogram
          </h1>
          <p style={{ color: 'var(--text3)', margin: '4px 0 0', fontSize: 12 }}>
            Reporting structure — auto-assigned by grade, editable
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={prevWeek} style={navBtnStyle}>←</button>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '6px 12px', fontSize: 12,
            fontWeight: 600, color: 'var(--text)', minWidth: 160, textAlign: 'center',
          }}>
            {formatWeekLabel(weekStart)}
          </div>
          <button onClick={nextWeek} style={navBtnStyle}>→</button>
          <select
            value={selectedProject ?? ''}
            onChange={e => setSelectedProject(Number(e.target.value))}
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '7px 12px', color: 'var(--text)',
              fontSize: 13, minWidth: 200,
            }}
          >
            <option value=''>Select a project...</option>
            {projects.map(p => (
              <option key={p.project_id} value={p.project_id}>{p.name}</option>
            ))}
          </select>
          {selectedProject && (
            <>
              <button
                onClick={() => setEditMode(e => !e)}
                style={{
                  background: editMode ? 'var(--brand-teal)' : 'var(--bg2)',
                  color: editMode ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 6, padding: '7px 16px',
                  fontSize: 13, cursor: 'pointer',
                }}
              >
                {editMode ? '✎ Editing' : '✎ Edit'}
              </button>
              {editMode && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    background: saved ? '#22c55e' : 'var(--brand-green)',
                    color: '#0e1a1f', border: 'none', borderRadius: 6,
                    padding: '7px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!selectedProject ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: 'var(--text3)', fontSize: 14,
          border: '1px dashed var(--border)', borderRadius: 8,
        }}>
          Select a project to view its organogram
        </div>
      ) : loading ? (
        <LoadingSpinner text="Loading organogram..." />
      ) : (
        <>
          {/* Edit panel */}
          {editMode && (
            <div style={{
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 16, marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 12, letterSpacing: '0.06em' }}>
                ADD PERSON
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                <select value={addPersonId} onChange={e => setAddPersonId(Number(e.target.value))} style={selectStyle}>
                  <option value=''>Select person...</option>
                  {allPeople
                    .filter(p => !orgNodes.find(n => n.people_id === p.people_id))
                    .map(p => (
                      <option key={p.people_id} value={p.people_id}>
                        {p.name} — {p.job_title}
                      </option>
                    ))}
                </select>
                <select value={addReportsTo} onChange={e => setAddReportsTo(Number(e.target.value))} style={selectStyle}>
                  <option value=''>Reports to (optional)...</option>
                  {orgNodes.map(n => (
                    <option key={n.people_id} value={n.people_id}>{n.person.name}</option>
                  ))}
                </select>
                <input
                  type="text" placeholder="Custom label (optional)"
                  value={addLabel} onChange={e => setAddLabel(e.target.value)}
                  style={{ ...selectStyle, minWidth: 180 }}
                />
                <button onClick={handleAddPerson} style={{
                  background: 'var(--brand-green)', color: '#0e1a1f',
                  border: 'none', borderRadius: 6, padding: '7px 16px',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>
                  + Add
                </button>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, letterSpacing: '0.06em' }}>
                EDIT REPORTING LINES
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...orgNodes]
                  .sort((a, b) => getGradeRank(a.person.job_title) - getGradeRank(b.person.job_title))
                  .map(node => (
                    <div key={node.people_id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', background: 'var(--bg3)',
                      borderRadius: 6, fontSize: 12,
                    }}>
                      <span style={{ minWidth: 160, fontWeight: 600, color: 'var(--text)' }}>{node.person.name}</span>
                      <span style={{ color: 'var(--text3)', minWidth: 160, fontSize: 11 }}>{node.person.job_title}</span>
                      <span style={{ color: 'var(--text3)', fontSize: 11 }}>reports to →</span>
                      <select
                        value={node.reports_to_id ?? ''}
                        onChange={e => handleReportsToChange(node.people_id, e.target.value ? Number(e.target.value) : null)}
                        style={{ ...selectStyle, minWidth: 180 }}
                      >
                        <option value=''>No one (top level)</option>
                        {orgNodes.filter(n => n.people_id !== node.people_id).map(n => (
                          <option key={n.people_id} value={n.people_id}>{n.person.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemove(node.people_id)}
                        style={{
                          background: 'var(--brand-red)', color: '#fff',
                          border: 'none', borderRadius: 4, padding: '3px 8px',
                          fontSize: 11, cursor: 'pointer', marginLeft: 'auto',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Hire Gap Banner */}
          {hireGap.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px',
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 8, marginBottom: 12, flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: 'var(--text3)', letterSpacing: '0.08em', marginRight: 4,
              }}>
                HIRE GAP
              </span>
              {hireGap.map(row => (
                <div key={row.discipline} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 999,
                  background: row.gap > 0 ? 'rgba(238,0,0,0.08)' : 'rgba(34,197,94,0.08)',
                  border: `1px solid ${row.gap > 0 ? '#EE000030' : '#22c55e30'}`,
                  fontSize: 11,
                }}>
                  <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{row.discipline}</span>
                  <span style={{ fontWeight: 700, color: row.gap > 0 ? '#EE0000' : '#22c55e' }}>
                    {row.gap > 0 ? `+${row.gap} hire` : '✓'}
                  </span>
                </div>
              ))}
              <span style={{
                fontSize: 10, color: 'var(--text3)',
                marginLeft: 'auto', fontStyle: 'italic',
              }}>
                Week of {formatWeekLabel(weekStart)} · project-level target
              </span>
            </div>
          )}

          {/* Org chart */}
          {orgNodes.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              color: 'var(--text3)', fontSize: 14,
              border: '1px dashed var(--border)', borderRadius: 8,
            }}>
              No weekly effort recorded for this project yet.
            </div>
          ) : (
            <div
              style={{
                overflowX: 'auto', overflowY: 'auto',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--bg2)', padding: 16, position: 'relative',
              }}
              onClick={() => setTooltip(null)}
            >
              <svg width={maxX} height={maxY} style={{ display: 'block', overflow: 'visible' }}>
                {lines.map((line, i) => (
                  <path key={i}
                    d={`M ${line.x1} ${line.y1} C ${line.x1} ${(line.y1 + line.y2) / 2}, ${line.x2} ${(line.y1 + line.y2) / 2}, ${line.x2} ${line.y2}`}
                    fill="none" stroke="var(--brand-teal)" strokeWidth={1.5} strokeOpacity={0.4}
                  />
                ))}
                {allTreeNodes.map(node => {
                  const color = getDeptColor(node.person.department)
                  const totalEffort = getPersonTotalEffort(node.people_id)
                  const utilColor = getUtilColor(totalEffort)
                  const isTooltipOpen = tooltip?.people_id === node.people_id

                  return (
                    <g key={node.people_id} transform={`translate(${node.x}, ${node.y})`}>
                      <rect width={BOX_W} height={BOX_H} rx={6}
                        fill="var(--bg)" stroke={color} strokeWidth={isTooltipOpen ? 2 : 1.5}
                      />
                      <rect width={BOX_W} height={4} rx={3} fill={color} />
                      <text x={BOX_W / 2} y={24} textAnchor="middle"
                        fontSize={11} fontWeight={700} fill="var(--text)" fontFamily="Outfit, sans-serif">
                        {node.person.name.length > 22
                          ? node.person.name.substring(0, 21) + '…'
                          : node.person.name}
                      </text>
                      <text x={BOX_W / 2} y={38} textAnchor="middle"
                        fontSize={9} fill="var(--text3)" fontFamily="Outfit, sans-serif">
                        {(node.position_label || node.person.job_title || '').length > 26
                          ? (node.position_label || node.person.job_title || '').substring(0, 25) + '…'
                          : (node.position_label || node.person.job_title || '')}
                      </text>
                      {node.person.region && (
                        <text x={14} y={58} fontSize={9} fontWeight={600}
                          fill={color} fontFamily="Outfit, sans-serif">
                          {node.person.region}
                        </text>
                      )}
                      {totalEffort > 0 && (
                        <g transform={`translate(${BOX_W - 44}, 46)`}
                          style={{ cursor: 'pointer' }}
                          onClick={e => {
                            e.stopPropagation()
                            setTooltip(tooltip?.people_id === node.people_id
                              ? null
                              : { people_id: node.people_id, x: node.x, y: node.y })
                          }}
                        >
                          <rect width={40} height={18} rx={9} fill={utilColor} opacity={0.12} />
                          <rect width={40} height={18} rx={9} fill="none" stroke={utilColor} strokeWidth={1} />
                          <text x={20} y={13} textAnchor="middle"
                            fontSize={9} fontWeight={700} fill={utilColor} fontFamily="Outfit, sans-serif">
                            {totalEffort}%
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}

                {tooltip && tooltipNode && (() => {
                  const tx = tooltipNode.x + BOX_W + 8
                  const ty = tooltipNode.y
                  const tw = 210
                  const th = 32 + tooltipBreakdown.length * 24 + 8
                  return (
                    <g transform={`translate(${tx}, ${ty})`} onClick={e => e.stopPropagation()}>
                      <rect width={tw} height={th} rx={8}
                        fill="var(--bg2)" stroke="var(--border2)" strokeWidth={1} />
                      <text x={12} y={20} fontSize={10} fontWeight={700}
                        fill="var(--text2)" fontFamily="Outfit, sans-serif">
                        PROJECT ALLOCATION
                      </text>
                      {tooltipBreakdown.map((item, i) => (
                        <g key={item.project_id}
                          transform={`translate(0, ${32 + i * 24})`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => { setSelectedProject(item.project_id); setTooltip(null) }}
                        >
                          <text x={12} y={14} fontSize={10}
                            fill="var(--brand-teal)" fontFamily="Outfit, sans-serif"
                            style={{ textDecoration: 'underline' }}>
                            {(item.project?.name ?? '').length > 24
                              ? (item.project?.name ?? '').substring(0, 23) + '…'
                              : item.project?.name}
                          </text>
                          <text x={tw - 8} y={14} textAnchor="end"
                            fontSize={10} fontWeight={700}
                            fill={getUtilColor(item.effort_pct)} fontFamily="Outfit, sans-serif">
                            {item.effort_pct}%
                          </text>
                        </g>
                      ))}
                    </g>
                  )
                })()}
              </svg>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'var(--bg2)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 10px', color: 'var(--text)',
  fontSize: 14, cursor: 'pointer',
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 10px', color: 'var(--text)',
  fontSize: 12, minWidth: 140,
}