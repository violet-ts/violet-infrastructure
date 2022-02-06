/* eslint-disable */
// prettier-ignore
import express, { Express, RequestHandler } from 'express'
// prettier-ignore
import hooksFn0 from './api/hooks'
// prettier-ignore
import hooksFn1 from './api/admin/hooks'
// prettier-ignore
import hooksFn2 from './api/normal/hooks'
// prettier-ignore
import controllerFn0 from './api/admin/users/controller'
// prettier-ignore
import controllerFn1 from './api/admin/users/_id@string/controller'
// prettier-ignore
import controllerFn2 from './api/normal/awsiam/controller'
// prettier-ignore
import controllerFn3 from './api/normal/awsiam/accesskey/controller'
// prettier-ignore
import controllerFn4 from './api/normal/role/controller'
// prettier-ignore
import type { LowerHttpMethod, AspidaMethods, HttpStatusOk, AspidaMethodParams } from 'aspida'

// prettier-ignore
export type FrourioOptions = {
  basePath?: string
}

// prettier-ignore
type HttpStatusNoOk = 301 | 302 | 400 | 401 | 402 | 403 | 404 | 405 | 406 | 409 | 500 | 501 | 502 | 503 | 504 | 505

// prettier-ignore
type PartiallyPartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// prettier-ignore
type BaseResponse<T, U, V> = {
  status: V extends number ? V : HttpStatusOk
  body: T
  headers: U
}

// prettier-ignore
type ServerResponse<K extends AspidaMethodParams> =
  | (K extends { resBody: K['resBody']; resHeaders: K['resHeaders'] }
  ? BaseResponse<K['resBody'], K['resHeaders'], K['status']>
  : K extends { resBody: K['resBody'] }
  ? PartiallyPartial<BaseResponse<K['resBody'], K['resHeaders'], K['status']>, 'headers'>
  : K extends { resHeaders: K['resHeaders'] }
  ? PartiallyPartial<BaseResponse<K['resBody'], K['resHeaders'], K['status']>, 'body'>
  : PartiallyPartial<
      BaseResponse<K['resBody'], K['resHeaders'], K['status']>,
      'body' | 'headers'
    >)
  | PartiallyPartial<BaseResponse<any, any, HttpStatusNoOk>, 'body' | 'headers'>

// prettier-ignore
type RequestParams<T extends AspidaMethodParams> = Pick<{
  query: T['query']
  body: T['reqBody']
  headers: T['reqHeaders']
}, {
  query: Required<T>['query'] extends {} | null ? 'query' : never
  body: Required<T>['reqBody'] extends {} | null ? 'body' : never
  headers: Required<T>['reqHeaders'] extends {} | null ? 'headers' : never
}['query' | 'body' | 'headers']>

// prettier-ignore
export type ServerMethods<T extends AspidaMethods, U extends Record<string, any> = {}> = {
  [K in keyof T]: (
    req: RequestParams<T[K]> & U
  ) => ServerResponse<T[K]> | Promise<ServerResponse<T[K]>>
}

// prettier-ignore
const parseJSONBoby: RequestHandler = (req, res, next) => {
  express.json()(req, res, err => {
    if (err) return res.sendStatus(400)

    next()
  })
}

// prettier-ignore
const asyncMethodToHandler = (
  methodCallback: ServerMethods<any, any>[LowerHttpMethod]
): RequestHandler => async (req, res, next) => {
  try {
    const data = await methodCallback(req as any) as any

    if (data.headers) {
      for (const key in data.headers) {
        res.setHeader(key, data.headers[key])
      }
    }

    res.status(data.status).send(data.body)
  } catch (e) {
    next(e)
  }
}

// prettier-ignore
export default (app: Express, options: FrourioOptions = {}) => {
  const basePath = options.basePath ?? ''
  const hooks0 = hooksFn0(app)
  const hooks1 = hooksFn1(app)
  const hooks2 = hooksFn2(app)
  const controller0 = controllerFn0(app)
  const controller1 = controllerFn1(app)
  const controller2 = controllerFn2(app)
  const controller3 = controllerFn3(app)
  const controller4 = controllerFn4(app)

  app.get(`${basePath}/admin/users`, [
    hooks0.onRequest,
    hooks1.onRequest,
    asyncMethodToHandler(controller0.get)
  ])

  app.post(`${basePath}/admin/users/:id`, [
    hooks0.onRequest,
    hooks1.onRequest,
    asyncMethodToHandler(controller1.post)
  ])

  app.delete(`${basePath}/admin/users/:id`, [
    hooks0.onRequest,
    hooks1.onRequest,
    asyncMethodToHandler(controller1.delete)
  ])

  app.patch(`${basePath}/admin/users/:id`, [
    hooks0.onRequest,
    hooks1.onRequest,
    parseJSONBoby,
    asyncMethodToHandler(controller1.patch)
  ])

  app.get(`${basePath}/normal/awsiam`, [
    hooks0.onRequest,
    hooks2.onRequest,
    asyncMethodToHandler(controller2.get)
  ])

  app.post(`${basePath}/normal/awsiam`, [
    hooks0.onRequest,
    hooks2.onRequest,
    asyncMethodToHandler(controller2.post)
  ])

  app.delete(`${basePath}/normal/awsiam`, [
    hooks0.onRequest,
    hooks2.onRequest,
    asyncMethodToHandler(controller2.delete)
  ])

  app.get(`${basePath}/normal/awsiam/accesskey`, [
    hooks0.onRequest,
    hooks2.onRequest,
    asyncMethodToHandler(controller3.get)
  ])

  app.post(`${basePath}/normal/awsiam/accesskey`, [
    hooks0.onRequest,
    hooks2.onRequest,
    asyncMethodToHandler(controller3.post)
  ])

  app.delete(`${basePath}/normal/awsiam/accesskey`, [
    hooks0.onRequest,
    hooks2.onRequest,
    asyncMethodToHandler(controller3.delete)
  ])

  app.get(`${basePath}/normal/role`, [
    hooks0.onRequest,
    hooks2.onRequest,
    asyncMethodToHandler(controller4.get)
  ])

  return app
}
