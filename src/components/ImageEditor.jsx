import React, { useState, useRef, useEffect, useCallback } from 'react';

const BG_PRESETS = {
  white: { name: 'Studio White', colors: ['#fff', '#f0f0f0'] },
  grey: { name: 'Minimalist Grey', colors: ['#e0e0e0', '#c8c8c8'] },
  wood: { name: 'Textured Wood', colors: ['#d4a574', '#b8845a', '#a07050', '#c49868'] },
  grass: { name: 'Outdoor Grass', colors: ['#5a8f3c', '#6da84a', '#4d7a30', '#6da84a', '#5a8f3c'] },
};

export default function ImageEditor({ file, onEnhancedImage }) {
  const canvasRef = useRef(null);
  const [bgPreset, setBgPreset] = useState('white');
  const [shadowIntensity, setShadowIntensity] = useState(40);
  const [edgeFeather, setEdgeFeather] = useState(3);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState('');
  const [originalImg, setOriginalImg] = useState(null);
  const [maskDataUrl, setMaskDataUrl] = useState(null);

  // Load the image when file changes
  useEffect(() => {
    if (!file) return;
    const img = new Image();
    img.onload = () => { setOriginalImg(img); setMsg('Image loaded. Use controls below.'); };
    img.onerror = () => setMsg('❌ Failed to load image');
    img.src = URL.createObjectURL(file);
    setMaskDataUrl(null);
  }, [file]);

  // Render the canvas whenever settings change
  useEffect(() => {
    if (!canvasRef.current || !originalImg) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const maxW = 600, maxH = 600;
    let w = originalImg.width, h = originalImg.height;
    if (w > maxW || h > maxH) {
      if (w > h) { h = Math.round(h * maxW / w); w = maxW; }
      else { w = Math.round(w * maxH / h); h = maxH; }
    }
    canvas.width = w; canvas.height = h;

    // Draw background gradient
    const bgColors = BG_PRESETS[bgPreset].colors;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    bgColors.forEach((c, i) => grad.addColorStop(i / (bgColors.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Draw the image (or mask)
    const imgSrc = maskDataUrl || URL.createObjectURL(file);
    const drawImg = new Image();
    drawImg.onload = () => {
      // Clear previous rendering
      ctx.clearRect(0, 0, w, h);
      
      // Redraw background
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Draw garment with edge feathering
      ctx.save();
      if (edgeFeather > 0) {
        ctx.shadowBlur = edgeFeather * 2;
        ctx.shadowColor = 'transparent';
      }
      // Use source-atop to restrict the image shape if masked
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(drawImg, 0, 0, w, h);
      ctx.restore();

      // Draw contact shadow
      if (shadowIntensity > 0) {
        ctx.save();
        const shadH = Math.max(4, h * 0.04);
        const shadowGrad = ctx.createLinearGradient(0, h - shadH, 0, h);
        shadowGrad.addColorStop(0, `rgba(0,0,0,${shadowIntensity / 600})`);
        shadowGrad.addColorStop(1, `rgba(0,0,0,${shadowIntensity / 200})`);
        ctx.fillStyle = shadowGrad;
        const padX = w * 0.08;
        ctx.beginPath();
        ctx.ellipse(w / 2, h - 1, (w / 2) - padX, shadH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };
    drawImg.src = imgSrc;
  }, [bgPreset, shadowIntensity, edgeFeather, originalImg, maskDataUrl, file]);

  // Remove background via server
  async function removeBackground() {
    if (!file) return;
    setProcessing(true);
    setMsg('🔄 Sending to AI service...');
    try {
      // Compress first
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = async () => {
        const c = document.createElement('canvas');
        let w = img.width, h = img.height;
        const m = 1200;
        if (w > m || h > m) { if (w > h) { h = Math.round(h * m / w); w = m; } else { w = Math.round(w * m / h); h = m; } }
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = c.toDataURL('image/jpeg', 0.85).split(',')[1];
        URL.revokeObjectURL(url);

        // Call server endpoint
        const r = await fetch('/api/remove-bg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: compressed }),
        });
        const d = await r.json();
        if (d.maskBase64) {
          setMaskDataUrl(`data:image/png;base64,${d.maskBase64}`);
          setMsg('✅ Background removed! Choose a preset below.');
        } else {
          // Fallback: just use the compressed image
          setMaskDataUrl(c.toDataURL('image/png'));
          setMsg('⚠️ AI background removal unavailable. Image loaded without background processing.');
        }
      };
      img.src = url;
    } catch (e) {
      setMsg('❌ Error: ' + e.message);
    }
    setProcessing(false);
  }

  // Export
  const exportImage = useCallback(() => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    if (onEnhancedImage) onEnhancedImage(base64);
    setMsg('✅ Enhanced image ready! Click "Add product" to save.');
  }, [onEnhancedImage]);

  if (!file) return null;

  return (
    <div style={{ marginTop: '16px', border: '1px solid #eee', borderRadius: '12px', padding: '20px', background: '#fafafa' }}>
      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>🖼️ Image Editor</h4>

      <div style={{ marginBottom: '16px' }}>
        <button onClick={removeBackground} disabled={processing}
          style={{ padding: '8px 18px', borderRadius: '999px', background: processing ? '#ccc' : '#FF4D14', color: '#fff', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
          {processing ? '⏳ Processing...' : '🔍 Remove Background'}
        </button>
        {maskDataUrl && <span style={{ marginLeft: '10px', fontSize: '13px', color: '#4caf50' }}>✅ Mask ready</span>}
      </div>

      <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Background:</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(BG_PRESETS).map(([key, p]) => (
          <button key={key} onClick={() => setBgPreset(key)}
            style={{
              padding: '6px 14px', borderRadius: '999px',
              background: bgPreset === key ? '#16130F' : '#fff',
              color: bgPreset === key ? '#fff' : '#16130F',
              border: bgPreset === key ? 'none' : '1px solid #ddd',
              cursor: 'pointer', fontSize: '12px', fontWeight: 500,
            }}>
            {p.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>Shadow: {shadowIntensity}%</label>
          <input type="range" min="0" max="100" value={shadowIntensity}
            onChange={e => setShadowIntensity(Number(e.target.value))}
            style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>Edge Feather: {edgeFeather}px</label>
          <input type="range" min="0" max="10" step="0.5" value={edgeFeather}
            onChange={e => setEdgeFeather(Number(e.target.value))}
            style={{ width: '100%' }} />
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Preview:</p>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd', background: '#fff' }} />
      </div>

      <button onClick={exportImage}
        style={{ padding: '10px 20px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
        ✅ Apply & Save
      </button>

      {msg && <p style={{ fontSize: '13px', marginTop: '8px', color: msg.includes('❌') ? '#e53935' : msg.includes('⚠️') ? '#ff9800' : '#4caf50' }}>{msg}</p>}
    </div>
  );
}
