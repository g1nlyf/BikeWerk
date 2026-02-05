import { Router } from 'express'

const checkoutRouter = Router()
checkoutRouter.get('/', (_req, res) => {
  res.json({ page: 'checkout', status: 'ok' })
})

export default checkoutRouter