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

function MarketStatus() {
  const now = useNow(1000)
  const { marketStatus, marketTime, localTime } = useMemo(() => {
    const marketClock = getTimeParts(now, MARKET_TIME_ZONE)

    return {
      marketStatus: getMarketStatus(marketClock),
      marketTime: marketTimeFormatter.format(now),
      localTime: localTimeFormatter.format(now),
    }
  }, [now])

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-4 py-3 text-xs tabular-nums">
      <div
        className={`inline-flex mr-3 items-center gap-1.5 whitespace-nowrap font-medium ${
          marketStatus.isOpen ? 'text-[#00ff41]' : 'text-amber-300'
        }`}
        title={marketStatus.detail}
      >
        <span
          className={`size-1.5 rounded-full ${marketStatus.isOpen ? 'bg-[#00ff41]' : 'bg-amber-300'}`}
        />
        <span>{marketStatus.label}</span>
      </div>
      <div className="flex flex-col gap-0.5 mr-2">
        <div className="flex items-center justify-between gap-3 whitespace-nowrap text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>NY</span>
          </div>
          <span className="text-right text-foreground">{marketTime}</span>
        </div>
        <div className="flex items-center justify-between gap-3 whitespace-nowrap text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span>LOCAL</span>
          </div>
          <span className="text-right text-foreground">{localTime}</span>
        </div>
      </div>
    </div>
  )
}

export { MarketStatus }
