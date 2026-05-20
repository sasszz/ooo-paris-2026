const crypto  = require('crypto');
const BIN_ID  = process.env.JSONBIN_JAR_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;

exports.handler = async (event) => {
  const base = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
  const headers = { 'X-Master-Key': API_KEY, 'Content-Type': 'application/json' };

  if (event.httpMethod === 'GET') {
    const r = await fetch(`${base}/latest`, { headers });
    if (!r.ok) return { statusCode: r.status, body: await r.text() };
    const data = await r.json();
    return { statusCode: 200, body: JSON.stringify((data.record && data.record.positions) || []) };
  }

  if (event.httpMethod === 'POST') {
    const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const today = new Date().toISOString().slice(0, 10);
    const ipHash = crypto.createHash('sha256').update(ip + today).digest('hex').slice(0, 16);

    const getR = await fetch(`${base}/latest`, { headers });
    if (!getR.ok) return { statusCode: getR.status, body: await getR.text() };
    const data = await getR.json();
    const positions = (data.record && data.record.positions) || [];
    const todayDrops = (data.record && data.record.dailyDrops && data.record.dailyDrops[today]) || [];

    if (todayDrops.includes(ipHash)) {
      return { statusCode: 429, body: 'Already dropped today' };
    }

    positions.push(JSON.parse(event.body));
    const putR = await fetch(base, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ positions, dailyDrops: { [today]: [...todayDrops, ipHash] } })
    });
    if (!putR.ok) return { statusCode: putR.status, body: await putR.text() };
    return { statusCode: 200, body: JSON.stringify(positions) };
  }

  return { statusCode: 405, body: 'Method not allowed' };
};
