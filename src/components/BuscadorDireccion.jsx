import React, { useState } from 'react';

export default function BuscadorDireccion({ onDireccionEncontrada }) {
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(false);

  const manejarBusqueda = async (e) => {
    e.preventDefault();
    if (!busqueda.trim()) return;

    setCargando(true);
    try {
      // Limitamos la búsqueda principalmente a Venezuela para agilizar los resultados
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(busqueda)}&countrycodes=ve&limit=1`;
      
      const respuesta = await fetch(url, {
        headers: { 'Accept-Language': 'es' }
      });
      const datos = await respuesta.json();

      if (datos && datos.length > 0) {
        const resultado = datos[0];
        const coordenadas = {
          lat: parseFloat(resultado.lat),
          lng: parseFloat(resultado.lon)
        };
        // Enviamos la coordenada de vuelta a App.jsx
        onDireccionEncontrada(coordenadas);
        // alert(`Ubicación encontrada: ${resultado.display_name.split(',')[0]}`);
      } else {
        alert("No se encontró la dirección. Intenta añadir más detalles (ej. 'Sector El Viñedo, Valencia').");
      }
    } catch (error) {
      console.error("Error al buscar la dirección:", error);
      alert("Hubo un problema al conectar con el servicio de mapas.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={manejarBusqueda} className="bg-white p-3 rounded-lg shadow border space-y-2">
      <label className="text-xs font-black text-slate-700 block">
        🔍 BUSCAR DIRECCIÓN EN EL MAPA
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Ej: Naguanagua, San Diego, Av. Bolívar..."
          className="flex-1 text-xs border rounded p-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={cargando}
          className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded transition-all disabled:opacity-50"
        >
          {cargando ? '...' : 'Buscar'}
        </button>
      </div>
    </form>
  );
}