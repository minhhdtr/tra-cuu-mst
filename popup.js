const API = 'https://hoadondientu.gdt.gov.vn/api/category/public/dsdkts/';
const KHOA_LICH_SU = 'lichSu';
const KHOA_MO_JSON = 'moJson';
const SO_MUC_LICH_SU = 10;

// Nơi lưu lịch sử. Nếu manifest thiếu quyền "storage" thì biến này rỗng,
// phần lịch sử tự tắt và không ảnh hưởng đến việc tra cứu.
const kho =
  (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;

// Mã trạng thái MST. Thêm mã khác vào đây khi cần, mã chưa khai sẽ hiện dạng "Trạng thái xx".
const TRANG_THAI = {
  '00': 'Đang hoạt động'
};

const $ = (id) => document.getElementById(id);

const form = $('form-tra-cuu');
const oMst = $('mst');
const nutTraCuu = $('nut-tra-cuu');
const oThongBao = $('thong-bao');
const oKetQua = $('ket-qua');
const oTenNnt = $('ten-nnt');
const oSoMst = $('so-mst');
const oChip = $('chip-trang-thai');
const nutSaoChep = $('nut-sao-chep');
const khungJson = $('khung-json');
const oJson = $('json');
const khungLichSu = $('khung-lich-su');
const oLichSu = $('lich-su');
const nutXoaLichSu = $('nut-xoa-lich-su');

let vanBanSaoChep = '';

function thongBao(noiDung, loi = false) {
  oThongBao.textContent = noiDung;
  oThongBao.classList.toggle('loi', loi);
  oThongBao.hidden = !noiDung;
}

function datJson(noiDung) {
  vanBanSaoChep = noiDung;
  oJson.textContent = noiDung;
  oKetQua.hidden = false;
}

function veKetQua(data, json) {
  oTenNnt.textContent = data.tennnt || '(không có tên)';
  oSoMst.textContent = data.mst || '';
  oChip.textContent = TRANG_THAI[data.tthai] || `Trạng thái ${data.tthai ?? '?'}`;
  oChip.className = 'chip' + (data.tthai === '00' ? ' hoat-dong' : '');
  datJson(json);
}

function veTho(status, noiDung) {
  oTenNnt.textContent = `HTTP ${status}`;
  oSoMst.textContent = '';
  oChip.textContent = 'Không đọc được dữ liệu';
  oChip.className = 'chip';
  khungJson.open = true;
  datJson(noiDung);
}

async function traCuu(mstVao) {
  const mst = (mstVao || '').replace(/\s+/g, '');
  if (!mst) {
    oMst.focus();
    return;
  }

  oMst.value = mst;
  nutTraCuu.disabled = true;
  oKetQua.hidden = true;
  thongBao(`Đang tra cứu ${mst}...`);

  try {
    const res = await fetch(API + encodeURIComponent(mst) + '/manager', {
      headers: { 'Request-Id': crypto.randomUUID() },
      cache: 'no-store'
    });

    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}

    thongBao('');

    if (res.ok && data && data.mst) {
      veKetQua(data, JSON.stringify(data, null, 2));
      luuLichSu(data.mst, data.tennnt || '');
    } else {
      veTho(res.status, data ? JSON.stringify(data, null, 2) : text);
    }
  } catch (e) {
    thongBao(`Lỗi: ${e.message}`, true);
  } finally {
    nutTraCuu.disabled = false;
  }
}

/* Lịch sử tra cứu, lưu trong máy bằng chrome.storage.local */

async function docLichSu() {
  if (!kho) return [];
  const kq = await kho.get(KHOA_LICH_SU);
  return Array.isArray(kq[KHOA_LICH_SU]) ? kq[KHOA_LICH_SU] : [];
}

async function luuLichSu(mst, ten) {
  if (!kho) return;
  try {
    const cu = await docLichSu();
    const moi = [{ mst, ten }, ...cu.filter((m) => m.mst !== mst)].slice(0, SO_MUC_LICH_SU);
    await kho.set({ [KHOA_LICH_SU]: moi });
    veLichSu(moi);
  } catch {}
}

function veLichSu(danhSach) {
  oLichSu.textContent = '';
  khungLichSu.hidden = danhSach.length === 0;

  for (const muc of danhSach) {
    const nut = document.createElement('button');
    nut.type = 'button';
    nut.dataset.mst = muc.mst;

    const oMa = document.createElement('span');
    oMa.className = 'ls-mst';
    oMa.textContent = muc.mst;

    const oTen = document.createElement('span');
    oTen.className = 'ls-ten';
    oTen.textContent = muc.ten || '';

    nut.append(oMa, oTen);

    const li = document.createElement('li');
    li.append(nut);
    oLichSu.append(li);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  traCuu(oMst.value);
});

oLichSu.addEventListener('click', (e) => {
  const nut = e.target.closest('button[data-mst]');
  if (nut) traCuu(nut.dataset.mst);
});

nutXoaLichSu.addEventListener('click', async () => {
  if (kho) {
    try {
      await kho.remove(KHOA_LICH_SU);
    } catch {}
  }
  veLichSu([]);
  oMst.focus();
});

nutSaoChep.addEventListener('click', async () => {
  if (!vanBanSaoChep) return;
  try {
    await navigator.clipboard.writeText(vanBanSaoChep);
    nutSaoChep.textContent = 'Đã chép';
    setTimeout(() => {
      nutSaoChep.textContent = 'Sao chép JSON';
    }, 1500);
  } catch {
    thongBao('Không sao chép được', true);
  }
});

(async function khoiTao() {
  oMst.focus();
  if (!kho) return;

  try {
    const kq = await kho.get([KHOA_LICH_SU, KHOA_MO_JSON]);

    khungJson.open = kq[KHOA_MO_JSON] !== false;
    khungJson.addEventListener('toggle', () => {
      kho.set({ [KHOA_MO_JSON]: khungJson.open }).catch(() => {});
    });

    veLichSu(Array.isArray(kq[KHOA_LICH_SU]) ? kq[KHOA_LICH_SU] : []);
  } catch {}
})();
