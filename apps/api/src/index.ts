import { app } from './app'
import type { AppEnv } from './env'
import { runScheduledExchangeRateSync } from './jobs/exchange-rate'

export type { AppEnv }

export default {
  fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    return app.fetch(request, env, ctx)
  },
  async scheduled(controller: ScheduledController, env: AppEnv['Bindings']) {
    await runScheduledExchangeRateSync(controller, env)
  },
}
