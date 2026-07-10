export default function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 20px',
      gap: 16,
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--border)',
        borderTop: '3px solid var(--brand-teal)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <div style={{
        fontSize: 12,
        color: 'var(--text3)',
        letterSpacing: '0.06em',
      }}>
        {text}
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}