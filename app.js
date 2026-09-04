/**
 * ỨNG DỤNG TRA CỨU ĐIỂM THI THEO MSHV
 */

// Application State
let currentStudents = [];
let activeTab = 'lookup';
let currentSearchedStudent = null;

// Table pagination and filtering state
let tableState = {
  search: '',
  filterResult: 'ALL', // 'ALL', 'Đậu', 'Rớt'
  sortBy: 'stt',
  sortAsc: true,
  page: 1,
  pageSize: 15
};

// Remove Vietnamese tones for flexible search
function removeVietnameseTones(str) {
  if (!str) return '';
  str = str.toLowerCase();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
  str = str.replace(/\u02C6|\u0306|\u031B/g, "");
  return str.trim();
}

// Format Excel Date serial to DD/MM/YYYY
function formatExcelDate(serial) {
  if (!serial) return '';
  if (typeof serial === 'string' && serial.includes('/')) return serial;
  const num = parseFloat(serial);
  if (isNaN(num)) return String(serial);
  const utc_days = Math.floor(num - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  if (isNaN(date_info.getTime())) return String(serial);
  const day = String(date_info.getUTCDate()).padStart(2, '0');
  const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
  const year = date_info.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-blue-600';
  const iconClass = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info';
  
  toast.className = `flex items-center gap-3 px-4 py-3 text-white text-sm font-medium rounded-xl shadow-xl transition-all transform duration-300 translate-y-2 opacity-0 ${bgClass}`;
  toast.innerHTML = `
    <i class="fa-solid ${iconClass} text-lg"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  // Load default dataset
  if (window.DEFAULT_STUDENTS_DATA && Array.isArray(window.DEFAULT_STUDENTS_DATA)) {
    currentStudents = [...window.DEFAULT_STUDENTS_DATA];
  } else {
    currentStudents = [];
  }

  initTabs();
  initSearch();
  initQuickChips();
  initUpload();
  updateStats();
  renderTable();

  // Handle URL hash / search query parameter if any
  const urlParams = new URLSearchParams(window.location.search);
  const mshvParam = urlParams.get('mshv');
  if (mshvParam) {
    document.getElementById('mshv-input').value = mshvParam;
    handleLookup(mshvParam);
  }
});

// Tab Navigation
function initTabs() {
  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  
  // Update button active styles
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabId;
    if (isTarget) {
      btn.className = 'nav-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 text-white shadow-md transition';
    } else {
      btn.className = 'nav-tab-btn flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition';
    }
  });

  // Switch visible sections
  const tabs = ['lookup', 'stats', 'table', 'upload'];
  tabs.forEach(t => {
    const el = document.getElementById(`${t}-tab-content`);
    if (el) {
      if (t === tabId) {
        el.classList.remove('hidden');
        el.classList.add('animate-fade-in');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  if (tabId === 'stats') {
    updateStats();
  } else if (tabId === 'table') {
    renderTable();
  }
}

// Search and Autocomplete
function initSearch() {
  const input = document.getElementById('mshv-input');
  const clearBtn = document.getElementById('clear-search-btn');
  const searchBtn = document.getElementById('search-btn');
  const suggestionsBox = document.getElementById('search-suggestions');

  if (!input) return;

  input.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';
    showSuggestions(val);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      hideSuggestions();
      handleLookup(input.value);
    } else if (e.key === 'Escape') {
      input.value = '';
      if (clearBtn) clearBtn.style.display = 'none';
      hideSuggestions();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      hideSuggestions();
      input.focus();
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      hideSuggestions();
      handleLookup(input.value);
    });
  }

  // Click outside to close suggestions
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-wrapper')) {
      hideSuggestions();
    }
  });
}

function showSuggestions(val) {
  const suggestionsBox = document.getElementById('search-suggestions');
  if (!suggestionsBox) return;

  if (!val || val.length < 1) {
    suggestionsBox.innerHTML = '';
    suggestionsBox.classList.add('hidden');
    return;
  }

  const queryNorm = removeVietnameseTones(val);
  const matches = currentStudents.filter(s => {
    const mshvNorm = removeVietnameseTones(s.mshv);
    const nameNorm = removeVietnameseTones(s.hoTen);
    const sttStr = String(s.stt);
    return mshvNorm.includes(queryNorm) || nameNorm.includes(queryNorm) || sttStr === val;
  }).slice(0, 6);

  if (matches.length === 0) {
    suggestionsBox.innerHTML = `
      <div class="px-4 py-3 text-sm text-slate-500 text-center italic">
        Không tìm thấy gợi ý phù hợp cho "${val}"
      </div>
    `;
    suggestionsBox.classList.remove('hidden');
    return;
  }

  suggestionsBox.innerHTML = matches.map(s => {
    const isPass = s.ketQua === 'Đậu' || (typeof s.diemThi === 'number' && s.diemThi >= 5.0);
    const badgeColor = isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
    return `
      <div class="suggestion-item flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer transition border-b border-slate-100 last:border-0" data-mshv="${s.mshv}">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            ${s.gioiTinh === 'Nữ' ? '<i class="fa-solid fa-user-nurse"></i>' : '<i class="fa-solid fa-user-doctor"></i>'}
          </div>
          <div>
            <div class="text-sm font-semibold text-slate-800">${s.hoTen}</div>
            <div class="text-xs text-slate-500 flex items-center gap-2">
              <span class="font-mono font-medium text-blue-600">${s.mshv}</span>
              <span>•</span>
              <span>${s.ngaySinh || 'Chưa cập nhật'}</span>
            </div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-sm font-bold ${isPass ? 'text-emerald-600' : 'text-rose-600'}">${s.diemThiFormatted || s.diemThi} đ</div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}">${s.ketQua}</span>
        </div>
      </div>
    `;
  }).join('');

  suggestionsBox.classList.remove('hidden');

  suggestionsBox.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      const mshv = item.getAttribute('data-mshv');
      document.getElementById('mshv-input').value = mshv;
      hideSuggestions();
      handleLookup(mshv);
    });
  });
}

function hideSuggestions() {
  const box = document.getElementById('search-suggestions');
  if (box) box.classList.add('hidden');
}

// Quick Sample Chips
function initQuickChips() {
  const chips = document.querySelectorAll('.sample-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const mshv = chip.getAttribute('data-mshv');
      if (mshv) {
        document.getElementById('mshv-input').value = mshv;
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) clearBtn.style.display = 'flex';
        switchTab('lookup');
        handleLookup(mshv);
      }
    });
  });
}

// Core Lookup Function
function handleLookup(query) {
  if (!query || !query.trim()) {
    showToast('Vui lòng nhập Mã số học viên (MSHV) hoặc Họ tên để tra cứu!', 'info');
    return;
  }

  const rawQuery = query.trim();
  const queryNorm = removeVietnameseTones(rawQuery);

  // Find student: First try exact MSHV match
  let found = currentStudents.find(s => s.mshv && s.mshv.trim().toLowerCase() === rawQuery.toLowerCase());

  // If not found, try suffix matching (e.g. user typed "0001" or "1" instead of "YK2026-0001")
  if (!found) {
    found = currentStudents.find(s => {
      if (!s.mshv) return false;
      const parts = s.mshv.split('-');
      if (parts.length > 1 && (parts[1].toLowerCase() === rawQuery.toLowerCase() || parseInt(parts[1], 10) === parseInt(rawQuery, 10))) {
        return true;
      }
      return false;
    });
  }

  // If still not found, try matching by Full Name exact/partial
  if (!found) {
    const nameMatches = currentStudents.filter(s => {
      const nameNorm = removeVietnameseTones(s.hoTen);
      return nameNorm.includes(queryNorm);
    });
    if (nameMatches.length === 1) {
      found = nameMatches[0];
    } else if (nameMatches.length > 1) {
      // If multiple name matches, show list or pick first with notice
      found = nameMatches[0];
      showToast(`Tìm thấy ${nameMatches.length} học viên có tên khớp, đang hiển thị học viên đầu tiên.`, 'info');
    }
  }

  const resultContainer = document.getElementById('result-container');
  const notFoundContainer = document.getElementById('not-found-container');
  const initialGuide = document.getElementById('initial-guide');

  if (initialGuide) initialGuide.classList.add('hidden');

  if (!found) {
    currentSearchedStudent = null;
    if (resultContainer) resultContainer.classList.add('hidden');
    if (notFoundContainer) {
      notFoundContainer.classList.remove('hidden');
      notFoundContainer.classList.add('animate-fade-in');
      document.getElementById('searched-query-text').textContent = rawQuery;
    }
    showToast(`Không tìm thấy dữ liệu cho mã: "${rawQuery}"`, 'error');
    return;
  }

  currentSearchedStudent = found;
  if (notFoundContainer) notFoundContainer.classList.add('hidden');
  renderStudentResult(found);
}

// Render Result Card
function renderStudentResult(student) {
  const resultContainer = document.getElementById('result-container');
  if (!resultContainer) return;

  const isPass = student.ketQua === 'Đậu' || (typeof student.diemThi === 'number' && student.diemThi >= 5.0);
  const scoreNum = parseFloat(student.diemThi) || 0;
  const scorePercent = Math.min(100, Math.max(0, (scoreNum / 10) * 100));

  // Calculate cohort ranking
  const sortedStudents = [...currentStudents].sort((a, b) => (parseFloat(b.diemThi) || 0) - (parseFloat(a.diemThi) || 0));
  const rankIndex = sortedStudents.findIndex(s => s.mshv === student.mshv);
  const rankNumber = rankIndex >= 0 ? rankIndex + 1 : '-';
  const totalCount = currentStudents.length;
  const topPercent = rankIndex >= 0 ? Math.max(1, Math.round((rankNumber / totalCount) * 100)) : 0;

  // Grade classification text
  let gradeClassification = 'Không đạt';
  let gradeClassColor = 'text-rose-600';
  if (scoreNum >= 8.5) {
    gradeClassification = 'Xuất sắc';
    gradeClassColor = 'text-amber-500';
  } else if (scoreNum >= 7.0) {
    gradeClassification = 'Khá - Giỏi';
    gradeClassColor = 'text-blue-600';
  } else if (scoreNum >= 5.0) {
    gradeClassification = 'Đạt yêu cầu';
    gradeClassColor = 'text-emerald-600';
  }

  // Populate data into UI elements
  document.getElementById('res-mshv').textContent = student.mshv;
  document.getElementById('res-hoten').textContent = student.hoTen;
  document.getElementById('res-ngaysinh').textContent = student.ngaySinh || 'Chưa cập nhật';
  document.getElementById('res-gioitinh').textContent = student.gioiTinh || '-';
  document.getElementById('res-chuyennganh').textContent = student.chuyenNganh || 'Y khoa';
  document.getElementById('res-diem').textContent = student.diemThiFormatted || student.diemThi;
  document.getElementById('res-ghichu').textContent = student.ghiChu || 'Không có';
  document.getElementById('res-xeploai').textContent = gradeClassification;
  document.getElementById('res-xeploai').className = `font-bold text-sm ${gradeClassColor}`;
  
  document.getElementById('res-rank').textContent = `Hạng ${rankNumber} / ${totalCount} (Top ${topPercent}%)`;

  // Result Badge
  const badge = document.getElementById('res-badge');
  if (isPass) {
    badge.className = 'inline-flex items-center gap-2 px-5 py-2 rounded-full font-black text-base uppercase tracking-wider bg-emerald-100 text-emerald-700 border-2 border-emerald-500 shadow-sm';
    badge.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-600 text-lg"></i> ĐẠT (ĐẬU)';
  } else {
    badge.className = 'inline-flex items-center gap-2 px-5 py-2 rounded-full font-black text-base uppercase tracking-wider bg-rose-100 text-rose-700 border-2 border-rose-500 shadow-sm';
    badge.innerHTML = '<i class="fa-solid fa-circle-xmark text-rose-600 text-lg"></i> KHÔNG ĐẠT (RỚT)';
  }

  // Score Bar
  const scoreBar = document.getElementById('res-score-bar');
  if (scoreBar) {
    scoreBar.style.width = `${scorePercent}%`;
    scoreBar.className = `h-full rounded-full transition-all duration-1000 ${isPass ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-rose-500 to-red-500'}`;
  }

  // Gender Avatar Icon
  const avatarIcon = document.getElementById('res-avatar-icon');
  if (avatarIcon) {
    if (student.gioiTinh === 'Nữ') {
      avatarIcon.className = 'w-20 h-20 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center text-3xl shadow-inner';
      avatarIcon.innerHTML = '<i class="fa-solid fa-user-nurse"></i>';
    } else {
      avatarIcon.className = 'w-20 h-20 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-3xl shadow-inner';
      avatarIcon.innerHTML = '<i class="fa-solid fa-user-doctor"></i>';
    }
  }

  // Print watermark date
  const printDateEl = document.getElementById('print-timestamp');
  if (printDateEl) {
    const now = new Date();
    printDateEl.textContent = `Ngày in phiếu: ${now.toLocaleDateString('vi-VN')} lúc ${now.toLocaleTimeString('vi-VN')}`;
  }

  resultContainer.classList.remove('hidden');
  resultContainer.classList.add('animate-fade-in');

  // Trigger celebratory confetti if Passed with high score (>= 7.5)
  if (isPass && scoreNum >= 7.5 && typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }

  // Scroll to result smoothly
  resultContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Print score card
function printScoreCard() {
  if (!currentSearchedStudent) {
    showToast('Chưa có thông tin học viên để in!', 'error');
    return;
  }
  window.print();
}

// Copy Student Information to Clipboard
function copyStudentInfo() {
  if (!currentSearchedStudent) return;
  const s = currentSearchedStudent;
  const text = `=== THÔNG TIN KẾT QUẢ ĐIỂM THI ===\nMSHV: ${s.mshv}\nHọ và tên: ${s.hoTen}\nNgày sinh: ${s.ngaySinh}\nGiới tính: ${s.gioiTinh}\nChuyên ngành: ${s.chuyenNganh}\nĐiểm thi: ${s.diemThiFormatted || s.diemThi} / 10\nKết quả: ${s.ketQua}\nGhi chú: ${s.ghiChu || 'Không'}`;
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('Đã sao chép thông tin phiếu điểm vào clipboard!', 'success');
  }).catch(() => {
    showToast('Không thể tự động sao chép, vui lòng copy thủ công.', 'error');
  });
}

