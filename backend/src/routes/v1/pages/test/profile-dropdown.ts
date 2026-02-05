import { Router } from 'express'

const testProfileDropdownRouter = Router()
testProfileDropdownRouter.get('/', (_req, res) => {
  res.json({ page: 'test-profile-dropdown', status: 'ok' })
})

export default testProfileDropdownRouter