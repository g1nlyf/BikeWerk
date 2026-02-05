import { Router } from 'express'

const mobileTestRouter = Router()
mobileTestRouter.get('/', (_req, res) => {
  res.json({ page: 'mobile-test', status: 'ok' })
})

export default mobileTestRouter