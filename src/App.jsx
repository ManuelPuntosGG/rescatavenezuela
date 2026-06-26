import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import MapaEmergencia from './components/MapaEmergencia';
import FormularioRescate from './components/FormularioRescate';
import FormularioAcopio from './components/FormularioAcopio';
import BuscadorDireccion from './components/BuscadorDireccion'; // <-- Nueva Importación

export default function App() {
  const [rescates, setRescates] = useState([]);
  const [acopios, setAcopios] = useState([]);
  const [coordenadaSeleccionada, setCoordenadaSeleccionada] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState('rescate'); 
  const [gpsUsuario, setGpsUsuario] = useState(null); 

  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
  };

  const cargarDatos = async (posicionGps = gpsUsuario) => {
    const { data: res } = await supabase.from('reportes_rescate').select('*').order('creado_en', { ascending: false });
    const { data: aco } = await supabase.from('centros_acopio').select('*').order('creado_en', { ascending: false });
    
    let datosRescates = res || [];
    let datosAcopios = aco || [];

    if (posicionGps) {
      datosRescates = datosRescates.map(item => ({
        ...item,
        distancia: calcularDistancia(posicionGps.lat, posicionGps.lng, item.latitud, item.longitud)
      })).sort((a, b) => a.distancia - b.distancia);

      datosAcopios = datosAcopios.map(item => ({
        ...item,
        distancia: calcularDistancia(posicionGps.lat, posicionGps.lng, item.latitud, item.longitud)
      })).sort((a, b) => a.distancia - b.distancia);
    }

    setRescates(datosRescates);
    setAcopios(datosAcopios);
  };

  useEffect(() => {
    cargarDatos();

    const canalRescates = supabase.channel('cambios-rescates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes_rescate' }, () => cargarDatos())
      .subscribe();

    const canalAcopios = supabase.channel('cambios-acopios')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'centros_acopio' }, () => cargarDatos())
      .subscribe();

    return () => {
      supabase.removeChannel(canalRescates);
      supabase.removeChannel(canalAcopios);
    };
  }, [gpsUsuario]);

  const geolocalizarUsuario = () => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta geolocalización.");
    navigator.geolocation.getCurrentPosition((pos) => {
      const miUbicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoordenadaSeleccionada(miUbicacion);
      setGpsUsuario(miUbicacion);
      cargarDatos(miUbicacion); 
      alert("Ubicación GPS obtenida. Listados ordenados por cercanía.");
    }, () => {
      alert("No se pudo acceder a tu GPS. Marcando manualmente no se calcularán distancias automáticas.");
    }, { enableHighAccuracy: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-slate-900 text-white p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-red-500 border-0 p-0 m-0">🚨 S.O.S. CRISIS VENEZUELA</h1>
            <p className="text-xs text-slate-400 m-0">Plataforma Civil de Apoyo ante Sismos del 24 de Junio</p>
          </div>
          <button 
            onClick={geolocalizarUsuario} 
            className="mt-2 md:mt-0 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded shadow transition-all"
          >
            {gpsUsuario ? "📍 GPS Activo" : "📍 Usar mi GPS Actual"}
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Columna 1: Formularios e Inputs */}
        <div className="space-y-4">
          
          {/* NUEVO COMPONENTE: Buscador de Direcciones por Texto */}
          <BuscadorDireccion onDireccionEncontrada={(coords) => setCoordenadaSeleccionada(coords)} />

          <div className="bg-white rounded-lg shadow p-2 flex justify-around border">
            <button 
              onClick={() => setPestanaActiva('rescate')} 
              className={`text-xs font-bold py-2 px-4 rounded transition-all ${pestanaActiva === 'rescate' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              🚨 Reportar Rescate
            </button>
            <button 
              onClick={() => setPestanaActiva('acopio')} 
              className={`text-xs font-bold py-2 px-4 rounded transition-all ${pestanaActiva === 'acopio' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              📦 Nuevo Acopio
            </button>
          </div>

          {coordenadaSeleccionada ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-2 rounded text-center font-semibold">
              Coordenada fijada: {coordenadaSeleccionada.lat.toFixed(5)}, {coordenadaSeleccionada.lng.toFixed(5)}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded text-center font-bold animate-pulse">
              ⚠️ Haz clic en cualquier punto del mapa, busca una dirección arriba o usa tu GPS para habilitar el formulario.
            </div>
          )}

          {pestanaActiva === 'rescate' ? (
            <FormularioRescate coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); cargarDatos(); }} />
          ) : (
            <FormularioAcopio coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); cargarDatos(); }} />
          )}
        </div>

        {/* Columna 2: Mapa */}
        <div className="bg-white p-2 rounded-lg shadow border relative h-[400px] lg:h-auto flex flex-col">
          <div className="absolute top-4 right-4 z-[999] bg-white/95 backdrop-blur-sm p-3 rounded shadow-md border text-xs space-y-1 font-bold">
            <div className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span> Rescate</div>
            <div className="flex items-center"><span className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span> Acopios</div>
            <div className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span> Tu Selección</div>
          </div>
          <div className="flex-1">
            <MapaEmergencia 
              rescates={rescates} 
              acopios={acopios}
              coordenadaSeleccionada={coordenadaSeleccionada} 
              onMapClick={(latlng) => setCoordenadaSeleccionada(latlng)} 
            />
          </div>
        </div>

        {/* Columna 3: Listados por Cercanía */}
        <div className="space-y-4 flex flex-col h-[500px] lg:h-auto overflow-hidden">
          
          {/* Tarjeta de Rescates Urgentes */}
          <div className="bg-white p-3 rounded-lg shadow border flex-1 flex flex-col overflow-hidden">
            <h3 className="text-sm font-black text-red-600 border-b pb-2 mb-2 flex justify-between items-center">
              <span>🚨 RESCATES PRIORITARIOS</span>
              <span className="text-[10px] bg-red-100 px-2 py-0.5 rounded text-red-800 font-bold">{rescates.length}</span>
            </h3>
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {rescates.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay solicitudes de rescate activas.</p>
              ) : (
                rescates.map((item) => (
                  <div key={item.id} className="p-2 bg-red-50/60 rounded border border-red-100 text-xs">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-bold text-gray-900 truncate flex-1">{item.ubicacion_referencia}</span>
                      {item.distancia !== undefined && (
                        <span className="bg-red-600 text-white font-mono font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          📍 a {item.distancia.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-[11px] leading-tight mb-2">{item.detalles_emergencia}</p>
                    <div className="flex justify-between items-center text-[10px] text-gray-500 font-semibold border-t pt-1.5 mt-1">
                      <div className="flex flex-col">
                        <span>📞 {item.contacto_reportante}</span>
                        {item.sospecha_supervivientes && <span className="text-red-600 font-bold">⚠️ Vidas en riesgo</span>}
                      </div>
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitud},${item.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2 rounded flex items-center gap-1 transition-all shadow-sm text-[10px]"
                      >
                        🗺️ Navegar
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tarjeta de Centros de Acopio */}
          <div className="bg-white p-3 rounded-lg shadow border flex-1 flex flex-col overflow-hidden">
            <h3 className="text-sm font-black text-emerald-600 border-b pb-2 mb-2 flex justify-between items-center">
              <span>📦 ACOPIOS Y LOGÍSTICA</span>
              <span className="text-[10px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-800 font-bold">{acopios.length}</span>
            </h3>
            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {acopios.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No hay centros de acopio reportados.</p>
              ) : (
                acopios.map((item) => (
                  <div key={item.id} className="p-2 bg-emerald-50/60 rounded border border-emerald-100 text-xs">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-bold text-gray-900 truncate flex-1">{item.nombre_centro}</span>
                      {item.distancia !== undefined && (
                        <span className="bg-emerald-600 text-white font-mono font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          📍 a {item.distancia.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 text-[11px] mb-2 font-medium"><strong className="text-red-600">Pide:</strong> {item.insumos_solicitados}</p>
                    <div className="flex justify-between items-center text-[10px] text-gray-500 border-t pt-1.5 mt-1">
                      <div className="flex flex-col">
                        <span>🕒 {item.horario || 'Sin horario'}</span>
                        <span>📞 {item.contacto_centro || 'S/C'}</span>
                      </div>
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitud},${item.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2 rounded flex items-center gap-1 transition-all shadow-sm text-[10px]"
                      >
                        🗺️ Navegar
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}