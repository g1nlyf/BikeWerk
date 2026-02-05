import { Router } from 'express'

const homeRouter = Router()
homeRouter.get('/', (_req, res) => {
  res.json({ page: 'home', status: 'ok' })
})

export default homeRouter