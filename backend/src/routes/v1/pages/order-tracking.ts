import { Router } from 'express'

const orderTrackingRouter = Router()
// Без параметра
orderTrackingRouter.get('/', (_req, res) => {
  res.json({ page: 'order-tracking', orderId: null, status: 'ok' })
})
// С параметром orderId
orderTrackingRouter.get('/:orderId', (req, res) => {
  res.json({ page: 'order-tracking', orderId: req.params.orderId, status: 'ok' })
})

export default orderTrackingRouter