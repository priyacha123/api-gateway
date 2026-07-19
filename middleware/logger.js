const morgan = require('morgan');
const prisma = require('../config/prisma')
const { randomUUID } = require('crypto')

const httpLogger = morgan((tokens, req, res) => {
    return [
        `[${new Date().toISOString()}]`,
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), 'ms'
    ].join(' ')
})

const traceMiddleware = (req, res, next) => {
    req.traceId = randomUUID()
    res.setHeader('X-Trace-Id', req.traceId)
    next()
}

const dbLogger = async (req, res, next) => {
    const start = Date.now()

    res.on('finish', async () => {
        try {
            if(req.user && req.path !== '/health') {
                await prisma.requestLog.create({
                    data: {
                        userId:       req.user.userId,
                        route:        req.path,
                        method:       req.method,
                        statusCode:   res.statusCode,
                        responseTime: Date.now() - start
                    }
                })
            }
        } catch (err) {
            console.error('DB log error:', err.message)
        }
    })
    next()
}

module.exports = {httpLogger, traceMiddleware, dbLogger}