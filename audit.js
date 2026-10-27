const https = require('https');

https.get('https://jenganasitz.vercel.app/', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const cssMatches = body.match(/<link[^>]+rel="stylesheet"[^>]*>/g) || [];
    const jsMatches = body.match(/<script[^>]+src=[^>]*>/g) || [];
    const inlineScriptMatches = body.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
    
    console.log('CSS links:', cssMatches.length);
    console.log('External JS:', jsMatches.length);
    console.log('Inline scripts:', inlineScriptMatches.length);
    
    console.log('');
    console.log('--- Checking for common issues ---');
    console.log('Has container class:', body.includes('class="container"'));
    console.log('Has products-grid:', body.includes('products-grid'));
    console.log('Has categories-grid:', body.includes('categories-grid'));
    console.log('Has vendors-carousel:', body.includes('vendors-carousel'));
    console.log('Has auth-modal:', body.includes('id="authModal"'));
    console.log('Has nav-links:', body.includes('nav-links'));
    console.log('Has hero-search:', body.includes('heroSearch'));
    console.log('Has cart-dropdown:', body.includes('cartDropdown'));
    
    const styleTagCount = (body.match(/<style[^>]*>/g) || []).length;
    console.log('Style tags:', styleTagCount);
    
    // Check for JavaScript errors
    const jsErrors = body.match(/console\.error|throw new Error|Uncaught|ReferenceError/g);
    console.log('Potential JS errors in HTML:', jsErrors ? jsErrors.length : 0);
    
    // Check for key elements that should be rendered by JS
    console.log('\n--- JS-rendered content check ---');
    console.log('Categories grid has content:', body.includes('categories-grid') && body.includes('cement'));
    console.log('Products grid has content:', body.includes('products-grid') && body.includes('product-card'));
    console.log('Vendors carousel has content:', body.includes('vendors-carousel') && body.includes('vendor-card'));
    console.log('Cart count element:', body.includes('cartCount'));
    console.log('Auth modal steps:', body.includes('authStep1') && body.includes('customerForm') && body.includes('vendorForm'));
  });
});