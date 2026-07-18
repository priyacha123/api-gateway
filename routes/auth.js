const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const prisma = require('./../config/prisma')

const router = express.Router()

router.post('/register', async (req, res, next) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' })

        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' })
        }

        // Check if the user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } })

        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' })
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create a new user
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: hashedPassword
            }
        })

        res.status(201).json({ 
            message: 'User registered successfully', 
            userId: user.id,
            plan: user.plan
        })
    }
    catch (error) {
        next(error)
    }
})

router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' })
        }

        // Find the user by email
        const user = await prisma.user.findUnique({ where: { email } })

        if (!user) {
            return res.status(404).json({ error: 'User not found' })
        }

        // Check if the password is correct
        const valid = await bcrypt.compare(password, user.passwordHash)

        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' })
        }

        // Generate a JWT token
        const token = jwt.sign({ 
            userId: user.id, plan: user.plan }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1h' }
        )

        res.json({ token, plan: user.plan })
    }
    catch (error) {
        next({ error: error.message })
    }
})

module.exports = router