import { useState, useEffect, useMemo, useRef } from 'react';

// Giữ nguyên key cũ để không mất dữ liệu đã chấm
const KEY = 'tuctac_chamcong_v1';
const DEF = { dayRate: 24000, nightRate: 34000 };

// Ca làm nhanh: [nhãn, giờ vào, giờ ra]
const PRESETS = [
  ['7h30 - 12h30', '07:30', '12:30'],
  ['7h30 - 15h', '07:30', '15:00'],
  ['12h - 17h', '12:00', '17:00'],
  ['15h - 22h30', '15:00', '22:30'],
  ['22h - 3h', '22:00', '03:00'],
];

const num = (v) => {
  const n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
  return isFinite(n) && n > 0 ? n : 0;
};
const r2 = (n) => Math.round(n * 100) / 100;
const fh = (n) => String(r2(n));
const vnd = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' đ';
const sk = (n) => Math.round(n / 100) / 10 + 'k';
const p2 = (n) => String(n).padStart(2, '0');
const dkey = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
const toMin = (t) => {
  const a = t.split(':').map(Number);
  return a[0] * 60 + a[1];
};

// Quy tắc mới: xét theo giờ BẮT ĐẦU ca.
// - Bắt đầu từ 22:00 trở đi  -> 100% ca khuya
// - Bắt đầu trước 22:00      -> 100% ca ngày (kể cả giờ ra lố qua 22:00)
// Nếu giờ ra <= giờ vào thì cộng thêm 24 giờ (ca qua 00:00 đêm).
function calcShift(st, en) {
  if (!st || !en) return null;
  const s = toMin(st);
  let e = toMin(en);
  if (e <= s) e += 1440;
  const hours = (e - s) / 60;
  return s >= 1320 ? { day: 0, night: hours } : { day: hours, night: 0 };
}

// Tiền = (giờ ngày + OT ngày) x đơn giá ngày + (giờ khuya + OT đêm) x đơn giá khuya,
// nhân hệ số ngày lễ (nếu có), rồi mới cộng thưởng / phụ cấp.
function calcPay(dH, nH, oD, oN, rd, rn, holiday, mult, bonus) {
  const k = holiday ? mult : 1;
  return ((dH + oD) * rd + (nH + oN) * rn) * k + bonus;
}

// Chuẩn hóa bản ghi (bản ghi cũ chưa có OT / ngày lễ sẽ nhận giá trị mặc định an toàn)
const norm = (e) => ({
  ...e,
  dayH: num(e.dayH),
  nightH: num(e.nightH),
  otDay: num(e.otDay),
  otNight: num(e.otNight),
  isHoliday: !!e.isHoliday,
  holidayMultiplier: e.holidayMultiplier === 3 ? 3 : 2,
  dayRate: e.dayRate || DEF.dayRate,
  nightRate: e.nightRate || DEF.nightRate,
  bonus: num(e.bonus),
});

const entryPay = (e) =>
  calcPay(e.dayH, e.nightH, e.otDay, e.otNight, e.dayRate, e.nightRate, e.isHoliday, e.holidayMultiplier, e.bonus);
const entryHours = (e) => e.dayH + e.nightH + e.otDay + e.otNight;

