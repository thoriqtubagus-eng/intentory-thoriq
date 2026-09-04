const { authenticate, jsonError } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticate(req);

    if (!user) {
      return jsonError(res, 401, 'Invalid or expired token');
    }

    const { password: _, ...userWithoutPassword } = user;

    return res.status(200).json(userWithoutPassword);
  } catch (error) {
    console.error('Auth check error:', error);
    return jsonError(res, 401, 'Invalid or expired token');
  }
};
