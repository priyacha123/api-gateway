const express = require('express')
const prisma = require('../config/prisma')
const router = express.Router()

const FREE_PROJECT_LIMIT = 10
const PRO_PROJECT_LIMIT = Infinity

router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body
    const userId = req.user.userId
    const plan = req.user.plan

    if (!name) {
      return res.status(400).json({ error: 'project name is required' })
    }

    const projectCount = await prisma.project.count({ where: { userId } })
    const limit = plan === 'PRO' ? PRO_PROJECT_LIMIT : FREE_PROJECT_LIMIT

    if (projectCount >= limit) {
      return res.status(403).json({
        error: `FREE plan is limited to ${FREE_PROJECT_LIMIT} projects. Upgrade to PRO for unlimited projects.`
      })
    }

    const project = await prisma.project.create({
      data: { name, description, userId }
    })

    res.status(201).json(project)
  } catch (err) {
    next(err)
  }
})

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.userId

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: { select: { apiKeys: true } }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(projects)
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        apiKeys: {
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'project not found' })
    }

    res.json(project)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const userId = req.user.userId

    const project = await prisma.project.findFirst({
      where: { id, userId }
    })

    if (!project) {
      return res.status(404).json({ error: 'project not found' })
    }

    await prisma.project.delete({ where: { id } })
    res.json({ message: 'project deleted' })
  } catch (err) {
    next(err)
  }
})

module.exports = router