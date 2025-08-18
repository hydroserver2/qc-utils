
import { EnumDictionary, EnumEditOperations, EnumFilterOperations, FilterOperation, FilterOperationFn, HistoryItem, Operator, RateOfChangeComparator, RateOfChangeOperation } from '../../types'
// @ts-ignore
import DeleteDataWorker from './delete-data.worker?worker&inline'
// @ts-ignore
import FillGapsWorker from './fill-gaps.worker?worker&inline'

export function subtractHours(timestamp: string, hours: number): string {
  const date = new Date(timestamp)
  date.setHours(date.getHours() - hours)
  return date.toISOString()
}

/** Returns the index of the first value that is greater or equal to the target value */
export const findFirstGreaterOrEqual = (
  array: number[] | Float64Array<SharedArrayBuffer>,
  target: number
) => {
  let low = 0,
    high = array.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (array[mid] < target) low = mid + 1
    else high = mid
  }
  return low
}

/** Returns the index of the last value that is lesser or equal to the target value */
export const findLastLessOrEqual = (
  array: number[] | Float64Array<SharedArrayBuffer>,
  target: number
) => {
  let low = 0,
    high = array.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (array[mid] > target) high = mid
    else low = mid + 1
  }
  return low - 1
}

export const measureEllapsedTime = async (
  fn: () => any,
  message?: string
): Promise<{ response: any; duration: number }> => {
  if (message) {
    console.log(message)
  }
  const start = performance.now()
  const response = await fn()
  const end = performance.now()
  if (import.meta.env.MODE !== 'test') {
    console.log(`\tDone in ${(end - start).toFixed(2)} ms`)
  }
  const duration = +(end - start)
  return { response, duration }
}


const SECOND = 1
const MINUTE = SECOND * 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24
const WEEK = DAY * 7
const MONTH = HOUR * 30
const YEAR = DAY * 365

export enum TimeUnit {
  SECOND = 's',
  MINUTE = 'm',
  HOUR = 'h',
  DAY = 'D',
  WEEK = 'W',
  MONTH = 'M',
  YEAR = 'Y',
}

export const timeUnitMultipliers: EnumDictionary<TimeUnit, number> = {
  [TimeUnit.SECOND]: SECOND,
  [TimeUnit.MINUTE]: MINUTE,
  [TimeUnit.HOUR]: HOUR,
  [TimeUnit.DAY]: DAY,
  [TimeUnit.WEEK]: WEEK,
  [TimeUnit.MONTH]: MONTH,
  [TimeUnit.YEAR]: YEAR,
}

export const formatDate = (date: Date) => {
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    second: '2-digit',
  })
}

export const formatDuration = (duration: number) => {
  let value
  let unit

  if (duration >= MINUTE * 1000) {
    value = duration / (MINUTE * 1000)
    unit = 'm'
  } else if (duration >= 1000) {
    value = duration / 1000
    unit = 's'
  } else {
    value = duration
    unit = 'ms'
  }

  let formattedValue
  if (unit === 'ms') {
    formattedValue = Math.round(value).toString()
  } else {
    formattedValue = value.toFixed(2)
  }

  return `${formattedValue} ${unit}`
}

export const shiftDatetime = (
  datetime: number,
  amount: number,
  unit: TimeUnit
) => {
  if (unit === TimeUnit.MONTH) {
    const currentDate = new Date(datetime)
    currentDate.setMonth(currentDate.getMonth() + amount)
    return currentDate.getTime()
  } else if (unit === TimeUnit.YEAR) {
    const currentDate = new Date(datetime)
    currentDate.setFullYear(currentDate.getFullYear() + amount)
    return currentDate.getTime()
  } else {
    return datetime + amount * timeUnitMultipliers[unit] * 1000
  }
}


/**
 * This number should approximate the number of observations that a dataset could increase by during a session.
 * The lower this number, the less memory the entire app uses.
 * Note that when a dataset number of data points increases by more than `INCREASE_AMOUNT`,
 * the `_growBuffer()` method will allocate a new buffer, and the data will be copied into it.
 */
