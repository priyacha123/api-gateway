const redis = require('./../config/redis')

const PLANS = {
    FREE: { limit: 10, window: 60 },
    PRO: { limit: 100, window: 60 },
}

const rateLimiter = async (req, res, next) => {
    try {
        const userId = req.user.userId
        const plan = req.user.plan
        const { limit, window } = PLANS[plan] || PLANS.FREE

        const key = `rate:${userId}`
        const now = Date.now()
        const windowStart = now - window * 1000

        await redis.zadd(key, now, now.toString())
        await redis.zremrangebyscore(key, 0, windowStart)
        await redis.expire(key, window)

        const count = await redis.zcard(key)

        res.setHeader('X-RateLimit-Limit', limit)
        res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count))
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + window * 1000) / 1000))

        if (count > limit) {
            return res.status(429).json({
                error: 'rate limit exceeded',
                retryAfter: window,
                plan: plan,
                limit: limit
            })
        }

        next()
    }
    catch (err) {
        next(err)
    }
}

module.exports = rateLimiter