import React, { useState, useRef, useEffect, useCallback } from 'react';

const BG_PRESETS = {
  white: { name: 'Studio White', colors: ['#fff', '#f0f0f0'] },
  grey: { name: 'Minimalist Grey', colors: ['#e0e0e0', '#c8c8c8'] },
  wood: { name: 'Textured Wood', colors: ['#d4a574', '#b8845a', '#a07050', '#c49868'] },
  grass: { name: 'Outdoor Grass', colors: ['#5a8f3c', '#6da84a', '#4d7a30', '#6da84a', '#5a8f3c'] },
};

export default function ImageEditor({ file, onEnhancedImage }) {
  const canvasRef = useRef(null);
  const cachedImg = useRef(null);
  const [bgPreset, setBgPreset] = useState('white');
  const [shadowIntensity, setShadowIntensity] = useState(40);
  const [edgeFeather, setEdgeFeather] = useState(3);
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!file) return;
    const img = new Image();
    img.onload = () => { cachedImg.current = img; setLoaded(true); };
    img.src = URL.createObjectURL(file);
  }, [file]);

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
    const colors = BG_PRESETS[bgPreset].colors;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    if (edgeFeather > 0) { ctx.shadowBlur = edgeFeather * 2; ctx.shadowColor = 'transparent'; }
    ctx.drawImage(img, 0, 0, w, h);
    ctx.restore();
    if (shadowIntensity > 0) {
      ctx.save();
      const shadH = Math.max(4, h * 0.04);
      const sg = ctx.createLinearGradient(0, h - shadH, 0, h);
      sg.addColorStop(0, `rgba(0,0,0,${shadowIntensity / 600})`);
      sg.addColorStop(1, `rgba(0,0,0,${shadowIntensity / 200})`);
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 1, (w / 2) - w * 0.08, shadH * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [bgPreset, shadowIntensity, edgeFeather, loaded]);

  // Chroma key: removes solid background using math, no AI
  function chromaKey() {
    const img = cachedImg.current;
    if (!img || !loaded) { setMsg('❌ No image loaded'); return; }
    setMsg('🔄 Analyzing background color...');

    const maxW = 600, maxH = 600;
    let w = img.width, h = img.height;
    if (w > maxW || h > maxH) {
      if (w > h) { h = Math.round(h * maxW / w); w = maxW; }
      else { w = Math.round(w * maxH / h); h = maxH; }
    }
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const oc = off.getContext('2d');
    oc.drawImage(img, 0, 0, w, h);
    const d = oc.getImageData(0, 0, w, h).data;

    // Sample corner colors to find background
    function px(x, y) {
      const i = (y * w + x) * 4;
      return { r: d[i], g: d[i + 1], b: d[i + 2] };
    }
    const corners = [px(0,0), px(w-1,0), px(0,h-1), px(w-1,h-1)];
    const bg = {
      r: Math.round(corners.reduce((s,c)=>s+c.r,0)/4),
      g: Math.round(corners.reduce((s,c)=>s+c.g,0)/4),
      b: Math.round(corners.reduce((s,c)=>s+c.b,0)/4),
    };

    // Process pixels
    const out = new ImageData(w, h);
    const outData = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const dr = d[i] - bg.r, dg = d[i+1] - bg.g, db = d[i+2] - bg.b;
        const dist = Math.sqrt(dr*dr + dg*dg + db*db);
        const thr = 45;
        if (dist < thr) {
          outData[i] = d[i]; outData[i+1] = d[i+1]; outData[i+2] = d[i+2]; outData[i+3] = 0;
        } else if (dist < thr * 1.5) {
          const a = Math.round(((dist - thr) / (thr * 0.5)) * 255);
          outData[i] = d[i]; outData[i+1] = d[i+1]; outData[i+2] = d[i+2]; outData[i+3] = a;
        } else {
          outData[i] = d[i]; outData[i+1] = d[i+1]; outData[i+2] = d[i+2]; outData[i+3] = 255;
        }
      }
    }
    oc.putImageData(out, 0, 0);

    const newImg = new Image();
    newImg.onload = () => {
      cachedImg.current = newImg;
      setLoaded(false);
      setTimeout(() => setLoaded(true), 50);
      setMsg('✅ Background removed using chroma key! Best with solid color backgrounds.');
    };
    newImg.src = off.toDataURL('image/png');
  }

  const exportImage = useCallback(() => {
    if (!canvasRef.current) return;
    const b64 = canvasRef.current.toDataURL('image/jpeg', 0.92).split(',')[1];
    onEnhancedImage?.(b64);
    setMsg('✅ Ready! Click "Add product" to save.');
  }, [onEnhancedImage]);

  if (!file) return null;

  return (
    <div style={{ marginTop: '16px', border: '1px solid #eee', borderRadius: '12px', padding: '20px', background: '#fafafa' }}>
      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>🖼️ Image Editor</h4>
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
            onMouseOver={e => e.target.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.target.style.transform = ''}>
            {p.name}
          </button>
        ))}
        <button onClick={chromaKey}
          style={{ padding: '8px 16px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          🟢 Chroma Key
        </button>
      </div>
      <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>Shadow: {shadowIntensity}%</label>
          <input type="range" min="0" max="100" value={shadowIntensity} onChange={e => setShadowIntensity(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>Soft Edge: {edgeFeather}px</label>
          <input type="range" min="0" max="10" step="0.5" value={edgeFeather} onChange={e => setEdgeFeather(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ marginBottom: '12px' }}>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd' }} />
      </div>
      <button onClick={exportImage}
        style={{ padding: '10px 24px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
        ✅ Apply & Save
      </button>
      {msg && <p style={{ fontSize: '13px', marginTop: '8px', color: msg.includes('✅') ? '#4caf50' : msg.includes('❌') ? '#e53935' : '#ff9800' }}>{msg}</p>}
    </div>
  );
}
