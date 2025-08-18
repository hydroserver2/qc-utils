import { describe, expect, it } from 'vitest'
import { measureEllapsedTime } from '../plotting/observationRecord'

const duration = 1000
const doSomething = () => {
  return new Promise((resolve, _reject) => {
    return setTimeout(() => { return resolve(true) }, duration)
  })
}

describe('Measure ellapsedTime', () => {
  it('measures ellapsed time', async () => {
    const measurement = await measureEllapsedTime(doSomething)
    expect(measurement.duration).to.be.greaterThanOrEqual(duration)
  })

  it('returns function response', async () => {
    const measurement = await measureEllapsedTime(doSomething)
    expect(measurement.response).toBe(true)
  })
})