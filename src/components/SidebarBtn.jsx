import React from 'react';

export default function SidebarBtn({ label, isOn, onClick, count }) {
  return (
    <button className={`rw-sb-btn${isOn ? ' is-on' : ''}`} onClick={onClick}
      onMouseOver={e => { if (!isOn) { e.currentTarget.style.background = 'var(--line)'; } }}
      onMouseOut={e => { if (!isOn) { e.currentTarget.style.background = ''; } }}>
      <span className="rw-sb-label">{label}</span>
      <span className="rw-sb-count">{count}</span>
    </button>
  );
}
