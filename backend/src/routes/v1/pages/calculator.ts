import { Router } from 'express'

const calculatorRouter = Router()
calculatorRouter.get('/', (_req, res) => {
  res.json({ page: 'calculator', status: 'ok' })
})

export default calculatorRouter