/**
 * Primitivos de skeleton para estados de carregamento.
 *
 * Filosofia: o skeleton deve **imitar o shape** do conteúdo final — mesma
 * altura, mesma largura aproximada — para evitar layout shift quando os
 * dados chegam. Animação `animate-pulse` do Tailwind dá o efeito sutil de
 * "respirando".
 */

import type { HTMLAttributes } from 'react'

type DivProps = HTMLAttributes<HTMLDivElement>

/** Bloco genérico — use para qualquer placeholder retangular. */
export function Skeleton({ className = '', ...rest }: DivProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 ${className}`}
      {...rest}
    />
  )
}

/** Card de métrica — substitui um KPI enquanto carrega. */
export function SkeletonMetricCard() {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200/60">
      <Skeleton className="h-3 w-24 mb-3 rounded-lg" />
      <Skeleton className="h-8 w-32 rounded-lg" />
      <Skeleton className="h-2.5 w-20 mt-3 rounded-lg" />
    </div>
  )
}

/** Linha de tabela — N células de larguras variadas. */
export function SkeletonTableRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4" style={{ width: `${60 + ((i * 13) % 40)}%` }} />
        </td>
      ))}
    </tr>
  )
}

/** Grupo de N linhas de tabela. */
export function SkeletonTableRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} cols={cols} />
      ))}
    </>
  )
}
