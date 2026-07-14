require('dotenv').config()
require('./../config/redis') //just to test if redis is connected

const express = require('express')
const app = express()

app.use(express.json())

app.get('/health', (req, res) => {
    res.json({ status: 'API Gateway is running' })
})



const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log(`API Gateway is running on port ${PORT}`)
})