/**
 * Saraya Grill - Admin Dashboard Engine
 * إدارة المطعم، الحجوزات الواردة، الأصناف، الصور، المحتوى، والنسخ الاحتياطي
 * يدعم المزامنة السحابية الفورية عبر Cloudflare KV و LocalStorage
 */

const DEFAULT_PIN = "1234";

const AdminApp = {
  currentTab: 'overview',
  dishes: [],
  reservations: [],
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

    // Load Local reservations first
    this.reservations = JSON.parse(localStorage.getItem(SARAYA_CONFIG.storageKeys.reservations) || '[]');

    // Now fetch cloud reservations from Cloudflare KV
    await this.fetchCloudReservations();

    this.renderOverview();
    this.renderReservationsTable();
    this.renderMenuTable();
    this.renderCmsPageFields();
    this.loadSettingsForm();
    this.loadMediaPreviews();
    this.updateReservationStats();
  },

  async fetchCloudReservations() {
    try {
      const res = await fetch('/api/reservations');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.reservations)) {
          // Merge local and cloud by id
          const map = new Map();
          // First add local
          this.reservations.forEach(r => map.set(r.id, r));
          // Then override or add cloud
          data.reservations.forEach(r => map.set(r.id, r));

          this.reservations = Array.from(map.values()).sort((a,b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
          localStorage.setItem(SARAYA_CONFIG.storageKeys.reservations, JSON.stringify(this.reservations));
        }
      }
    } catch (err) {
      console.warn("Could not fetch cloud reservations (using local cache):", err);
    }
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
      reservations: 'إدارة الحجوزات الواردة وسجل الطاولات',
      menu: 'إدارة قائمة الطعام والأصناف',
      cms: 'إدارة محتوى ونصوص كافة الصفحات (Visual CMS)',
      media: 'إدارة الصور والبانرات الملكية',
      settings: 'إعدادات المطعم وقنوات التواصل',
      backup: 'النسخ الاحتياطي واستعادة البيانات'
    };
    const titleEl = document.getElementById('sectionTitle');
    if (titleEl) titleEl.textContent = titles[tabKey] || 'لوحة التحكم';

    if (tabKey === 'reservations') {
      this.fetchCloudReservations().then(() => {
        this.renderReservationsTable();
      });
    }
  },

  // ==================== OVERVIEW ====================
  renderOverview() {
    const totalDishesEl = document.getElementById('statTotalDishes');
    const specialsEl = document.getElementById('statSpecialsCount');
    const totalResEl = document.getElementById('statTotalRes');

    if (totalDishesEl) totalDishesEl.textContent = this.dishes.length;
    if (specialsEl) specialsEl.textContent = this.dishes.filter(d => d.is_special || d.category === 'specials').length;
    if (totalResEl) totalResEl.textContent = this.reservations.length;

    const bookingsTbody = document.querySelector('#overviewRecentBookingsTable tbody');
    if (bookingsTbody) {
      if (this.reservations.length === 0) {
        bookingsTbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-muted); padding:30px;">لا توجد أي حجوزات مسجلة حتى الآن.</td></tr>`;
      } else {
        const recent = this.reservations.slice(0, 5);
        bookingsTbody.innerHTML = recent.map(r => `
          <tr>
            <td><strong style="color:var(--gold-accent);">${r.id}</strong></td>
            <td><strong>${r.name}</strong></td>
            <td><a href="https://wa.me/${r.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:var(--gold-light);"><i class="fa-brands fa-whatsapp" style="color:#25d366;"></i> ${r.phone}</a></td>
            <td>${r.date}</td>
            <td>${r.time}</td>
            <td>${r.guests}</td>
            <td><span class="badge-pill badge-gold">${r.zone}</span></td>
            <td>${this.getStatusBadge(r.status)}</td>
          </tr>
        `).join('');
      }
    }
  },

  // ==================== RESERVATIONS MANAGEMENT ====================
  updateReservationStats() {
    const total = this.reservations.length;
    const pending = this.reservations.filter(r => r.status === 'جديد').length;
    const confirmed = this.reservations.filter(r => r.status === 'مؤكد').length;
    const cancelled = this.reservations.filter(r => r.status === 'ملغي').length;

    const elTotal = document.getElementById('resCountTotal');
    const elPending = document.getElementById('resCountPending');
    const elConfirmed = document.getElementById('resCountConfirmed');
    const elCancelled = document.getElementById('resCountCancelled');
    const elSidebarBadge = document.getElementById('sidebarResCount');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elConfirmed) elConfirmed.textContent = confirmed;
    if (elCancelled) elCancelled.textContent = cancelled;

    if (elSidebarBadge) {
      elSidebarBadge.textContent = pending;
      elSidebarBadge.style.display = pending > 0 ? 'inline-block' : 'none';
    }
  },

  getStatusBadge(status) {
    if (status === 'مؤكد') return `<span class="badge-pill badge-green"><i class="fa-solid fa-check"></i> مؤكد</span>`;
    if (status === 'ملغي') return `<span class="badge-pill badge-red"><i class="fa-solid fa-xmark"></i> ملغي</span>`;
    return `<span class="badge-pill badge-yellow"><i class="fa-solid fa-clock"></i> جديد</span>`;
  },

  renderReservationsTable(items = null) {
    const list = items || this.reservations;
    const tbody = document.querySelector('#adminReservationsTable tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--text-muted); padding:40px;">لا توجد نتائج مطابقة في سجل الحجوزات.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(r => {
      const cleanPhone = r.phone.replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`مرحباً أستاذ ${r.name}، بخصوص حجزكم في مطعم السرايا جريل برقم (${r.id}) لموعد: ${r.date} الساعة ${r.time}...`)}`;
      
      return `
        <tr>
          <td><strong style="color:var(--gold-accent);">${r.id}</strong></td>
          <td style="font-size:0.85rem; color:var(--text-muted);">${r.created_at || '-'}</td>
          <td><strong>${r.name}</strong></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span>${r.phone}</span>
              <a href="${waLink}" target="_blank" class="btn-quick-order" style="width:30px; height:30px; font-size:0.85rem;" title="محادثة واتساب مباشرة">
                <i class="fa-brands fa-whatsapp" style="color:#25d366;"></i>
              </a>
            </div>
          </td>
          <td><strong>${r.date}</strong> <small style="color:var(--gold-accent);">(${r.time})</small></td>
          <td>${r.guests}</td>
          <td><span class="badge-pill badge-gold">${r.zone}</span></td>
          <td style="max-width:200px; font-size:0.85rem; color:var(--text-muted);">${r.notes || '-'}</td>
          <td>${this.getStatusBadge(r.status)}</td>
          <td>
            <div style="display:flex; gap:6px;">
              <button onclick="AdminApp.updateResStatus('${r.id}', 'مؤكد')" class="btn-luxury" style="padding:4px 8px; font-size:0.75rem;" title="تأكيد الحجز">
                <i class="fa-solid fa-check"></i>
              </button>
              <button onclick="AdminApp.updateResStatus('${r.id}', 'ملغي')" class="btn-wine" style="padding:4px 8px; font-size:0.75rem;" title="إلغاء الحجز">
                <i class="fa-solid fa-ban"></i>
              </button>
              <button onclick="AdminApp.deleteReservation('${r.id}')" class="btn-gold-outline" style="padding:4px 8px; font-size:0.75rem;" title="حذف نهائي">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.updateReservationStats();
  },

  filterReservationsTable() {
    const query = document.getElementById('resSearchInput')?.value.toLowerCase().trim() || '';
    const status = document.getElementById('resStatusFilter')?.value || 'all';

    const filtered = this.reservations.filter(r => {
      const matchStatus = (status === 'all') || (r.status === status);
      const matchQuery = !query || r.name.toLowerCase().includes(query) || r.phone.includes(query) || (r.id && r.id.toLowerCase().includes(query));
      return matchStatus && matchQuery;
    });

    this.renderReservationsTable(filtered);
  },

  async updateResStatus(id, newStatus) {
    const item = this.reservations.find(r => r.id === id);
    if (!item) return;

    item.status = newStatus;
    localStorage.setItem(SARAYA_CONFIG.storageKeys.reservations, JSON.stringify(this.reservations));
    this.renderReservationsTable();
    this.renderOverview();

    // Cloud patch
    try {
      await fetch('/api/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
    } catch (e) {
      console.warn("Could not patch cloud status:", e);
    }

    SarayaApp.showToast(`تم تغيير حالة الحجز (${id}) إلى: ${newStatus}`, 'success');
  },

  async deleteReservation(id) {
    if (!confirm(`هل أنت متأكد من حذف الحجز (${id}) نهائياً؟`)) return;

    this.reservations = this.reservations.filter(r => r.id !== id);
    localStorage.setItem(SARAYA_CONFIG.storageKeys.reservations, JSON.stringify(this.reservations));
    this.renderReservationsTable();
    this.renderOverview();

    // Cloud delete
    try {
      await fetch(`/api/reservations?id=${id}`, { method: 'DELETE' });
    } catch (e) {
      console.warn("Could not delete from cloud:", e);
    }

    SarayaApp.showToast('تم حذف الحجز من السجل', 'info');
  },

  openManualResModal() {
    const modal = document.getElementById('manualResModal');
    const form = document.getElementById('manualResForm');
    form.reset();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    document.getElementById('manualResDate').value = `${yyyy}-${mm}-${dd}`;

    modal.classList.add('active');
  },

  closeManualResModal() {
    document.getElementById('manualResModal').classList.remove('active');
  },

  async saveManualReservation(e) {
    e.preventDefault();
    const name = document.getElementById('manualResName').value.trim();
    const phone = document.getElementById('manualResPhone').value.trim();
    const date = document.getElementById('manualResDate').value;
    const time = document.getElementById('manualResTime').value.trim();
    const guests = document.getElementById('manualResGuests').value;
    const zone = document.getElementById('manualResZone').value;
    const notes = document.getElementById('manualResNotes').value.trim() || 'حجز يدوي من الإدارة';

    const newBooking = {
      id: 'RES-' + Math.floor(100000 + Math.random() * 900000),
      timestamp: new Date().toISOString(),
      created_at: new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }),
      name,
      phone,
      guests,
      date,
      time,
      zone,
      notes,
      status: 'مؤكد'
    };

    this.reservations.unshift(newBooking);
    localStorage.setItem(SARAYA_CONFIG.storageKeys.reservations, JSON.stringify(this.reservations));
    this.closeManualResModal();
    this.renderReservationsTable();
    this.renderOverview();

    // Cloud sync
    try {
      await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBooking)
      });
    } catch (err) {}

    SarayaApp.showToast(`تم تسجيل الحجز اليدوي بنجاح برقم (${newBooking.id})`, 'success');
  },

  exportReservationsCSV() {
    if (this.reservations.length === 0) {
      SarayaApp.showToast('لا توجد حجوزات لتصديرها حالياً', 'error');
      return;
    }

    const headers = ["رقم الحجز", "تاريخ التسجيل", "اسم العميل", "رقم الجوال", "تاريخ الحجز", "الوقت", "الضيوف", "الجلسة", "الملاحظات", "الحالة"];
    const rows = this.reservations.map(r => [
      r.id,
      r.created_at || '',
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.phone}"`,
      r.date,
      r.time,
      `"${r.guests}"`,
      `"${r.zone}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
      r.status
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `saraya_reservations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    SarayaApp.showToast('تم تصدير ملف الحجوزات بنجاح بصيغة CSV المتوافقة مع Excel!', 'success');
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
      const idx = this.dishes.findIndex(d => d.id === id);
      if (idx !== -1) {
        this.dishes[idx] = {
          ...this.dishes[idx],
          name, category, categoryName: catNames[category], price, tag, desc, image, is_special: isSpecial
        };
      }
    } else {
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
    document.getElementById('setRestPhone').value = rest.phone || '01027093535';
    document.getElementById('setRestWa').value = rest.whatsapp || '201027093535';
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
      reservations: this.reservations,
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
        if (parsed.reservations) {
          localStorage.setItem(SARAYA_CONFIG.storageKeys.reservations, JSON.stringify(parsed.reservations));
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
    localStorage.removeItem(SARAYA_CONFIG.storageKeys.reservations);
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
