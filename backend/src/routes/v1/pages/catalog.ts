import { Router } from 'express'

const catalogRouter = Router()
catalogRouter.get('/', (_req, res) => {
  res.json({ page: 'catalog', status: 'ok' })
})

export default catalogRouter