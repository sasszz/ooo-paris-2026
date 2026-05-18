const BIN_ID  = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

exports.handler = async (event) => {
  const base = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const headers = { 'X-Master-Key': API_KEY, 'Content-Type': 'application/json' };

  if (event.httpMethod === 'GET') {
    const r = await fetch(`${base}/latest`, { headers });
    if (!r.ok) return { statusCode: r.status, body: await r.text() };
    const data = await r.json();
    return {
      statusCode: 200,
      body: JSON.stringify((data.record && data.record.checkins) || [])
    };
  }

  if (event.httpMethod === 'PUT') {
    if (event.headers['x-admin-password'] !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
    const r = await fetch(base, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ checkins: JSON.parse(event.body) })
    });
    return { statusCode: r.status, body: '{}' };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
