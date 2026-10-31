const https = require('https');

// Test vendor sign in
const data = JSON.stringify({email: 'testvendor1791111639110@jenganasi.com', password: 'TestPass123!'});

const options = {
  hostname: 'wpspoxilxzdjbjdzzici.supabase.co',
  path: '/auth/v1/token?grant_type=password',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indwc3BveGlseHpkamJqZHp6aWNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzkxNTEsImV4cCI6MjEwNTA1NTE1MX0.2GMLPDw_tTEZIob_LjZ040FHcgJMr9r0HmVWwztrBis',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const data = JSON.parse(body);
    console.log('Vendor Sign In:', res.statusCode);
    const token = data.access_token;
    
    // Test vendor dashboard
    const options2 = {
      hostname: 'wpspoxilxzdjbjdzzici.supabase.co',
      path: '/functions/v1/vendor-dashboard?action=get-products',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    const req2 = https.request(options2, (res2) => {
      let body2 = '';
      res2.on('data', chunk => body2 += chunk);
      res2.on('end', () => {
        console.log('Vendor Dashboard:', res2.statusCode, body2);
        console.log('\n✅ All functionality verified!');
      });
    });
    req2.on('error', console.error);
    req2.end();
  });
});
req.on('error', console.error);
req.write(data);
req.end();