export const INCREASE_AMOUNT = 20 * 1000

const components = ['date', 'value', 'qualifier'] // TODO: `qualifier` unused for now...

export class ObservationRecord {
  /** The generated dataset to be used for plotting */
  dataset: {
    dimensions: string[]
    source: {
      // Store datetimes in a Float64Array because plotly can't parse BigInts correctly.
      x: Float64Array<SharedArrayBuffer>
      y: Float32Array<SharedArrayBuffer>
    }
  } = {
      dimensions: components,
      source: {
        x: new Float64Array(
          new SharedArrayBuffer(
            INCREASE_AMOUNT * Float64Array.BYTES_PER_ELEMENT,
            {
              maxByteLength: INCREASE_AMOUNT * Float64Array.BYTES_PER_ELEMENT, // Max size the array can reach
            }
          )
        ),
        y: new Float32Array(
          new SharedArrayBuffer(
            INCREASE_AMOUNT * Float32Array.BYTES_PER_ELEMENT,
            {
              maxByteLength: INCREASE_AMOUNT * Float32Array.BYTES_PER_ELEMENT, // Max size the array can reach
            }
          )
        ),
      },
    }
  history: HistoryItem[] = []
  loadingTime: number | null = null
  isLoading: boolean = true
  rawData: {
    datetimes: Float64Array<ArrayBuffer> | number[]
    dataValues: Float32Array<ArrayBuffer> | number[]
  }

  constructor(dataArrays: {
    datetimes: Float64Array<ArrayBuffer> | number[]
    dataValues: Float32Array<ArrayBuffer> | number[]
  }) {
    this.history = []
    this.rawData = dataArrays
    this.loadData(this.rawData)
  }

  async loadData(dataArrays: {
    datetimes: Float64Array<ArrayBuffer> | number[]
    dataValues: Float32Array<ArrayBuffer> | number[]
  }) {
    if (!dataArrays) {
      return
    }
    this.isLoading = true
    const measurement = await measureEllapsedTime(() => {
      this._growBuffer(dataArrays.datetimes.length)
      this._resizeTo(dataArrays.datetimes.length)

      this.dataX.set(dataArrays.datetimes)
      this.dataY.set(dataArrays.dataValues)
    })

    this.loadingTime = measurement.duration

    this.history.length = 0
    this.isLoading = false
  }

  get dataX() {
    return this.dataset.source.x
  }

  get dataY() {
    return this.dataset.source.y
  }

  /**
   * Resizes the typed array
   * @param length The total number of elements that the view will contain
   */
  private _resizeTo(length: number) {
    // We need to resize the view to match our data length,
    // but TypedArrays using SharedArrayBuffer can't shrink.
    // Recreate the view to effectively resize it
    this.dataset.source.x = new Float64Array(
      this.dataset.source.x.buffer
    ).subarray(0, length)

    this.dataset.source.y = new Float32Array(
      this.dataset.source.y.buffer
    ).subarray(0, length)
  }

  /**
   * Buffer size is always in increments of `INCREASE_AMOUNT`.
   * Grows the buffer by `INCREASE_AMOUNT` in bytes if the current data doesn't fit
   * @param newLength The total number of elements that the view will contain
   */
  private _growBuffer(newLength: number) {
    const dataArrayByteSizeX = newLength * Float64Array.BYTES_PER_ELEMENT

    let maxByteLengthNeeded = this.dataX.buffer.byteLength
    while (dataArrayByteSizeX > maxByteLengthNeeded) {
      maxByteLengthNeeded += INCREASE_AMOUNT * Float64Array.BYTES_PER_ELEMENT
    }

    if (
      maxByteLengthNeeded * Float64Array.BYTES_PER_ELEMENT >
      this.dataX.buffer.maxByteLength
    ) {
      // More space is needed, beyond the maxByteLength initially set, to allocate the data. A new buffer needs to be allocated.
      const outputBufferX = new SharedArrayBuffer(
        this.dataX.buffer.byteLength,
        {
          maxByteLength: maxByteLengthNeeded * Float64Array.BYTES_PER_ELEMENT,
        }
      )

      const outputBufferY = new SharedArrayBuffer(
        this.dataY.buffer.byteLength,
        {
          maxByteLength: maxByteLengthNeeded * Float32Array.BYTES_PER_ELEMENT,
        }
      )

      const outputArrayX = new Float64Array(outputBufferX)
      const outputArrayY = new Float32Array(outputBufferY)
      outputArrayX.set(this.dataX)
      outputArrayY.set(this.dataY)

      // Swap to the new array and buffer
      this.dataset.source.x = outputArrayX
      this.dataset.source.y = outputArrayY
    }

    if (
      this.dataX.buffer.byteLength <
      newLength * Float64Array.BYTES_PER_ELEMENT
    ) {
      this.dataX.buffer.grow(newLength * Float64Array.BYTES_PER_ELEMENT)
      this.dataY.buffer.grow(newLength * Float32Array.BYTES_PER_ELEMENT)
    }
  }

