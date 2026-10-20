/**
 * Saraya Grill - Admin Dashboard Engine
 * إدارة المطعم، الأصناف، الصور، المحتوى، والنسخ الاحتياطي
 */

const DEFAULT_PIN = "1234";

const AdminApp = {
  currentTab: 'overview',
  dishes: [],
  restaurant: {},
  cmsTexts: {},
  cmsImages: {},

  init() {
    this.checkAuthSession();
    this.initNavigation();
  },

  // ==================== AUTHENTICATION ====================
  checkAuthSession() {
    const isAuth = sessionStorage.getItem('saraya_admin_auth');
    if (isAuth === 'true') {
      this.showDashboard();
    } else {
      document.getElementById('pinAuthScreen').style.display = 'flex';
      document.getElementById('adminApp').style.display = 'none';
    }
  },

  checkPin(e) {
    if (e) e.preventDefault();
    const pin = document.getElementById('adminPinInput').value.trim();
    const savedPin = localStorage.getItem('saraya_admin_pin') || DEFAULT_PIN;

    if (pin === savedPin) {
      sessionStorage.setItem('saraya_admin_auth', 'true');
      this.showDashboard();
      SarayaApp.showToast('تم تسجيل الدخول بنجاح!', 'success');
    } else {
      SarayaApp.showToast('رمز المرور غير صحيح! الرمز الافتراضي هو 1234', 'error');
      document.getElementById('adminPinInput').value = '';
    }
  },

  logout() {
    sessionStorage.removeItem('saraya_admin_auth');
    location.reload();
  },

  async showDashboard() {
    document.getElementById('pinAuthScreen').style.display = 'none';
    document.getElementById('adminApp').style.display = 'flex';

    await SarayaApp.loadData();
    this.dishes = SarayaApp.data?.dishes || [];
    this.restaurant = SarayaApp.data?.restaurant || {};
    this.cmsTexts = JSON.parse(localStorage.getItem(SARAYA_CONFIG.storageKeys.cmsTexts) || '{}');
    this.cmsImages = JSON.parse(localStorage.getItem(SARAYA_CONFIG.storageKeys.cmsImages) || '{}');

    this.renderOverview();
    this.renderMenuTable();
    this.renderCmsPageFields();
    this.loadSettingsForm();
    this.loadMediaPreviews();
  },

  // ==================== NAVIGATION ====================
  initNavigation() {
    const navItems = document.querySelectorAll('.admin-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const sec = item.getAttribute('data-section');
        this.switchTab(sec);
      });
    });
  },

  switchTab(tabKey) {
    this.currentTab = tabKey;
    document.querySelectorAll('.admin-nav-item').forEach(i => {
      i.classList.toggle('active', i.getAttribute('data-section') === tabKey);
    });

    document.querySelectorAll('.admin-sec-view').forEach(view => {
      view.style.display = (view.id === `sec-${tabKey}`) ? 'block' : 'none';
    });

    const titles = {
      overview: 'نظرة عامة على الموقع والإحصائيات',
      menu: 'إدارة قائمة الطعام والأصناف',
      cms: 'إدارة محتوى ونصوص كافة الصفحات (Visual CMS)',
      media: 'إدارة الصور والبانرات الملكية',
      settings: 'إعدادات المطعم وقنوات التواصل',
      backup: 'النسخ الاحتياطي واستعادة البيانات'
    };
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = titles[tabKey] || 'لوحة التحكم';
  },

  // ==================== OVERVIEW ====================
  renderOverview() {
    const totalDishesEl = document.getElementById('statTotalDishes');
    const specialsEl = document.getElementById('statSpecialsCount');
    if (totalDishesEl) totalDishesEl.textContent = this.dishes.length;
    if (specialsEl) specialsEl.textContent = this.dishes.filter(d => d.is_special || d.category === 'specials').length;

    const tableBody = document.querySelector('#overviewRecentTable tbody');
    if (!tableBody) return;

    const recent = this.dishes.slice(0, 5);
    tableBody.innerHTML = recent.map(dish => `
      <tr>
        <td><img src="${dish.image}" class="dish-thumb-sm" alt="${dish.name}"></td>
        <td><strong>${dish.name}</strong></td>
        <td><span class="badge-pill badge-gold">${dish.categoryName || dish.category}</span></td>
        <td><strong style="color:var(--gold-accent);">${dish.price} ${dish.currency || 'ر.س'}</strong></td>
        <td>⭐ ${dish.rating || '4.9'}</td>
        <td>
          <button onclick="AdminApp.editDish('${dish.id}')" class="btn-gold-outline" style="padding:4px 10px; font-size:0.8rem;">
            <i class="fa-solid fa-pen-to-square"></i> تعديل
          </button>
        </td>
      </tr>
    `).join('');
  },

  // ==================== MENU CRUD ====================
  renderMenuTable(items = null) {
    const tableBody = document.querySelector('#adminFullMenuTable tbody');
    if (!tableBody) return;

    const list = items || this.dishes;
    tableBody.innerHTML = list.map(dish => `
      <tr>
        <td><img src="${dish.image}" class="dish-thumb-sm" alt="${dish.name}"></td>
        <td><strong>${dish.name}</strong></td>
        <td><span class="badge-pill badge-gold">${dish.categoryName || dish.category}</span></td>
        <td><strong style="color:var(--gold-accent);">${dish.price} ${dish.currency || 'ر.س'}</strong></td>
        <td style="max-width:280px; font-size:0.88rem; color:var(--text-muted);">${dish.desc}</td>
        <td>${dish.is_special ? '<span class="badge-pill badge-wine">مميز ⭐</span>' : '-'}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button onclick="AdminApp.editDish('${dish.id}')" class="btn-gold-outline" style="padding:6px 12px; font-size:0.82rem;">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="AdminApp.deleteDish('${dish.id}')" class="btn-wine" style="padding:6px 12px; font-size:0.82rem;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  filterMenuTable() {
    const query = document.getElementById('adminMenuSearch')?.value.toLowerCase().trim() || '';
    const cat = document.getElementById('adminCatFilter')?.value || 'all';

    const filtered = this.dishes.filter(d => {
      const matchCat = (cat === 'all') || (cat === 'specials' && (d.is_special || d.category === 'specials')) || (d.category === cat);
      const matchQuery = !query || d.name.toLowerCase().includes(query) || (d.desc && d.desc.toLowerCase().includes(query));
      return matchCat && matchQuery;
    });

    this.renderMenuTable(filtered);
  },

  openDishModal(dish = null) {
    const modal = document.getElementById('dishEditModal');
    const title = document.getElementById('modalDishTitle');
    const form = document.getElementById('dishForm');
    form.reset();

    if (dish) {
      title.textContent = `تعديل صنف: ${dish.name}`;
      document.getElementById('editDishId').value = dish.id;
      document.getElementById('dishFormName').value = dish.name;
      document.getElementById('dishFormCat').value = dish.category;
      document.getElementById('dishFormPrice').value = dish.price;
      document.getElementById('dishFormTag').value = dish.tag || '';
      document.getElementById('dishFormDesc').value = dish.desc || '';
      document.getElementById('dishFormImgUrl').value = dish.image || '';
      document.getElementById('dishFormImgPreview').src = dish.image || '';
      document.getElementById('dishFormIsSpecial').checked = !!dish.is_special;
    } else {
      title.textContent = 'إضافة صنف طعام جديد إلى القائمة';
      document.getElementById('editDishId').value = '';
      document.getElementById('dishFormImgPreview').src = 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80';
    }

    modal.classList.add('active');
  },

  closeDishModal() {
    document.getElementById('dishEditModal').classList.remove('active');
  },

  editDish(id) {
    const dish = this.dishes.find(d => d.id === id);
    if (dish) this.openDishModal(dish);
  },

  deleteDish(id) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الصنف من القائمة نهائياً؟')) return;
    this.dishes = this.dishes.filter(d => d.id !== id);
    this.saveDishes();
    SarayaApp.showToast('تم حذف الصنف بنجاح', 'info');
  },

  handleDishImgUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      document.getElementById('dishFormImgPreview').src = base64;
      document.getElementById('dishFormImgUrl').value = '';
    };
    reader.readAsDataURL(file);
  },

  updateDishImgFromUrl(url) {
    if (url) {
      document.getElementById('dishFormImgPreview').src = url;
    }
  },

  saveDishForm(e) {
    e.preventDefault();
    const id = document.getElementById('editDishId').value;
    const name = document.getElementById('dishFormName').value.trim();
    const category = document.getElementById('dishFormCat').value;
    const price = parseFloat(document.getElementById('dishFormPrice').value);
    const tag = document.getElementById('dishFormTag').value.trim();
    const desc = document.getElementById('dishFormDesc').value.trim();
    const isSpecial = document.getElementById('dishFormIsSpecial').checked;
    const image = document.getElementById('dishFormImgPreview').src;

    const catNames = {
      mains: 'الأطباق الرئيسية والستيك',
      appetizers: 'المقبلات والشوربات الفاخرة',
      pizza: 'البيتزا والباستا الإيطالية',
      desserts: 'الحلويات والمشروبات المنعشة',
      specials: 'المختارات الملكية'
    };

    if (id) {
      // Edit
      const idx = this.dishes.findIndex(d => d.id === id);
      if (idx !== -1) {
        this.dishes[idx] = {
          ...this.dishes[idx],
          name, category, categoryName: catNames[category], price, tag, desc, image, is_special: isSpecial
        };
      }
    } else {
      // New
      const newDish = {
        id: `dish_${Date.now()}`,
        name,
        category,
        categoryName: catNames[category],
        price,
        currency: 'ر.س',
        tag,
        rating: '5.0',
        desc,
        image,
        is_special: isSpecial
      };
      this.dishes.unshift(newDish);
    }

    this.saveDishes();
    this.closeDishModal();
    SarayaApp.showToast('تم حفظ الصنف بنجاح في القائمة!', 'success');
  },

  saveDishes() {
    localStorage.setItem(SARAYA_CONFIG.storageKeys.dishes, JSON.stringify(this.dishes));
    this.renderOverview();
    this.renderMenuTable();
  },

  // ==================== VISUAL CMS ====================
  renderCmsPageFields() {
    const page = document.getElementById('cmsPageSelect')?.value || 'home';
    const container = document.getElementById('cmsFieldsContainer');
    if (!container) return;

    const cmsDefinitions = {
      home: [
        { key: 'brand_name', label: 'اسم البراند بالهيدر', type: 'text', default: 'السرايا جريل' },
        { key: 'brand_sub', label: 'الشعار بالإنجليزية بالهيدر', type: 'text', default: 'SARAYA LUXURY GRILL' },
        { key: 'hero_title_1', label: 'عنوان السلايدر الأول', type: 'text', default: 'إبداع الطهي الرفيع بلمسة ملكية ساحرة' },
        { key: 'hero_sub_1', label: 'وصف السلايدر الأول', type: 'textarea', default: 'نأخذكم في رحلة ذوقية فريدة تجمع بين أصالة المذاق وفنون الطهي المعاصر...' },
        { key: 'hero_badge_1', label: 'شارة السلايدر الأول', type: 'text', default: 'تجربة طهي استثنائية • نكهات لا تُنسى' },
        { key: 'story_title', label: 'عنوان قسم قصتنا', type: 'text', default: 'فن الشواء الأصيل بلذة لا تُضاهى' },
        { key: 'story_text_1', label: 'الفقرة الأولى بقصتنا', type: 'textarea', default: 'انطلقت مسيرة مطعم السرايا جريل من شغف عميق بتقديم أرقى مأكولات الشواء المعتقة...' },
        { key: 'story_text_2', label: 'الفقرة الثانية بقصتنا', type: 'textarea', default: 'نحرص على استيراد أفخر أنواع لحوم الواغيو والبلاك أنجوس المعتقة...' },
        { key: 'story_exp_num', label: 'رقم سنوات الخبرة', type: 'text', default: '15+ عاماً' },
        { key: 'footer_desc', label: 'وصف الفوتر التعريفي', type: 'textarea', default: 'مطعم ومشويات السرايا جريل، الوجهة الأولى في المملكة لعشاق المشويات المعتقة...' }
      ],
      about: [
        { key: 'about_hero_title', label: 'عنوان صفحة من نحن', type: 'text', default: 'شغف الشواء وفن الطهي الرفيع' },
        { key: 'about_hero_sub', label: 'وصف هيدر من نحن', type: 'textarea', default: 'نروي لكم حكاية بدأت من حب التميز والبحث عن النكهة النقية...' }
      ],
      reservation: [
        { key: 'res_policy_text', label: 'ملاحظة سياسة الحجز', type: 'textarea', default: 'يتم تثبيت الحجز لمدة 15 دقيقة بعد الموعد المحدد. يُفضل الحجز قبل 24 ساعة للأجنحة الملكية.' }
      ],
      contact: [
        { key: 'contact_intro', label: 'مقدمة صفحة اتصل بنا', type: 'textarea', default: 'فريق الضيافة والاستقبال في مطعم السرايا جريل جاهز لتلبية كافة استفساراتكم.' }
      ]
    };

    const fields = cmsDefinitions[page] || [];
    container.innerHTML = fields.map(f => {
      const val = this.cmsTexts[f.key] !== undefined ? this.cmsTexts[f.key] : f.default;
      if (f.type === 'textarea') {
        return `
          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label">${f.label}</label>
            <textarea class="form-control cms-input" data-cms-key="${f.key}" rows="3">${val}</textarea>
          </div>
        `;
      }
      return `
        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label">${f.label}</label>
          <input type="text" class="form-control cms-input" data-cms-key="${f.key}" value="${val}">
        </div>
      `;
    }).join('');
  },

  saveCmsTexts() {
    document.querySelectorAll('.cms-input').forEach(input => {
      const key = input.getAttribute('data-cms-key');
      this.cmsTexts[key] = input.value;
    });

    localStorage.setItem(SARAYA_CONFIG.storageKeys.cmsTexts, JSON.stringify(this.cmsTexts));
    SarayaApp.showToast('تم حفظ كافة النصوص بنجاح وستظهر مباشرة في الموقع!', 'success');
  },

  // ==================== MEDIA CMS ====================
  handleMediaUpload(e, key) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      this.cmsImages[key] = base64;
      localStorage.setItem(SARAYA_CONFIG.storageKeys.cmsImages, JSON.stringify(this.cmsImages));

      const imgEl = document.getElementById(`img-${key}`);
      if (imgEl) imgEl.src = base64;

      SarayaApp.showToast(`تم تحديث الصورة "${key}" من جهازك بنجاح!`, 'success');
    };
    reader.readAsDataURL(file);
  },

  loadMediaPreviews() {
    Object.keys(this.cmsImages).forEach(key => {
      const imgEl = document.getElementById(`img-${key}`);
      if (imgEl) imgEl.src = this.cmsImages[key];
    });
  },

  // ==================== SETTINGS ====================
  loadSettingsForm() {
    const rest = this.restaurant;
    document.getElementById('setRestName').value = rest.name || '';
    document.getElementById('setRestSlogan').value = rest.slogan || '';
    document.getElementById('setRestPhone').value = rest.phone || '';
    document.getElementById('setRestWa').value = rest.whatsapp || '';
    document.getElementById('setRestEmail').value = rest.email || '';
    document.getElementById('setRestCurrency').value = rest.currency || 'ر.س';
    document.getElementById('setRestAddress').value = rest.address || '';
    document.getElementById('setRestHours').value = rest.working_hours || '';
  },

  saveSettings(e) {
    e.preventDefault();
    this.restaurant = {
      ...this.restaurant,
      name: document.getElementById('setRestName').value.trim(),
      slogan: document.getElementById('setRestSlogan').value.trim(),
      phone: document.getElementById('setRestPhone').value.trim(),
      whatsapp: document.getElementById('setRestWa').value.trim(),
      email: document.getElementById('setRestEmail').value.trim(),
      currency: document.getElementById('setRestCurrency').value.trim(),
      address: document.getElementById('setRestAddress').value.trim(),
      working_hours: document.getElementById('setRestHours').value.trim()
    };

    localStorage.setItem(SARAYA_CONFIG.storageKeys.restaurant, JSON.stringify(this.restaurant));
    SarayaApp.showToast('تم حفظ إعدادات المطعم بنجاح!', 'success');
  },

  // ==================== BACKUP & RESTORE ====================
  exportBackup() {
    const fullBackup = {
      timestamp: new Date().toISOString(),
      restaurant: this.restaurant,
      dishes: this.dishes,
      vip_packages: SarayaApp.data?.vip_packages || [],
      cmsTexts: this.cmsTexts,
      cmsImages: this.cmsImages
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullBackup, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `saraya_grill_backup_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
    SarayaApp.showToast('تم تحميل ملف النسخة الاحتياطية بنجاح!', 'success');
  },

  importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.dishes) {
          localStorage.setItem(SARAYA_CONFIG.storageKeys.dishes, JSON.stringify(parsed.dishes));
        }
        if (parsed.restaurant) {
          localStorage.setItem(SARAYA_CONFIG.storageKeys.restaurant, JSON.stringify(parsed.restaurant));
        }
        if (parsed.vip_packages) {
          localStorage.setItem(SARAYA_CONFIG.storageKeys.vip, JSON.stringify(parsed.vip_packages));
        }
        if (parsed.cmsTexts) {
          localStorage.setItem(SARAYA_CONFIG.storageKeys.cmsTexts, JSON.stringify(parsed.cmsTexts));
        }
        if (parsed.cmsImages) {
          localStorage.setItem(SARAYA_CONFIG.storageKeys.cmsImages, JSON.stringify(parsed.cmsImages));
        }

        SarayaApp.showToast('تم استعادة البيانات والنسخة الاحتياطية بنجاح!', 'success');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        alert('ملف النسخة الاحتياطية غير صالح أو تالف!');
      }
    };
    reader.readAsText(file);
  },

  resetToFactory() {
    if (!confirm('تحذير: سيتم مسح كافة التعديلات المخصصة والعودة إلى البيانات الأصلية للمطعم. هل أنت متأكد؟')) return;

    localStorage.removeItem(SARAYA_CONFIG.storageKeys.dishes);
    localStorage.removeItem(SARAYA_CONFIG.storageKeys.restaurant);
    localStorage.removeItem(SARAYA_CONFIG.storageKeys.vip);
    localStorage.removeItem(SARAYA_CONFIG.storageKeys.cmsTexts);
    localStorage.removeItem(SARAYA_CONFIG.storageKeys.cmsImages);

    SarayaApp.showToast('تمت إعادة ضبط المصنع بنجاح!', 'success');
    setTimeout(() => location.reload(), 1000);
  }
};

window.AdminApp = AdminApp;

document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
