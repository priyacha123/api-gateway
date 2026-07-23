const crypto = require('crypto')
const prisma = require('../config/prisma')

const hashKey = (rawKey) => {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

const apiKeyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const apiKeyHeader = req.headers['x-api-key']

    const rawKey = apiKeyHeader || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null)

    if (!rawKey) {
      return res.status(401).json({ error: 'API key required. Pass via X-API-Key header or Authorization: Bearer <key>' })
    }

    if (!rawKey.startsWith('gk_live_')) {
      return res.status(401).json({ error: 'invalid API key format' })
    }

    const keyHash = hashKey(rawKey)

    const apiKey = await prisma.apiKey.findFirst({
      where: { keyHash, isActive: true },
      include: {
        project: {
          include: { user: true }
        }
      }
    })

    if (!apiKey) {
      return res.status(401).json({ error: 'invalid or revoked API key' })
    }

    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    })

    req.apiKey = apiKey
    req.project = apiKey.project
    req.user = {
      userId: apiKey.project.user.id,
      plan: apiKey.project.user.plan
    }

    next()
  } catch (err) {
    next(err)
  }
}

module.exports = apiKeyAuth