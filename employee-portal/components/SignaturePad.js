'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';

/**
 * HTML5 Digital Signature Pad Component
 * Provides smooth touch/mouse drawing, Undo, Clear, and base64 PNG export.
 */
export default function SignaturePad({
  title = 'Digital Signature Capture',
  subtitle = 'Please sign using your finger, stylus, or mouse above the baseline.',
  signerName = '',
  onSave,
  onCancel,
  width = 560,
  height = 200,
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState([]); // Array of ImageData snapshots for Undo
  const [hasDrawn, setHasDrawn] = useState(false);

  // Setup canvas resolution and background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // Deep slate ink

    // Save empty state snapshot
    const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initial]);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.closePath();

    // Snapshot state for undo
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, snapshot]);
  };

  // Clear canvas
  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initial]);
    setHasDrawn(false);
  }, []);

  // Undo last stroke
  const handleUndo = useCallback(() => {
    if (history.length <= 1) {
      handleClear();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nextHistory = history.slice(0, -1);
    const previousState = nextHistory[nextHistory.length - 1];
    ctx.putImageData(previousState, 0, 0);
    setHistory(nextHistory);
    if (nextHistory.length <= 1) setHasDrawn(false);
  }, [history, handleClear]);

  // Export base64
  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    const base64 = canvas.toDataURL('image/png');
    if (onSave) onSave(base64);
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 14,
        padding: '20px 22px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
        maxWidth: width + 44,
        width: '100%',
        margin: '0 auto',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#101828' }}>
          {title}
        </h4>
        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
          {subtitle}
        </p>
      </div>

      {/* Canvas Box */}
      <div
        style={{
          position: 'relative',
          borderRadius: 10,
          border: '2px dashed #cbd5e1',
          background: '#ffffff',
          overflow: 'hidden',
          touchAction: 'none',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            display: 'block',
            width: '100%',
            height: height,
            cursor: 'crosshair',
          }}
        />

        {/* Baseline guideline */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: 20,
            right: 20,
            borderBottom: '1px solid rgba(148, 163, 184, 0.45)',
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: '#94a3b8',
            paddingBottom: 2,
          }}
        >
          <span>✕ Sign above this line</span>
          {signerName && <span>Signer: {signerName}</span>}
        </div>
      </div>

      {/* Footer Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 16,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasDrawn}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: 6,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: hasDrawn ? '#475569' : '#94a3b8',
              cursor: hasDrawn ? 'pointer' : 'not-allowed',
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleUndo}
            disabled={history.length <= 1}
            style={{
              padding: '6px 14px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: 6,
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: history.length > 1 ? '#475569' : '#94a3b8',
              cursor: history.length > 1 ? 'pointer' : 'not-allowed',
            }}
          >
            Undo
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '7px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: 6,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasDrawn}
            style={{
              padding: '7px 18px',
              fontSize: '12.5px',
              fontWeight: 700,
              borderRadius: 6,
              background: hasDrawn ? 'linear-gradient(135deg, #00b8db, #0284c7)' : '#e2e8f0',
              border: 'none',
              color: hasDrawn ? '#ffffff' : '#94a3b8',
              cursor: hasDrawn ? 'pointer' : 'not-allowed',
              boxShadow: hasDrawn ? '0 2px 8px rgba(0, 184, 219, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Confirm & Apply Signature
          </button>
        </div>
      </div>
    </div>
  );
}
