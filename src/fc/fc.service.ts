import { Injectable, Logger } from '@nestjs/common'
import { CreateFcDto } from './dto/create-fc.dto'
import { UpdateFcDto } from './dto/update-fc.dto'
import { HttpAdapterHost } from '@nestjs/core'
import { Express, json, RequestHandler, Router } from 'express'
import { CRUDMeta, ParamConfig, User } from './backend'
import { getAllMeta } from './meta.helper'
const util = require('util')

const logger = new Logger('FcService')

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

    this.configureEntity(User)
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

  configureEntity<T extends new (...args: any[]) => any>(entity: T) {
    const data = getAllMeta(entity) as CRUDMeta
    // console.log(data)

    const router = new RouterBuilder()
    for (const [route, meta] of Object.entries(data.routes)) {
      // console.log(meta.config.method, meta.path)
      router.setRoute(meta.config.method, meta.path, (req, res) => {
        res.json({ message: 'Hello World' })
      })
    }

    // this.addRouter(`/fc/${data.entity.toLowerCase()}`, router.build())
    this.configureHandlers(entity, data)
  }

  /* 
  {
  fields: { name: { type: 'string' } },
  routes: {
    login: {
      parameters: {
        '0': {
          validator: [Function (anonymous)] { [length]: 1, [name]: '' },
          required: true
        },
        '1': { required: true }
      },
      path: '/login',
      config: {
        method: 'POST',
        preRoute: [Function: preRoute] { [length]: 0, [name]: 'preRoute' }
      }
    }
  },
  entity: 'User'
}
  */
  configureHandlers<T extends new (...args: any[]) => any>(
    entity: T,
    meta: CRUDMeta,
  ) {
    for (const [routeName, routeMeta] of Object.entries(meta.routes)) {
      const handler = this.configureRoute(entity, meta, routeName)

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
  ) {
    const routeMeta = meta.routes[routeName]
    const fn = entity.prototype[routeName] as Function
    const paramValidators = Object.values(routeMeta.parameters).map(
      this.configureParam,
    )
    const handler = (req, res) => {
      const errors = paramValidators.map((v) => v(req.body)).filter(Boolean)
      if (errors.length) {
        res.status(400).json({ errors })
      } else {
        // preRoute
        routeMeta.config?.preRoute?.call({ req, res })

        // unwarp params according to order
        const args = new Array().fill(
          null,
          Object.keys(routeMeta.parameters).length,
        )
        for (const [idx, cfg] of Object.entries(routeMeta.parameters)) {
          args[parseInt(idx)] = req.body[cfg.name]
        }
        //TODO use context here
        const result = fn.call({ req, res }, ...args)
        res.json(result)

        // postRoute
        routeMeta.config?.postRoute?.call({ req, res, result })
      }
    }

    return handler
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
