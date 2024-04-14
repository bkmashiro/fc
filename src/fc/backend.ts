import 'reflect-metadata'
const util = require('util')

const fcMetadataKey = Symbol('fc')
type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

type ClassDecorator = <TFunction extends Function>(
  target: TFunction,
) => TFunction | void
type PropertyDecorator = (target: Object, propertyKey: string | symbol) => void
type MethodDecorator = <T>(
  target: Object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>,
) => TypedPropertyDescriptor<T> | void
type ParameterDecorator = (
  target: Object,
  propertyKey: string | symbol | undefined,
  parameterIndex: number,
) => void

function setMeta(target: any, key: string, value: any) {
  const path = `__meta__${key}`
  const existingMeta = Reflect.getOwnMetadata(fcMetadataKey, target) || {}
  // key is a dot separated path
  const keys = key.split('.')
  let current = existingMeta
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {}
    }
    current = current[keys[i]] || {}
  }
  current[keys[keys.length - 1]] = value
  Reflect.defineMetadata(fcMetadataKey, existingMeta, target)
}

function getMeta(target: any, key: string) {
  const existingMeta = Reflect.getOwnMetadata(fcMetadataKey, target) || {}
  const keys = key.split('.')
  let current = existingMeta
  for (let i = 0; i < keys.length; i++) {
    if (!current[keys[i]]) {
      return undefined
    }
    current = current[keys[i]]
  }
  return current
}

type InferTypeName<T> = T extends string
  ? 'string'
  : T extends number
  ? 'number'
  : T extends boolean
  ? 'boolean'
  : T extends object
  ? 'object'
  : 'any'

const _type_castable = {
  string: [],
  number: ['bigint'],
  boolean: [],
  object: ['array'],
  any: [],
} as const

type TypeCastable<T extends keyof typeof _type_castable> =
  | (typeof _type_castable)[T][number]
  | T
type PropConfig<T extends Record<string, any>, P extends keyof T> = {
  type: TypeCastable<InferTypeName<T[P]>>
}

function Prop<T extends {}, P extends keyof T & string>(cfg: PropConfig<T, P>) {
  return function (target: T, propertyKey: P) {
    setMeta(target, `fields.${propertyKey}`, cfg)
  }
}

function collectProps(prototype: Function) {
  const props = {}
  const keys = Object.getOwnPropertyNames(prototype)
  keys.forEach((key) => {
    const meta = getMeta(prototype, `fields.${key}`)
    if (meta) {
      props[key] = meta
    }
  })
  return props
}

function CRUD<C extends { new (...args: any[]): {} }>(
  cfg: Record<string, any>,
) {
  return function (target: C) {
    console.log('CRUD', target.name, cfg)
    const fields = collectProps(target)
    setMeta(target, 'fields', fields)
  }
}

type RouteCtx<T extends {}, P extends keyof T & string, Act extends Action> = {
  payload: Payload<Act, T>

  error(message: string): void
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
type Action = 'create' | 'read' | 'update' | 'delete' | 'raw'
type CreatePayload<T> = {
  action: 'create'
}
type ReadPayload<T> = {
  action: 'read'
}
type UpdatePayload<T> = {
  action: 'update'
}
type DeletePayload<T> = {
  action: 'delete'
}
type RawPayload<T> = {
  action: 'raw'
  data: T
}

type PayloadType<T> =
  | CreatePayload<T>
  | ReadPayload<T>
  | UpdatePayload<T>
  | DeletePayload<T>
  | RawPayload<T>

type Payload<A extends Action, T> = Extract<PayloadType<T>, { action: A }>

type RouteConfig<
  T extends {},
  P extends keyof T & string,
  D extends PropertyDescriptor,
  Act extends Action,
> = {
  method?: Method
  action?: Act
  path?: string
  preRoute?(o: { req: T; res: any; next: () => void }): void
  transformPayload?(o: Payload<Act, any>): unknown
  postRoute?(o: { req: T; res: any }): void
} & ThisType<RouteCtx<T, P, Act>>
type IsOptional<T, K extends keyof T> = {
  [K1 in Exclude<keyof T, K>]: T[K1]
} & { K?: T[K] } extends T
  ? K
  : never
type OptionalKeys<T> = { [K in keyof T]: IsOptional<T, K> }[keyof T]
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>
type LeftCommonKey<T, U> = {
  // for optional keys
  [K in OptionalKeys<T>]?: T[K]
} & {
  // for required keys
  [K in RequiredKeys<T>]: T[K]
}

function Route<
  T extends {},
  F extends keyof T & string,
  P extends PropertyDescriptor,
  C extends {},
>(
  path: string,
  // we cannot prevent unknown properties to be added to cfg
  // TODO: find ways to fix this.
  cfg?: RouteConfig<T, F, P, 'raw'> & C,
) {
  return function (target: T, propertyKey: F, descriptor: P) {
    setMeta(target, `routes.${propertyKey}.method`, 'POST')
    setMeta(target, `routes.${propertyKey}.path`, path)
    setMeta(target, `routes.${propertyKey}.config`, cfg || {}) //TODO: validate config
  }
}

function required(target: Object, propertyKey: string, parameterIndex: number) {
  setMeta(
    target,
    `routes.${propertyKey}.parameters.${parameterIndex}.required`,
    true,
  )
}

type NthParameterType<
  T extends (...args: any[]) => any,
  N extends number,
> = Parameters<T>[N]
function expect<T, P extends keyof T & string, Idx extends number>(
  validator: (
    value: T[P] extends (...args: any[]) => any
      ? NthParameterType<T[P], Idx>
      : never,
  ) => boolean,
) {
  return function (target: T, propertyKey: P, parameterIndex: Idx) {
    setMeta(
      target,
      `routes.${propertyKey}.parameters.${parameterIndex}.validator`,
      validator,
    )
  }
}

function validate(
  target: any,
  propertyName: string,
  descriptor: TypedPropertyDescriptor<Function>,
) {
  let method = descriptor.value!

  descriptor.value = function () {
    const req = getMeta(target, `routes.${propertyName}.parameters`) || {}
    const requiredParameters = Object.keys(req)
      .filter((k) => req[k].required)
      .map((k) => parseInt(k))

    if (requiredParameters) {
      for (let parameterIndex of requiredParameters) {
        if (
          parameterIndex >= arguments.length ||
          arguments[parameterIndex] === undefined
        ) {
          throw new Error('Missing required argument.')
        }
      }
    }
    return method.apply(this, arguments)
  }
}

function applyDecorators(...decorators: any[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    decorators.forEach((decorator) =>
      decorator(target, propertyKey, descriptor),
    )
  }
}

@CRUD({})
class User {
  @Prop({ type: 'number' })
  id: number

  @Prop({ type: 'string' })
  name: string

  @Route('/login', {
    preRoute() {
      this
    },
  })
  login(
    @required
    @expect((s) => s.length > 0)
    username: string,
    @required
    password: string,
  ) {
    console.log('login', username, password)
  }
}

// debug
// get fc metadata
// console.log(util)
console.log(
  util.inspect(Reflect.getOwnMetadata(fcMetadataKey, User.prototype), {
    showHidden: true,
    depth: null,
    colors: true,
  }),
)
