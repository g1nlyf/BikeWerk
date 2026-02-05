import { Router } from 'express'

const cartRouter = Router()
cartRouter.get('/', (_req, res) => {
  res.json({ page: 'cart', status: 'ok' })
})

export default cartRouter