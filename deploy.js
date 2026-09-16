const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = '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';
const REPO_OWNER = 'hendryriwa-png';
const REPO_NAME = 'jenganasi-tanzania';

async function githubApi(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}${endpoint}`,
      method,
      headers: {
        'Authorization': `token ${TOKEN}`,
        'User-Agent': 'JengaNasi-Deploy',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : {});
        } else {
          reject(new Error(`${method} ${endpoint}: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function enablePages() {
  try {
    await githubApi('/pages', 'POST', {
      source: { branch: 'main', path: '/' }
    });
    console.log('GitHub Pages enabled');
  } catch (e) {
    if (!e.message.includes('already')) {
      console.log('Pages:', e.message);
    }
  }
}

async function uploadFile(filePath, repoPath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const encoded = Buffer.from(content).toString('base64');
  
  // Check if file exists
  let sha = null;
  try {
    const existing = await githubApi(`/contents/${repoPath}`, 'GET');
    sha = existing.sha;
  } catch (e) {
    // File doesn't exist, that's fine
  }

  await githubApi(`/contents/${repoPath}`, 'PUT', {
    message: `Update ${repoPath}`,
    content: encoded,
    sha,
    branch: 'main'
  });
  console.log(`Uploaded: ${repoPath}`);
}

async function deploy() {
  console.log('Starting deployment...');
  
  await enablePages();
  
  const files = [
    'index.html',
    'legal.html',
    'manifest.json',
    'sw.js'
  ];
  
  for (const file of files) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      await uploadFile(fullPath, file);
    }
  }
  
  console.log('Deployment complete!');
  console.log(`Site will be available at: https://${REPO_OWNER}.github.io/${REPO_NAME}/`);
}

deploy().catch(console.error);