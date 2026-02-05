import { Router } from 'express'

const bikeSelectionRouter = Router()
bikeSelectionRouter.get('/', (_req, res) => {
  res.json({ page: 'bike-selection', status: 'ok' })
})

export default bikeSelectionRouter