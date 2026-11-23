import { GrowthChart } from '@/features/growth/GrowthChart'

/**
 * The portfolio value over time (F31), now the shared growth chart on the Investments series: a
 * series switch, a range picker, the server's rising or falling verdict and the notes.
 */
export function PortfolioLine({ currency }: { currency: string }) {
  return (
    <GrowthChart
      defaultSeries="investments"
      currency={currency}
      testId="portfolio-line"
      label="Portfolio over time"
    />
  )
}
