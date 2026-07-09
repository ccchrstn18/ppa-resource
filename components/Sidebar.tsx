'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'

const nav = [
  {
    section: 'RESOURCE',
    items: [
      { label: 'Weekly Input', href: '/resource' },
      { label: 'Organogram', href: '/organogram' },
      //{ label: 'Availability', href: '/availability' },
      { label: 'Hire Gap', href: '/hire-gap' },
    ]
  },
  {
    section: 'ADMIN',
    items: [
      { label: 'Settings', href: '/settings' },
    ]
  }
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 200,
      minWidth: 200,
      background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--brand-green)',
          letterSpacing: '-0.5px',
        }}>ppa</div>
        <div style={{
          fontSize: 10,
          color: 'var(--text3)',
          lineHeight: 1.2,
        }}>Mission Critical<br />Solutions</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {nav.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 10,
              color: 'var(--text3)',
              padding: '4px 16px 6px',
              letterSpacing: '0.08em',
              fontWeight: 600,
            }}>
              {section}
            </div>
            {items.map(({ label, href }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} style={{
                  display: 'block',
                  padding: '7px 16px',
                  fontSize: 13,
                  color: active ? 'var(--brand-green)' : 'var(--text2)',
                  background: active ? 'var(--bg3)' : 'transparent',
                  borderLeft: active ? '2px solid var(--brand-green)' : '2px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}>
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text3)',
      }}>
        Christian Domingo<br />
        <span style={{ fontSize: 11 }}>Developer</span>
      </div>
    </aside>
  )
}