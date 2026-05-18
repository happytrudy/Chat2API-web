/**
 * Management API Routes Index
 * Exports all management route modules
 */

import authRouter from './auth'
import configRouter from './config'
import providersRouter from './providers'
import accountsRouter from './accounts'
import apiKeysRouter from './apiKeys'
import modelMappingsRouter from './modelMappings'
import sessionsRouter from './sessions'
import statisticsRouter from './statistics'
import proxyRouter from './proxy'
import toolCallingRouter from './toolCalling'
import oauthRouter from './oauth/index'
import logsRouter from './logs'
import promptsRouter from './prompts'
import appRouter from './app'

export {
  authRouter,
  configRouter,
  providersRouter,
  accountsRouter,
  apiKeysRouter,
  modelMappingsRouter,
  sessionsRouter,
  statisticsRouter,
  proxyRouter,
  toolCallingRouter,
  oauthRouter,
  logsRouter,
  promptsRouter,
  appRouter,
}

export default [
  // The auth router has to come first so its public endpoints are matched
  // before any other middleware (and so the SPA can reach /auth/status
  // even when the rest of the management API is not yet configured).
  authRouter,
  configRouter,
  providersRouter,
  accountsRouter,
  apiKeysRouter,
  modelMappingsRouter,
  sessionsRouter,
  statisticsRouter,
  proxyRouter,
  toolCallingRouter,
  oauthRouter,
  logsRouter,
  promptsRouter,
  appRouter,
]
