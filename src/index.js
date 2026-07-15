require('dotenv').config()
require('./../config/redis') //just to test if redis is connected

const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const logger = require('./../middleware/logger')
const auth = require('./../middleware/auth')
const authRoutes = require('./../routes/auth')

const app = express()
app.use(express.json())
app.use(logger) // Use the logger middleware for all routes
// app.use(auth) // Use the auth middleware for all routes

app.get('/health', (req, res) => {
    res.json({ status: 'API Gateway is running' })
})

app.use('/auth', authRoutes) // Use the auth routes for /auth endpoints

// Proxy middleware for routing requests to different services
// What pathRewrite does: when a client hits /service-a/data, the gateway strips /service-a and forwards just /data to port 4001. The downstream service only ever sees /data — it doesn't know it's behind a gateway.
const serviceAProxy = createProxyMiddleware({
    target: 'http://localhost:4001',
    changeOrigin: true,
    pathRewrite: { '^/service-a': ''}
})

const serviceBProxy = createProxyMiddleware({
    target: 'http://localhost:4002',
    changeOrigin: true,
    pathRewrite: { '^/service-b': ''}
})

app.use('/service-a', auth, serviceAProxy)
app.use('/service-b', auth, serviceBProxy)

app.use((err, req, res, next) => {
    console.log(err.message)
    res.status(500).json({ error: err.message })
})

// Add a temporary route to confirm error handling works

// app.get('/error-test', (req, res, next) => {
//     next(new Error('error erooro eorrr'))
// })

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`)
})