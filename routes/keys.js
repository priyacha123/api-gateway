const express = require('express')
const crypto = require('crypto')
const prisma = require('../config/prisma')
const router = express.Router({ mergeParams: true })

const FREE_KEY_LIMIT = 3
const FREE_RATE_LIMIT = 60
const PRO_RATE_LIMIT = 1000

const hashKey = (rawKey) => {
  return crypto.createHash('sha256').update(rawKey).digest('hex')
}

router.post('/', async (req, res, next) => {
  try {
    const { name, rateLimit } = req.body
    const { projectId } = req.params
    const userId = req.user.userId
    const plan = req.user.plan

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { _count: { select: { apiKeys: true } } }
    })

    if (!project) {
      return res.status(404).json({ error: 'project not found' })
    }

    if (plan === 'FREE' && project._count.apiKeys >= FREE_KEY_LIMIT) {
      return res.status(403).json({
        error: `FREE plan is limited to ${FREE_KEY_LIMIT} keys per project. Upgrade to PRO for unlimited keys.`
      })
    }

    const maxRateLimit = plan === 'PRO' ? PRO_RATE_LIMIT : FREE_RATE_LIMIT
    const resolvedRateLimit = Math.min(rateLimit || 60, maxRateLimit)

    const rawKey = 'gk_live_' + crypto.randomBytes(32).toString('hex')
    const keyPrefix = rawKey.substring(0, 16)
    const keyHash = hashKey(rawKey)

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name || 'My API Key',
        keyHash,
        keyPrefix,
        rateLimit: resolvedRateLimit,
        projectId
      }
    })

    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      rateLimit: apiKey.rateLimit,
      createdAt: apiKey.createdAt,
      warning: 'Store this key securely. It will not be shown again.'
    })
  } catch (err) {
    next(err)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.params
    const userId = req.user.userId

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })

    if (!project) {
      return res.status(404).json({ error: 'project not found' })
    }

    const keys = await prisma.apiKey.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(keys)
  } catch (err) {
    next(err)
  }
})

router.delete('/:keyId', async (req, res, next) => {
  try {
    const { projectId, keyId } = req.params
    const userId = req.user.userId

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    })

    if (!project) {
      return res.status(404).json({ error: 'project not found' })
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false }
    })

    res.json({ message: 'API key revoked successfully' })
  } catch (err) {
    next(err)
  }
})

module.exports = router