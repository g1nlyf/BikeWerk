import { Router } from 'express'

const aiChatRouter = Router()
aiChatRouter.get('/', (_req, res) => {
  res.json({ page: 'ai-chat', status: 'ok' })
})

export default aiChatRouter