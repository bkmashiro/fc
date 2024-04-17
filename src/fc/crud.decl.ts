export type Page = {
  currentPage?: number
  pageSize?: number
}

export type PageSort = {
  prop?: string
  order?: string
  asc?: boolean
}

export type PageQuery<T = unknown> = {
  page?: Page
  form?: T
  sort?: PageSort
}

export type PageRes<T> = {
  currentPage: number
  pageSize: number
  total: number
  records: Array<T>
}

export type CreateReq<T = unknown> = {
  form?: T
  [key: string]: any
}

export type ReadReq<T = unknown, Pagination = true> = {
  mode?: string
  row?: T
  [key: string]: any
} & (Pagination extends true ? Page : {})

export type UpdateReq<T = unknown> = {
  form?: T
  row?: T
  [key: string]: any
}

export type DeleteReq<T = unknown> = {
  row?: unknown
  [key: string]: any
}

export type CreateRes<T = unknown> = {
  row: T
  rows_affected: number
}

export type ReadRes<T = unknown, Pagination = true> = Pagination extends true
  ? PageRes<T>
  : {
      row: T
    }

export type UpdateRes<T = unknown> = {
  row: T
  rows_affected: number
}

export type DeleteRes = {
  rows_affected: number
}