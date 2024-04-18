import { Injectable, Logger } from '@nestjs/common'
import { CreateFcDto } from './dto/create-fc.dto'
import { UpdateFcDto } from './dto/update-fc.dto'
import { HttpAdapterHost } from '@nestjs/core'
import {
  Express,
  json,
  Request,
  RequestHandler,
  Response,
  Router,
} from 'express'
import { CRUDMeta, ParamConfig, RouteMeta } from './backend'
import { getAllMeta } from './meta.helper'
import { User } from './entities/fc.entity'
import {
  CreateReq,
  CreateRes,
  DeleteReq,
  DeleteRes,
  PageRes,
  ReadReq,
  ReadRes,
  UpdateReq,
  UpdateRes,
} from './crud.decl'
const util = require('util')

const logger = new Logger('FcService')

export interface CRUDProvider<T> {
  create(req: CreateReq<T>): CreateRes<T>
  read(req: ReadReq<T>): ReadRes<T>
  update(req: UpdateReq<T>): UpdateRes<T>
  delete(req: DeleteReq<T>): DeleteRes<T>
}
class MockCRUDProvider implements CRUDProvider<User> {
  repo: User[] = []
  create(req: CreateReq<User>): CreateRes<User> {
    console.log('create', this)
    const { form } = req
    this.repo.push(form)
    return { row: form, rows_affected: 1 }
  }
  read(req: ReadReq<User>): PageRes<User> {
    return { currentPage: 1, pageSize: 1, total: 1, records: this.repo }
  }
  update(req: UpdateReq<User>): UpdateRes<User> {
    const { form } = req
    const idx = this.repo.findIndex((r) => r.id === form.id)
    if (idx === -1) {
      return { row: form, rows_affected: 0 }
    }
    this.repo[idx] = form
    return { row: form, rows_affected: 1 }
  }
  delete(req: DeleteReq<User>): DeleteRes<User> {
    const { row } = req
    const idx = this.repo.findIndex((r) => r.id === row.id)
    if (idx === -1) {
      return { rows_affected: 0 }
    }
    this.repo.splice(idx, 1)
    return { rows_affected: 1 }
  }
}

@Injectable()
export class FcService {
  express: Express
  constructor(private readonly adapterHost: HttpAdapterHost) {
    this.express = this.adapterHost.httpAdapter.getInstance<Express>()
    this.express.use(json())

    logger.debug(
      `FasterCrudService created, attaching to ${this.adapterHost.httpAdapter.getType()}`,
    )
    this.express.get('/fc', (req, res) => res.json({ message: 'Hello World' }))

    this.configureEntity(User, new MockCRUDProvider())
  }

  create(createFcDto: CreateFcDto) {
    return 'This action adds a new fc'
  }

  findAll() {
    return `This action returns all fc`
  }

  findOne(id: number) {
    return `This action returns a #${id} fc`
  }

  update(id: number, updateFcDto: UpdateFcDto) {
    return `This action updates a #${id} fc`
  }

  remove(id: number) {
    return `This action removes a #${id} fc`
  }

  addRouter(route: string, router: Router) {
    router.stack.forEach((r) => {
      if (r.route && r.route.path) {
        logger.debug(
          `Mapped {${route}${
            r.route.path
          }}, ${r.route.stack[0].method.toUpperCase()}} route`,
        )
      }
    })
    this.express.use(route, router)
  }

  configureEntity<T extends new (...args: any[]) => any>(
    entity: T,
    provider: CRUDProvider<InstanceType<T>>,
  ) {
    const data = getAllMeta(entity) as CRUDMeta

    this.configureHandlers(entity, data, provider)
  }

  configureHandlers<T extends new (...args: any[]) => any>(
    entity: T,
    meta: CRUDMeta,
    provider: CRUDProvider<InstanceType<T>>,
  ) {
    for (const [routeName, routeMeta] of Object.entries(meta.routes)) {
      const handler = this.configureRoute(entity, meta, routeName, provider)

      this.addRouter(
        `/fc/${meta.entity.toLowerCase()}`,
        new RouterBuilder()
          .setRoute(routeMeta.config.method, routeMeta.path, handler)
          .build(),
      )
    }
  }

  configureParam(cfg: ParamConfig) {
    // assume input is a record of parameters
    return (o: Record<string, any>) => {
      if (cfg.required) {
        // check if required
        if (!o[cfg.name]) {
          // if not found, return error
          return { error: `missing required parameter, named ${cfg.name}` }
        }
      }
      if (cfg.validator) {
        // if validator is present, run it
        if (!cfg.validator(o[cfg.name])) {
          // if validator returns false, return error
          return { error: 'parameter validation failed' }
        }
      }
      //TODO
    }
  }

  configureRoute<T extends new (...args: any[]) => any>(
    entity: T,
    meta: CRUDMeta,
    routeName: string,
    provider: CRUDProvider<InstanceType<T>>,
  ) {
    const routeMeta = meta.routes[routeName]
    const {
      config: { preRoute, postRoute, raw_input = false },
      parameters,
    } = routeMeta
    const fn = createFunction(routeMeta, entity, routeName, provider)

    const paramValidators = this.configureParamValidators(routeMeta)
    const reshape = this.getParamsReshaper(parameters)
    const handler = (req: Request, res: Response) => {
      const errors = paramValidators.map((v) => v(req.body)).filter(Boolean)
      if (errors.length) {
        res.status(400).json({ errors })
      } else {
        preRoute?.call({ req, res })

        console.log('req.body', req.body, raw_input)
        const args = raw_input ? [req.body] : reshape(req.body)
        console.log('args', args)
        // if is crud, this is the provider
        // if is raw, this is the entity
        let result: any
        if (routeMeta.config.action !== 'raw') {
          result = fn.call(provider, ...args)
        } else {
          result = fn.call(entity, ...args)
        }

        res.json(result)

        postRoute?.call({ req, res, result })
      }
    }

    return handler
  }

  private getParamsReshaper(parameters: Record<string, ParamConfig>) {
    const n_args = Object.keys(parameters || []).length

    if (n_args === 0) {
      return () => []
    }

    return (body: Record<string, any>) => {
      const args = new Array().fill(null, n_args)
      for (const [idx, cfg] of Object.entries(parameters || [])) {
        args[parseInt(idx)] = body[cfg.name]
      }
      return args
    }
  }

  private configureParamValidators(routeMeta: RouteMeta) {
    return Object.values(routeMeta.parameters || {}).map(this.configureParam)
  }
}

export class RouterBuilder {
  router: Router = Router()
  pre_middlewares: RequestHandler[] = []
  post_middlewares: RequestHandler[] = []

  constructor() {}
  setRoute(method: string, path: string, handler: RequestHandler) {
    this.router[method.toLowerCase()](path, ...this.pre_middlewares, handler)
    return this
  }

  addPreMiddlewares(...middleware: any[]) {
    this.pre_middlewares.push(...middleware)
    return this
  }

  addPostMiddlewares(...middleware: any[]) {
    this.post_middlewares.push(...middleware)
    return this
  }

  build() {
    return this.router
  }
}
function createFunction<T extends new (...args: any[]) => any>(
  routeMeta: RouteMeta,
  entity: T,
  routeName: string,
  provider: CRUDProvider<InstanceType<T>>,
) {
  let fn: Function
  const {
    config: { action },
  } = routeMeta
  if (action === 'raw') {
    fn = entity.prototype[routeName] as Function
  } else {
    fn = provider[action] as Function
    if (!fn) {
      throw new Error(`action ${action} not found in provider`)
    }
  }
  return fn
}
