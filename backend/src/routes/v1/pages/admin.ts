import { Router } from 'express'

const adminRouter = Router()
adminRouter.get('/', (_req, res) => {
  res.json({ page: 'admin-panel', status: 'ok' })
})

export default adminRouter