  /**
   * Reloads the dataset with the raw data
   */
  async reload() {
    this.loadingTime = null
    this.isLoading = true
    this.history.length = 0
    await this.loadData(this.rawData)
  }

  /**
   * @param index
   * @returns
   */
  async reloadHistory(index: number) {
    const newHistory = this.history.slice(0, index + 1)
    await this.reload()

    await this.dispatch(newHistory.map((h) => [h.method, ...(h.args || [])]))
    return
  }

  /**
   * Remove a history item
   * @param index
   */
  async removeHistoryItem(index: number) {
    const newHistory = [...this.history]
    newHistory.splice(index, 1)
    await this.reload()
    await this.dispatch(newHistory.map((h) => [h.method, ...(h.args || [])]))
  }

  get beginTime(): Date | null {
    if (!this.dataset.source.x.length) {
      return null
    }
    return new Date(this.dataset.source.x[0])
  }

  get endTime(): Date | null {
    if (!this.dataset.source.x.length) {
      return null
    }
    return new Date(this.dataset.source.x[this.dataset.source.x.length - 1])
  }

  /** Dispatch an operation and log its signature in hisotry */
  async dispatch(
    action: EnumEditOperations | [EnumEditOperations, ...any][],
    ...args: any
  ) {
    const actions: EnumDictionary<EnumEditOperations, Function> = {
      [EnumEditOperations.ADD_POINTS]: this._addDataPoints,
      [EnumEditOperations.CHANGE_VALUES]: this._changeValues,
      [EnumEditOperations.DELETE_POINTS]: this._deleteDataPoints,
      [EnumEditOperations.DRIFT_CORRECTION]: this._driftCorrection,
      [EnumEditOperations.INTERPOLATE]: this._interpolate,
      [EnumEditOperations.SHIFT_DATETIMES]: this._shift,
      [EnumEditOperations.FILL_GAPS]: this._fillGaps,
    }

    // TODO: consolidate with icons in EditDrawer component
    const editIcons: EnumDictionary<EnumEditOperations, string> = {
      [EnumEditOperations.ADD_POINTS]: 'mdi-plus',
      [EnumEditOperations.CHANGE_VALUES]: 'mdi-pencil',
      [EnumEditOperations.DELETE_POINTS]: 'mdi-trash-can',
      [EnumEditOperations.DRIFT_CORRECTION]: 'mdi-chart-sankey',
      [EnumEditOperations.INTERPOLATE]: 'mdi-transit-connection-horizontal',
      [EnumEditOperations.SHIFT_DATETIMES]: 'mdi-calendar',
      [EnumEditOperations.FILL_GAPS]: 'mdi-keyboard-space',
    }

    let response: any[] = []

    try {
      if (Array.isArray(action)) {
        for (let i = 0; i < action.length; i++) {
          const method = action[i][0]
          const actionArgs = action[i].slice(1, action[i].length)
          const historyItem: HistoryItem = {
            method,
            args: actionArgs,
            icon: editIcons[method],
            isLoading: false,
          }
          this.history.push(historyItem)
        }

        for (
          let i = this.history.length - action.length;
          i < this.history.length;
          i++
        ) {
          const historyItem = this.history[i]
          historyItem.isLoading = true

          const measurement = await measureEllapsedTime(async () => {
            return await actions[historyItem.method].apply(
              this,
              historyItem.args
            )
          })
          historyItem.duration = measurement.duration
          historyItem.isLoading = false
          response.push(measurement.response)
        }
      } else {
        const historyItem: HistoryItem = {
          method: action,
          args,
          icon: editIcons[action],
          isLoading: true,
        }
        this.history.push(historyItem)
        const measurement = await measureEllapsedTime(async () => {
          return await actions[action].apply(this, args)
        })
        response = measurement.response
        historyItem.duration = measurement.duration
        historyItem.isLoading = false
      }
    } catch (e) {
      console.log(
        `Failed to execute operation: ${action} with arguments: `,
        args
      )
      console.log(e)
    }

    return response
  }

