require('dotenv').config()
require('./../config/redis') //just to test if redis is connected

// testing redis connection
// const redis = require('./../config/redis') //just to test if redis is connected

// redis.set('test', 'hello')
// redis.get('test').then(val => console.log('Redis Test:', val))

const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const { httpLogger, traceMiddleware ,dbLogger} = require('./../middleware/logger')
const auth = require('./../middleware/auth')
const authRoutes = require('./../routes/auth')
const rateLimiter = require('../middleware/rateLimiter')
const circuitBreaker = require('../middleware/circuitBreaker')

const app = express()
app.use(express.json())
app.use(traceMiddleware) // Use the trace middleware for all routes
app.use(httpLogger) // Use the logger middleware for all routes

app.get('/health', (req, res) => { 
    res.json({ status: 'API Gateway is running', traceId: req.traceId })
})

app.use('/auth', authRoutes) // Use the auth routes for /auth endpoints

// Proxy middleware for routing requests to different services
// What pathRewrite does: when a client hits /service-a/data, the gateway strips /service-a and forwards just /data to port 4001. The downstream service only ever sees /data — it doesn't know it's behind a gateway.
const serviceAProxy = createProxyMiddleware({
    target: 'http://localhost:4001',
    changeOrigin: true,
    pathRewrite: { '^/service-a': ''},
    on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('X-Trace-Id', req.traceId)
    }
  }
})

const serviceBProxy = createProxyMiddleware({
    target: 'http://localhost:4002',
    changeOrigin: true,
    pathRewrite: { '^/service-b': ''},
    on: {
    proxyReq: (proxyReq, req) => {
      proxyReq.setHeader('X-Trace-Id', req.traceId)
    }
  }
})

// Order is now: auth → rateLimiter → circuitBreaker → proxy
app.use('/service-a', auth, dbLogger, rateLimiter, circuitBreaker('service-a'), serviceAProxy)
app.use('/service-b', auth, dbLogger, rateLimiter, circuitBreaker('service-b'), serviceBProxy)

app.use((err, req, res, next) => {
    console.log(`[${req.traceId}] ${err.message}`)
    res.status(500).json({ error: err.message, traceId: req.traceId })
})

// Add a temporary route to confirm error handling works
// app.get('/error-test', (req, res, next) => {
//     next(new Error('error erooro eorrr'))
// })

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`)
})