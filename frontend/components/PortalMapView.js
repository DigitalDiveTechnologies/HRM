'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Interactive In-Portal Map Component.
 * Renders an embedded, interactive map directly inside the portal without any external redirects.
 */
export default function PortalMapView({
  latitude,
  longitude,
  title = 'Employee Location',
  subtitle = '',
  height = 380,
  zoom = 15,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const isValidCoord = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;

  useEffect(() => {
    if (!isValidCoord || typeof window === 'undefined') return;

    let isMounted = true;

    async function loadLeaflet() {
      try {
        // Ensure Leaflet CSS is in document head
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.crossOrigin = '';
          document.head.appendChild(link);
        }

        // Ensure Leaflet JS is loaded
        if (!window.L) {
          await new Promise((resolve, reject) => {
            const existingScript = document.getElementById('leaflet-js');
            if (existingScript) {
              existingScript.addEventListener('load', resolve);
              existingScript.addEventListener('error', reject);
              return;
            }
            const script = document.createElement('script');
            script.id = 'leaflet-js';
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
            script.crossOrigin = '';
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
          });
        }

        if (!isMounted || !mapContainerRef.current || !window.L) return;

        // Cleanup any previous instance
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const L = window.L;
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        // Add clean OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }).addTo(map);

        // Custom pulsing marker icon
        const customIcon = L.divIcon({
          className: 'portal-map-pin',
          html: `
            <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; width:32px; height:32px; border-radius:50%; background:rgba(0,184,219,0.35); animation:pulse 2s infinite ease-out;"></div>
              <div style="position:relative; width:22px; height:22px; border-radius:50%; background:#00b8db; border:3px solid #ffffff; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
                <div style="width:6px; height:6px; border-radius:50%; background:#ffffff;"></div>
              </div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        // Popup with details
        const popupContent = `
          <div style="font-family:inherit; padding:4px 2px; min-width:160px;">
            <div style="font-weight:800; font-size:13px; color:#0f172a;">${title}</div>
            ${subtitle ? `<div style="font-size:11.5px; color:#64748b; margin-top:2px;">${subtitle}</div>` : ''}
            <div style="font-size:11px; color:#008fa8; margin-top:4px; font-weight:600;">
              ${lat.toFixed(5)}, ${lng.toFixed(5)}
            </div>
          </div>
        `;
        marker.bindPopup(popupContent).openPopup();

        mapInstanceRef.current = map;
        setMapLoaded(true);

        // Invalidate size once container renders
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 200);
      } catch (err) {
        console.warn('Leaflet load error, falling back to embedded map:', err);
        if (isMounted) setLoadError(true);
      }
    }

    loadLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, title, subtitle, zoom, isValidCoord]);

  if (!isValidCoord) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--panel-bg, #f8fafc)',
          borderRadius: 12,
          color: 'var(--muted, #64748b)',
          fontSize: '13px',
          border: '1px dashed var(--line, #cbd5e1)',
        }}
      >
        No location coordinates available.
      </div>
    );
  }

  const delta = 0.006;
  const fallbackOsmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - delta}%2C${lat - delta}%2C${lng + delta}%2C${lat + delta}&layer=mapnik&marker=${lat}%2C${lng}`;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--line, #e2e8f0)',
        background: '#f1f5f9',
      }}
    >
      {/* Primary Leaflet Interactive Map Container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          display: loadError ? 'none' : 'block',
        }}
      />

      {/* Fallback iframe if Leaflet CDN is offline or blocked */}
      {loadError && (
        <iframe
          title="Attendance Location Map"
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight="0"
          marginWidth="0"
          src={fallbackOsmUrl}
          style={{ border: 0 }}
        />
      )}

      {/* In-Map Info Overlay Badge */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(8px)',
          padding: '6px 12px',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          border: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '12px',
          fontWeight: 600,
          color: '#0f172a',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        <span>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
      </div>
    </div>
  );
}