  /** Filter operations do not transform the data and are not logged in history */
  async dispatchFilter(
    action: EnumFilterOperations | [EnumFilterOperations, ...any][],
    ...args: any
  ) {
    const filters: EnumDictionary<EnumFilterOperations, Function> = {
      [EnumFilterOperations.FIND_GAPS]: this._findGaps,
      [EnumFilterOperations.VALUE_THRESHOLD]: this._valueThreshold,
      [EnumFilterOperations.PERSISTENCE]: this._persistence,
      [EnumFilterOperations.RATE_OF_CHANGE]: this._rateOfChange,
    }
    let response = []

    try {
      if (Array.isArray(action)) {
        for (let i = 0; i < action.length; i++) {
          const method = action[i][0]
          const args = action[i].slice(1, action[i].length)
          const res = await filters[method].apply(this, args)
          response.push(res)
        }
      } else {
        response = await filters[action].apply(this, args)
      }
    } catch (e) {
      console.log(
        `Failed to execute filter operation: ${action} with arguments: `,
        args
      )
      console.log(e)
    }
    return response
  }

  /**
   * @param index An array containing the list of index of values to perform the operations on.
   * @param operator The operator that will be applied
   * @param value The value to use in the operation
   * @returns The modified DataFrame
   */
  private _changeValues(index: number[], operator: Operator, value: number) {
    const operation = (x: number) => {
      switch (operator) {
        case Operator.ADD:
          return x + value
        case Operator.ASSIGN:
          return value
        case Operator.DIV:
          return x / value
        case Operator.MULT:
          return x * value
        case Operator.SUB:
          return x - value
        default:
          return x
      }
    }

    index.forEach((index: number) => {
      this.dataset.source.y[index] = operation(this.dataset.source.y[index])
    })
  }

  private _interpolate(index: number[]) {
    const groups = this._getConsecutiveGroups(index)

    groups.forEach((g) => {
      const start = g[0]
      const end = g[g.length - 1]

      let lowerIndex = Math.max(0, start - 1)
      let upperIndex = Math.min(this.dataset.source.y.length - 1, end + 1)

      const xData = this.dataset.source.x
      const yData = this.dataset.source.y
      for (let i = 0; i < g.length; i++) {
        this.dataset.source.y[g[i]] = this._interpolateLinear(
          xData[g[i]],
          xData[lowerIndex],
          yData[lowerIndex],
          xData[upperIndex],
          yData[upperIndex]
        )
      }
    })
  }

  /** Interpolate existing values in the data source */
  private _interpolateLinear(
    datetime: number,
    lowerDatetime: number,
    lowerValue: number,
    upperDatetime: number,
    upperValue: number
  ) {
    const interpolatedValue =
      lowerValue +
      ((datetime - lowerDatetime) * (upperValue - lowerValue)) /
      (upperDatetime - lowerDatetime)

    return interpolatedValue
  }

