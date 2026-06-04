/**
 * Configuração centralizada de preços do BEM Plantonista.
 * Altere SOMENTE aqui para refletir em todo o app.
 */
export const PRICING = {
  monthly: {
    launch: 29.90,        // primeiros 3 meses
    regular: 49.90,       // após 3 meses
    launchLabel: 'R$29,90',
    regularLabel: 'R$49,90',
    launchMonths: 3,
  },
  annual: {
    total: 299.00,
    perMonth: 24.92,      // 299 / 12
    totalLabel: 'R$299,00',
    perMonthLabel: 'R$24,92',
    savingsPercent: '~50%',
  },
  guarantee: {
    days: 7,
  },
} as const
