import { Router } from 'express'

const performanceTestRouter = Router()
performanceTestRouter.get('/', (_req, res) => {
  res.json({ page: 'performance-test', status: 'ok' })
})

export default performanceTestRouter