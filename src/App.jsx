import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse'; 
import { supabase } from './supabaseClient';
import MapaEmergencia from './components/MapaEmergencia';
import FormularioRescate from './components/FormularioRescate';
import FormularioAcopio from './components/FormularioAcopio';
import BuscadorDireccion from './components/BuscadorDireccion';

const normalizarTexto = (str) => {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export default function App() {
  const [rescates, setRescates] = useState([]);
  const [acopios, setAcopios] = useState([]);
  const [coordenadaSeleccionada, setCoordenadaSeleccionada] = useState(null);
  const [formActivo, setFormActivo] = useState(null); 
  const [gpsUsuario, setGpsUsuario] = useState(null);
  const [soloCriticos, setSoloCriticos] = useState(false); 

  // ESTADO DINÁMICO PARA PACIENTES (CSV)
  const [pacientes, setPacientes] = useState([]); 
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [filtroHospital, setFiltroHospital] = useState('');

  const [rescateExpandido, setRescateExpandido] = useState(null);
  const [acopioExpandido, setAcopioExpandido] = useState(null);
  
  // CAMBIO CLAVE: Iniciamos en la vista centralizada de bienvenida 'inicio'
  const [seccionActiva, setSeccionActiva] = useState('inicio'); 

  // CARGA DE CSV
  useEffect(() => {
    fetch('/pacientes.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const datosFormateados = results.data.map((item, index) => {
              return {
                id: item['N°'] || item['\ufeffN°'] || index, 
                nombre: item['Apellidos y Nombres'] || "Sin Nombre",
                hospital: item['Hospital'] || "Sin Hospital",
                edad: item['Edad'] || "—",
                cedula: item['Cédula / ID'] || item['Cedula'] || "—"
              };
            });
            setPacientes(datosFormateados);
          }
        });
      })
      .catch(err => console.error("Error cargando CSV:", err));
  }, []);

  const hospitalesDisponibles = [...new Set(pacientes.map(p => p.hospital).filter(Boolean))].sort();

  const gpsUsuarioRef = useRef(gpsUsuario);
  useEffect(() => {
    gpsUsuarioRef.current = gpsUsuario;
  }, [gpsUsuario]);

  const calcularDistancia = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
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
      alert("No se pudo acceder a tu GPS.");
    }, { enableHighAccuracy: true });
  };

  const rescatesFiltrados = soloCriticos ? rescates.filter(item => item.sospecha_supervivientes) : rescates;

  const pacientesFiltrados = pacientes.filter(p => {
    const coincideBusqueda = normalizarTexto(p.nombre).includes(normalizarTexto(busquedaPaciente)) || 
                             normalizarTexto(p.cedula).includes(normalizarTexto(busquedaPaciente));
    const coincideHospital = filtroHospital === '' || p.hospital === filtroHospital;
    return coincideBusqueda && coincideHospital;
  });

  const totalCriticos = rescates.filter(item => item.sospecha_supervivientes).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 shadow-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="cursor-pointer select-none" onClick={() => setSeccionActiva('inicio')}>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <h1 className="text-xl font-black tracking-tight text-red-500 m-0">RESCATA VENEZUELA</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Monitoreo Civil de Contingencias e Insumos Logísticos</p>
          </div>

          <div className="flex items-center gap-2">
            {seccionActiva !== 'inicio' && (
              <button 
                onClick={() => setSeccionActiva('inicio')}
                className="text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-3.5 rounded-lg border border-slate-700 transition-all"
              >
                🏠 Volver al Inicio
              </button>
            )}
            <button 
              onClick={geolocalizarUsuario} 
              className={`text-xs font-bold py-2 px-3.5 rounded-lg shadow transition-all border ${
                gpsUsuario 
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30" 
                  : "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
              }`}
            >
              {gpsUsuario ? "📍 GPS Activo" : "📍 Compartir GPS"}
            </button>
          </div>
        </div>
      </header>

      {/* SUB-NAVBAR CONTROLADORA */}
      <div className="bg-white border-b border-slate-200 sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-12">
          <div className="flex gap-2 h-full py-1.5">
            <button 
              onClick={() => setSeccionActiva('inicio')}
              className={`px-3 rounded-lg text-xs font-bold transition-all ${
                seccionActiva === 'inicio' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              Inicio
            </button>
            <button 
              onClick={() => setSeccionActiva('mapa')}
              className={`px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                seccionActiva === 'mapa' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              🗺️ Mapa y Rescates
            </button>
            <button 
              onClick={() => setSeccionActiva('hospitales')}
              className={`px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                seccionActiva === 'hospitales' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              🏥 Buscar Hospitalizados
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
         1. LANDING PRINCIPAL / HUB INTUITIVO (Métricas + Selector de Tareas)
         ========================================================================= */}
      {seccionActiva === 'inicio' && (
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center gap-8 animate-fadeIn">
          
          {/* Mensaje de bienvenida simple */}
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">¿Qué información necesitas consultar hoy?</h2>
            <p className="text-sm text-slate-500 mt-1">
              Plataforma civil unificada para el monitoreo geográfico de incidentes y localización de personas en centros médicos.
            </p>
          </div>

          {/* Cuadrícula de Métricas Integradas en el Home */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xl">🚨</span>
              <div className="mt-2">
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Rescates Solicitados</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{rescates.length}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xl">⚠️</span>
              <div className="mt-2">
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Casos de Extrema Gravedad</p>
                <p className="text-2xl font-black text-orange-600 mt-1">{totalCriticos}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xl">📦</span>
              <div className="mt-2">
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Centros de Acopio</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{acopios.length}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xl">👥</span>
              <div className="mt-2">
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Censo Hospitalario (CSV)</p>
                <p className="text-2xl font-black text-indigo-600 mt-1">{pacientes.length} Personas</p>
              </div>
            </div>
          </section>

          {/* TARJETAS OPCIONALES DE REDIRECCIÓN (Core de la Experiencia) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Opción A: Mapa de operaciones */}
            <div 
              onClick={() => setSeccionActiva('mapa')}
              className="bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-500 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl font-bold text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    🗺️
                  </div>
                  <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">Tiempo Real</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-4 tracking-tight">Ver Mapa de Emergencia e Incidentes</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Ubica geográficamente solicitudes de rescates activos, personas atrapadas o localiza centros logísticos de acopio. 
                  <strong> También puedes reportar nuevos casos aquí.</strong>
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                <span>Abrir mapa operativo →</span>
              </div>
            </div>

            {/* Opción B: Buscador de Personas */}
            <div 
              onClick={() => setSeccionActiva('hospitales')}
              className="bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-500 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[220px]"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="bg-indigo-50 text-indigo-600 p-3 rounded-xl font-bold text-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    🏥
                  </div>
                  <span className="text-[11px] bg-slate-100 text-slate-600 font-mono font-bold px-2 py-0.5 rounded-full">Padrón Interno</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-4 tracking-tight">Buscar Familiares Hospitalizados</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Consulta rápida del censo civil consolidado. Escribe nombres, apellidos o números de identificación para verificar ingresos validados en centros de salud.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-700">
                <span>Ingresar al buscador de personas →</span>
              </div>
            </div>

          </section>

          {/* Bloque de accesibilidad rápida para registrar desde el Inicio */}
          <div className="bg-slate-100 rounded-xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-xs font-bold text-slate-800">¿Deseas dar de alta una alerta de emergencia de forma directa?</p>
              <p className="text-[11px] text-slate-500">Puedes levantar un reporte inmediato rellenando el formulario correspondiente.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto justify-center">
              <button 
                onClick={() => setFormActivo('rescate')}
                className="text-[11px] font-black bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded-lg shadow whitespace-nowrap"
              >
                🚨 Alerta de Rescate
              </button>
              <button 
                onClick={() => setFormActivo('acopio')}
                className="text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 rounded-lg shadow whitespace-nowrap"
              >
                📦 Dar de Alta Acopio
              </button>
            </div>
          </div>
        </main>
      )}

      {/* =========================================================================
         2. VISTA CONDICIONAL: MAPA OPERATIVO (Con botones integrados)
         ========================================================================= */}
      {seccionActiva === 'mapa' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* Buscador e indicaciones rápidas */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex-1">
                <BuscadorDireccion onDireccionEncontrada={(coords) => setCoordenadaSeleccionada(coords)} />
              </div>
              {coordenadaSeleccionada ? (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] py-2 px-3.5 rounded-lg font-bold shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap">
                  Fijado: {coordenadaSeleccionada.lat.toFixed(4)}, {coordenadaSeleccionada.lng.toFixed(4)}
                </div>
              ) : (
                <div className="bg-slate-200/60 text-slate-600 text-[10px] py-2 px-3 rounded-lg font-medium text-center flex items-center justify-center">
                  💡 Haz clic en el mapa para marcar coordenadas
                </div>
              )}
            </div>

            {/* Contenedor del Mapa */}
            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-200 relative h-[450px] lg:h-full flex flex-col overflow-hidden">
              <div className="flex-1 w-full h-full rounded-lg overflow-hidden">
                <MapaEmergencia 
                  rescates={rescates} 
                  acopios={acopios}
                  coordenadaSeleccionada={coordenadaSeleccionada} 
                  onMapClick={(latlng) => setCoordenadaSeleccionada(latlng)} 
                />
              </div>
            </div>
          </div>

          {/* Listas laterales de control */}
          <div className="lg:col-span-1 space-y-3 flex flex-col h-[600px] lg:h-auto overflow-hidden">
            
            {/* Lista de Rescates */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
              <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                <h3 className="text-xs font-black tracking-wider text-slate-400">🚨 SOLICITUDES DE RESCATE</h3>
                <label className="inline-flex items-center cursor-pointer text-[10px] font-semibold text-slate-500">
                  <input 
                    type="checkbox" 
                    checked={soloCriticos} 
                    onChange={(e) => setSoloCriticos(e.target.checked)} 
                    className="rounded border-slate-300 text-red-600 focus:ring-red-500 mr-1 w-3 h-3"
                  />
                  Solo críticos
                </label>
              </div>

              <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
                {rescatesFiltrados.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">Sin registros.</div>
                ) : (
                  rescatesFiltrados.map((item) => {
                    const estaExpandido = rescateExpandido === item.id;
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => setRescateExpandido(estaExpandido ? null : item.id)}
                        className={`p-3 rounded-lg border text-xs transition-all cursor-pointer shadow-sm ${
                          estaExpandido ? 'bg-indigo-50/20 border-indigo-200' : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/70'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="truncate flex-1">
                            <span className="font-bold text-slate-800 block truncate">{item.ubicacion_referencia}</span>
                            {item.sospecha_supervivientes && !estaExpandido && (
                              <span className="text-[10px] text-red-600 font-bold animate-pulse">⚠️ Atrapados</span>
                            )}
                          </div>
                          {item.distancia !== undefined && (
                            <span className="bg-slate-200/80 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[9px]">
                              {item.distancia.toFixed(1)} km
                            </span>
                          )}
                        </div>

                        {estaExpandido && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-slate-600 space-y-2">
                            <p className="text-[11px] leading-relaxed"><strong className="text-slate-700">Detalles:</strong> {item.detalles_emergencia}</p>
                            <span className="block text-[10px] font-semibold text-slate-700">📞 Contacto: {item.contacto_reportante}</span>
                            <div className="flex justify-end pt-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2.5 rounded text-[10px]"
                                onClick={(e) => e.stopPropagation()} 
                              >
                                🗺️ Trazar Ruta
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Centros de acopio */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
              <h3 className="text-xs font-black tracking-wider text-slate-400 border-b border-slate-100 pb-2 mb-2">📦 CENTROS DE ACOPIO</h3>
              <div className="overflow-y-auto space-y-2 flex-1 pr-1 custom-scrollbar">
                {acopios.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">Sin centros activos.</div>
                ) : (
                  acopios.map((item) => {
                    const estaExpandido = acopioExpandido === item.id;
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => setAcopioExpandido(estaExpandido ? null : item.id)}
                        className={`p-3 rounded-lg border text-xs transition-all cursor-pointer shadow-sm ${
                          estaExpandido ? 'bg-emerald-50/20 border-emerald-200' : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/70'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-slate-800 truncate flex-1">{item.nombre_centro}</span>
                          {item.distancia !== undefined && (
                            <span className="bg-slate-200/80 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[9px]">
                              {item.distancia.toFixed(1)} km
                            </span>
                          )}
                        </div>

                        {estaExpandido && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-slate-600 space-y-2">
                            <p className="text-[11px] leading-relaxed"><strong className="text-emerald-700">Solicita:</strong> {item.insumos_solicitados}</p>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                              <span>🕒 Horario: {item.horario || 'S/E'}</span>
                              <span>📞 Telf: {item.contacto_centro || 'S/C'}</span>
                            </div>
                            <div className="flex justify-end pt-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2.5 rounded text-[10px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                🗺️ Cómo llegar
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </main>
      )}

      {/* =========================================================================
         3. VISTA CONDICIONAL: DICTAMEN / CENSO HOSPITALARIO (.CSV)
         ========================================================================= */}
      {seccionActiva === 'hospitales' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1">
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                  🏥 Directorio Integrado de Personas Admitidas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filtra de manera precisa por el nombre de la persona en contingencia o su identificación reglamentaria.
                </p>
              </div>
              
              <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 flex-1 max-w-2xl justify-end">
                <input 
                  type="text"
                  placeholder="🔍 Buscar por nombre, apellido o cédula..."
                  value={busquedaPaciente}
                  onChange={(e) => setBusquedaPaciente(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 flex-1 font-medium text-slate-800"
                />
                <select
                  value={filtroHospital}
                  onChange={(e) => setFiltroHospital(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-slate-700"
                >
                  <option value="">Todos los Hospitales</option>
                  {hospitalesDisponibles.map((hosp, i) => (
                    <option key={i} value={hosp}>{hosp}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-[11px] font-bold text-slate-400 mb-3 uppercase tracking-wider">
              {pacientesFiltrados.length === 1 
                ? '1 persona listada bajo el parámetro indicado' 
                : `${pacientesFiltrados.length} Personas encontradas`}
            </div>

            {/* Tabla / Tarjetas responsivas */}
            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl shadow-inner max-h-[58vh]">
              {pacientesFiltrados.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs bg-slate-50/50">
                  ❌ No se hallaron incidencias con los criterios dados.
                </div>
              ) : (
                <>
                  {/* Vista Escritorio */}
                  <table className="hidden md:table w-full text-left border-collapse text-xs relative">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-500 font-black tracking-wider border-b border-slate-200/60 sticky top-0 backdrop-blur-sm z-10">
                        <th className="p-3.5 w-16 text-center">N°</th>
                        <th className="p-3.5">Apellidos y Nombres</th>
                        <th className="p-3.5">Cédula / ID</th>
                        <th className="p-3.5">Centro de Destino</th>
                        <th className="p-3.5 w-24 text-center">Edad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {pacientesFiltrados.map((p, index) => (
                        <tr key={p.id || index} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 font-mono text-slate-400 text-center bg-slate-50/20">{index + 1}</td>
                          <td className="p-3.5 font-bold text-slate-900 uppercase">{p.nombre}</td>
                          <td className="p-3.5 font-mono text-slate-600">{p.cedula}</td>
                          <td className="p-3.5">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold text-[10px]">
                              {p.hospital}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-600">{p.edad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Vista Tarjeta para Celulares */}
                  <div className="md:hidden grid grid-cols-1 gap-2 p-2 bg-slate-50/50">
                    {pacientesFiltrados.map((p, index) => (
                      <div key={p.id || index} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                          <span>REGISTRO #{index + 1}</span>
                          <span>🎂 {p.edad} AÑOS</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 uppercase">{p.nombre}</h4>
                        <p className="text-[10px] text-slate-500">Documento: <span className="font-mono text-slate-700 font-bold">{p.cedula}</span></p>
                        <div className="pt-1.5 text-[10px] text-indigo-700 font-bold">
                          🏥 {p.hospital}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>
      )}

      {/* MODAL EMERGENTE GLOBAL DE FORMULARIOS */}
      {formActivo && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button 
              onClick={() => setFormActivo(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold transition-all"
            >
              ✕
            </button>
            <h2 className="text-xs font-black tracking-wider text-slate-400 mb-4 uppercase">
              {formActivo === 'rescate' ? '🚨 Registrar Solicitud de Rescate' : '📦 Registrar Punto de Acopio'}
            </h2>
            {coordenadaSeleccionada ? (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] py-2 px-3 rounded-lg text-center font-semibold mb-4 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                Ubicación vinculada de forma exitosa.
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 text-[11px] py-2.5 px-3 rounded-lg text-center font-medium mb-4">
                ⚠️ No has seleccionado un punto en el mapa. Puedes rellenar el formulario ahora o cerrar para marcarlo en el mapa primero.
              </div>
            )}
            <div className="mt-2">
              {formActivo === 'rescate' ? (
                <FormularioRescate coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); setFormActivo(null); cargarDatos(); }} />
              ) : (
                <FormularioAcopio coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); setFormActivo(null); cargarDatos(); }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}