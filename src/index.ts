import { Command } from '@gosen/command-types'
import { resolve, VersionMismatchError } from '@gosen/run-resolver'

export const versionKey = '__GOSEN_PAGE_VERSION__'

type RequestOptions = {
  version?: string
  retries?: number
  window?: Window
} & Omit<RequestInit, 'window'>

type RequestResult = {
  version: string
  url: string
  commands: Command[]
}

const request = async (url: string, options?: RequestOptions): Promise<RequestResult> => {
  const { version: optionsVersion, retries = 1, window: w = window, ...init } = options || {}
  const version = optionsVersion || w[versionKey] || ''

  let query = 'format=json'
  if (version) {
    query += `&version=${version}`
  }

  if (url.includes('?')) {
    query = `&${query}`
  } else {
    query = `?${query}`
  }

  const res = await fetch(`${url}${query}`, init)
  const finalURL = res.url.replace(query, '')
  const result = await res.json()

  if (result.error === 'VERSION_MISMATCH') {
    if (retries > 0) {
      return await request(finalURL, {
        ...options,
        retries: retries - 1,
        version: result.serverVersion,
      })
    }

    throw new VersionMismatchError(result.serverVersion)
  }

  if (!Array.isArray(result)) {
    return {
      commands: [],
      version,
      url: finalURL,
    }
  }

  try {
    return {
      commands: await resolve(result, version),
      version,
      url: finalURL,
    }
  } catch (err) {
    if (err instanceof VersionMismatchError) {
      if (retries > 0) {
        return await request(url, {
          ...options,
          retries: retries - 1,
          version: err.serverVersion,
        })
      }
    }

    throw err
  }
}

export { Command, VersionMismatchError, RequestOptions, RequestResult }
export default request
