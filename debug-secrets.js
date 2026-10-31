const https = require('https');
const sodium = require('libsodium-wrappers');

const GH_PAT = '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';
const REPO_OWNER = 'hendryriwa-png';
const REPO_NAME = 'jenganasi-tanzania';

function githubApi(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${GH_PAT}`,
        'User-Agent': 'JengaNasi-Secrets',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          const url = new URL(redirectUrl);
          const redirectOptions = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: options.headers
          };
          const redirectReq = https.request(redirectOptions, (redirectRes) => {
            handleResponse(redirectRes, resolve, reject);
          });
          redirectReq.on('error', reject);
          if (data) redirectReq.write(JSON.stringify(data));
          redirectReq.end();
          return;
        }
      }
      handleResponse(res, resolve, reject);
    });

    function handleResponse(res, resolve, reject) {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : {});
        } else {
          reject(new Error(`${method} ${endpoint}: ${res.statusCode} - ${body}`));
        }
      });
    }

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function test() {
  await sodium.ready;
  
  const keyData = await githubApi('/actions/secrets/public-key', 'GET');
  console.log('Public key response:', JSON.stringify(keyData, null, 2));
  
  const { key, key_id } = keyData;
  
  // Try different decoding methods
  console.log('\nTrying Buffer.from base64...');
  const buf = Buffer.from(key, 'base64');
  console.log('Buffer length:', buf.length);
  console.log('Buffer:', buf);
  
  // Try sodium.from_base64 with different variants
  console.log('\nTrying sodium.from_base64...');
  try {
    const pk = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    console.log('ORIGINAL:', pk.length);
  } catch (e) {
    console.log('ORIGINAL failed:', e.message);
  }
  
  try {
    const pk = sodium.from_base64(key, sodium.base64_variants.ORIGINAL_NO_PADDING);
    console.log('ORIGINAL_NO_PADDING:', pk.length);
  } catch (e) {
    console.log('ORIGINAL_NO_PADDING failed:', e.message);
  }
  
  try {
    const pk = sodium.from_base64(key);
    console.log('DEFAULT:', pk.length);
  } catch (e) {
    console.log('DEFAULT failed:', e.message);
  }
  
  // Use Buffer for the key
  const publicKey = buf;
  const testValue = 'test-secret-value';
  const message = sodium.from_string(testValue);
  
  console.log('\nPublic key bytes:', publicKey.length, '(expected 32)');
  console.log('Message bytes:', message.length);
  
  try {
    const encrypted = sodium.crypto_box_seal(message, publicKey);
    console.log('Encrypted bytes:', encrypted.length);
    console.log('Encrypted base64:', sodium.to_base64(encrypted));
  } catch (e) {
    console.error('Encryption error:', e.message);
  }
}

test().catch(console.error);