// Statistics Tab
function updateStats() {
  if (!currentStudents || currentStudents.length === 0) return;

  const total = currentStudents.length;
  let passCount = 0;
  let failCount = 0;
  let totalScore = 0;
  let maxScore = -1;
  let minScore = 999;
  let topStudent = null;

  // Distribution buckets
  let bucketXuatSac = 0; // >= 8.5
  let bucketKhaGioi = 0; // 7.0 - 8.4
  let bucketTrungBinh = 0; // 5.0 - 6.9
  let bucketKhongDat = 0; // < 5.0

  currentStudents.forEach(s => {
    const score = parseFloat(s.diemThi) || 0;
    const isPass = s.ketQua === 'Đậu' || score >= 5.0;

    if (isPass) passCount++;
    else failCount++;

    totalScore += score;
    if (score > maxScore) {
      maxScore = score;
      topStudent = s;
    }
    if (score < minScore) {
      minScore = score;
    }

    if (score >= 8.5) bucketXuatSac++;
    else if (score >= 7.0) bucketKhaGioi++;
    else if (score >= 5.0) bucketTrungBinh++;
    else bucketKhongDat++;
  });

  const avgScore = (totalScore / total).toFixed(2);
  const passRate = ((passCount / total) * 100).toFixed(1);
  const failRate = ((failCount / total) * 100).toFixed(1);

  // Update elements
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pass').textContent = passCount;
  document.getElementById('stat-fail').textContent = failCount;
  document.getElementById('stat-pass-rate').textContent = `${passRate}%`;
  document.getElementById('stat-avg-score').textContent = avgScore;
  document.getElementById('stat-max-score').textContent = maxScore >= 0 ? maxScore : '-';
  document.getElementById('stat-min-score').textContent = minScore <= 10 ? minScore : '-';
  
  if (topStudent) {
    document.getElementById('stat-valedictorian').textContent = `${topStudent.hoTen} (${topStudent.mshv} - ${topStudent.diemThiFormatted || topStudent.diemThi} đ)`;
  }

  // Update distribution bars
  document.getElementById('bar-xuatsac').style.width = `${(bucketXuatSac / total) * 100}%`;
  document.getElementById('label-xuatsac').textContent = `${bucketXuatSac} HS (${((bucketXuatSac / total) * 100).toFixed(1)}%)`;

  document.getElementById('bar-khagioi').style.width = `${(bucketKhaGioi / total) * 100}%`;
  document.getElementById('label-khagioi').textContent = `${bucketKhaGioi} HS (${((bucketKhaGioi / total) * 100).toFixed(1)}%)`;

  document.getElementById('bar-trungbinh').style.width = `${(bucketTrungBinh / total) * 100}%`;
  document.getElementById('label-trungbinh').textContent = `${bucketTrungBinh} HS (${((bucketTrungBinh / total) * 100).toFixed(1)}%)`;

  document.getElementById('bar-khongdat').style.width = `${(bucketKhongDat / total) * 100}%`;
  document.getElementById('label-khongdat').textContent = `${bucketKhongDat} HS (${((bucketKhongDat / total) * 100).toFixed(1)}%)`;
}

