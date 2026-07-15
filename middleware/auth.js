const jwt = require('jsonwebtoken')

const auth = (req, res, next) => {
    const authHeader = req.headers['authorization']

    if(!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'missing or invalid authorization header' })
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()
    }
    catch(err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' })
        }
        return res.status(401).json({ error: 'Invalid token' })
    }
}

module.exports = auth