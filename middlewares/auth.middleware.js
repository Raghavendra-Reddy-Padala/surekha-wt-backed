const requireApiKey = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
        return res.status(401).json({ 
            success: false, 
            error: "Unauthorized: Invalid or missing API key" 
        });
    }
    next();
};

module.exports = requireApiKey;