// Table Tab (Full Directory)
function renderTable() {
  const tbody = document.getElementById('students-table-body');
  if (!tbody) return;

  // Filter
  let filtered = currentStudents.filter(s => {
    // Status filter
    if (tableState.filterResult === 'Đậu' && s.ketQua !== 'Đậu') return false;
    if (tableState.filterResult === 'Rớt' && s.ketQua !== 'Rớt') return false;

    // Search filter
    if (tableState.search) {
      const q = removeVietnameseTones(tableState.search);
      const mshv = removeVietnameseTones(s.mshv);
      const name = removeVietnameseTones(s.hoTen);
      const stt = String(s.stt);
      return mshv.includes(q) || name.includes(q) || stt === q;
    }
    return true;
  });

  // Sort
  filtered.sort((a, b) => {
    let valA = a[tableState.sortBy];
    let valB = b[tableState.sortBy];

    if (tableState.sortBy === 'diemThi' || tableState.sortBy === 'stt') {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else {
      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();
    }

    if (valA < valB) return tableState.sortAsc ? -1 : 1;
    if (valA > valB) return tableState.sortAsc ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / tableState.pageSize) || 1;
  if (tableState.page > totalPages) tableState.page = totalPages;
  if (tableState.page < 1) tableState.page = 1;

  const startIndex = (tableState.page - 1) * tableState.pageSize;
  const paginated = filtered.slice(startIndex, startIndex + tableState.pageSize);

  document.getElementById('table-count-info').textContent = `Hiển thị ${paginated.length > 0 ? startIndex + 1 : 0} - ${startIndex + paginated.length} trong tổng số ${totalItems} học viên`;

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="px-6 py-12 text-center text-slate-400">
          <i class="fa-solid fa-magnifying-glass text-3xl mb-3 block"></i>
          Không tìm thấy học viên nào phù hợp với bộ lọc.
        </td>
      </tr>
    `;
    renderPagination(totalPages);
    return;
  }

  tbody.innerHTML = paginated.map(s => {
    const isPass = s.ketQua === 'Đậu' || (typeof s.diemThi === 'number' && s.diemThi >= 5.0);
    return `
      <tr class="border-b border-slate-100 hover:bg-blue-50/60 transition cursor-pointer" onclick="quickViewStudent('${s.mshv}')">
        <td class="px-4 py-3 text-center text-xs font-semibold text-slate-500">${s.stt}</td>
        <td class="px-4 py-3 font-mono font-bold text-sm text-blue-600">${s.mshv}</td>
        <td class="px-4 py-3 font-medium text-slate-800">${s.hoTen}</td>
        <td class="px-4 py-3 text-xs text-slate-600">${s.ngaySinh || '-'}</td>
        <td class="px-4 py-3 text-center text-xs">
          <span class="px-2 py-0.5 rounded-md ${s.gioiTinh === 'Nữ' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'} font-medium">
            ${s.gioiTinh || '-'}
          </span>
        </td>
        <td class="px-4 py-3 text-xs text-slate-600">${s.chuyenNganh || 'Y khoa'}</td>
        <td class="px-4 py-3 text-center font-bold text-sm ${isPass ? 'text-emerald-600' : 'text-rose-600'}">${s.diemThiFormatted || s.diemThi}</td>
        <td class="px-4 py-3 text-center">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
            ${s.ketQua}
          </span>
        </td>
        <td class="px-4 py-3 text-center">
          <button class="px-3 py-1 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-medium transition" title="Xem chi tiết">
            <i class="fa-solid fa-eye mr-1"></i> Xem
          </button>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = document.getElementById('table-pagination');
  if (!container) return;

  let html = '';
  // Prev button
  html += `
    <button onclick="changeTablePage(${tableState.page - 1})" ${tableState.page <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium ${tableState.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'} transition">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= tableState.page - 2 && i <= tableState.page + 2)) {
      const active = i === tableState.page;
      html += `
        <button onclick="changeTablePage(${i})" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}">
          ${i}
        </button>
      `;
    } else if (i === tableState.page - 3 || i === tableState.page + 3) {
      html += `<span class="px-1 text-slate-400 text-xs">...</span>`;
    }
  }

  // Next button
  html += `
    <button onclick="changeTablePage(${tableState.page + 1})" ${tableState.page >= totalPages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium ${tableState.page >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'} transition">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  container.innerHTML = html;
}

function changeTablePage(page) {
  tableState.page = page;
  renderTable();
}

function quickViewStudent(mshv) {
  document.getElementById('mshv-input').value = mshv;
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.style.display = 'flex';
  switchTab('lookup');
  handleLookup(mshv);
}

// Table filter event handlers
function handleTableSearch(val) {
  tableState.search = val;
  tableState.page = 1;
  renderTable();
}

function handleTableFilterResult(filter) {
  tableState.filterResult = filter;
  tableState.page = 1;
  
  document.querySelectorAll('.table-filter-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-filter') === filter;
    if (isTarget) {
      btn.className = 'table-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-sm transition';
    } else {
      btn.className = 'table-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition';
    }
  });

  renderTable();
}

function handleTableSort(col) {
  if (tableState.sortBy === col) {
    tableState.sortAsc = !tableState.sortAsc;
  } else {
    tableState.sortBy = col;
    tableState.sortAsc = true;
  }
  renderTable();
}

function handlePageSizeChange(val) {
  tableState.pageSize = parseInt(val, 10);
  tableState.page = 1;
  renderTable();
}

// Export Table to Excel/CSV
function exportTableToExcel() {
  if (!window.XLSX) {
    showToast('Thư viện xuất Excel chưa sẵn sàng!', 'error');
    return;
  }

  const exportData = currentStudents.map(s => ({
    'STT': s.stt,
    'MSHV': s.mshv,
    'Họ và tên': s.hoTen,
    'Ngày sinh': s.ngaySinh,
    'Giới tính': s.gioiTinh,
    'Chuyên ngành': s.chuyenNganh,
    'Điểm thi': s.diemThi,
    'Kết quả': s.ketQua,
    'Ghi chú': s.ghiChu
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Danh sách điểm");
  XLSX.writeFile(workbook, `Bang_diem_MSHV_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('Đã xuất file Excel thành công!', 'success');
}

// Upload & Import Excel
function initUpload() {
  const fileInput = document.getElementById('excel-file-input');
  const dropZone = document.getElementById('excel-dropzone');
  const resetBtn = document.getElementById('reset-default-btn');

  if (!fileInput || !dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-blue-500', 'bg-blue-50/50');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-500', 'bg-blue-50/50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500', 'bg-blue-50/50');
    if (e.dataTransfer.files.length > 0) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processExcelFile(e.target.files[0]);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (window.DEFAULT_STUDENTS_DATA) {
        currentStudents = [...window.DEFAULT_STUDENTS_DATA];
        updateStats();
        renderTable();
        showToast('Đã khôi phục dữ liệu 200 học viên mặc định thành công!', 'success');
        switchTab('lookup');
      }
    });
  }
}

function processExcelFile(file) {
  if (!window.XLSX) {
    showToast('Lỗi: Thư viện đọc Excel chưa tải được!', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (!rawRows || rawRows.length < 2) {
        showToast('File Excel không có dữ liệu hợp lệ!', 'error');
        return;
      }

      // Find header row (row containing MSHV or STT or Họ tên)
      let headerRowIndex = -1;
      let colMap = { stt: -1, mshv: -1, hoTen: -1, ngaySinh: -1, gioiTinh: -1, chuyenNganh: -1, diemThi: -1, ketQua: -1, ghiChu: -1 };

      for (let r = 0; r < Math.min(10, rawRows.length); r++) {
        const row = rawRows[r];
        if (!Array.isArray(row)) continue;
        
        row.forEach((cell, idx) => {
          if (!cell) return;
          const text = removeVietnameseTones(String(cell));
          if (text === 'stt' || text === 'no') colMap.stt = idx;
          else if (text.includes('mshv') || text.includes('ma so') || text.includes('ma hoc vien') || text.includes('sbd')) colMap.mshv = idx;
          else if (text.includes('ho va ten') || text.includes('ho ten') || text.includes('thi sinh')) colMap.hoTen = idx;
          else if (text.includes('ngay sinh') || text.includes('dob')) colMap.ngaySinh = idx;
          else if (text.includes('gioi tinh') || text.includes('gender')) colMap.gioiTinh = idx;
          else if (text.includes('chuyen nganh') || text.includes('nganh') || text.includes('lop')) colMap.chuyenNganh = idx;
          else if (text.includes('diem thi') || text.includes('diem') || text.includes('score')) colMap.diemThi = idx;
          else if (text.includes('ket qua') || text.includes('result')) colMap.ketQua = idx;
          else if (text.includes('ghi chu') || text.includes('note')) colMap.ghiChu = idx;
        });

        if (colMap.mshv !== -1 && colMap.hoTen !== -1) {
          headerRowIndex = r;
          break;
        }
      }

      if (headerRowIndex === -1 || colMap.mshv === -1) {
        // Fallback default column indexes if header row not identified
        colMap = { stt: 0, mshv: 1, hoTen: 2, ngaySinh: 3, gioiTinh: 4, chuyenNganh: 5, diemThi: 6, ketQua: 7, ghiChu: 8 };
        headerRowIndex = 3; // default for our standard format
      }

      // Parse data rows
      const parsedStudents = [];
      for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;
        const mshvVal = row[colMap.mshv];
        if (!mshvVal) continue;

        const scoreRaw = row[colMap.diemThi];
        const scoreNum = parseFloat(scoreRaw) || 0;
        const resultVal = row[colMap.ketQua] ? String(row[colMap.ketQua]).trim() : (scoreNum >= 5.0 ? 'Đậu' : 'Rớt');

        parsedStudents.push({
          stt: row[colMap.stt] ? parseInt(row[colMap.stt], 10) : parsedStudents.length + 1,
          mshv: String(mshvVal).trim(),
          hoTen: row[colMap.hoTen] ? String(row[colMap.hoTen]).trim() : 'Chưa cập nhật',
          ngaySinh: formatExcelDate(row[colMap.ngaySinh]),
          gioiTinh: row[colMap.gioiTinh] ? String(row[colMap.gioiTinh]).trim() : '-',
          chuyenNganh: row[colMap.chuyenNganh] ? String(row[colMap.chuyenNganh]).trim() : 'Y khoa',
          diemThi: scoreNum,
          diemThiFormatted: String(scoreRaw !== undefined ? scoreRaw : scoreNum).trim(),
          ketQua: resultVal,
          ghiChu: row[colMap.ghiChu] ? String(row[colMap.ghiChu]).trim() : ''
        });
      }

      if (parsedStudents.length === 0) {
        showToast('Không đọc được bản ghi học viên nào từ file!', 'error');
        return;
      }

      currentStudents = parsedStudents;
      updateStats();
      renderTable();
      showToast(`Tải thành công ${parsedStudents.length} học viên từ file "${file.name}"!`, 'success');
      switchTab('lookup');

    } catch (err) {
      console.error(err);
      showToast(`Lỗi khi đọc file Excel: ${err.message}`, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
}
