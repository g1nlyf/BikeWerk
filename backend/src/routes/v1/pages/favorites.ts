import { Router } from 'express'

const favoritesRouter = Router()
favoritesRouter.get('/', (_req, res) => {
  res.json({ page: 'favorites', status: 'ok' })
})

export default favoritesRouter