import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'BEM plantonista',
  description: 'Sistema de gestão de plantonistas médicos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <h1 style={{ color: 'red', position: 'fixed', zIndex: 9999 }}>LAYOUT PAI ATIVO</h1>
        {children}
      </body>
    </html>
  )
}
