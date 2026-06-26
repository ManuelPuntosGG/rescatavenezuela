import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapaEmergencia({ rescates, acopios, onMapClick, coordenadaSeleccionada }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Inicializar mapa centrado en Valencia, Venezuela
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainer.current).setView([10.2394, -67.9662], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapRef.current);

      // Evento de clic en el mapa para capturar coordenadas exactas
      mapRef.current.on('click', (e) => {
        if (onMapClick) onMapClick(e.latlng);
      });
    }
  }, [onMapClick]);

  // Efecto para repintar todos los marcadores en tiempo real
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Limpiar marcadores antiguos del ciclo anterior
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    // Estilos CSS Inline para los pines del mapa
    const iconRescate = L.divIcon({
      html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px #000;"></div>`,
      className: 'marker-rescate'
    });

    const iconAcopio = L.divIcon({
      html: `<div style="background-color: #10b981; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px #000;"></div>`,
      className: 'marker-acopio'
    });

    const iconSeleccion = L.divIcon({
      html: `<div style="background-color: #3b82f6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px #000;"></div>`,
      className: 'marker-seleccion' 
    });

    // Dibujar marcadores de Rescate
    if (rescates && rescates.length > 0) {
      rescates.forEach((item) => {
        const marker = L.marker([item.latitud, item.longitud], { icon: iconRescate })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;">
              <b style="color:#dc2626;">🚨 SOS: Rescate Solicitado</b><br/>
              <strong>Ref:</strong> ${item.ubicacion_referencia}<br/>
              <strong>Detalles:</strong> ${item.detalles_emergencia}<br/>
              ${item.foto_url ? `<img src="${item.foto_url}" style="width:100%; max-height:100px; object-fit:cover; margin-top:5px; border-radius:4px;" />` : ''}
              <strong>Contacto:</strong> ${item.contacto_reportante}
            </div>
          `);
        markersRef.current.push(marker);
      });
    }

    // Dibujar marcadores de Centros de Acopio
    if (acopios && acopios.length > 0) {
      acopios.forEach((item) => {
        const marker = L.marker([item.latitud, item.longitud], { icon: iconAcopio })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;">
              <b style="color:#059669;">📦 Centro de Acopio</b><br/>
              <strong>Lugar:</strong> ${item.nombre_centro}<br/>
              <strong>Insumos Requeridos:</strong> <span style="color:#dc2626;">${item.insumos_solicitados}</span><br/>
              <strong>Horario:</strong> ${item.horario || 'No especificado'}<br/>
              <strong>Contacto:</strong> ${item.contacto_centro}
            </div>
          `);
        markersRef.current.push(marker);
      });
    }

    // Mostrar el pin azul de selección actual
    if (coordenadaSeleccionada) {
      const markerSel = L.marker([coordenadaSeleccionada.lat, coordenadaSeleccionada.lng], { icon: iconSeleccion })
        .addTo(map)
        .bindPopup("<b>📍 Ubicación marcada para el nuevo reporte</b>");
      markersRef.current.push(markerSel);
    }
  }, [rescates, acopios, coordenadaSeleccionada]);

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-full rounded-lg shadow-inner border border-gray-200" 
      style={{ minHeight: "500px" }} 
    />
  );
}