'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937' }}>Algo deu errado</h2>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Nosso time já foi notificado. Tente novamente.</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', backgroundColor: '#f97316', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 500 }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
