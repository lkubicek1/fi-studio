import { useMemo } from 'react'
import { Calendar } from 'lucide-react'

import { MARKET_TIME_ZONE, getMarketStatus, getTimeParts, useNow } from '../../lib/dateUtils.tsx'

const localTimeFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

const marketTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIME_ZONE,
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

const compactLocalTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const compactMarketTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIME_ZONE,
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

function MarketStatus() {
  const now = useNow(1000)
  const { marketStatus, marketTime, localTime, compactMarketTime, compactLocalTime } = useMemo(() => {
    const marketClock = getTimeParts(now, MARKET_TIME_ZONE)

    return {
      marketStatus: getMarketStatus(marketClock),
      marketTime: marketTimeFormatter.format(now),
      localTime: localTimeFormatter.format(now),
      compactMarketTime: compactMarketTimeFormatter.format(now),
      compactLocalTime: compactLocalTimeFormatter.format(now),
    }
  }, [now])

  return (
    <div className="flex w-full flex-col gap-2 border-t border-border/70 pt-3 text-[11px] tabular-nums md:w-auto md:border-t-0 md:px-4 md:py-3 md:text-xs">
      <div
        className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium ${
          marketStatus.isOpen ? 'text-[#00ff41]' : 'text-amber-300'
        }`}
        title={marketStatus.detail}
      >
        <span
          className={`size-1.5 rounded-full ${marketStatus.isOpen ? 'bg-[#00ff41]' : 'bg-amber-300'}`}
        />
        <span>{marketStatus.label}</span>
      </div>
      <div className="flex flex-col gap-1 md:gap-0.5">
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>NY</span>
          </div>
          <span className="text-right text-foreground md:hidden">{compactMarketTime}</span>
          <span className="hidden text-right text-foreground md:inline">{marketTime}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>LOCAL</span>
          </div>
          <span className="text-right text-foreground md:hidden">{compactLocalTime}</span>
          <span className="hidden text-right text-foreground md:inline">{localTime}</span>
        </div>
      </div>
    </div>
  )
}

export { MarketStatus }
