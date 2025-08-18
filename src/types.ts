export enum EnumEditOperations {
  ADD_POINTS = 'ADD_POINTS',
  CHANGE_VALUES = 'CHANGE_VALUES',
  DELETE_POINTS = 'DELETE_POINTS',
  DRIFT_CORRECTION = 'DRIFT_CORRECTION',
  INTERPOLATE = 'INTERPOLATE',
  SHIFT_DATETIMES = 'SHIFT_DATETIMES',
  FILL_GAPS = 'FILL_GAPS',
}

export enum EnumFilterOperations {
  FIND_GAPS = 'FIND_GAPS',
  PERSISTENCE = 'PERSISTENCE',
  RATE_OF_CHANGE = 'RATE_OF_CHANGE',
  VALUE_THRESHOLD = 'VALUE_THRESHOLD',
}

export type HistoryItem = {
  method: EnumEditOperations
  icon: string
  isLoading: boolean
  args?: any[]
  duration?: number
  status?: 'success' | 'failed'
}

export type EnumDictionary<T extends string | symbol | number, U> = {
  [K in T]: U
}

export enum FilterOperation {
  LT = 'Less than',
  LTE = 'Less than or equal to',
  GT = 'Greater than',
  GTE = 'Greater than or equal to',
  E = 'Equal',
  START = 'Start datetime',
  END = 'End datetime',
}

export const FilterOperationFn: EnumDictionary<
  FilterOperation,
  (value: number, toCompare: number) => boolean
> = {
  [FilterOperation.LT]: (value: number, toCompare: number) => {
    return value < toCompare
  },
  [FilterOperation.LTE]: (value: number, toCompare: number) => {
    return value <= toCompare
  },
  [FilterOperation.GT]: (value: number, toCompare: number) => {
    return value > toCompare
  },
  [FilterOperation.GTE]: (value: number, toCompare: number) => {
    return value >= toCompare
  },
  [FilterOperation.E]: (value: number, toCompare: number) => {
    return value == toCompare
  },
  [FilterOperation.START]: (value: number, toCompare: number) => {
    return value == toCompare
  },
  [FilterOperation.END]: (value: number, toCompare: number) => {
    return value == toCompare
  },
}

export enum Operator {
  ADD = 'ADD',
  SUB = 'SUB',
  MULT = 'MULT',
  DIV = 'DIV',
  ASSIGN = 'ASSIGN',
}

export enum RateOfChangeOperation {
  LT = 'Less than',
  LTE = 'Less than or equal to',
  GT = 'Greater than',
  GTE = 'Greater than or equal to',
  E = 'Equal',
}

export const RateOfChangeComparator: EnumDictionary<
  RateOfChangeOperation,
  (value: number, toCompare: number) => boolean
> = {
  [RateOfChangeOperation.LT]: (value: number, toCompare: number) => {
    return value < toCompare
  },
  [RateOfChangeOperation.LTE]: (value: number, toCompare: number) => {
    return value <= toCompare
  },
  [RateOfChangeOperation.GT]: (value: number, toCompare: number) => {
    return value > toCompare
  },
  [RateOfChangeOperation.GTE]: (value: number, toCompare: number) => {
    return value >= toCompare
  },
  [RateOfChangeOperation.E]: (value: number, toCompare: number) => {
    return value == toCompare
  },
}