  /**
   * Shifts the selected indexes by specified amount of units. Elements are reinserted according to their datetime.
   * @param index The index of the elements to shift
   * @param amount Number of {@link TimeUnit}
   * @param unit {@link TimeUnit}
   * @returns
   */
  private async _shift(index: number[], amount: number, unit: TimeUnit) {
    // Collection that will be re-added using `_addDataPoints`
    const collection: [number, number][] = index.map((i) => [
      shiftDatetime(this.dataX[i], amount, unit),
      this.dataY[i],
    ])
    // TODO: add dedicated method to do these in one go
    await this._deleteDataPoints(index)
    await this._addDataPoints(collection)
  }

  private async _fillGapsV2(
    gap: [number, TimeUnit],
    fill: [number, TimeUnit],
    interpolateValues: boolean,
    range?: [number, number]
  ) {
    const numWorkers = navigator.hardwareConcurrency || 1
    const workers: Worker[] = []
    const promises = []
    const newLength = this.dataX.length

    // To avoid workers reading from a memory address where another working is writing to, we use separate output buffers.
    const outputBufferX = new SharedArrayBuffer(this.dataX.buffer.byteLength, {
      maxByteLength: this.dataX.buffer.maxByteLength,
    })

    const outputBufferY = new SharedArrayBuffer(this.dataY.buffer.byteLength, {
      maxByteLength: this.dataY.buffer.maxByteLength,
    })

    // Compute startTarget for each segment and start workers
    for (let i = 0; i < numWorkers; i++) {
      // Spawn workers
      promises.push(
        new Promise((resolve) => {
          const worker = new FillGapsWorker()
          workers.push(worker)
          worker.postMessage({
            bufferX: this.dataX.buffer,
            bufferY: this.dataY.buffer,
            outputBufferX,
            outputBufferY,
          })
          worker.onmessage = (event: MessageEvent) => {
            resolve(event.data)
          }
        })
      )
    }

    await Promise.all(promises)

    workers.forEach((worker) => worker.terminate()) // Important to terminate the workers

    this.dataset.source.x = new Float64Array(outputBufferX)
    this.dataset.source.y = new Float32Array(outputBufferY)
    this._resizeTo(newLength)
  }

  /**
   * Find gaps and fill them with placeholder value
   * @param gap Intervals to detect as gaps
   * @param fill Interval used to fill the detected gaps
   * @param interpolateValues If true, the new values will be linearly interpolated
   * @returns
   */
  // TODO: this needs to be improved using web workers
  private _fillGaps(
    gap: [number, TimeUnit],
    fill: [number, TimeUnit],
    interpolateValues: boolean,
    range?: [number, number]
  ) {
    const gaps = this._findGaps(gap[0], gap[1], range)

    for (let i = gaps.length - 1; i >= 0; i--) {
      const currentGap = gaps[i]
      const leftDatetime = this.dataX[currentGap[0]]
      const rightDatetime = this.dataX[currentGap[1]]
      const fillPoints: [number, number][] = []

      // TODO: number of seconds in a year or month is not constant
      // Use setMonth and setFullYear instead
      const fillDelta = fill[0] * timeUnitMultipliers[fill[1]] * 1000
      let nextFillDatetime = leftDatetime + fillDelta

      while (nextFillDatetime < rightDatetime) {
        const val: number = interpolateValues
          ? this._interpolateLinear(
            nextFillDatetime,
            this.dataX[currentGap[0]],
            this.dataY[currentGap[0]],
            this.dataX[currentGap[1]],
            this.dataY[currentGap[1]]
          )
          : -9999

        fillPoints.push([nextFillDatetime, val])
        nextFillDatetime += fillDelta
      }

      this._addDataPoints(fillPoints)
    }
  }

