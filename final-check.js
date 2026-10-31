const https = require('https');

const req = https.get('https://jenganasitz.vercel.app/', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const autocompleteInputs = body.match(/<input[^>]*autocomplete[^>]*>/g) || [];
    console.log('Inputs with autocomplete:', autocompleteInputs.length);
    
    const allInputs = body.match(/<input[^>]*>/g) || [];
    const inputsWithoutAuto = allInputs.filter(i => !i.includes('autocomplete'));
    console.log('Total inputs:', allInputs.length);
    console.log('Inputs without autocomplete:', inputsWithoutAuto.length);
    
    const lazyImages = body.match(/<img[^>]*loading="lazy"[^>]*>/g) || [];
    console.log('\nLazy images:', lazyImages.length);
    lazyImages.forEach(img => {
      const hasWidth = img.includes('width=');
      const hasHeight = img.includes('height=');
      console.log('  Image has width:', hasWidth, '| height:', hasHeight);
    });
    
    const labelFors = body.match(/for="([^"]*)"/g) || [];
    console.log('\nLabel for attributes:');
    labelFors.forEach(f => console.log('  ', f));
    
    const inputIds = body.match(/<input[^>]*id="([^"]*)"[^>]*>/g) || [];
    console.log('\nInput IDs:');
    inputIds.forEach(id => console.log('  ', id));
  });
});
req.setTimeout(15000);
req.on('timeout', () => { req.destroy(); console.log('timeout'); });
req.on('error', e => console.log('error:', e.message));
req.end();