export function jsonWithAuthCookies(authResponse: Response, body: unknown, status = 200) {
  const headers = new Headers()
  const withCookies = authResponse.headers as Headers & {
    getSetCookie?: () => string[]
  }
  const cookies = withCookies.getSetCookie?.() ?? []

  if (cookies.length > 0) {
    for (const cookie of cookies) headers.append('set-cookie', cookie)
  } else {
    const cookie = authResponse.headers.get('set-cookie')
    if (cookie) headers.append('set-cookie', cookie)
  }

  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

export function authErrorResponse(error: unknown) {
  const candidate = error as {
    status?: number
    body?: { message?: string; code?: string }
    message?: string
  }
  const message =
    candidate.body?.message ??
    candidate.message ??
    'No pudimos completar la operación con tu cuenta.'

  return {
    status: typeof candidate.status === 'number' ? candidate.status : 400,
    message,
  }
}
