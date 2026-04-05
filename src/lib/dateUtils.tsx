import { useEffect, useState } from 'react'

export const MARKET_TIME_ZONE = 'America/New_York'

const MARKET_OPEN_MINUTES = 9 * 60 + 30
const MARKET_CLOSE_MINUTES = 16 * 60

const DAY_OF_WEEK_BY_LABEL = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
} as const

const zonedFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>()

export type ClockParts = {
  dayOfWeek: number
  hour: number
  minute: number
  second: number
}

export type MarketStatus = {
  isOpen: boolean
  label: 'Market Open' | 'Market Closed'
  detail: string
}

export type ClockSnapshot = {
  local: ClockParts
  market: ClockParts
  marketStatus: MarketStatus
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}

function getZonedFormatter(timeZone: string) {
  const existingFormatter = zonedFormatterByTimeZone.get(timeZone)

  if (existingFormatter) {
    return existingFormatter
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  zonedFormatterByTimeZone.set(timeZone, formatter)

  return formatter
}

export function getTimeParts(date: Date, timeZone?: string): ClockParts {
  if (!timeZone) {
    return {
      dayOfWeek: date.getDay(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    }
  }

  const formatter = getZonedFormatter(timeZone)

  let dayOfWeek = 0
  let hour = 0
  let minute = 0
  let second = 0

  for (const part of formatter.formatToParts(date)) {
    switch (part.type) {
      case 'weekday':
        dayOfWeek = DAY_OF_WEEK_BY_LABEL[part.value as keyof typeof DAY_OF_WEEK_BY_LABEL] ?? 0
        break
      case 'hour':
        hour = Number(part.value)
        break
      case 'minute':
        minute = Number(part.value)
        break
      case 'second':
        second = Number(part.value)
        break
    }
  }

  return {
    dayOfWeek,
    hour,
    minute,
    second,
  }
}

export function getMarketStatus(marketTime: ClockParts): MarketStatus {
  const isWeekday = marketTime.dayOfWeek >= 1 && marketTime.dayOfWeek <= 5
  const totalMinutes = marketTime.hour * 60 + marketTime.minute

  if (isWeekday && totalMinutes >= MARKET_OPEN_MINUTES && totalMinutes < MARKET_CLOSE_MINUTES) {
    return {
      isOpen: true,
      label: 'Market Open',
      detail: 'Open now',
    }
  }

  if (!isWeekday) {
    return {
      isOpen: false,
      label: 'Market Closed',
      detail: 'Opens Monday at 9:30 AM ET',
    }
  }

  if (totalMinutes < MARKET_OPEN_MINUTES) {
    return {
      isOpen: false,
      label: 'Market Closed',
      detail: 'Opens today at 9:30 AM ET',
    }
  }

  return {
    isOpen: false,
    label: 'Market Closed',
    detail:
      marketTime.dayOfWeek === 5
        ? 'Opens Monday at 9:30 AM ET'
        : 'Opens tomorrow at 9:30 AM ET',
  }
}

export function getClockSnapshot(
  date: Date = new Date(),
  marketTimeZone = MARKET_TIME_ZONE
): ClockSnapshot {
  const local = getTimeParts(date)
  const market = getTimeParts(date, marketTimeZone)

  return {
    local,
    market,
    marketStatus: getMarketStatus(market),
  }
}
