/**
 * مطعم ومشويات السرايا جريل - Saraya Grill Luxury Restaurant
 * المحرك التفاعلي للموقع والربط المباشر مع لوحة التحكم والواتساب
 */

const SARAYA_CONFIG = {
  storageKeys: {
    dishes: 'saraya_dishes',
    restaurant: 'saraya_restaurant_info',
    vip: 'saraya_vip_packages',
    cmsTexts: 'saraya_cms_texts',
    cmsImages: 'saraya_cms_images',
    cart: 'saraya_cart'
  },
  defaultRestaurant: {
    name: "مطعم ومشويات السرايا جريل",
    short_name: "السرايا جريل",
    slogan: "فن الشواء الأصيل وفخامة الضيافة الملكية",
    phone: "+966 50 123 4567",
    whatsapp: "+966501234567",
    email: "info@saraya-grill.com",
    address: "طريق الملك فهد، حي الصحافة، الرياض، المملكة العربية السعودية",
    currency: "ر.س",
    working_hours: "يومياً: 1:00 ظهراً - 2:00 بعد منتصف الليل"
  }
};

// Global Store
let SarayaApp = {
  data: null,
  cart: [],
  activeVip: 'royal',

  async init() {
    await this.loadData();
    this.applyCMS();
    this.initCart();
    this.initNavigation();
    this.initHeroSwiper();
    this.initReviewsSwiper();
    this.initVipTabs();
    this.initReservationForm();
    this.renderSpecials();
    this.renderMenuTabs();
    this.initDishModal();
    this.initQuickOrder();
    this.updateCartBadge();
  },

  async loadData() {
    // 1. Try LocalStorage first (for instant CMS changes)
    const localDishes = localStorage.getItem(SARAYA_CONFIG.storageKeys.dishes);
    const localRest = localStorage.getItem(SARAYA_CONFIG.storageKeys.restaurant);
    const localVip = localStorage.getItem(SARAYA_CONFIG.storageKeys.vip);

    if (localDishes && localRest) {
      this.data = {
        restaurant: JSON.parse(localRest),
        dishes: JSON.parse(localDishes),
        vip_packages: localVip ? JSON.parse(localVip) : []
      };
      return;
    }

    // 2. Fetch default json
    try {
      const res = await fetch('data/menu.json');
      if (res.ok) {
        this.data = await res.json();
        // Seed to localStorage for first-time use
        localStorage.setItem(SARAYA_CONFIG.storageKeys.dishes, JSON.stringify(this.data.dishes));
        localStorage.setItem(SARAYA_CONFIG.storageKeys.restaurant, JSON.stringify(this.data.restaurant));
        localStorage.setItem(SARAYA_CONFIG.storageKeys.vip, JSON.stringify(this.data.vip_packages));
      }
    } catch (e) {
      console.warn("Could not fetch data/menu.json, using defaults", e);
      this.data = {
        restaurant: SARAYA_CONFIG.defaultRestaurant,
        dishes: [],
        vip_packages: []
      };
    }
  },

  applyCMS() {
    const texts = JSON.parse(localStorage.getItem(SARAYA_CONFIG.storageKeys.cmsTexts) || '{}');
    const images = JSON.parse(localStorage.getItem(SARAYA_CONFIG.storageKeys.cmsImages) || '{}');

    // Replace text elements
    document.querySelectorAll('[data-cms]').forEach(el => {
      const key = el.getAttribute('data-cms');
      if (texts[key]) {
        el.textContent = texts[key];
      }
    });

    // Replace images
    document.querySelectorAll('[data-cms-src]').forEach(el => {
      const key = el.getAttribute('data-cms-src');
      if (images[key]) {
        el.src = images[key];
      }
    });

    // Replace restaurant info dynamically
    if (this.data && this.data.restaurant) {
      const rest = this.data.restaurant;
      document.querySelectorAll('.rest-phone').forEach(el => {
        el.textContent = rest.phone;
        if (el.tagName === 'A') el.href = `tel:${rest.phone.replace(/\s+/g, '')}`;
      });
      document.querySelectorAll('.rest-whatsapp').forEach(el => {
        el.textContent = rest.whatsapp;
        if (el.tagName === 'A') el.href = `https://wa.me/${rest.whatsapp.replace(/[^0-9]/g, '')}`;
      });
      document.querySelectorAll('.rest-address').forEach(el => el.textContent = rest.address);
      document.querySelectorAll('.rest-hours').forEach(el => el.textContent = rest.working_hours);
    }
  },

  initNavigation() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const menu = document.querySelector('.nav-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', () => {
        menu.classList.toggle('open');
        toggle.innerHTML = menu.classList.contains('open') ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
      });
    }

    // Header scroll background effect
    const header = document.querySelector('.main-header');
    if (header) {
      window.addEventListener('scroll', () => {
        if (window.scrollY > 60) {
          header.style.background = 'rgba(10, 7, 8, 0.98)';
          header.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.7)';
        } else {
          header.style.background = 'rgba(12, 9, 10, 0.88)';
          header.style.boxShadow = 'none';
        }
      });
    }
  },

  initHeroSwiper() {
    if (typeof Swiper !== 'undefined' && document.querySelector('.hero-swiper')) {
      new Swiper('.hero-swiper', {
        loop: true,
        speed: 1000,
        autoplay: {
          delay: 5000,
          disableOnInteraction: false
        },
        effect: 'fade',
        fadeEffect: { crossFade: true },
        pagination: {
          el: '.hero-pagination',
          clickable: true
        }
      });
    }
  },

  initReviewsSwiper() {
    if (typeof Swiper !== 'undefined' && document.querySelector('.reviews-swiper')) {
      new Swiper('.reviews-swiper', {
        loop: true,
        speed: 800,
        autoplay: {
          delay: 5500,
          disableOnInteraction: false
        },
        slidesPerView: 1,
        spaceBetween: 24,
        pagination: {
          el: '.reviews-pagination',
          clickable: true
        },
        breakpoints: {
          768: { slidesPerView: 2, spaceBetween: 24 },
          1024: { slidesPerView: 3, spaceBetween: 30 }
        }
      });
    }
  },

  renderSpecials() {
    const container = document.getElementById('specialsGrid');
    if (!container || !this.data || !this.data.dishes) return;

    const specials = this.data.dishes.filter(d => d.is_special || d.category === 'specials').slice(0, 6);
    container.innerHTML = specials.map(dish => `
      <div class="special-card" data-id="${dish.id}">
        <div class="special-img-wrapper" onclick="SarayaApp.openDishModal('${dish.id}')">
          <img src="${dish.image}" alt="${dish.name}" loading="lazy">
          ${dish.tag ? `<div class="special-tag">${dish.tag}</div>` : ''}
          <div class="special-rating">
            <i class="fa-solid fa-star"></i>
            <span>${dish.rating || '4.9'}</span>
          </div>
        </div>
        <div class="special-body">
          <h3 class="special-title" onclick="SarayaApp.openDishModal('${dish.id}')" style="cursor:pointer;">${dish.name}</h3>
          <p class="special-desc">${dish.desc}</p>
          <div class="special-footer">
            <div class="special-price">
              ${dish.price} <small>${dish.currency || 'ر.س'}</small>
            </div>
            <button class="btn-quick-order" onclick="SarayaApp.addToCart('${dish.id}')" title="أضف للطلب">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderMenuTabs() {
    const tabsContainer = document.querySelector('.menu-tabs-wrapper');
    const contentContainer = document.getElementById('menuTabsContent');
    if (!contentContainer || !this.data || !this.data.dishes) return;

    // Filter non-specials dishes
    const regularDishes = this.data.dishes.filter(d => !d.is_special && d.category !== 'specials');

    const categories = [
      { id: 'mains', name: 'الأطباق الرئيسية والستيك', icon: 'fa-drumstick-bite' },
      { id: 'appetizers', name: 'المقبلات والشوربات الفاخرة', icon: 'fa-bowl-rice' },
      { id: 'pizza', name: 'البيتزا والباستا الإيطالية', icon: 'fa-pizza-slice' },
      { id: 'desserts', name: 'الحلويات والمشروبات المنعشة', icon: 'fa-cake-candles' }
    ];

    contentContainer.innerHTML = categories.map((cat, idx) => {
      const items = regularDishes.filter(d => d.category === cat.id);
      return `
        <div class="menu-tab-content ${idx === 0 ? 'active' : ''}" id="tab-${cat.id}" style="${idx === 0 ? 'display:block;' : 'display:none;'}">
          <div class="menu-items-grid">
            ${items.map(dish => `
              <div class="menu-item-row" onclick="SarayaApp.openDishModal('${dish.id}')">
                <div class="menu-item-thumb">
                  <img src="${dish.image}" alt="${dish.name}" loading="lazy">
                </div>
                <div class="menu-item-info">
                  <div class="menu-item-top">
                    <span class="menu-item-title">${dish.name}</span>
                    <span class="menu-item-dots"></span>
                    <span class="menu-item-price">${dish.price} ${dish.currency || 'ر.س'}</span>
                  </div>
                  <p class="menu-item-desc">${dish.desc}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Tab buttons event
    const tabBtns = document.querySelectorAll('.menu-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target');
        document.querySelectorAll('.menu-tab-content').forEach(c => {
          c.style.display = (c.id === target) ? 'block' : 'none';
        });
      });
    });
  },

  initVipTabs() {
    const vipBtns = document.querySelectorAll('.vip-tab-btn');
    if (!vipBtns.length) return;

    vipBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.getAttribute('data-pkg');
        this.selectVipPackage(key);
      });
    });

    const bookBtn = document.getElementById('vipBookBtn');
    if (bookBtn) {
      bookBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const pkg = (this.data.vip_packages || []).find(p => p.id.includes(this.activeVip));
        const resNotes = document.getElementById('resNotes');
        const resZone = document.getElementById('resZone');
        if (resZone) resZone.value = 'vip';
        if (resNotes && pkg) {
          resNotes.value = `طلب حجز باقة: ${pkg.name} (${pkg.price} ر.س)`;
        }
        const resSection = document.getElementById('reservation');
        if (resSection) {
          resSection.scrollIntoView({ behavior: 'smooth' });
          const card = resSection.querySelector('.reservation-card');
          if (card) {
            card.style.boxShadow = '0 0 45px rgba(212, 175, 55, 0.8)';
            setTimeout(() => card.style.boxShadow = '', 2500);
          }
        }
      });
    }

    // Set initial
    this.selectVipPackage('royal');
  },

  selectVipPackage(key) {
    this.activeVip = key;
    const pkgs = this.data?.vip_packages || [];
    const pkg = pkgs.find(p => p.id === `vip_${key}` || p.id === key) || pkgs[0];
    if (!pkg) return;

    document.querySelectorAll('.vip-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-pkg') === key);
    });

    const priceNum = document.getElementById('vipPriceNum');
    const desc = document.getElementById('vipPkgDesc');
    const badge = document.getElementById('vipCapacityBadge');
    const featList = document.getElementById('vipFeaturesList');
    const waBtn = document.getElementById('vipWaBtn');

    if (priceNum) priceNum.textContent = Number(pkg.price).toLocaleString();
    if (desc) desc.textContent = pkg.desc;
    if (badge) badge.innerHTML = `<i class="fa-solid fa-users"></i> ${pkg.guests || 'طاولة خاصة'}`;
    if (featList && pkg.features) {
      featList.innerHTML = pkg.features.map(f => `
        <li><i class="fa-solid fa-check"></i> ${f}</li>
      `).join('');
    }
    if (waBtn) {
      const rest = this.data.restaurant || SARAYA_CONFIG.defaultRestaurant;
      const cleanWa = rest.whatsapp.replace(/[^0-9]/g, '');
      const msg = `مرحباً ${rest.name}، أود الاستفسار وحجز ${pkg.name} (${pkg.price} ${pkg.currency || 'ر.س'}). يرجى تأكيد الموعد المتاح.`;
      waBtn.href = `https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`;
    }
  },

  initReservationForm() {
    const form = document.getElementById('reservationForm');
    const dateInput = document.getElementById('resDate');

    if (dateInput) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      dateInput.value = `${yyyy}-${mm}-${dd}`;
      dateInput.min = `${yyyy}-${mm}-${dd}`;
    }

    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('resName')?.value.trim();
      const phone = document.getElementById('resPhone')?.value.trim();
      const guests = document.getElementById('resGuests')?.value;
      const date = document.getElementById('resDate')?.value;
      const time = document.getElementById('resTime')?.value;
      const zone = document.getElementById('resZone');
      const zoneText = zone ? zone.options[zone.selectedIndex]?.text : 'الجلسة الرئيسية';
      const notes = document.getElementById('resNotes')?.value.trim() || 'لا يوجد';

      if (!name || !phone || !date || !time) {
        this.showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
      }

      const rest = this.data?.restaurant || SARAYA_CONFIG.defaultRestaurant;
      const cleanWa = rest.whatsapp.replace(/[^0-9]/g, '');

      const message = `👑 *طلب حجز طاولة جديدة - ${rest.name}*
━━━━━━━━━━━━━━━━━━
👤 *الاسم:* ${name}
📞 *رقم الهاتف:* ${phone}
👥 *عدد الضيوف:* ${guests} أشخاص
📅 *تاريخ الحجز:* ${date}
⏰ *الوقت المفضل:* ${time}
🏛 *منطقة الجلوس:* ${zoneText}
📝 *ملاحظات خاصة:* ${notes}
━━━━━━━━━━━━━━━━━━
نرجو منكم تأكيد توافر الطاولة والرد شاكرين حسن تعاونكم.`;

      const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(message)}`;
      this.showToast('جاري تحويل طلبكم لتأكيد الحجز عبر واتساب...', 'success');
      setTimeout(() => {
        window.open(waUrl, '_blank');
        form.reset();
      }, 1000);
    });
  },

  // ==================== CART / ORDER SYSTEM ====================
  initCart() {
    const saved = localStorage.getItem(SARAYA_CONFIG.storageKeys.cart);
    if (saved) {
      try { this.cart = JSON.parse(saved); } catch (e) { this.cart = []; }
    }
    this.renderCart();
  },

  saveCart() {
    localStorage.setItem(SARAYA_CONFIG.storageKeys.cart, JSON.stringify(this.cart));
    this.updateCartBadge();
    this.renderCart();
  },

  updateCartBadge() {
    const totalCount = this.cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('.cart-badge').forEach(badge => {
      badge.textContent = totalCount;
      badge.style.display = totalCount > 0 ? 'flex' : 'none';
    });
  },

  addToCart(dishId) {
    const dish = (this.data?.dishes || []).find(d => d.id === dishId);
    if (!dish) return;

    const existing = this.cart.find(item => item.id === dishId);
    if (existing) {
      existing.qty += 1;
    } else {
      this.cart.push({
        id: dish.id,
        name: dish.name,
        price: dish.price,
        currency: dish.currency || 'ر.س',
        image: dish.image,
        qty: 1
      });
    }

    this.saveCart();
    this.showToast(`تمت إضافة "${dish.name}" إلى الطلب بنجاح!`, 'success');
  },

  changeQty(dishId, delta) {
    const item = this.cart.find(i => i.id === dishId);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
      this.cart = this.cart.filter(i => i.id !== dishId);
    }
    this.saveCart();
  },

  removeFromCart(dishId) {
    this.cart = this.cart.filter(i => i.id !== dishId);
    this.saveCart();
    this.showToast('تم حذف الصنف من الطلب', 'info');
  },

  renderCart() {
    const body = document.getElementById('cartDrawerBody');
    const totalEl = document.getElementById('cartTotalNum');
    if (!body) return;

    if (this.cart.length === 0) {
      body.innerHTML = `
        <div class="cart-empty-state">
          <i class="fa-solid fa-utensils"></i>
          <p>قائمة طلباتك فارغة حالياً</p>
          <a href="menu.html" class="btn-gold-outline" style="margin-top:15px; font-size:0.9rem;">تصفح قائمة الطعام</a>
        </div>
      `;
      if (totalEl) totalEl.textContent = '0 ر.س';
      return;
    }

    let total = 0;
    body.innerHTML = this.cart.map(item => {
      const itemTotal = item.price * item.qty;
      total += itemTotal;
      return `
        <div class="cart-item-row">
          <img src="${item.image}" alt="${item.name}" class="cart-item-img">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${item.price} ${item.currency} &times; ${item.qty} = ${itemTotal} ${item.currency}</div>
          </div>
          <div class="cart-item-qty">
            <span class="qty-btn" onclick="SarayaApp.changeQty('${item.id}', -1)">-</span>
            <span>${item.qty}</span>
            <span class="qty-btn" onclick="SarayaApp.changeQty('${item.id}', 1)">+</span>
          </div>
          <button class="cart-item-del" onclick="SarayaApp.removeFromCart('${item.id}')" title="حذف">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
    }).join('');

    if (totalEl) totalEl.textContent = `${total.toLocaleString()} ${this.cart[0]?.currency || 'ر.س'}`;
  },

  checkoutWhatsApp() {
    if (this.cart.length === 0) {
      this.showToast('قائمة الطلب فارغة، يرجى إضافة أصناف أولاً', 'error');
      return;
    }

    const rest = this.data?.restaurant || SARAYA_CONFIG.defaultRestaurant;
    const cleanWa = rest.whatsapp.replace(/[^0-9]/g, '');

    let total = 0;
    const itemsList = this.cart.map((item, idx) => {
      const sub = item.price * item.qty;
      total += sub;
      return `${idx + 1}. *${item.name}* (${item.qty} × ${item.price} = ${sub} ${item.currency})`;
    }).join('\n');

    const msg = `🍽 *طلب طعام خارجي / استلام - ${rest.name}*
━━━━━━━━━━━━━━━━━━
${itemsList}
━━━━━━━━━━━━━━━━━━
💰 *المجموع الإجمالي:* ${total.toLocaleString()} ${rest.currency}
📍 أرجو تأكيد موعد تجهيز الطلب والاستلام شاكرين لكم.`;

    const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  },

  toggleCartDrawer(open) {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (!drawer || !overlay) return;

    if (open !== undefined) {
      drawer.classList.toggle('active', open);
      overlay.classList.toggle('active', open);
    } else {
      drawer.classList.toggle('active');
      overlay.classList.toggle('active');
    }
  },

  // ==================== DISH DETAIL MODAL ====================
  initDishModal() {
    const overlay = document.getElementById('dishModalOverlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeDishModal();
      });
    }
  },

  openDishModal(dishId) {
    const dish = (this.data?.dishes || []).find(d => d.id === dishId);
    if (!dish) return;

    const overlay = document.getElementById('dishModalOverlay');
    const img = document.getElementById('dishModalImg');
    const title = document.getElementById('dishModalTitle');
    const price = document.getElementById('dishModalPrice');
    const desc = document.getElementById('dishModalDesc');
    const addBtn = document.getElementById('dishModalAddBtn');

    if (img) img.src = dish.image;
    if (title) title.textContent = dish.name;
    if (price) price.innerHTML = `${dish.price} <small>${dish.currency || 'ر.س'}</small>`;
    if (desc) desc.textContent = dish.desc;
    if (addBtn) {
      addBtn.onclick = () => {
        this.addToCart(dish.id);
        this.closeDishModal();
      };
    }

    if (overlay) overlay.classList.add('active');
  },

  closeDishModal() {
    const overlay = document.getElementById('dishModalOverlay');
    if (overlay) overlay.classList.remove('active');
  },

  initQuickOrder() {
    // Already linked via onclick in templates
  },

  showToast(message, type = 'info') {
    let box = document.querySelector('.toast-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toast-box';
      document.body.appendChild(box);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-bell');
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    box.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

// Global Exposure
window.SarayaApp = SarayaApp;

// Auto Start
document.addEventListener('DOMContentLoaded', () => {
  SarayaApp.init();
});
