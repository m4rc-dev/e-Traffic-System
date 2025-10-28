const jwt = require('jsonwebtoken');
const { getFirebaseService } = require('../config/database');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const firebaseService = getFirebaseService();

    // Get user from database
    const user = await firebaseService.findById('users', decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'User account is deactivated'
      });
    }

    // Remove password from user object
    delete user.password;
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      });
    }

    next();
  };
};

const adminOnly = authorize('admin');
const enforcerOnly = authorize('enforcer');

module.exports = {
  protect,
  authorize,
  adminOnly,
  enforcerOnly
};
