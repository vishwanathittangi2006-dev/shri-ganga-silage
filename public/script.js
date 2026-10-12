
(() => {
  const KEY = 'shri-ganga-lang';
  let lang = localStorage.getItem(KEY) || 'en';
  let crops = [];

  const $ = id => document.getElementById(id);

  // Your business contact details
  const DEFAULT_PHONE = '+91 9916826717';
  const DEFAULT_WHATSAPP = '919916826717';
  const DEFAULT_ADDRESS = 'Ankalgi, Belagavi, Karnataka';

  const money = n =>
    '₹' + new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2
    }).format(n || 0);

  function applyLang() {
    document.documentElement.lang = lang === 'kn' ? 'kn' : 'en';

    document.querySelectorAll('[data-en][data-kn]').forEach(e => {
      e.textContent = lang === 'kn'
        ? e.dataset.kn
        : e.dataset.en;
    });

    if ($('langBtn')) {
      $('langBtn').textContent =
        lang === 'en' ? 'ಕನ್ನಡ' : 'English';
    }
  }

  function render() {
    const grid = $('cropGrid');
    if (!grid) return;

    grid.innerHTML = crops.map((c, i) => `
      <article class="crop-card">
        <div class="crop-number">
          ${String(i + 1).padStart(2, '0')}
        </div>
        <div class="crop-card-main">
          <span class="crop-label">SUGARCANE</span>
          <h3>${c.name}</h3>
          <div class="crop-price">
            ₹${Number(c.price).toFixed(2)}
            <small>/ ${c.unit}</small>
          </div>
          <p>${(lang === 'kn' ? c.points_kn : c.points_en)
            .slice(0, 2).join(' ')}</p>
          <a class="text-link"
             href="/crop.html?id=${c.id}"
             data-en="View variety →"
             data-kn="ತಳಿ ನೋಡಿ →">
            View variety →
          </a>
        </div>
      </article>
    `).join('');

    applyLang();
  }

  function setPrice() {
    const c = crops.find(
      x => String(x.id) === $('calcCrop')?.value
    ) || crops[0];

    if (c && $('price')) {
      $('price').value = Number(c.price).toFixed(2);
    }
  }

  async function calc() {
    if (!$('area')) return;

    const b = {
      crop: (
        crops.find(
          x => String(x.id) === $('calcCrop').value
        ) || {}
      ).name,
      area: Number($('area').value) || 0,
      areaUnit: $('areaUnit').value,
      unitsPerAcre: Number($('unitsPerAcre').value) || 0,
      price: Number($('price').value) || 0
    };

    try {
      const response = await fetch('/api/calculator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(b)
      });

      const d = await response.json();

      $('totalUnits').textContent =
        new Intl.NumberFormat('en-IN', {
          maximumFractionDigits: 2
        }).format(d.totalUnits || 0);

      $('totalCost').textContent =
        money(d.estimatedCost || 0);
    } catch (error) {
      console.error('Calculator error:', error);
    }
  }

  function updateContact(settings = {}) {
    // Use saved settings when valid; otherwise use your details.
    const savedPhone = String(settings.phone || '').trim();
    const savedWhatsApp = String(settings.whatsapp || '').trim();
    const savedAddress = String(settings.address || '').trim();

    const phone = (
      savedPhone && !savedPhone.includes('XXXXX')
    ) ? savedPhone : DEFAULT_PHONE;

    const whatsapp = (
      savedWhatsApp && !savedWhatsApp.includes('XXXXX')
    ) ? savedWhatsApp.replace(/\D/g, '') : DEFAULT_WHATSAPP;

    const address = (
      savedAddress &&
      savedAddress.toLowerCase() !== 'ankalgi, karnataka'
    ) ? savedAddress : DEFAULT_ADDRESS;

    if ($('phoneText')) {
      $('phoneText').textContent = phone;
      $('phoneText').href = 'tel:' + phone.replace(/[^\d+]/g, '');
    }

    if ($('whatsappText')) {
      $('whatsappText').textContent = 'Chat with us on WhatsApp';
      $('whatsappText').href = 'https://wa.me/' + whatsapp;
      $('whatsappText').target = '_blank';
      $('whatsappText').rel = 'noopener noreferrer';
    }

    if ($('addressText')) {
      $('addressText').textContent = address;
    }
  }

  async function load() {
    const [cropsResponse, settingsResponse] =
      await Promise.all([
        fetch('/api/crops'),
        fetch('/api/settings')
      ]);

    if (!cropsResponse.ok) {
      throw new Error('Could not load crop varieties.');
    }

    crops = await cropsResponse.json();

    let settings = {};

    // Contact details still work if settings cannot be loaded.
    if (settingsResponse.ok) {
      try {
        settings = await settingsResponse.json();
      } catch (error) {
        console.error('Could not read business settings:', error);
      }
    }

    updateContact(settings);

    if ($('calcCrop')) {
      $('calcCrop').innerHTML = crops.map(c =>
        `<option value="${c.id}">${c.name}</option>`
      ).join('');
    }

    setPrice();
    render();
    calc();
  }

  $('langBtn')?.addEventListener('click', () => {
    lang = lang === 'en' ? 'kn' : 'en';
    localStorage.setItem(KEY, lang);
    render();
    applyLang();
  });

  $('calcCrop')?.addEventListener('change', () => {
    setPrice();
    calc();
  });

  ['area', 'areaUnit', 'unitsPerAcre', 'price'].forEach(id => {
    $(id)?.addEventListener(
      id === 'areaUnit' ? 'change' : 'input',
      calc
    );
  });

  load().catch(error => {
    console.error('Website loading error:', error);
    updateContact();
  });
})();