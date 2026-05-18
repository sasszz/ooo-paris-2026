const BIN_ID  = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

exports.handler = async (event) => {
  console.log('BIN_ID present:', !!BIN_ID, '| KEY present:', !!API_KEY, '| KEY prefix:', API_KEY ? API_KEY.slice(0, 6) : 'none');

  const base = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const headers = { 'X-Master-Key': API_KEY, 'Content-Type': 'application/json' };

  if (event.httpMethod === 'GET') {
    const r = await fetch(`${base}/latest`, { headers });
    const text = await r.text();
    console.log('GET status:', r.status, '| body:', text.slice(0, 200));
    if (!r.ok) return { statusCode: r.status, body: text };
    const data = JSON.parse(text);
    return {
      statusCode: 200,
      body: JSON.stringify((data.record && data.record.checkins) || [])
    };
  }

  if (event.httpMethod === 'PUT') {
    const r = await fetch(base, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ checkins: JSON.parse(event.body) })
    });
    const text = await r.text();
    console.log('PUT status:', r.status, '| body:', text.slice(0, 200));
    return { statusCode: r.status, body: text };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
