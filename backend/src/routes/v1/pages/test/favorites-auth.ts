import { Router } from 'express'

const testFavoritesAuthRouter = Router()
testFavoritesAuthRouter.get('/', (_req, res) => {
  res.json({ page: 'test-favorites-auth', status: 'ok' })
})

export default testFavoritesAuthRouter