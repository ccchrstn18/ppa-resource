'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Resource Management
        </h1>
        <p style={{ color: 'var(--text3)', margin: '6px 0 0', fontSize: 13 }}>
          PPA Mission Critical Solutions · Internal Operations
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 12,
        marginBottom: 24,
      }}>
        {[
          {
            href: '/resource',
            title: 'Weekly Input',
            description: 'Record % effort per person per project for the Monday meeting.',
            color: 'var(--brand-teal)',
            tag: 'Monday meeting',
          },
          {
            href: '/organogram',
            title: 'Organogram',
            description: 'Project reporting structure — auto-assigned by grade, editable.',
            color: '#214E5F',
            tag: 'Per project',
          },
          {
            href: '/hire-gap',
            title: 'Hire Gap',
            description: 'Required vs deployed headcount per discipline across all projects.',
            color: 'var(--brand-green)',
            tag: 'Recruitment',
          },
        ].map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '20px 20px 16px',
                cursor: 'pointer',
                height: '100%',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--brand-teal)'
                e.currentTarget.style.background = 'var(--bg3)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(33,78,95,0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.background = 'var(--bg2)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: card.color,
                marginBottom: 10,
              }}>
                {card.tag.toUpperCase()}
              </div>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 8,
              }}>
                {card.title}
              </div>
              <div style={{
                fontSize: 12,
                color: 'var(--text3)',
                lineHeight: 1.6,
              }}>
                {card.description}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex',
        gap: 40,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--text3)', letterSpacing: '0.08em',
        }}>
          SYSTEM
        </div>
        {[
          { label: 'Data source', value: 'Float API' },
          { label: 'Database', value: 'Supabase' },
          { label: 'Regions', value: 'UK · UAE · FR' },
          { label: 'Version', value: 'v1.0' },
        ].map(stat => (
          <div key={stat.label}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{stat.label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}