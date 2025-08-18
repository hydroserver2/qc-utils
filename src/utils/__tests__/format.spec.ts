import { describe, expect, it } from 'vitest'
import { formatDate, formatDuration, shiftDatetime, TimeUnit } from '../plotting/observationRecord'

describe('Format', () => {
  it('formats date', () => {
    const someDate = new Date(2025, 0, 1)
    const expected = "Jan 01, 2025, 00:00:00"
    const formatted = formatDate(someDate)
    expect(formatted).toBe(expected)
  })

  it('formats duration', () => {
    // Milliseconds
    let someDuration = 525
    let formatted = formatDuration(someDuration)
    expect(formatted).toBe("525 ms")

    // Seconds
    someDuration = 1244
    formatted = formatDuration(someDuration)
    expect(formatted).toBe("1.24 s")

    // Minutes
    someDuration = 81525
    formatted = formatDuration(someDuration)
    expect(formatted).toBe("1.36 m")
  })

  it('shifts datetime', () => {
    const someDatetime = (new Date(2025, 0, 1)).getTime()
    const daysToShift = 10
    const monthsToShift = 5
    const yearsToShift = 4

    // Shift days
    let shifted = shiftDatetime(someDatetime, daysToShift, TimeUnit.DAY)
    let expected = (new Date(2025, 0, 1 + daysToShift)).getTime()
    expect(shifted).toBe(expected)

    // Shift months
    shifted = shiftDatetime(someDatetime, monthsToShift, TimeUnit.MONTH)
    expected = (new Date(2025, 0 + monthsToShift, 1)).getTime()
    expect(shifted).toBe(expected)

    // Shift years
    shifted = shiftDatetime(someDatetime, yearsToShift, TimeUnit.YEAR)
    expected = (new Date(2025 + yearsToShift, 0, 1)).getTime()
    expect(shifted).toBe(expected)
  })
})