  /**
   Deletes data points from a large array using worker threads.
    1. The main thread divides the original array into equal parts to distribute work among workers.
    2. For each segment, binary search locates the indexes to delete (deleteSegment), ensuring efficient lookups.
    3. The cumulative deletions before each segment help compute the starting index (startTarget) for each worker's output, ensuring no overlap.
    4. Each worker processes its segment linearly, skipping deletions and copying kept elements to their computed positions.
    * @param deleteIndices 
   */
  // TODO: implement similar multithread solutions for other operations
  private async _deleteDataPoints(deleteIndices: number[]) {
    const numWorkers = navigator.hardwareConcurrency || 1
    const segmentSize = Math.ceil(this.dataX.length / numWorkers)
    const workers: Worker[] = []
    const segments = []

    // Prepare segments
    for (let i = 0; i < numWorkers; i++) {
      const start = i * segmentSize
      const end = Math.min((i + 1) * segmentSize - 1, this.dataX.length - 1)

      // Binary search to find deleteSegment within [start, end]
      const first = findFirstGreaterOrEqual(deleteIndices, start)
      const last = findLastLessOrEqual(deleteIndices, end)
      const deleteSegment = deleteIndices.slice(first, last + 1)

      segments.push({ start, end, deleteSegment })
    }

    // Compute prefix sums. These help distribute the work evenly.
    const prefixSum = new Array(numWorkers).fill(0)
    for (let i = 1; i < numWorkers; i++) {
      prefixSum[i] = prefixSum[i - 1] + segments[i - 1].deleteSegment.length
    }

    const promises = []
    const newLength = this.dataX.length - deleteIndices.length

    // // To avoid workers reading from a memory address where another working is writing to, we use separate output buffers.
    const outputBufferX = new SharedArrayBuffer(this.dataX.buffer.byteLength, {
      maxByteLength: this.dataX.buffer.maxByteLength,
    })

    const outputBufferY = new SharedArrayBuffer(this.dataY.buffer.byteLength, {
      maxByteLength: this.dataY.buffer.maxByteLength,
    })

    // Compute startTarget for each segment and start workers
    for (let i = 0; i < numWorkers; i++) {
      const { start, end, deleteSegment } = segments[i]
      const startTarget = start - prefixSum[i]

      // Spawn workers
      promises.push(
        new Promise((resolve) => {
          const worker = new DeleteDataWorker()
          workers.push(worker)
          worker.postMessage({
            bufferX: this.dataX.buffer,
            bufferY: this.dataY.buffer,
            outputBufferX,
            outputBufferY,
            start,
            end,
            deleteSegment,
            startTarget,
          })
          worker.onmessage = (event: MessageEvent) => {
            resolve(event.data)
          }
        })
      )
    }

    // Prevents vitest from halting during execution of multiple promises
    if (import.meta.env.MODE !== 'test') {
      await Promise.all(promises)
    }

    workers.forEach((worker) => worker.terminate()) // Important to terminate the workers

    this.dataset.source.x = new Float64Array(outputBufferX)
    this.dataset.source.y = new Float32Array(outputBufferY)
    this._resizeTo(newLength)
  }

  /**
   *
   * @param start The start index
   * @param end The end index
   * @param value The drift amount
   */
  private _driftCorrection(start: number, end: number, value: number) {
    const xData = this.dataset.source.x
    const yData = this.dataset.source.y

    const startDatetime = xData[start]
    const endDatetime = xData[end]
    const extent = endDatetime - startDatetime

    for (let i = start; i < end; i++) {
      // y_n = y_0 + G(x_i / extent)
      this.dataset.source.y[i] =
        yData[i] + value * ((xData[i] - startDatetime) / extent)
    }
  }

  /** Traverses the index array and returns groups of consecutive values.
   * i.e.: `[0, 1, 3, 4, 6] => [[0, 1], [3, 4], [6]]`
   * Assumes the input array is sorted.
   * @param index: the index array (sorted)
   */
  private _getConsecutiveGroups(index: number[]): number[][] {
    const groups: number[][] = [[]]

    // Form groups of consecutive points to delete in order to minimize the number of splice operations
    index.reduce((acc: number[][], curr: number) => {
      const target: number[] = acc[acc.length - 1]

      if (!target.length || curr == target[target.length - 1] + 1) {
        target.push(curr)
      } else {
        acc.push([curr])
      }

      return acc
    }, groups)

    return groups
  }

