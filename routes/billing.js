const express = require('express')
const prisma = require('../config/prisma')
const router = express.Router()

router.get('/status', async (req, res, next) => {
  try {
    const userId = req.user.userId

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        email: true,
        _count: {
          select: { projects: true }
        }
      }
    })

    const projectsWithKeys = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: { select: { apiKeys: { where: { isActive: true } } } }
      }
    })

    const totalActiveKeys = projectsWithKeys.reduce(
      (sum, p) => sum + p._count.apiKeys, 0
    )

    const limits = {
      FREE: { projects: 10, keysPerProject: 3, rateLimit: 60 },
      PRO:  { projects: 'unlimited', keysPerProject: 'unlimited', rateLimit: 1000 }
    }

    res.json({
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      usage: {
        projects: user._count.projects,
        activeKeys: totalActiveKeys
      },
      limits: limits[user.plan]
    })
  } catch (err) {
    next(err)
  }
})

router.post('/upgrade', async (req, res, next) => {
  try {
    const userId = req.user.userId

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (user.plan === 'PRO') {
      return res.status(400).json({ error: 'already on PRO plan' })
    }

    // TODO: replace with Razorpay/Stripe checkout in production
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'PRO',
        subscriptionStatus: 'ACTIVE'
      }
    })

    res.json({
      message: 'upgraded to PRO successfully',
      plan: 'PRO',
      subscriptionStatus: 'ACTIVE'
    })
  } catch (err) {
    next(err)
  }
})

router.post('/downgrade', async (req, res, next) => {
  try {
    const userId = req.user.userId

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (user.plan === 'FREE') {
      return res.status(400).json({ error: 'already on FREE plan' })
    }

    // TODO: replace with Razorpay/Stripe cancel subscription in production
    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'FREE',
        subscriptionStatus: 'INACTIVE'
      }
    })

    res.json({
      message: 'downgraded to FREE plan',
      plan: 'FREE',
      subscriptionStatus: 'INACTIVE'
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router