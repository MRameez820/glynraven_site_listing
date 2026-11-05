(function () {
  if (window.glynravenProductPricesInitialized) return;
  window.glynravenProductPricesInitialized = true;
  const money = value => '$' + Math.round(value).toLocaleString('en-US');
  const defaults = {
    'hemp-house': 0.15, 'artist-airstream': 0.15, 'lotus-belle-yurt': 0.15
  };
  const titles = {
    'Hemp House': 'hemp-house', 'Artist Airstream': 'artist-airstream',
    'Lotus Belle Yurt': 'lotus-belle-yurt', 'Hillside Manor': 'hillside-manor',
    'Balcony Suites': 'balcony-suites', 'The Hostel': 'the-hostel'
  };
  const logged = new Map();
  const cardSlug = card => card.dataset.productSlug || titles[card.querySelector('h3')?.textContent.trim()];
  const validPrice = price => price && price.currency === 'USD' &&
    price.value !== '' && Number.isFinite(Number(price.value)) && Number(price.value) >= 0;

  function renderPrice(card, price) {
    const direct = card.querySelector('.direct');
    if (!direct) return false;
    const configured = card.dataset.discount;
    const discount = configured === undefined ? (defaults[cardSlug(card)] || 0) : Number(configured);
    if (!Number.isFinite(discount) || discount < 0 || discount > 1) return false;
    const rate = money(price * (1 - discount));
    if (card.dataset.renderedRate !== rate) {
      const label = direct.querySelector('small');
      direct.replaceChildren(document.createTextNode(rate));
      if (label) direct.append(label);
      card.dataset.renderedRate = rate;
    }
    const regular = card.querySelector('.was s');
    if (regular && regular.textContent !== money(price)) regular.textContent = money(price);
    card.dataset.nightlySavings = String(price * discount);
    const count = card.querySelector('.night-count');
    const savings = card.querySelector('.savings');
    const saved = money(price * discount * Number(count?.dataset.nights || 2));
    if (savings && savings.textContent !== saved) savings.textContent = saved;
    return true;
  }

  function syncPrices() {
    const root = document.getElementById('glynraven-listings');
    if (!root) return false;
    const products = new Map();
    document.querySelectorAll('.product-block[data-product]').forEach(block => {
      try {
        const product = JSON.parse(block.getAttribute('data-product'));
        if (!product.urlSlug) return;
        products.set(product.urlSlug, product);
        const source = {
          product: product.title, slug: product.urlSlug,
          price: validPrice(product.price) ? Number(product.price.value) : null,
          variants: (product.variants || []).filter(v => validPrice(v.price)).map(v => ({
            bedrooms: v.attributes?.Bedrooms || null,
            price: Number(v.price.value), currency: v.price.currency
          }))
        };
        const signature = JSON.stringify(source);
        if (logged.get(product.urlSlug) !== signature) {
          console.log('[Glynraven product section: fetched price]', source);
          logged.set(product.urlSlug, signature);
        }
      } catch (_) { /* Wait for valid product block data. */ }
    });
    const cards = [...root.querySelectorAll('.card')];
    let complete = cards.length > 0;
    cards.forEach(card => {
      const slug = cardSlug(card);
      if (card.dataset.priceMode === 'inquiry' || slug === 'balcony-suites') {
        const direct = card.querySelector('.direct');
        if (direct && direct.textContent !== 'Call for Rates') direct.textContent = 'Call for Rates';
        return;
      }
      const product = products.get(slug);
      if (!product) { complete = false; return; }
      const select = card.querySelector('.bedroom-selector');
      if (card.dataset.priceMode === 'variants' || slug === 'the-hostel') {
        if (!select) { complete = false; return; }
        const variants = (product.variants || []).filter(v => v.attributes?.Bedrooms && validPrice(v.price));
        const byBedroom = new Map(variants.map(v => [v.attributes.Bedrooms.trim().toLowerCase(), v]));
        let allOptions = select.options.length > 0;
        [...select.options].forEach(option => {
          const variant = byBedroom.get(option.value.trim().toLowerCase());
          if (!variant) { allOptions = false; return; }
          option.dataset.price = variant.price.value;
          const label = variant.attributes.Bedrooms + ' — ' + money(Number(variant.price.value)) + ' / night';
          if (option.textContent !== label) option.textContent = label;
        });
        const selected = byBedroom.get(select.value.trim().toLowerCase());
        if (!selected || !renderPrice(card, Number(selected.price.value)) || !allOptions) complete = false;
      } else if (!validPrice(product.price) || !renderPrice(card, Number(product.price.value))) {
        complete = false;
      }
    });
    return complete;
  }

  document.addEventListener('change', event => {
    if (!(event.target instanceof Element)) return;
    const select = event.target.closest('#glynraven-listings .bedroom-selector');
    if (!select) return;
    const option = select.selectedOptions[0];
    if (option && option.dataset.price !== undefined) renderPrice(select.closest('.card'), Number(option.dataset.price));
  });

  document.addEventListener('click', async event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('#glynraven-listings button');
    if (!button) return;
    if (button.hasAttribute('data-copy')) {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        button.textContent = '\u2713 Copied';
      } catch (_) { button.textContent = button.dataset.copy; }
      return;
    }
    if (!button.hasAttribute('data-d')) return;
    const card = button.closest('.card');
    const count = card?.querySelector('.night-count');
    if (!count) return;
    const nights = Math.min(14, Math.max(1, Number(count.dataset.nights) + Number(button.dataset.d)));
    count.dataset.nights = String(nights);
    count.textContent = nights + (nights === 1 ? ' night' : ' nights');
    const savings = card.querySelector('.savings');
    if (savings) savings.textContent = money(Number(card.dataset.nightlySavings || 0) * nights);
  });

  function start() {
    if (syncPrices()) return;
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        if (syncPrices()) observer.disconnect();
      });
    });
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['data-product']
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
