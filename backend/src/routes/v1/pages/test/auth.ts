import { Router } from 'express'

const testAuthRouter = Router()
testAuthRouter.get('/', (_req, res) => {
  res.json({ page: 'test-auth', status: 'ok' })
})

export default testAuthRouter