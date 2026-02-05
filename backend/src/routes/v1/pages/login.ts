import { Router } from 'express'

const loginRouter = Router()
loginRouter.get('/', (_req, res) => {
  res.json({ page: 'login', status: 'ok' })
})

export default loginRouter