const Ic = ({ d, s = 20 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    {d.map((x, i) => (
      <path key={i} d={x} />
    ))}
  </svg>
);

const I = {
  prev: ['m15 18-6-6 6-6'],
  next: ['m9 18 6-6-6-6'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  set: ['M20 7h-9', 'M14 17H5', 'M14 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0', 'M23 17a3 3 0 1 0-6 0 3 3 0 0 0 6 0'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  trash: ['M3 6h18', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  down: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  up: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  check: ['M20 6 9 17l-5-5'],
};

function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r && r.entries) {
      const entries = {};
      Object.keys(r.entries).forEach((k) => {
        entries[k] = norm(r.entries[k]);
      });
      return { settings: Object.assign({}, DEF, r.settings), entries };
    }
  } catch (e) {}
  return { settings: { ...DEF }, entries: {} };
}

function Editor({ date, entry, settings, onSave, onDelete, onClose }) {
  // Đơn giá được lưu cứng (snapshot): ngày đã có dữ liệu giữ nguyên đơn giá cũ
  const rates = entry ? { d: entry.dayRate, n: entry.nightRate } : { d: settings.dayRate, n: settings.nightRate };
  const [f, setF] = useState({
    dayH: entry && entry.dayH ? fh(entry.dayH) : '',
    nightH: entry && entry.nightH ? fh(entry.nightH) : '',
    start: entry ? entry.start || '' : '',
    end: entry ? entry.end || '' : '',
    otDay: entry && entry.otDay ? fh(entry.otDay) : '',
    otNight: entry && entry.otNight ? fh(entry.otNight) : '',
    isHoliday: entry ? !!entry.isHoliday : false,
    mult: entry && entry.holidayMultiplier === 3 ? 3 : 2,
    bonus: entry && entry.bonus ? String(entry.bonus) : '',
    note: entry ? entry.note || '' : '',
  });
  const set = (k, v) => setF((o) => ({ ...o, [k]: v }));
  const times = (s, e) => {
    const c = calcShift(s, e);
    setF((o) => ({
      ...o,
      start: s,
      end: e,
      ...(c ? { dayH: c.day ? fh(c.day) : '', nightH: c.night ? fh(c.night) : '' } : {}),
    }));
  };
  const toggleHoliday = () => setF((o) => ({ ...o, isHoliday: !o.isHoliday, mult: 2 }));

  const dH = num(f.dayH);
  const nH = num(f.nightH);
  const oD = num(f.otDay);
  const oN = num(f.otNight);
  const bonus = Math.round(num(f.bonus));
  const totalH = dH + nH + oD + oN;
  const total = calcPay(dH, nH, oD, oN, rates.d, rates.n, f.isHoliday, f.mult, bonus);
  const [y, m, d] = date.split('-').map(Number);
  const wd = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][new Date(y, m - 1, d).getDay()];

  const save = () =>
    onSave({
      ...(entry || {}),
      dayH: r2(dH),
      nightH: r2(nH),
      otDay: r2(oD),
      otNight: r2(oN),
      isHoliday: f.isHoliday,
      holidayMultiplier: f.mult,
      dayRate: rates.d,
      nightRate: rates.n,
      start: f.start,
      end: f.end,
      bonus: bonus,
      note: f.note.trim(),
    });

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="disp text-xl font-extrabold">
              {wd}, {p2(d)}/{p2(m)}/{y}
            </div>
            <div style={{ color: 'var(--mute)', fontSize: 12 }}>
              Đơn giá ngày này: {vnd(rates.d)}/h ngày · {vnd(rates.n)}/h khuya
            </div>
          </div>
          <button className="chip" onClick={onClose} aria-label="Đóng">
            <Ic d={I.x} s={18} />
          </button>
        </div>

        <span className="lbl">Ca làm nhanh (chạm 1 lần)</span>
        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((p) => (
            <button key={p[0]} className="chip" onClick={() => times(p[1], p[2])}>
              {p[0]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <span className="lbl">Giờ vào</span>
            <input type="time" value={f.start} onChange={(e) => times(e.target.value, f.end)} />
          </div>
          <div>
            <span className="lbl">Giờ ra</span>
            <input type="time" value={f.end} onChange={(e) => times(f.start, e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <span className="lbl">Số giờ ca ngày</span>
            <input inputMode="decimal" placeholder="0" value={f.dayH} onChange={(e) => set('dayH', e.target.value)} />
          </div>
          <div>
            <span className="lbl">Số giờ ca khuya</span>
            <input inputMode="decimal" placeholder="0" value={f.nightH} onChange={(e) => set('nightH', e.target.value)} />
          </div>
        </div>

        <span className="lbl">OT dọn vệ sinh / họp cửa hàng (số giờ)</span>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <input inputMode="decimal" placeholder="OT ngày (7h–22h)" value={f.otDay} onChange={(e) => set('otDay', e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--mute)', margin: '4px 2px 0' }}>Tính giá ca ngày</div>
          </div>
          <div>
            <input inputMode="decimal" placeholder="OT đêm (từ 22h)" value={f.otNight} onChange={(e) => set('otNight', e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--mute)', margin: '4px 2px 0' }}>Tính giá ca khuya</div>
          </div>
        </div>

        <div className="card p-3 mb-4" style={{ background: 'var(--bg)' }}>
          <button
            type="button"
            role="checkbox"
            aria-checked={f.isHoliday}
            onClick={toggleHoliday}
            className="flex items-center gap-3 w-full"
            style={{ minHeight: 44, textAlign: 'left' }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                flexShrink: 0,
                border: '2px solid ' + (f.isHoliday ? 'var(--brand)' : 'var(--line)'),
                background: f.isHoliday ? 'var(--brand)' : 'var(--card)',
                color: 'var(--brand-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {f.isHoliday && <Ic d={I.check} s={16} />}
            </span>
            <span style={{ fontWeight: 700 }}>Ngày lễ</span>
            <span style={{ fontSize: 12, color: 'var(--mute)' }}>nhân hệ số toàn bộ giờ công</span>
          </button>
          {f.isHoliday && (
            <div className="flex gap-2 mt-2">
              {[2, 3].map((x) => (
                <button
                  key={x}
                  className="chip flex-1"
                  onClick={() => set('mult', x)}
                  style={
                    f.mult === x
                      ? { background: 'var(--brand)', color: 'var(--brand-ink)', borderColor: 'var(--brand)', minHeight: 44, fontSize: 16 }
                      : { minHeight: 44, fontSize: 16 }
                  }
                >
                  x{x}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="lbl">Thưởng / Phụ cấp (+)</span>
        <input className="mb-4" inputMode="numeric" placeholder="0" value={f.bonus} onChange={(e) => set('bonus', e.target.value.replace(/[^\d]/g, ''))} />

        <span className="lbl">Ghi chú</span>
        <input className="mb-4" placeholder="Ví dụ: đổi ca, làm thêm…" value={f.note} onChange={(e) => set('note', e.target.value)} />

        <div className="card p-4 mb-4" style={{ background: 'var(--day-bg)' }}>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>
            {fh(totalH)} giờ ({fh(dH + oD)} ngày + {fh(nH + oN)} khuya)
            {f.isHoliday ? ' · Ngày lễ x' + f.mult : ''}
          </div>
          <div className="disp text-2xl font-extrabold" style={{ color: 'var(--brand)' }}>
            {vnd(total)}
          </div>
        </div>

        <div className="flex gap-3">
          {entry && (
            <button className="btn btn-s" style={{ color: 'var(--danger)' }} onClick={onDelete}>
              <span className="flex items-center gap-1">
                <Ic d={I.trash} s={17} />
                Xóa
              </span>
            </button>
          )}
          <button className="btn btn-p flex-1" onClick={save}>
            Lưu chấm công
          </button>
        </div>
      </div>
    </div>
  );
}

function TextModal({ title, text, editable, filename, mime, confirmLabel, onConfirm, onClose }) {
  const [v, setV] = useState(text || '');
  const [msg, setMsg] = useState('');
  const ref = useRef(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(v);
      setMsg('Đã sao chép.');
    } catch (e) {
      if (ref.current) ref.current.select();
      setMsg('Hãy giữ và chọn Sao chép.');
    }
  };
  const dl = () => {
    try {
      const b = new Blob([v], { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMsg('Đã tạo file ' + filename);
    } catch (e) {
      setMsg('Không tải được, hãy dùng Sao chép.');
    }
  };
  const share = async () => {
    try {
      await navigator.share({ files: [new File([v], filename, { type: mime })] });
    } catch (e) {
      setMsg('Không chia sẻ được, hãy dùng Sao chép.');
    }
  };
  const pick = (e) => {
    const fl = e.target.files[0];
    if (!fl) return;
    const r = new FileReader();
    r.onload = () => setV(String(r.result));
    r.readAsText(fl);
  };

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="disp text-xl font-extrabold">{title}</div>
          <button className="chip" onClick={onClose} aria-label="Đóng">
            <Ic d={I.x} s={18} />
          </button>
        </div>
        {editable && <input type="file" accept=".json,application/json" onChange={pick} className="mb-3" />}
        <textarea
          ref={ref}
          rows={8}
          value={v}
          readOnly={!editable}
          onChange={(e) => setV(e.target.value)}
          style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13 }}
        />
        {msg && <div style={{ fontSize: 13, color: 'var(--tea)', margin: '8px 2px' }}>{msg}</div>}
        <div className="flex flex-wrap gap-2 mt-3">
          {editable ? (
            <button className="btn btn-p flex-1" onClick={() => onConfirm(v)}>
              {confirmLabel}
            </button>
          ) : (
            <>
              <button className="btn btn-p flex-1" onClick={copy}>
                Sao chép
              </button>
              <button className="btn btn-s" onClick={dl}>
                Tải file
              </button>
              {navigator.share && (
                <button className="btn btn-s" onClick={share}>
                  Chia sẻ
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ l, v, c, sub }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>{l}</div>
      <div className="disp font-extrabold" style={{ fontSize: 21, color: c || 'var(--ink)', lineHeight: 1.2 }}>
        {v}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const now = new Date();
  const [data, setData] = useState(load);
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [sel, setSel] = useState(null);
  const [panel, setPanel] = useState(null);
  const [text, setText] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }, [data]);

  const { y, m } = view;
  const pre = y + '-' + p2(m) + '-';
  const days = new Date(y, m, 0).getDate();
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const todayKey = dkey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // Tổng kết tháng: giờ làm + OT cộng chung vào giờ ngày / giờ khuya.
  // Giờ làm trong ngày lễ được tách riêng thành "giờ lễ" (số giờ thực làm, chưa nhân hệ số).
  const S = useMemo(() => {
    let dh = 0;
    let nh = 0;
    let hol = 0;
    let earn = 0;
    Object.keys(data.entries).forEach((k) => {
      if (k.indexOf(pre) !== 0) return;
      const e = data.entries[k];
      const dPart = e.dayH + e.otDay;
      const nPart = e.nightH + e.otNight;
      if (e.isHoliday) {
        hol += dPart + nPart;
      } else {
        dh += dPart;
        nh += nPart;
      }
      earn += entryPay(e);
    });
    return { dh, nh, hol, earn };
  }, [data, pre]);

  const move = (n) =>
    setView((v) => {
      let mm = v.m + n;
      let yy = v.y;
      if (mm < 1) {
        mm = 12;
        yy--;
      }
      if (mm > 12) {
        mm = 1;
        yy++;
      }
      return { y: yy, m: mm };
    });

  const save = (k, e) => {
    setData((d) => {
      const en = { ...d.entries };
      const empty = !e.dayH && !e.nightH && !e.otDay && !e.otNight && !e.bonus && !e.advance && !e.note;
      if (empty) delete en[k];
      else en[k] = norm(e);
      return { ...d, entries: en };
    });
    setSel(null);
  };

  const del = (k) => {
    setData((d) => {
      const en = { ...d.entries };
      delete en[k];
      return { ...d, entries: en };
    });
    setSel(null);
  };

  const setRate = (field, value) =>
    setData((d) => ({ ...d, settings: { ...d.settings, [field]: Number(value.replace(/[^\d]/g, '')) } }));

  const exportCSV = () => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [
      ['Ngày', 'Giờ ca ngày', 'Giờ ca khuya', 'OT ngày', 'OT đêm', 'Tổng giờ', 'Hệ số ngày lễ', 'Tiền mặt', 'Ghi chú'].join(','),
    ];
    Object.keys(data.entries)
      .filter((k) => k.indexOf(pre) === 0)
      .sort()
      .forEach((k) => {
        const e = data.entries[k];
        const p = k.split('-');
        rows.push(
          [
            p[2] + '/' + p[1] + '/' + p[0],
            fh(e.dayH),
            fh(e.nightH),
            fh(e.otDay),
            fh(e.otNight),
            fh(entryHours(e)),
            e.isHoliday ? 'x' + e.holidayMultiplier : '',
            Math.round(entryPay(e)),
            q(e.note || ''),
          ].join(',')
        );
      });
    setText({
      title: 'Xuất CSV tháng ' + p2(m) + '/' + y,
      text: '\uFEFF' + rows.join('\r\n'),
      filename: 'cham-cong-' + y + '-' + p2(m) + '.csv',
      mime: 'text/csv;charset=utf-8',
    });
  };

  const importJSON = (v) => {
    try {
      const r = JSON.parse(v);
      if (!r || typeof r.entries !== 'object') throw new Error('invalid');
      const entries = {};
      Object.keys(r.entries).forEach((k) => {
        entries[k] = norm(r.entries[k]);
      });
      setData({ settings: Object.assign({}, DEF, r.settings), entries });
      setText(null);
      setPanel(null);
    } catch (e) {
      alert('File không hợp lệ. Hãy dán đúng nội dung file sao lưu JSON.');
    }
  };

  const dn = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(<div key={'b' + i} />);
  for (let d = 1; d <= days; d++) {
    const k = dkey(y, m, d);
    const e = data.entries[k];
    const h = e ? entryHours(e) : 0;
    const has = e && (h > 0 || e.bonus > 0);
    cells.push(
      <button key={k} className={'cell' + (has ? ' has' : '') + (k === todayKey ? ' today' : '')} onClick={() => setSel(k)}>
        <span className="n" style={k === todayKey ? { color: 'var(--today)' } : null}>
          {d}
        </span>
        {e && h > 0 && (
          <>
            <span style={{ fontWeight: 600 }}>{fh(h)}h</span>
            <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{sk(entryPay(e))}</span>
          </>
        )}
        {e && h === 0 && e.bonus > 0 ? <span style={{ color: 'var(--mute)' }}>•</span> : null}
        {e && e.isHoliday && (
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: 3,
              background: 'var(--brand)',
              color: 'var(--brand-ink)',
              borderRadius: 6,
              padding: '0 3px',
              fontSize: 9,
              fontWeight: 800,
              lineHeight: '13px',
            }}
          >
            x{e.holidayMultiplier}
          </span>
        )}
        {e && e.nightH + e.otNight > 0 && (
          <span style={{ position: 'absolute', top: 3, right: 3, color: 'var(--night)' }}>
            <Ic d={I.moon} s={11} />
          </span>
        )}
      </button>
    );
  }

  const hoursSub =
    fh(S.dh) + ' giờ ngày + ' + fh(S.nh) + ' giờ khuya' + (S.hol > 0 ? ' + ' + fh(S.hol) + ' giờ lễ' : '');

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="hdr">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <img
              src="/icon-192.png"
              alt=""
              width="40"
              height="40"
              style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--line)', padding: 0 }}
            />
            <h1 className="text-xl font-extrabold m-0" style={{ color: 'var(--brand)' }}>
              Tức Tắc Tea
            </h1>
          </div>
          <button className="chip" onClick={() => setPanel('set')} aria-label="Cài đặt">
            <Ic d={I.set} s={18} />
          </button>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between mb-3">
            <button className="chip" onClick={() => move(-1)} aria-label="Tháng trước">
              <Ic d={I.prev} s={18} />
            </button>
            <div className="disp font-extrabold text-lg">
              Tháng {p2(m)}/{y}
            </div>
            <button className="chip" onClick={() => move(1)} aria-label="Tháng sau">
              <Ic d={I.next} s={18} />
            </button>
          </div>
          <div className="grid grid-cols-2 items-start">
            <div style={{ paddingRight: 12 }}>
              <Stat l="Tổng số tiếng" v={fh(S.dh + S.nh + S.hol) + ' giờ'} sub={hoursSub} />
            </div>
            <div style={{ paddingLeft: 12, borderLeft: '1.5px solid var(--line)' }}>
              <Stat l="Tổng tiền kiếm được" v={vnd(S.earn)} c="var(--brand)" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '6px 14px 30px' }}>
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {dn.map((x) => (
            <div key={x} style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: x === 'CN' ? 'var(--danger)' : 'var(--mute)' }}>
              {x}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">{cells}</div>
        <div className="flex items-center gap-2 mt-3" style={{ fontSize: 12, color: 'var(--mute)' }}>
          <span style={{ color: 'var(--night)' }}>
            <Ic d={I.moon} s={13} />
          </span>
          có làm ca khuya · chạm vào ngày để chấm công
        </div>
      </div>

      {sel && (
        <Editor
          key={sel}
          date={sel}
          entry={data.entries[sel]}
          settings={data.settings}
          onSave={(e) => save(sel, e)}
          onDelete={() => del(sel)}
          onClose={() => setSel(null)}
        />
      )}

      {panel === 'set' && (
        <div className="sheet-bg" onClick={() => setPanel(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="disp text-xl font-extrabold">Cài đặt</div>
              <button className="chip" onClick={() => setPanel(null)} aria-label="Đóng">
                <Ic d={I.x} s={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <span className="lbl">Đơn giá ca ngày (đ/giờ)</span>
                <input inputMode="numeric" value={data.settings.dayRate} onChange={(e) => setRate('dayRate', e.target.value)} />
              </div>
              <div>
                <span className="lbl">Đơn giá ca khuya (đ/giờ)</span>
                <input inputMode="numeric" value={data.settings.nightRate} onChange={(e) => setRate('nightRate', e.target.value)} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mute)', margin: '0 2px 16px' }}>
              Ca khuya: ca bắt đầu từ 22:00 trở đi. Ca ngày: ca bắt đầu trước 22:00 (tính 100% giá ca ngày kể cả khi giờ ra lố qua 22:00). Đơn giá mới chỉ áp dụng cho ngày chấm công mới; các ngày cũ giữ nguyên đơn giá đã lưu.
            </p>
            <div className="flex flex-col gap-2">
              <button className="btn btn-s flex items-center justify-center gap-2" onClick={exportCSV}>
                <Ic d={I.down} s={18} />
                Xuất CSV tháng {p2(m)}/{y}
              </button>
              <button
                className="btn btn-s flex items-center justify-center gap-2"
                onClick={() =>
                  setText({
                    title: 'Sao lưu JSON',
                    text: JSON.stringify(data, null, 2),
                    filename: 'cham-cong-sao-luu.json',
                    mime: 'application/json',
                  })
                }
              >
                <Ic d={I.down} s={18} />
                Sao lưu (Export JSON)
              </button>
              <button
                className="btn btn-s flex items-center justify-center gap-2"
                onClick={() => setText({ title: 'Khôi phục JSON', text: '', editable: true, confirmLabel: 'Khôi phục dữ liệu' })}
              >
                <Ic d={I.up} s={18} />
                Khôi phục (Import JSON)
              </button>
            </div>
          </div>
        </div>
      )}

      {text && <TextModal {...text} onConfirm={importJSON} onClose={() => setText(null)} />}
    </div>
  );
}