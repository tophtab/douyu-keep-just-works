import type express from 'express'
import { errorMessage } from './server-errors'

export type ErrorStatusResolver = (message: string, error: unknown) => number

export function sendJsonError(
  res: express.Response,
  error: unknown,
  resolveStatus: ErrorStatusResolver,
): void {
  const message = errorMessage(error)
  res.status(resolveStatus(message, error)).json({ error: message })
}

export async function sendJsonResult<T>(
  res: express.Response,
  run: () => Promise<T>,
  resolveErrorStatus: ErrorStatusResolver,
): Promise<void> {
  try {
    res.json(await run())
  } catch (error: unknown) {
    sendJsonError(res, error, resolveErrorStatus)
  }
}
