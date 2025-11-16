const jwt = require('jsonwebtoken');
const SECRET = process.env.SECRET;

const JWTAuth = (req, res, next) => {
  try {
    let token = req?.headers?.['Authorization'];

    if (!token) {
      return res.status(403).json({
        status: false,
        message: 'Access denied',
        error: 'Empty',
      });
    }

    return jwt.verify(token, SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({
          status: false,
          message: 'Access denied',
          error: err?.message,
        });
      }

      req.user = user;
      return next();
    });
  } catch (error) {
    res.status(400).json({
      status: false,
      message: 'Invalid token',
      error: error?.message,
    });
  }
};

module.exports = JWTAuth;
