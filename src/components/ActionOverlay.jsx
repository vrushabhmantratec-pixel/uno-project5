import React, { useEffect, useState } from 'react';

export default function ActionOverlay({ text, color, visible }) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible && text) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [visible, text]);

  if (!shouldRender) return null;

  return (
    <div className={`action-overlay ${visible ? 'visible' : ''}`} id="actionOverlay">
      {text && (
        <div 
          className="action-text" 
          id="actionText" 
          style={{ color: color || '#fff' }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