  /**
   * Adds data points. Their insert index is determined using `findFirstGreaterOrEqual` in the x-axis.
   * @param dataPoints
   */
  private async _addDataPoints(dataPoints: [number, number][]) {
    // Check if more space is needed
    const newLength = this.dataX.length + dataPoints.length
    this._growBuffer(newLength)
    // Sort the datapoints by datetime in reverse order
    dataPoints.sort((a, b) => {
      return a[0] - b[0]
    })

    const insertIndex = dataPoints.map((point) => {
      return findLastLessOrEqual(this.dataX, point[0]) + 1
    })

    this._resizeTo(newLength) // The space needs to be allocated before insertion can happen

    insertIndex.push(this.dataX.length)

    // Shift elements to the right to make room for the items to insert
    let toInsert = dataPoints.length
    for (let i = insertIndex.length - 1; i > 0; i--) {
      const left = insertIndex[i - 1]
      const right = insertIndex[i] - 1

      for (let n = right; n >= left; n--) {
        this.dataX[n + toInsert] = this.dataX[n]
        this.dataY[n + toInsert] = this.dataY[n]
      }
      toInsert--
      this.dataX[left + toInsert] = dataPoints[i - 1][0]
      this.dataY[left + toInsert] = dataPoints[i - 1][1]
    }
  }

  // =======================
  // FILTER OPERATIONS
  // =======================

  /**
   * Filter by applying a set of logical operations
   * @param appliedFilters
   * @returns
   */
  private _valueThreshold(appliedFilters: { [key: string]: number }) {
    const selection: number[] = []

    this.dataset.source.y.forEach((value: number, index: number) => {
      if (
        Object.keys(appliedFilters).some((key) => {
          return FilterOperationFn[key as FilterOperation]?.(
            value,
            appliedFilters[key]
          )
        })
      ) {
        selection.push(index)
      }
    })

    return selection
  }

  /**
   *
   * @param comparator
   * @param value
   * @returns
   */
  private _rateOfChange(comparator: string, value: number) {
    const selection: number[] = []
    const dataY = this.dataset.source.y

    for (let i = 0 + 1; i < dataY.length; i++) {
      const prev = dataY[i - 1]
      const curr = dataY[i]
      const rate = (curr - prev) / Math.abs(prev)

      if (
        RateOfChangeComparator[comparator as RateOfChangeOperation]?.(
          rate,
          value
        )
      ) {
        selection.push(i)
      }
    }
    return selection
  }

  /**
   * Find gaps in the data
   * @param value The time value
   * @param unit The time unit (TimeUnit)
   * @param range If specified, the gaps will be found only within the range
   * @returns
   */
  private _findGaps(
    value: number,
    unit: TimeUnit,
    range?: [number, number]
  ): [number, number][] {
    const selection: [number, number][] = []
    const dataX = this.dataset.source.x
    let start = 0
    let end = dataX.length

    if (range?.[0] && range?.[1]) {
      start = range[0]
      end = range[1]
    }

    let prevDatetime = dataX[start]

    for (let i = start + 1; i <= end; i++) {
      const curr = dataX[i]
      const delta = curr - prevDatetime // milliseconds

      if (delta > value * timeUnitMultipliers[unit] * 1000) {
        selection.push([i - 1, i])
      }
      prevDatetime = curr
    }

    return selection
  }

  /**
   * Find points where the values are the same at least x times in a row
   * @param times The number of times in a row that points can be equal
   * @param range If specified, the points will be found only within the range
   * @returns
   */
  private _persistence(times: number, range?: [number, number]) {
    let selection: number[] = []
    let dataY = this.dataset.source.y
    let start = 0
    let end = dataY.length
    if (range?.[0] && range?.[1]) {
      start = range[0]
      end = range[1]
    }

    let prev = dataY[start]
    let stack = []

    for (let i = start + 1; i < end; i++) {
      const curr = dataY[i]
      if (curr != prev || i === end) {
        if (stack.length >= times) {
          selection = [...selection, ...stack]
        }
        stack = []
      } else {
        stack.push(i)
      }
    }

    return selection
  }
}
