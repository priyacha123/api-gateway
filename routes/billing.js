const express = require('express')
const crypto = require('crypto')
const prisma = require('../config/prisma')
const razorpay = require('../config/razorpay')
const router = express.Router()

// GET /billing/status
router.get('/status', async (req, res, next) => {
  try {
    const userId = req.user.userId

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        plan: true,
        subscriptionStatus: true,
        razorpaySubscriptionId: true,
        email: true,
        _count: { select: { projects: true } }
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
      FREE: { projects: 2, keysPerProject: 3, rateLimit: 60 },
      PRO:  { projects: 'unlimited', keysPerProject: 'unlimited', rateLimit: 1000 }
    }

    res.json({
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      razorpaySubscriptionId: user.razorpaySubscriptionId,
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

// POST /billing/create-subscription
router.post('/create-subscription', async (req, res, next) => {
  try {
    const userId = req.user.userId

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (user.plan === 'PRO') {
      return res.status(400).json({ error: 'already on PRO plan' })
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PRO_PLAN_ID,
      customer_notify: 1,
      total_count: 12,
      notes: {
        userId: userId,
        email: user.email
      }
    })

    await prisma.user.update({
      where: { id: userId },
      data: { razorpaySubscriptionId: subscription.id }
    })

    res.json({
      subscriptionId: subscription.id,
      keyId: process.env.RAZORPAY_KEY_ID
    })
  } catch (err) {
    next(err)
  }
})

// POST /billing/verify-payment
router.post('/verify-payment', async (req, res, next) => {
  try {
    const userId = req.user.userId
    const {
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature
    } = req.body

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
      .digest('hex')

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: 'invalid payment signature' })
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'PRO',
        subscriptionStatus: 'ACTIVE',
        razorpaySubscriptionId: razorpay_subscription_id
      }
    })

    res.json({
      message: 'payment verified, upgraded to PRO',
      plan: 'PRO'
    })
  } catch (err) {
    next(err)
  }
})

// POST /billing/cancel-subscription
router.post('/cancel-subscription', async (req, res, next) => {
  try {
    const userId = req.user.userId

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (user.plan === 'FREE') {
      return res.status(400).json({ error: 'already on FREE plan' })
    }

    if (user.razorpaySubscriptionId) {
      await razorpay.subscriptions.cancel(
        user.razorpaySubscriptionId,
        { cancel_at_cycle_end: 1 }
      )
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: 'FREE',
        subscriptionStatus: 'CANCELLED'
      }
    })

    res.json({
      message: 'subscription cancelled, downgraded to FREE',
      plan: 'FREE'
    })
  } catch (err) {
    next(err)
  }
})

// POST /billing/webhook — Razorpay webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET
    const signature = req.headers['x-razorpay-signature']

    const generated = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex')

    if (generated !== signature) {
      return res.status(400).json({ error: 'invalid webhook signature' })
    }

    const event = JSON.parse(req.body)

    switch (event.event) {
      case 'subscription.activated':
        await prisma.user.updateMany({
          where: { razorpaySubscriptionId: event.payload.subscription.entity.id },
          data: { plan: 'PRO', subscriptionStatus: 'ACTIVE' }
        })
        break

      case 'subscription.cancelled':
        await prisma.user.updateMany({
          where: { razorpaySubscriptionId: event.payload.subscription.entity.id },
          data: { plan: 'FREE', subscriptionStatus: 'CANCELLED' }
        })
        break

      case 'subscription.halted':
        await prisma.user.updateMany({
          where: { razorpaySubscriptionId: event.payload.subscription.entity.id },
          data: { subscriptionStatus: 'PAST_DUE' }
        })
        break
    }

    res.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router