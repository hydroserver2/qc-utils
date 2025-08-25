import { beforeEach, describe, expect, it } from 'vitest'
import { mockDatastream } from './mock'
import { ObservationRecord } from '../observation-record'
import { EnumEditOperations, Operator } from '@/types';

/** Generates `amount` distinct numbers from `min` to `max`. Returns a sorted array. */
function _generateDistinctRandomNumbers(amount: number, min: number, max: number) {
  const rangeSize = max - min + 1;
  if (amount > rangeSize) {
    throw (`Range error: there aren't ${amount} distinct numbers between ${min} and ${max}`)
  }
  const result = new Set<number>();

  while (result.size < amount) {
    const randomNumber = Math.floor(Math.random() * rangeSize) + min;
    result.add(randomNumber);
  }

  return Array.from(result).sort((a, b) => a - b);
}

const rawData: {
  datetimes: number[]
  dataValues: number[]
} = {
  datetimes: mockDatastream.phenomenon_time.map(dateString => new Date(dateString).getTime()),
  dataValues: mockDatastream.result
}

const obsRecord = new ObservationRecord(rawData)

beforeEach(async () => {
  await obsRecord.reload()
  return
})

describe('observationRecord', () => {
  it('loads data', async () => {
    expect(obsRecord.dataX.length).toBe(rawData.datetimes.length)
    expect(obsRecord.dataY.length).toBe(rawData.dataValues.length)
  })

  it('adds data points', async () => {
    const toAdd = 100
    const originalLength = obsRecord.dataX.length

    const randomDatetimes = _generateDistinctRandomNumbers(toAdd, rawData.datetimes[0], rawData.datetimes[rawData.datetimes.length - 1])
    const dataPointsToAdd = randomDatetimes.map((datetime) => {
      return [datetime, (Math.random() * 10).toFixed(3)]
    })

    await obsRecord.dispatch(
      EnumEditOperations.ADD_POINTS,
      dataPointsToAdd
    )

    const newLength = obsRecord.dataX.length
    expect(newLength).toBe(originalLength + toAdd)
  })

  it('deletes data points', async () => {
    const toDelete = 100
    const randomIndexes = _generateDistinctRandomNumbers(toDelete, 0, obsRecord.dataX.length - 1)
    const originalLength = obsRecord.dataX.length

    await obsRecord.dispatch(
      EnumEditOperations.DELETE_POINTS,
      randomIndexes
    )

    const newLength = obsRecord.dataX.length
    expect(newLength).toBe(originalLength - toDelete)
  })

  it('changes values', async () => {
    const toChange = 100
    const randomIndexes = _generateDistinctRandomNumbers(toChange, 0, obsRecord.dataX.length - 1)

    // ADD
    await obsRecord.dispatch(
      EnumEditOperations.CHANGE_VALUES,
      randomIndexes,
      Operator.ADD,
      2
    )

    const expected = randomIndexes.map(index => +(rawData.dataValues[index] + 2).toFixed(3))
    const changedValues = randomIndexes.map(index => +obsRecord.dataY[index].toFixed(3))
    expect(changedValues).toEqual(expected)
  })

  it('reloads data', async () => {
    // Delete some data
    const randomIndexes = _generateDistinctRandomNumbers(10, 0, obsRecord.dataX.length - 1)
    const originalLength = obsRecord.dataX.length

    await obsRecord.dispatch(
      EnumEditOperations.DELETE_POINTS,
      randomIndexes
    )

    // Reload the raw data
    obsRecord.reload()

    const newLength = obsRecord.dataX.length
    expect(newLength).toBe(originalLength)
  })
})