import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import swaggerUi from 'swagger-ui-express'
import { openApiDocument } from './docs/openapi'
import healthRouter from './routes/health'
import v1Router from './routes/v1'

dotenv.config()

const app = express()
const PORT = Number(process.env.PORT) || 8080
const FRONTEND_ORIGIN = process.env.VITE_ORIGIN || 'http://localhost:5173'

app.use(express.json())
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
)

// Health check
app.use(healthRouter)

// Versioned API
app.use('/api/v1', v1Router)

// Swagger docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument))
// Raw OpenAPI for generators
app.get('/api/openapi.json', (_req, res) => {
  res.json(openApiDocument)
})

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`)
  console.log(`Swagger docs available at http://localhost:${PORT}/api/docs`)
})

export default app