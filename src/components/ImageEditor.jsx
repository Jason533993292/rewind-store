import React, { useState, useRef, useEffect } from 'react';

const BG_PRESETS = {
  white: { name: 'Studio White', gradient: 'linear-gradient(135deg, #fff 0%, #f0f0f0 100%)' },
  grey: { name: 'Minimalist Grey', gradient: 'linear-gradient(135deg, #e0e0e0 0%, #c8c8c8 100%)' },
  wood: { name: 'Textured Wood', gradient: 'linear-gradient(135deg, #d4a574 0%, #b8845a 30%, #a07050 60%, #c49868 100%)' },
  grass: { name: 'Outdoor Grass', gradient: 'linear-gradient(135deg, #5a8f3c 0%, #6da84a 20%, #4d7a30 40%, #6da84a 60%, #5a8f3c 80%, #4d7a30 100%)' },
};

const PRESET_NAMES = Object.keys(BG_PRESETS);

export default function ImageEditor({ file, onEnhancedImage }) {
  const canvasRef = useRef(null);
  const [bgPreset, setBgPreset] = useState('white');
  const [shadowIntensity, setShadowIntensity] = useState(40);
  const [edgeFeather, setEdgeFeather] = useState(3);
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState('');
  const [originalImg, setOriginalImg] = useState(null);
  const [maskBlob, setMaskBlob] = useState(null);

  // Load the image when file changes
  useEffect(() => {
    if (!file) return;
    const img = new Image();
    img.onload = () => setOriginalImg(img);
    img.src = URL.createObjectURL(file);
    setMaskBlob(null);
  }, [file]);

  // Remove background using @imgly/background-removal
  async function removeBackground() {
    if (!originalImg) return;
    setProcessing(true);
    setMsg('🔄 Removing background with AI...');
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(file);
      setMaskBlob(blob);
      setMsg('✅ Background removed! Select a preset below.');
    } catch (e) {
      setMsg('❌ Background removal failed: ' + e.message);
    }
    setProcessing(false);
  }

  // Composite the masked image over the chosen background
  function renderComposite() {
    if (!canvasRef.current || !originalImg) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const maxW = 600, maxH = 600;
    let w = originalImg.width, h = originalImg.height;
    if (w > maxW || h > maxH) {
      if (w > h) { h = h * maxW / w; w = maxW; }
      else { w = w * maxH / h; h = maxH; }
    }
    canvas.width = w; canvas.height = h;

    // Draw background
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    const colors = BG_PRESETS[bgPreset].gradient.match(/#[a-f0-9]+/gi);
    if (colors) {
      const step = 1 / (colors.length - 1);
      colors.forEach((c, i) => bgGrad.addColorStop(i * step, c));
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // If we have a mask, use it
    if (maskBlob) {
      const maskImg = new Image();
      maskImg.onload = () => {
        // Draw the masked product image with edge feathering
        ctx.save();
        if (edgeFeather > 0) {
          ctx.shadowColor = 'rgba(0,0,0,0)';
          ctx.shadowBlur = edgeFeather * 3;
        }
        ctx.drawImage(maskImg, 0, 0, w, h);
        ctx.restore();

        // Draw shadow
        if (shadowIntensity > 0) {
          ctx.save();
          const shadH = h * 0.04;
          const grad = ctx.createLinearGradient(0, h - shadH, 0, h);
          grad.addColorStop(0, `rgba(0,0,0,${shadowIntensity / 700})`);
          grad.addColorStop(1, `rgba(0,0,0,${shadowIntensity / 300})`);
          ctx.fillStyle = grad;
          const padding = w * 0.08;
          ctx.beginPath();
          ctx.ellipse(w / 2, h - 2, (w / 2) - padding, shadH * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      };
      maskImg.src = URL.createObjectURL(maskBlob);
    } else {
      // No mask yet — draw original with feather edge
      ctx.save();
      if (edgeFeather > 0) {
        ctx.shadowBlur = edgeFeather * 3;
      }
      ctx.drawImage(originalImg, 0, 0, w, h);
      ctx.restore();
    }
  }

  useEffect(() => {
    renderComposite();
  }, [bgPreset, shadowIntensity, edgeFeather, originalImg, maskBlob]);

  // Export the composite as base64
  function exportImage() {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    if (onEnhancedImage) onEnhancedImage(base64);
    setMsg('✅ Image ready! Click "Add product" to save.');
  }

  if (!file) return null;

  return (
    <div style={{ marginTop: '16px', border: '1px solid #eee', borderRadius: '12px', padding: '20px', background: '#fafafa' }}>
      <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>🖼️ Image Editor</h4>

      {/* Step 1: Remove background */}
      <div style={{ marginBottom: '16px' }}>
        <button onClick={removeBackground} disabled={processing}
          style={{ padding: '8px 18px', borderRadius: '999px', background: processing ? '#ccc' : '#FF4D14', color: '#fff', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
          {processing ? '⏳ Processing...' : '🔍 Remove Background'}
        </button>
        {maskBlob && <span style={{ marginLeft: '10px', fontSize: '13px', color: '#4caf50' }}>✅ Mask ready</span>}
      </div>

      {/* Background presets */}
      <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Background:</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {PRESET_NAMES.map((key) => {
          const p = BG_PRESETS[key];
          return (
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
          );
        })}
      </div>

      {/* Sliders */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>
            Shadow Intensity: {shadowIntensity}%
          </label>
          <input type="range" min="0" max="100" value={shadowIntensity}
            onChange={e => setShadowIntensity(Number(e.target.value))}
            style={{ width: '100%' }} />
        </div>
        <div>
          <label style={{ fontSize: '12px', color: '#888' }}>
            Edge Feather: {edgeFeather}px
          </label>
          <input type="range" min="0" max="10" step="0.5" value={edgeFeather}
            onChange={e => setEdgeFeather(Number(e.target.value))}
            style={{ width: '100%' }} />
        </div>
      </div>

      {/* Preview */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Preview:</p>
        <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd', background: '#fff' }} />
      </div>

      {/* Export */}
      <button onClick={exportImage}
        style={{ padding: '10px 20px', borderRadius: '999px', background: '#16130F', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
        ✅ Apply & Save
      </button>

      {msg && <p style={{ fontSize: '13px', marginTop: '8px' }}>{msg}</p>}
    </div>
  );
}
