/* eslint-disable */
// prettier-ignore
import { AspidaClient } from 'aspida'
// prettier-ignore
import { Methods as Methods0 } from './admin/users'
// prettier-ignore
import { Methods as Methods1 } from './admin/users/_id@string'
// prettier-ignore
import { Methods as Methods2 } from './normal/awsiam'
// prettier-ignore
import { Methods as Methods3 } from './normal/awsiam/accesskey'
// prettier-ignore
import { Methods as Methods4 } from './normal/role'

// prettier-ignore
const api = <T>({ baseURL, fetch }: AspidaClient<T>) => {
  const prefix = (baseURL === undefined ? '' : baseURL).replace(/\/$/, '')
  const PATH0 = '/admin/users'
  const PATH1 = '/normal/awsiam'
  const PATH2 = '/normal/awsiam/accesskey'
  const PATH3 = '/normal/role'
  const GET = 'GET'
  const POST = 'POST'
  const DELETE = 'DELETE'
  const PATCH = 'PATCH'

  return {
    admin: {
      users: {
        _id: (val2: string) => {
          const prefix2 = `${PATH0}/${val2}`

          return {
            post: (option?: { config?: T }) =>
              fetch(prefix, prefix2, POST, option).send(),
            $post: (option?: { config?: T }) =>
              fetch(prefix, prefix2, POST, option).send().then(r => r.body),
            delete: (option?: { config?: T }) =>
              fetch(prefix, prefix2, DELETE, option).send(),
            $delete: (option?: { config?: T }) =>
              fetch(prefix, prefix2, DELETE, option).send().then(r => r.body),
            patch: (option: { body: Methods1['patch']['reqBody'], config?: T }) =>
              fetch(prefix, prefix2, PATCH, option).send(),
            $patch: (option: { body: Methods1['patch']['reqBody'], config?: T }) =>
              fetch(prefix, prefix2, PATCH, option).send().then(r => r.body),
            $path: () => `${prefix}${prefix2}`
          }
        },
        get: (option?: { config?: T }) =>
          fetch<Methods0['get']['resBody']>(prefix, PATH0, GET, option).json(),
        $get: (option?: { config?: T }) =>
          fetch<Methods0['get']['resBody']>(prefix, PATH0, GET, option).json().then(r => r.body),
        $path: () => `${prefix}${PATH0}`
      }
    },
    normal: {
      awsiam: {
        accesskey: {
          get: (option?: { config?: T }) =>
            fetch<Methods3['get']['resBody']>(prefix, PATH2, GET, option).json(),
          $get: (option?: { config?: T }) =>
            fetch<Methods3['get']['resBody']>(prefix, PATH2, GET, option).json().then(r => r.body),
          post: (option?: { config?: T }) =>
            fetch<Methods3['post']['resBody']>(prefix, PATH2, POST, option).json(),
          $post: (option?: { config?: T }) =>
            fetch<Methods3['post']['resBody']>(prefix, PATH2, POST, option).json().then(r => r.body),
          delete: (option?: { config?: T }) =>
            fetch(prefix, PATH2, DELETE, option).send(),
          $delete: (option?: { config?: T }) =>
            fetch(prefix, PATH2, DELETE, option).send().then(r => r.body),
          $path: () => `${prefix}${PATH2}`
        },
        get: (option?: { config?: T }) =>
          fetch<Methods2['get']['resBody']>(prefix, PATH1, GET, option).json(),
        $get: (option?: { config?: T }) =>
          fetch<Methods2['get']['resBody']>(prefix, PATH1, GET, option).json().then(r => r.body),
        post: (option?: { config?: T }) =>
          fetch(prefix, PATH1, POST, option).send(),
        $post: (option?: { config?: T }) =>
          fetch(prefix, PATH1, POST, option).send().then(r => r.body),
        delete: (option?: { config?: T }) =>
          fetch(prefix, PATH1, DELETE, option).send(),
        $delete: (option?: { config?: T }) =>
          fetch(prefix, PATH1, DELETE, option).send().then(r => r.body),
        $path: () => `${prefix}${PATH1}`
      },
      role: {
        get: (option?: { config?: T }) =>
          fetch<Methods4['get']['resBody']>(prefix, PATH3, GET, option).json(),
        $get: (option?: { config?: T }) =>
          fetch<Methods4['get']['resBody']>(prefix, PATH3, GET, option).json().then(r => r.body),
        $path: () => `${prefix}${PATH3}`
      }
    }
  }
}

// prettier-ignore
export type ApiInstance = ReturnType<typeof api>
// prettier-ignore
export default api
