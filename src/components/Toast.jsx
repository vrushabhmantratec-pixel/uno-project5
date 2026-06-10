import React, { useEffect, useState } from 'react';

export default function Toast({ message, type = 'info', visible }) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible && message) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [visible, message]);

  if (!shouldRender) return null;

  return (
    <div className={`toast ${type} ${visible ? 'visible' : ''}`} id="toast">
      {message}
    </div>
  );
}
