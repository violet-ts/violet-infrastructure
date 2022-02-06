/* eslint-disable */
// prettier-ignore
export const pagesPath = {
  aws: {
    $url: (url?: { hash?: string }) => ({ pathname: '/aws' as const, hash: url?.hash })
  },
  users: {
    $url: (url?: { hash?: string }) => ({ pathname: '/users' as const, hash: url?.hash })
  },
  $url: (url?: { hash?: string }) => ({ pathname: '/' as const, hash: url?.hash })
}

// prettier-ignore
export type PagesPath = typeof pagesPath
