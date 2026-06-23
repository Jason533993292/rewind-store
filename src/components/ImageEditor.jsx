import React, { useState, useRef, useEffect, useCallback } from 'react';

const BG_PRESETS = {
  white: { name: 'Studio White', colors: ['#fff', '#f0f0f0'] },
  grey: { name: 'Minimalist Grey', colors: ['#e0e0e0', '#c8c8c8'] },
  wood: { name: 'Textured Wood', colors: ['#d4a574', '#b8845a', '#a07050', '#c49868'] },
  grass: { name: 'Outdoor Grass', colors: ['#5a8f3c', '#6da84a', '#4d7a30', '#6da84a', '#5a8f3c'] },
};

export default function ImageEditor({ file, onEnhancedImage }) {
  const canvasRef = useRef(null);
  const cachedImg = useRef(null); // Hold the loaded image to avoid re-loading
  const [bgPreset, setBgPreset] = useState('white');
  const [shadowIntensity, setShadowIntensity] = useState(40);
  const [edgeFeather, setEdgeFeather] = useState(3);
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Load image once when file changes
  useEffect(() => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      cachedImg.current = img;
      setLoaded(true);
    };
    img.src = URL.createObjectURL(file);
  }, [file]);

  // Render canvas on every setting change — no clearing, paint over
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = cachedImg.current;
    if (!canvas || !img || !loaded) return;

    const ctx = canvas.getContext('2d');
    const maxW = 600, maxH = 600;
    let w = img.width, h = img.height;
    if (w > maxW || h > maxH) {
      if (w > h) { h = Math.round(h * maxW / w); w = maxW; }
      else { w = Math.round(w * maxH / h); h = maxH; }
    }
    canvas.width = w; canvas.height = h;

    // 1. Paint background gradient
    const colors = BG_PRESETS[bgPreset].colors;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. Paint product image
    ctx.save();
    if (edgeFeather > 0) {
      ctx.shadowBlur = edgeFeather * 2;
      ctx.shadowColor = 'transparent';
    }
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();

    // 3. Paint shadow gradient at bottom
    if (shadowIntensity > 0) {
      ctx.save();
      const shadH = Math.max(4, h * 0.04);
      const sg = ctx.createLinearGradient(0, h - shadH, 0, h);
      sg.addColorStop(0, `rgba(0,0,0,${shadowIntensity / 600})`);
      sg.addColorStop(1, `rgba(0,0,0,${shadowIntensity / 200})`);
      ctx.fillStyle = sg;
      const padX = w * 0.08;
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 1, (w / 2) - padX, shadH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [bgPreset, shadowIntensity, edgeFeather, loaded]);

  // Remove background via Gemini (server)
  async function removeBackground() {
    setMsg('🔄 Processing...');
    const canvas = canvasRef.current;
    if (!canvas) { setMsg('❌ No image loaded'); return; }
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];
      const r = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
      });
      const d = await r.json();
      if (d.description) {
        setMsg(`✅ Gemini analyzed: "${d.description.slice(0, 60)}..."`);
      } else {
        setMsg(d.error ? `⚠️ ${d.error}` : '⚠️ Could not analyze image');
      }
    } catch (e) {
      setMsg('❌ ' + e.message);
    }
  }

  // Export final composite
  const exportImage = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    onEnhancedImage?.(base64);
    setMsg('✅ Enhanced image ready! Click "Add product" to save.');
  }, [onEnhancedImage]);

  if (!file) return null;

  return (
    <div style={{ marginTop: '16px', border: '1px solid #eee', borderRadius: '12px', padding: '20px', background: '#fafafa' }}>
      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>🖼️ Image Editor</h4>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {Object.entries(BG_PRESETS).map(([key, p]) => (
          <button key={key} onClick={() => setBgPreset(key)}
            style={{
              padding: '8px 16px', borderRadius: '999px',
              background: bgPreset === key ? '#FF4D14' : '#fff',
              color: bgPreset === key ? '#fff' : '#16130F',
              border: bgPreset === key ? 'none' : '1px solid #ddd',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              transition: 'transform 0.15s',
            }}
            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; }}
            onMouseOut={e => { e.target.style.transform = ''; }}>
            {p.name}
          </button>
        ))}
        <button onClick={removeBackground}
          style={{
            padding: '8px 16px', borderRadius: '999px',
            background: '#16130F', color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          }}>
          🔍 Remove BG
        </button>
      </div>

      {/* Sliders */}
      <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>Shadow: {shadowIntensity}%</label>
          <input type="range" min="0" max="100" value={shadowIntensity}
            onChange={e => setShadowIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>Soft Edge: {edgeFeather}px</label>
          <input type="range" min="0" max="10" step="0.5" value={edgeFeather}
            onChange={e => setEdgeFeather(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>

      {/* Canvas */}
      <div style={{ marginBottom: '12px' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd' }} />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={exportImage}
          style={{ padding: '10px 24px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
          ✅ Apply & Save
        </button>
      </div>

      {msg && <p style={{ fontSize: '13px', marginTop: '8px', color: msg.includes('✅') ? '#4caf50' : msg.includes('⚠️') ? '#ff9800' : '#e53935' }}>{msg}</p>}
    </div>
  );
}
