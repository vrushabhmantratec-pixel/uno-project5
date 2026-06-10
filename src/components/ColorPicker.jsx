import React from 'react';

export default function ColorPicker({ visible, onPickColor }) {
  if (!visible) return null;
  return (
    <div className="color-picker-overlay visible" id="colorPickerOverlay">
      <div className="color-picker">
        <h3>Choose a Color</h3>
        <div className="color-options">
          <div className="color-opt opt-red" onClick={() => onPickColor('red')} aria-label="Red">
            <i className="fas fa-circle"></i>
          </div>
          <div className="color-opt opt-blue" onClick={() => onPickColor('blue')} aria-label="Blue">
            <i className="fas fa-circle"></i>
          </div>
          <div className="color-opt opt-green" onClick={() => onPickColor('green')} aria-label="Green">
            <i className="fas fa-circle"></i>
          </div>
          <div className="color-opt opt-yellow" onClick={() => onPickColor('yellow')} aria-label="Yellow">
            <i className="fas fa-circle"></i>
          </div>
        </div>
      </div>
    </div>
  );
}
