export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'EU Bike Finals API',
    version: '1.0.0',
    description: 'Initial OpenAPI for versioned endpoints',
  },
  servers: [
    { url: 'http://localhost:8080', description: 'Local server' },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string' } },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/examples': {
      get: {
        summary: 'List examples',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Example' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create example',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Example' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/Example' } },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Example: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
}