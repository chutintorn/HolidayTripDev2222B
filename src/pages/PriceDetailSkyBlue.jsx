// src/pages/PriceDetailSkyBlue.jsx
import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STR = {
  en: {
    title: 'Flight Booking – Login + Round-trip + Travellers + SkyBlue Add-ons',
    priceSummary: 'Price Summary',
    baseFare: 'Base Fare',
    tax: 'Tax',
    total: 'Total',
    back: 'Back',
    book: 'Book Now',
  },
  th: {
    title: 'จองตั๋วเครื่องบิน – เข้าสู่ระบบ + ไป-กลับ + ผู้โดยสาร + ส่วนเสริม SkyBlue',
    priceSummary: 'สรุปราคา',
    baseFare: 'ค่าโดยสารพื้นฐาน',
    tax: 'ภาษี',
    total: 'ราคารวม',
    back: 'ย้อนกลับ',
    book: 'จองตอนนี้',
  }
};

export default function PriceDetailSkyBlue() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { priceDetail, lang: initialLang = 'en' } = state || {};
  const [lang, setLang] = useState(initialLang === 'th' ? 'th' : 'en');
  const t = STR[lang];

  // Defensive mapping for different API shapes
  const detail = useMemo(() => {
    if (!priceDetail) return null;
    const d = Array.isArray(priceDetail) ? priceDetail[0] : priceDetail;
    const base = d?.baseFareAmount ?? d?.baseFare ?? d?.base ?? 0;
    const tax  = d?.taxAmount ?? d?.tax ?? 0;
    const total = d?.totalAmount ?? d?.total ?? (Number(base) + Number(tax));
    return { baseFareAmount: base, taxAmount: tax, totalAmount: total, raw: d };
  }, [priceDetail]);

  if (!detail) {
    return (
      <div style={{ padding: 20 }}>
        <p>⛔ No price detail available. Please go back and select a fare.</p>
        <button onClick={() => navigate(-1)}>Back</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', background: '#fafafa', minHeight: '100vh', margin: 0 }}>
      {/* Top bar with language toggle */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', background: '#ffffff', borderBottom: '1px solid #e9e9e9',
        position: 'sticky', top: 0, zIndex: 5
      }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>{t.title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setLang('th')}
            style={{
              border: '1px solid #00b8ff', padding: '6px 10px', borderRadius: 8,
              background: lang === 'th' ? '#e6f8ff' : '#fff', cursor: 'pointer'
            }}
          >ไทย</button>
          <button
            onClick={() => setLang('en')}
            style={{
              border: '1px solid #00b8ff', padding: '6px 10px', borderRadius: 8,
              background: lang === 'en' ? '#e6f8ff' : '#fff', cursor: 'pointer'
            }}
          >English</button>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ maxWidth: 1100, margin: '20px auto', padding: '0 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
          {/* LEFT COLUMN: Placeholder for your full HTML form pieces */}
          <div>
            <div style={{
              background: '#fff', border: '1px solid #e9e9e9', borderRadius: 12,
              padding: 16, marginBottom: 16
            }}>
              <h2 style={{ margin: '0 0 8px' }}>Form Area</h2>
              <p style={{ margin: 0, color: '#666' }}>
                Paste your form elements here (login box, round-trip controls, travellers, add-ons, etc.).
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Price summary bound to API */}
          <aside style={{
            background: '#fff', border: '1px solid #e9e9e9', borderRadius: 12, padding: 16, height: 'fit-content'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>{t.priceSummary}</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 8 }}>
              <div style={{ color: '#555' }}>{t.baseFare}</div>
              <div><strong>{Number(detail.baseFareAmount).toLocaleString()}</strong> THB</div>

              <div style={{ color: '#555' }}>{t.tax}</div>
              <div><strong>{Number(detail.taxAmount).toLocaleString()}</strong> THB</div>

              <div style={{ height: 1, background: '#e9e9e9', gridColumn: '1 / -1', margin: '6px 0' }} />

              <div style={{ color: '#0a5c57' }}>{t.total}</div>
              <div style={{ fontSize: 18, color: '#0077aa' }}>
                <strong>{Number(detail.totalAmount).toLocaleString()}</strong> THB
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => navigate(-1)}
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}
              >
                {t.back}
              </button>
              <button
                onClick={() => alert('🚧 Booking feature coming soon!')}
                style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: '#00b8ff', color: '#fff', cursor: 'pointer' }}
              >
                {t.book}
              </button>
            </div>

            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', color: '#666' }}>Show raw response</summary>
              <pre style={{
                background: '#f7f7f7', border: '1px solid #eee', borderRadius: 8, padding: 10,
                overflowX: 'auto', fontSize: 12
              }}>
                {JSON.stringify(detail.raw, null, 2)}
              </pre>
            </details>
          </aside>
        </div>
      </div>
    </div>
  );
}
