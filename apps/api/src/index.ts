import { app } from './app'
import type { AppEnv } from './env'

export type { AppEnv }

export default {
  fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    return app.fetch(request, env, ctx)
  },
}
