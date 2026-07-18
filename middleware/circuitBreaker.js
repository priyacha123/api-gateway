const redis = require('./../config/redis')

const THRESHOLD = 5
const COOLDOWN = 10

const getState = async (service) => {
    const state = await redis.get(`cb:state:${service}`)
    return state || 'CLOSED'
}

const getFailures = async (service) => {
    const failures = await redis.get(`cb:failures:${service}`)
    return parseInt(failures || '0')
}

const setState = async (service, state) => {
    await redis.set(`cb:state:${service}`, state)
}

const incrementFailures = async (service) => {
    const key = `cb:failures:${service}`
    const count = await redis.incr(key)
    await redis.expire(key, COOLDOWN)
    return count
}

const resetFailures = async (service) => {
    await redis.del(`cb:failures:${service}`)
}

const circuitBreaker = (service) => {
    return async (req, res, next) => {
        try {
            const state = await getState(service)

            if (state === 'OPEN') {
                return res.status(503).json({
                    error: 'service unavailable',
                    reason: 'circuit breaker open',
                    service: service,
                    message: 'downstream service is failing, try again shortly'
                })
            }

            if (state == 'HALF-OPEN') {
                await setState(service, 'HALF-OPEN-PROBING')
            }

            res.on('finish', async() => {
                const status = res.statusCode

                if(status >= 500) {
                    const failures = await incrementFailures(service)
                    console.log(`[CB] ${service} failure count: ${failures}`)

                    if (failures >= THRESHOLD) {
                        await setState(service, 'OPEN')
                        console.log(`[CB] ${service} circuit OPENED`)

                    setTimeout(async () => {
                        await setState(service, 'HALF-OPEN')
                        console.log(`[CB] ${service} circuit HALF-OPEN (cooldown expired)`)
                    }, COOLDOWN * 1000)
                }
            }           
            else if (state === 'HALF-OPEN' || state === 'HALF-OPEN-PROBING') {
                await resetFailures(service)
                await setState(service, 'CLOSED')
                console.log(`[CB] ${service} circuit CLOSED (probe succeeded)`)
            }
        })
        next()
        }
        catch (err) {
            next(err)
        }
    }
}

module.exports = circuitBreaker