const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  let password;
  try { ({ password } = JSON.parse(event.body || '{}')); }
  catch { return { statusCode: 400, body: 'Bad request' }; }

  if (password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  const token = crypto.createHmac('sha256', process.env.ADMIN_PASSWORD).update('session').digest('hex');
  return { statusCode: 200, body: JSON.stringify({ token }) };
};
