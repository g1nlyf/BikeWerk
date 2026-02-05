import { Router } from 'express'

const testButtonRouter = Router()
testButtonRouter.get('/', (_req, res) => {
  res.json({ page: 'test-button', status: 'ok' })
})

export default testButtonRouter