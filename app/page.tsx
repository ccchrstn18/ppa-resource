import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          PPA Resource
        </h1>
        <p style={{ color: 'var(--text3)', margin: '6px 0 0', fontSize: 13 }}>
          Mission Critical Solutions — Internal Resource Management
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 32,
      }}>
        {[
          {
            href: '/resource',
            title: 'Weekly Input',
            description: 'Record % effort per person per project for the Monday meeting.',
            icon: '📋',
            color: 'var(--brand-teal)',
          },
          {
            href: '/organogram',
            title: 'Organogram',
            description: 'View project reporting structure with auto-assigned hierarchy.',
            icon: '🏗️',
            color: '#5848b8',
          },
          {
            href: '/hire-gap',
            title: 'Hire Gap',
            description: 'Compare required vs deployed headcount per discipline.',
            icon: '👥',
            color: '#EE0000',
          },
        ].map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 20,
              cursor: 'pointer',
              borderTop: `3px solid ${card.color}`,
            }}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>{card.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {card.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                {card.description}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: 20,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: 'var(--text3)', letterSpacing: '0.08em', marginBottom: 12,
        }}>
          QUICK STATS
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {[
            { label: 'Data source', value: 'Float API' },
            { label: 'Database', value: 'Supabase' },
            { label: 'Regions', value: 'UK · UAE · FR' },
            { label: 'Version', value: 'v1.0' },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{stat.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}