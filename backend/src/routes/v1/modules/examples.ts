import { Router } from 'express'
import { getExamples, createExample } from '../../../controllers/exampleController'

const router = Router()

// GET /api/v1/examples
router.get('/', async (_req, res, next) => {
  try {
    const data = await getExamples()
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/examples
router.post('/', async (req, res, next) => {
  try {
    const created = await createExample(req.body)
    res.status(201).json({ data: created })
  } catch (err) {
    next(err)
  }
})

export default router