import { useState, useEffect, useMemo, useRef } from 'react';

const KEY = 'tuctac_chamcong_v1';
const DEF = { dayRate: 24000, nightRate: 34000 };
const PRESETS = [
  ['7h30 - 15h', '07:30', '15:00'],
  ['12h - 17h', '12:00', '17:00'],
  ['17h - 22h', '17:00', '22:00'],
  ['22h - 3h', '22:00', '03:00'],
  ['17h - 3h', '17:00', '03:00'],
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
const ov = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));

// Tách giờ ca ngày / ca khuya, xử lý cả ca qua 00:00
function calcShift(st, en) {
  if (!st || !en) return null;
  const s = toMin(st);
  let e = toMin(en);
  if (e <= s) e += 1440;
  const D = [[450, 1320], [1890, 2760]];
  const N = [[0, 450], [1320, 1890], [2760, 3330]];
  const sum = (R) => R.reduce((t, r) => t + ov(s, e, r[0], r[1]), 0) / 60;
  return { day: sum(D), night: sum(N) };
}

const wage = (e) => e.dayH * e.dayRate + e.nightH * e.nightRate;

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
};

function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r && r.entries) return { settings: Object.assign({}, DEF, r.settings), entries: r.entries };
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
    bonus: entry && entry.bonus ? String(entry.bonus) : '',
    advance: entry && entry.advance ? String(entry.advance) : '',
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
  const dH = num(f.dayH);
  const nH = num(f.nightH);
  const w = dH * rates.d + nH * rates.n;
  const total = w + num(f.bonus);
  const [y, m, d] = date.split('-').map(Number);
  const wd = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][new Date(y, m - 1, d).getDay()];
  const save = () =>
    onSave({
      dayH: r2(dH),
      nightH: r2(nH),
      dayRate: rates.d,
      nightRate: rates.n,
      start: f.start,
      end: f.end,
      bonus: Math.round(num(f.bonus)),
      advance: Math.round(num(f.advance)),
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

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <span className="lbl">Thưởng / Phụ cấp (+)</span>
            <input inputMode="numeric" placeholder="0" value={f.bonus} onChange={(e) => set('bonus', e.target.value.replace(/[^\d]/g, ''))} />
          </div>
          <div>
            <span className="lbl">Tạm ứng tiền mặt (-)</span>
            <input inputMode="numeric" placeholder="0" value={f.advance} onChange={(e) => set('advance', e.target.value.replace(/[^\d]/g, ''))} />
          </div>
        </div>

        <span className="lbl">Ghi chú</span>
        <input className="mb-4" placeholder="Ví dụ: đổi ca, làm thêm…" value={f.note} onChange={(e) => set('note', e.target.value)} />

        <div className="card p-4 mb-4 flex items-center justify-between" style={{ background: 'var(--day-bg)' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--mute)' }}>
              {fh(dH + nH)} giờ ({fh(dH)} ngày + {fh(nH)} khuya)
            </div>
            <div className="disp text-2xl font-extrabold" style={{ color: 'var(--brand)' }}>
              {vnd(total)}
            </div>
          </div>
          {num(f.advance) > 0 && (
            <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 700 }}>Ứng −{vnd(num(f.advance))}</div>
          )}
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

function Stat({ l, v, c }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>{l}</div>
      <div className="disp font-extrabold" style={{ fontSize: 17, color: c || 'var(--ink)', lineHeight: 1.2 }}>
        {v}
      </div>
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

  const S = useMemo(() => {
    let dh = 0;
    let nh = 0;
    let earn = 0;
    let adv = 0;
    Object.keys(data.entries).forEach((k) => {
      if (k.indexOf(pre) !== 0) return;
      const e = data.entries[k];
      dh += e.dayH;
      nh += e.nightH;
      earn += wage(e) + (e.bonus || 0);
      adv += e.advance || 0;
    });
    return { dh, nh, earn, adv };
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
      if (!e.dayH && !e.nightH && !e.bonus && !e.advance && !e.note) delete en[k];
      else en[k] = e;
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
    const rows = [['Ngày', 'Giờ ca ngày', 'Giờ ca khuya', 'Tổng giờ', 'Tiền mặt', 'Tạm ứng', 'Ghi chú'].join(',')];
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
            fh(e.dayH + e.nightH),
            Math.round(wage(e) + (e.bonus || 0)),
            e.advance || 0,
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
      setData({ settings: Object.assign({}, DEF, r.settings), entries: r.entries });
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
    const h = e ? e.dayH + e.nightH : 0;
    cells.push(
      <button
        key={k}
        className={'cell' + (e && (h > 0 || e.bonus || e.advance) ? ' has' : '') + (k === todayKey ? ' today' : '')}
        onClick={() => setSel(k)}
      >
        <span className="n" style={k === todayKey ? { color: 'var(--today)' } : null}>
          {d}
        </span>
        {e && h > 0 && (
          <>
            <span style={{ fontWeight: 600 }}>{fh(h)}h</span>
            <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{sk(wage(e) + (e.bonus || 0))}</span>
          </>
        )}
        {e && h === 0 && (e.bonus || e.advance) ? <span style={{ color: 'var(--mute)' }}>•</span> : null}
        {e && e.nightH > 0 && (
          <span style={{ position: 'absolute', top: 3, right: 3, color: 'var(--night)' }}>
            <Ic d={I.moon} s={11} />
          </span>
        )}
      </button>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="hdr">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <img src="/icon-192.png" alt="" width="40" height="40" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover', border: '2px solid var(--line)', padding: 0 }} />
            <h1 className="text-xl font-extrabold m-0" style={{ color: 'var(--brand)' }}>
              Chấm công nè alo
            </h1>
          </div>
          <button className="chip" onClick={() => setPanel('set')} aria-label="Cài đặt">
            <Ic d={I.set} s={18} />
          </button>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <Stat l="Tổng số tiếng" v={fh(S.dh + S.nh) + ' giờ'} />
              <div style={{ fontSize: 11, color: 'var(--mute)' }}>
                {fh(S.dh)} giờ ngày + {fh(S.nh)} giờ khuya
              </div>
            </div>
            <Stat l="Tổng tiền kiếm được" v={vnd(S.earn)} c="var(--brand)" />
            <Stat l="Đã tạm ứng" v={vnd(S.adv)} c="var(--danger)" />
            <Stat l="Thực nhận còn lại" v={vnd(S.earn - S.adv)} c="var(--tea)" />
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
              Ca ngày 07:30–22:00, ca khuya 22:00–07:30. Đơn giá mới chỉ áp dụng cho ngày chấm công mới; các ngày cũ giữ nguyên đơn giá đã lưu.
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