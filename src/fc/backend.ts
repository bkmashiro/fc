import 'reflect-metadata'
// import util from 'util';
const util = require('util');

const fcMetadataKey = Symbol("fc");
type ClassDecorator = <TFunction extends Function>(target: TFunction) => TFunction | void;
type PropertyDecorator = (target: Object, propertyKey: string | symbol) => void;
type MethodDecorator = <T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T> | void;
type ParameterDecorator = (target: Object, propertyKey: string | symbol | undefined, parameterIndex: number) => void;

function setMeta(target: any, key: string, value: any) {
  const path = `__meta__${key}`;
  const existingMeta = Reflect.getOwnMetadata(fcMetadataKey, target) || {};
  // key is a dot separated path
  const keys = key.split('.');
  let current = existingMeta;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]] || {};
  }
  current[keys[keys.length - 1]] = value;
  Reflect.defineMetadata(fcMetadataKey, existingMeta, target);
}

function getMeta(target: any, key: string) {
  const existingMeta = Reflect.getOwnMetadata(fcMetadataKey, target) || {};
  const keys = key.split('.');
  let current = existingMeta;
  for (let i = 0; i < keys.length; i++) {
    if (!current[keys[i]]) {
      return undefined;
    }
    current = current[keys[i]];
  }
  return current;
}

type InferTypeName<T> =
  T extends string ? 'string' :
  T extends number ? 'number' :
  T extends boolean ? 'boolean' :
  T extends object ? 'object' : 'any';

const _type_castable = {
  'string': [],
  'number': ['bigint'],
  'boolean': [],
  'object': ['array'],
  'any': []
} as const;
type TypeCastable<T extends keyof typeof _type_castable> = typeof _type_castable[T][number] | T;
type PropConfig<T extends Record<string, any>, P extends string> = {
  type: TypeCastable<InferTypeName<T[P]>>;
}

function Prop<T, P extends string>(cfg: PropConfig<T, P>) {
  return function (target: T, propertyKey: keyof T & P) {
    setMeta(target, `fields.${propertyKey}`, cfg);
  }
}

function collectProps(prototype: Function) {
  const props = {};
  const keys = Object.getOwnPropertyNames(prototype);
  keys.forEach(key => {
    const meta = getMeta(prototype, `fields.${key}`);
    if (meta) {
      props[key] = meta;
    }
  });
  return props;
}

function CRUD<C extends { new(...args: any[]): {} }>(cfg: Record<string, any>) {
  return function (target: C) {
    console.log('CRUD', target.name, cfg);
    const fields = collectProps(target);
    setMeta(target, 'fields', fields);
  }
}

function POST<C extends {}, K extends string, D extends PropertyDescriptor>(path: string) {
  return function (target: C, propertyKey: K, descriptor: D) {
    setMeta(target, `routes.${propertyKey}.method`, 'POST');
    setMeta(target, `routes.${propertyKey}.path`, path);
  };
}

function required(target: Object, propertyKey: string, parameterIndex: number) {
  setMeta(target, `routes.${propertyKey}.parameters.${parameterIndex}.required`, true);
}

type NthParameterType<T extends (...args: any[]) => any, N extends number> = Parameters<T>[N];
function expect<T, P extends keyof T & string, Idx extends number>(
  validator: (value:
    T[P] extends (...args: any[]) => any ? NthParameterType<T[P], Idx> : never
  ) => boolean
) {
  return function (target: T, propertyKey: P, parameterIndex: Idx) {
    setMeta(target, `routes.${propertyKey}.parameters.${parameterIndex}.validator`, validator);
  };
}

function validate(target: any, propertyName: string, descriptor: TypedPropertyDescriptor<Function>) {
  let method = descriptor.value!;

  descriptor.value = function () {
    const req = getMeta(target, `routes.${propertyName}.parameters`) || {}
    const requiredParameters = Object.keys(req).filter(k => req[k].required).map(k => parseInt(k));

    if (requiredParameters) {
      for (let parameterIndex of requiredParameters) {
        if (parameterIndex >= arguments.length || arguments[parameterIndex] === undefined) {
          throw new Error("Missing required argument.");
        }
      }
    }
    return method.apply(this, arguments);
  };
}

function applyDecorators(...decorators: any[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    decorators.forEach(decorator => decorator(target, propertyKey, descriptor));
  }
}

@CRUD({})
class User {
  @Prop({ type: 'number' })
  id: number;
  @Prop({ type: 'string' })
  name: string;

  @POST('/login')
  @validate
  login(
    @required
    @expect(s => s.length > 0)
    username: string,
    @required
    password: string
  ) {
    console.log('login', username, password);
  }
}

// debug
// get fc metadata
console.log(
  util.inspect(Reflect.getOwnMetadata(fcMetadataKey, User.prototype), {
    showHidden: true,
    depth: null
  })
)