import React, { useState, useEffect, useRef } from 'react';

export default function BuscadorDireccion({ onDireccionEncontrada }) {
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const containerRef = useRef(null);

  // Efecto para buscar sugerencias en tiempo real con Debounce (espera 400ms tras dejar de escribir)
  useEffect(() => {
    if (busqueda.trim().length < 3) {
      setSugerencias([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        // Buscamos opciones restringidas prioritariamente a Venezuela
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busqueda)}&countrycodes=ve&limit=5`;
        const respuesta = await fetch(url, {
          headers: { 'Accept-Language': 'es' }
        });
        const datos = await respuesta.json();
        setSugerencias(datos || []);
      } catch (error) {
        console.error("Error obteniendo sugerencias:", error);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [busqueda]);

  // Cerrar el menú de sugerencias si el usuario hace clic afuera del buscador
  useEffect(() => {
    const hacerClicAfuera = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setMostrarDropdown(false);
      }
    };
    document.addEventListener("mousedown", hacerClicAfuera);
    return () => document.removeEventListener("mousedown", hacerClicAfuera);
  }, []);

  // Al seleccionar una sugerencia de la lista
  const seleccionarSugerencia = (item) => {
    const coordenadas = {
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    };
    
    // Asignar el texto corto al input
    setBusqueda(item.display_name.split(',')[0] + ', ' + (item.address?.city || item.address?.state || ''));
    setMostrarDropdown(false);
    
    // Enviar las coordenadas a App.jsx para que el mapa se mueva
    onDireccionEncontrada(coordenadas);
  };

  return (
    <div ref={containerRef} className="bg-white p-3 rounded-lg shadow border space-y-2 relative">
      <label className="text-xs font-black text-slate-700 block">
        🔍 BUSCAR DIRECCIÓN EN EL MAPA
      </label>
      
      <div className="relative">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setMostrarDropdown(true);
          }}
          onFocus={() => setMostrarDropdown(true)}
          placeholder="Ej: Naguanagua, San Diego, Av. Bolívar..."
          className="w-full text-xs border rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {/* Menú desplegable de sugerencias en tiempo real */}
        {mostrarDropdown && sugerencias.length > 0 && (
          <ul className="absolute left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-52 overflow-y-auto z-[1000] divide-y divide-gray-100">
            {sugerencias.map((item) => (
              <li key={item.place_id}>
                <button
                  type="button"
                  onClick={() => seleccionarSugerencia(item)}
                  className="w-full text-left p-2.5 hover:bg-slate-50 text-[11px] text-gray-700 transition-colors leading-tight block truncate"
                  title={item.display_name}
                >
                  <span className="font-bold block text-slate-900">
                    {item.display_name.split(',')[0]}
                  </span>
                  <span className="text-gray-400 text-[10px] block truncate">
                    {item.display_name.split(',').slice(1).join(',').trim()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Mensaje de "No resultados" si escribe mucho y no encuentra nada */}
        {mostrarDropdown && busqueda.trim().length >= 3 && sugerencias.length === 0 && (
          <div className="absolute left-0 right-0 mt-1 bg-white border rounded-md shadow-lg p-3 z-[1000] text-[11px] text-gray-400 text-center">
            No se encontraron direcciones parecidas.
          </div>
        )}
      </div>
    </div>
  );
}