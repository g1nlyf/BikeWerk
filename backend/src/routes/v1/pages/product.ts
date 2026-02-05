import { Router } from 'express'

const productRouter = Router()
// Без параметра
productRouter.get('/', (_req, res) => {
  res.json({ page: 'product-detail', id: null, status: 'ok' })
})
// С параметром id
productRouter.get('/:id', (req, res) => {
  res.json({ page: 'product-detail', id: req.params.id, status: 'ok' })
})

export default productRouter