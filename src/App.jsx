import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import MapaEmergencia from './components/MapaEmergencia';
import FormularioRescate from './components/FormularioRescate';
import FormularioAcopio from './components/FormularioAcopio';
import BuscadorDireccion from './components/BuscadorDireccion';

export default function App() {
  const [rescates, setRescates] = useState([]);
  const [acopios, setAcopios] = useState([]);
  const [coordenadaSeleccionada, setCoordenadaSeleccionada] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState('rescate'); 
  const [gpsUsuario, setGpsUsuario] = useState(null);
  const [soloCriticos, setSoloCriticos] = useState(false); // <-- Nuevo Filtro Táctico

  // Ref para evitar que las suscripciones en tiempo real se reconecten innecesariamente al cambiar el GPS
  const gpsUsuarioRef = useRef(gpsUsuario);
  useEffect(() => {
    gpsUsuarioRef.current = gpsUsuario;
  }, [gpsUsuario]);

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

  const cargarDatos = async (posicionGps = gpsUsuarioRef.current) => {
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

    // Las suscripciones ahora se inicializan una única vez al montar la app
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
  }, []);

  const geolocalizarUsuario = () => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta geolocalización.");
    navigator.geolocation.getCurrentPosition((pos) => {
      const miUbicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoordenadaSeleccionada(miUbicacion);
      setGpsUsuario(miUbicacion);
      cargarDatos(miUbicacion); 
    }, () => {
      alert("No se pudo acceder a tu GPS. Marcando manualmente no se calcularán distancias automáticas.");
    }, { enableHighAccuracy: true });
  };

  // Filtrado lógico de rescates prioritarios
  const rescatesFiltrados = soloCriticos 
    ? rescates.filter(item => item.sospecha_supervivientes) 
    : rescates;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      
      {/* Navbar con gradiente e indicador de transmisión en vivo */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <h1 className="text-xl font-black tracking-tight text-red-500 m-0">RESCATA VENEZUELA</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Monitoreo Civil de Contingencias e Insumos Logísticos</p>
          </div>
          <button 
            onClick={geolocalizarUsuario} 
            className={`text-xs font-bold py-2.5 px-4 rounded-lg shadow-md transition-all flex items-center gap-2 border ${
              gpsUsuario 
                ? "bg-blue-500/10 text-blue-400 border-blue-500/30" 
                : "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
            }`}
          >
            {gpsUsuario ? "📍 GPS Activo" : "📍 Compartir mi GPS Actual"}
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Columna 1: Formularios */}
        <div className="space-y-4 flex flex-col">
          <BuscadorDireccion onDireccionEncontrada={(coords) => setCoordenadaSeleccionada(coords)} />

          <div className="bg-slate-200/60 p-1 rounded-xl flex border border-slate-300/60 gap-1 shadow-inner">
            <button 
              onClick={() => setPestanaActiva('rescate')} 
              className={`flex-1 text-xs font-black py-2.5 px-3 rounded-lg transition-all ${pestanaActiva === 'rescate' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              🚨 Reportar Rescate
            </button>
            <button 
              onClick={() => setPestanaActiva('acopio')} 
              className={`flex-1 text-xs font-black py-2.5 px-3 rounded-lg transition-all ${pestanaActiva === 'acopio' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              📦 Nuevo Acopio
            </button>
          </div>

          {coordenadaSeleccionada ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] py-2 px-3 rounded-lg text-center font-medium shadow-sm flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
              Marcador fijado: {coordenadaSeleccionada.lat.toFixed(5)}, {coordenadaSeleccionada.lng.toFixed(5)}
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200/70 text-amber-900 text-[11px] py-2.5 px-3 rounded-lg text-center font-medium shadow-sm animate-pulse">
              ⚠️ Haz clic en el mapa, introduce una calle arriba o activa tu GPS para desbloquear el formulario de envío.
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex-1">
            {pestanaActiva === 'rescate' ? (
              <FormularioRescate coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); cargarDatos(); }} />
            ) : (
              <FormularioAcopio coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); cargarDatos(); }} />
            )}
          </div>
        </div>

        {/* Columna 2: Mapa */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 relative h-[450px] lg:h-auto flex flex-col overflow-hidden">
          <div className="absolute top-4 right-4 z-[999] bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-sm border border-slate-200 text-[11px] space-y-1.5 font-bold text-slate-700">
            <div className="flex items-center"><span className="w-2.5 h-2.5 bg-red-500 rounded-full mr-2 shadow-sm"></span> Solicitud Rescate</div>
            <div className="flex items-center"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2 shadow-sm"></span> Centro de Acopio</div>
            <div className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full mr-2 shadow-sm"></span> Tu Selección</div>
          </div>
          <div className="flex-1 w-full h-full rounded-lg overflow-hidden">
            <MapaEmergencia 
              rescates={rescates} 
              acopios={acopios}
              coordenadaSeleccionada={coordenadaSeleccionada} 
              onMapClick={(latlng) => setCoordenadaSeleccionada(latlng)} 
            />
          </div>
        </div>

        {/* Columna 3: Listados Dinámicos */}
        <div className="space-y-4 flex flex-col h-[600px] lg:h-auto overflow-hidden">
          
          {/* Tarjeta de Rescates */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <div className="border-b border-slate-100 pb-3 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-xs font-black tracking-wider text-slate-400 flex items-center gap-2">
                🚨 RESCATES PRIORITARIOS
                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold">{rescatesFiltrados.length}</span>
              </h3>
              
              {/* Toggle de filtrado rápido */}
              <label className="inline-flex items-center cursor-pointer text-[11px] font-semibold text-slate-600">
                <input 
                  type="checkbox" 
                  checked={soloCriticos} 
                  onChange={(e) => setSoloCriticos(e.target.checked)} 
                  className="rounded border-slate-300 text-red-600 focus:ring-red-500 mr-1.5 w-3.5 h-3.5"
                />
                Solo críticos
              </label>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
              {rescatesFiltrados.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No hay operaciones que coincidan con el filtro.</div>
              ) : (
                rescatesFiltrados.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-lg border border-slate-200/60 text-xs transition-all hover:translate-x-0.5 shadow-sm">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-bold text-slate-800 truncate flex-1">{item.ubicacion_referencia}</span>
                      {item.distancia !== undefined && (
                        <span className="bg-slate-200 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          📍 a {item.distancia.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px] leading-relaxed mb-2.5">{item.detalles_emergencia}</p>
                    <div className="flex justify-between items-end text-[10px] text-slate-500 border-t border-slate-200/50 pt-2 mt-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-700">📞 Contacto: {item.contacto_reportante}</span>
                        {item.sospecha_supervivientes && (
                          <span className="text-red-600 font-bold flex items-center gap-1 animate-pulse">⚠️ Personas atrapadas</span>
                        )}
                      </div>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-2.5 rounded-md flex items-center transition-all text-[10px] tracking-wide shadow-sm"
                      >
                        🗺️ Ruta
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tarjeta de Centros de Acopio */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
            <h3 className="text-xs font-black tracking-wider text-slate-400 border-b border-slate-100 pb-3 mb-3 flex justify-between items-center">
              <span>📦 LOGÍSTICA Y ACOPIOS</span>
              <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">{acopios.length}</span>
            </h3>
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 custom-scrollbar">
              {acopios.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">No se han registrado centros de acopio activos.</div>
              ) : (
                acopios.map((item) => (
                  <div key={item.id} className="p-3 bg-slate-50/80 hover:bg-slate-50 rounded-lg border border-slate-200/60 text-xs transition-all hover:translate-x-0.5 shadow-sm">
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-bold text-slate-800 truncate flex-1">{item.nombre_centro}</span>
                      {item.distancia !== undefined && (
                        <span className="bg-slate-200 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap">
                          📍 a {item.distancia.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px] mb-2.5 leading-relaxed">
                      <strong className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[10px] font-bold mr-1">Solicita:</strong> 
                      {item.insumos_solicitados}
                    </p>
                    <div className="flex justify-between items-end text-[10px] text-slate-500 border-t border-slate-200/50 pt-2 mt-1">
                      <div className="flex flex-col gap-0.5 text-slate-500 font-medium">
                        <span>🕒 Horario: {item.horario || 'No especificado'}</span>
                        <span>📞 Telf: {item.contacto_centro || 'S/C'}</span>
                      </div>
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1.5 px-2.5 rounded-md flex items-center transition-all text-[10px] tracking-wide shadow-sm"
                      >
                        🗺️ Ruta
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