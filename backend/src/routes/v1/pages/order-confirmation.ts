import { Router } from 'express'

const orderConfirmationRouter = Router()
// Без параметра
orderConfirmationRouter.get('/', (_req, res) => {
  res.json({ page: 'order-confirmation', orderId: null, status: 'ok' })
})
// С параметром orderId
orderConfirmationRouter.get('/:orderId', (req, res) => {
  res.json({ page: 'order-confirmation', orderId: req.params.orderId, status: 'ok' })
})

export default orderConfirmationRouter