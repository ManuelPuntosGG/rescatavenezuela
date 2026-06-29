import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse'; 
import { supabase } from './supabaseClient';
import MapaEmergencia from './components/MapaEmergencia';
import FormularioRescate from './components/FormularioRescate';
import FormularioAcopio from './components/FormularioAcopio';
import BuscadorDireccion from './components/BuscadorDireccion';

// Importación de iconos
import { 
  AlertTriangle, MapPin, Package, Users, Map as MapIcon, 
  Hospital, Home, Phone, Clock, Search, Filter, X, 
  Navigation, CheckCircle, Lightbulb, Siren, Activity
} from 'lucide-react';

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

  const [subTabMapa, setSubTabMapa] = useState('rescates');

  const [pacientes, setPacientes] = useState([]); 
  const [busquedaPaciente, setBusquedaPaciente] = useState('');
  const [filtroHospital, setFiltroHospital] = useState('');

  const [rescateExpandido, setRescateExpandido] = useState(null);
  const [acopioExpandido, setAcopioExpandido] = useState(null);
  
  const [seccionActiva, setSeccionActiva] = useState('inicio'); 

  useEffect(() => {
    fetch('/pacientes.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const datosFormateados = results.data.map((item, index) => ({
              id: item['N°'] || item['\ufeffN°'] || index, 
              nombre: item['Apellidos y Nombres'] || "Sin Nombre",
              hospital: item['Hospital'] || "Sin Hospital",
              edad: item['Edad'] || "—",
              cedula: item['Cédula / ID'] || item['Cedula'] || "—",
              observaciones: item['Observaciones'] || "Sin novedades adicionales."
            }));
            setPacientes(datosFormateados);
          }
        });
      })
      .catch(err => console.error("Error cargando CSV de pacientes:", err));
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
    const canalRescates = supabase.channel('cambios-rescates').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes_rescate' }, () => cargarDatos()).subscribe();
    const canalAcopios = supabase.channel('cambios-acopios').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'centros_acopio' }, () => cargarDatos()).subscribe();
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
                             normalizarTexto(p.cedula).includes(normalizarTexto(busquedaPaciente)) ||
                             normalizarTexto(p.hospital).includes(normalizarTexto(busquedaPaciente));
    const coincideHospital = filtroHospital === '' || p.hospital === filtroHospital;
    return coincideBusqueda && coincideHospital;
  });

  const totalCriticos = rescates.filter(item => item.sospecha_supervivientes).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      
      {/* HEADER PRINCIPAL */}
      <header className="bg-slate-950 text-white p-4 shadow-md border-b border-blue-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="cursor-pointer select-none" onClick={() => setSeccionActiva('inicio')}>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <h1 className="text-xl font-black tracking-tight text-white m-0 flex items-center gap-2">
                RESCATA VENEZUELA
              </h1>
            </div>
            <p className="text-xs text-blue-300 mt-0.5 font-medium">Monitoreo Civil de Contingencias e Insumos Logísticos</p>
          </div>

          <div className="flex items-center gap-2">
            {seccionActiva !== 'inicio' && (
              <button 
                onClick={() => setSeccionActiva('inicio')}
                className="flex items-center gap-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-3.5 rounded-lg border border-slate-700 transition-all"
              >
                <Home className="w-4 h-4" /> Volver al Inicio
              </button>
            )}
            <button 
              onClick={geolocalizarUsuario} 
              className={`flex items-center gap-1.5 text-xs font-bold py-2 px-3.5 rounded-lg shadow transition-all border ${
                gpsUsuario 
                  ? "bg-blue-900/40 text-blue-400 border-blue-800" 
                  : "bg-blue-600 hover:bg-blue-700 text-white border-transparent"
              }`}
            >
              <MapPin className="w-4 h-4" />
              {gpsUsuario ? "Ubicación Compartida" : "Compartir Mi Ubicación"}
            </button>
          </div>
        </div>
      </header>

      {/* BARRA DE NAVEGACIÓN GLOBAL SIMPLIFICADA */}
      <div className="bg-white border-b border-slate-200 sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center h-12">
          <div className="flex gap-2 h-full py-1.5">
            <button 
              onClick={() => setSeccionActiva('inicio')}
              className={`flex items-center gap-1.5 px-4 rounded-lg text-xs font-bold transition-all ${
                seccionActiva === 'inicio' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Home className="w-4 h-4" /> Inicio
            </button>
            <button 
              onClick={() => setSeccionActiva('mapa')}
              className={`flex items-center gap-1.5 px-4 rounded-lg text-xs font-bold transition-all ${
                seccionActiva === 'mapa' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <MapIcon className="w-4 h-4" /> Mapa Operativo
            </button>
            <button 
              onClick={() => setSeccionActiva('hospitales')}
              className={`flex items-center gap-1.5 px-4 rounded-lg text-xs font-bold transition-all ${
                seccionActiva === 'hospitales' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Hospital className="w-4 h-4" /> Buscador de Hospitalizados
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
         1. LANDING PRINCIPAL / HUB DE INDICADORES
         ========================================================================= */}
      {seccionActiva === 'inicio' && (
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center gap-8 animate-fadeIn">
          
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Portal de Monitoreo Civil de Emergencias</h2>
            <p className="text-sm text-slate-500 mt-2">
              Selecciona el módulo correspondiente para consultar información validada en tiempo real.
            </p>
          </div>

          {/* MÁTRICAS CLAVE */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <Siren className="w-6 h-6 text-red-500" />
              <div className="mt-3">
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Rescates Solicitados</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{rescates.length}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between bg-red-50/30">
              <Activity className="w-6 h-6 text-red-600" />
              <div className="mt-3">
                <p className="text-[10px] uppercase font-black tracking-wider text-red-400/80 leading-none">Casos Críticos</p>
                <p className="text-2xl font-black text-red-600 mt-1">{totalCriticos}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <Package className="w-6 h-6 text-blue-500" />
              <div className="mt-3">
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Centros de Acopio</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{acopios.length}</p>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <Users className="w-6 h-6 text-blue-600" />
              <div className="mt-3">
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Censo Hospitalario</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{pacientes.length} <span className="text-sm">Registros</span></p>
              </div>
            </div>
          </section>

          {/* TARJETAS DE DIRECCIONAMIENTO DIRECTO */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div 
              onClick={() => setSeccionActiva('mapa')}
              className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-500 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[200px]"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="bg-blue-50 text-blue-600 p-3 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <MapIcon className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider bg-blue-100 text-blue-800 font-black px-2 py-1 rounded-full">Interactiva</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-4 tracking-tight">Ver Mapa, Reportar Casos y Buscar Acopios</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Accede al plano cartográfico. Podrás compartir tu GPS para hallar ayuda cercana, reportar rescates in situ o registrar un nuevo almacén de insumos.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:text-blue-700">
                <span>Ingresar al centro cartográfico →</span>
              </div>
            </div>

            <div 
              onClick={() => setSeccionActiva('hospitales')}
              className="bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-500 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[200px]"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="bg-blue-50 text-blue-600 p-3 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Hospital className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 font-black px-2 py-1 rounded-full">Base CSV</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-4 tracking-tight">Buscar Familiares Hospitalizados</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Consulta rápida del padrón maestro de heridos y personas admitidas. Filtra inmediatamente por nombre completo, número de cédula o centro de destino.
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs font-bold text-blue-600 group-hover:text-blue-700">
                <span>Ingresar al buscador de personas →</span>
              </div>
            </div>

          </section>
        </main>
      )}

      {/* =========================================================================
         2. MAPA OPERATIVO INTEGRADO
         ========================================================================= */}
      {seccionActiva === 'mapa' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4 overflow-hidden">
          
          {/* COLUMNA IZQUIERDA Y CENTRAL: MAPA Y ACCIONES */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-6">
                <BuscadorDireccion onDireccionEncontrada={(coords) => setCoordenadaSeleccionada(coords)} />
              </div>

              <div className="md:col-span-6 flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={() => setFormActivo('rescate')}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-black py-2.5 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 h-10"
                >
                  <AlertTriangle className="w-4 h-4" /> Reportar Emergencia
                </button>
                <button
                  onClick={() => setFormActivo('acopio')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 h-10"
                >
                  <Package className="w-4 h-4" /> Registrar Acopio
                </button>
              </div>
            </div>

            {coordenadaSeleccionada && (
              <div className="bg-blue-50 border border-blue-100 text-blue-800 text-[11px] py-1.5 px-3 rounded-lg font-bold flex items-center justify-between shadow-sm">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3" /> Punto marcado: {coordenadaSeleccionada.lat.toFixed(4)}, {coordenadaSeleccionada.lng.toFixed(4)}
                </span>
                <button 
                  onClick={() => setCoordenadaSeleccionada(null)}
                  className="text-blue-400 hover:text-blue-600 text-xs font-bold flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Limpiar marcador
                </button>
              </div>
            )}

            <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex-1 min-h-[400px] lg:min-h-[500px] relative overflow-hidden">
              <MapaEmergencia 
                rescates={rescates} 
                acopios={acopios}
                coordenadaSeleccionada={coordenadaSeleccionada} 
                onMapClick={(latlng) => setCoordenadaSeleccionada(latlng)} 
              />
            </div>
          </div>

          {/* COLUMNA DERECHA: PANEL LATERAL */}
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[550px] lg:h-auto overflow-hidden">
            
            <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 gap-1">
              <button
                onClick={() => setSubTabMapa('rescates')}
                className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-black rounded-lg transition-all ${
                  subTabMapa === 'rescates' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Siren className="w-3.5 h-3.5" /> Rescates ({rescatesFiltrados.length})
              </button>
              <button
                onClick={() => setSubTabMapa('acopios')}
                className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-black rounded-lg transition-all ${
                  subTabMapa === 'acopios' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Package className="w-3.5 h-3.5" /> Acopios ({acopios.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar flex flex-col">
              
              {/* SUB-TAB: RESCATES */}
              {subTabMapa === 'rescates' && (
                <div className="space-y-2 flex-1">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">Incidentes Activos</span>
                    <label className="inline-flex items-center cursor-pointer text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      <input 
                        type="checkbox" 
                        checked={soloCriticos} 
                        onChange={(e) => setSoloCriticos(e.target.checked)} 
                        className="rounded border-slate-300 text-red-600 mr-1.5 w-3 h-3"
                      />
                      Ver solo Críticos
                    </label>
                  </div>

                  {rescatesFiltrados.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center">
                      <Search className="w-6 h-6 mb-2 opacity-50" />
                      No hay reportes bajo este criterio.
                    </div>
                  ) : (
                    rescatesFiltrados.map((item) => {
                      const estaExpandido = rescateExpandido === item.id;
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => setRescateExpandido(estaExpandido ? null : item.id)}
                          className={`p-3 rounded-xl border text-xs transition-all cursor-pointer shadow-sm ${
                            estaExpandido ? 'bg-red-50/30 border-red-200' : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/70'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="truncate flex-1">
                              <span className="font-bold text-slate-800 block truncate">{item.ubicacion_referencia}</span>
                              {item.sospecha_supervivientes && (
                                <span className="flex items-center gap-1 text-[9px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded mt-1 w-fit animate-pulse">
                                  <AlertTriangle className="w-3 h-3" /> Atrapados
                                </span>
                              )}
                            </div>
                            {item.distancia !== undefined && (
                              <span className="flex items-center gap-1 bg-slate-200 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap">
                                <Navigation className="w-3 h-3" /> {item.distancia.toFixed(1)} km
                              </span>
                            )}
                          </div>

                          {estaExpandido && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 text-slate-600 space-y-2 animate-fadeIn">
                              <p className="text-[11px] leading-relaxed"><strong className="text-slate-700">Situación:</strong> {item.detalles_emergencia}</p>
                              <p className="text-[10px] font-semibold text-slate-700 flex items-center gap-1.5">
                                <Phone className="w-3 h-3" /> Reportó: {item.contacto_reportante}
                              </p>
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setCoordenadaSeleccionada({lat: item.latitud, lng: item.longitud}); }}
                                  className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-1 px-2 rounded text-[10px]"
                                >
                                  <MapPin className="w-3 h-3" /> Ver en mapa
                                </button>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2 rounded text-[10px]"
                                  onClick={(e) => e.stopPropagation()} 
                                >
                                  Navegar <Navigation className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* SUB-TAB: ACOPIOS */}
              {subTabMapa === 'acopios' && (
                <div className="space-y-2 flex-1">
                  <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase block pb-1">Centros Logísticos</span>
                  
                  {acopios.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center">
                      <Package className="w-6 h-6 mb-2 opacity-50" />
                      No hay centros registrados.
                    </div>
                  ) : (
                    acopios.map((item) => {
                      const estaExpandido = acopioExpandido === item.id;
                      return (
                        <div 
                          key={item.id} 
                          onClick={() => setAcopioExpandido(estaExpandido ? null : item.id)}
                          className={`p-3 rounded-xl border text-xs transition-all cursor-pointer shadow-sm ${
                            estaExpandido ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200/70'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-slate-800 truncate flex-1">{item.nombre_centro}</span>
                            {item.distancia !== undefined && (
                              <span className="flex items-center gap-1 bg-slate-200 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap">
                                <Navigation className="w-3 h-3" /> {item.distancia.toFixed(1)} km
                              </span>
                            )}
                          </div>

                          {estaExpandido && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 text-slate-600 space-y-2 animate-fadeIn">
                              <p className="text-[11px] leading-relaxed"><strong className="text-blue-700">Insumos Requeridos:</strong> {item.insumos_solicitados}</p>
                              <div className="grid grid-cols-1 gap-1.5 text-[10px] text-slate-600 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                                <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {item.horario || 'Horario no especificado'}</span>
                                <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {item.contacto_centro || 'Sin contacto provisto'}</span>
                              </div>
                              <div className="flex justify-end gap-1.5 pt-1">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setCoordenadaSeleccionada({lat: item.latitud, lng: item.longitud}); }}
                                  className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-1 px-2 rounded text-[10px]"
                                >
                                  <MapPin className="w-3 h-3" /> Ver en mapa
                                </button>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2 rounded text-[10px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Cómo llegar <Navigation className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

            </div>
          </div>
        </main>
      )}

      {/* =========================================================================
         3. BUSCADOR DE PACIENTES HOSPITALIZADOS
         ========================================================================= */}
      {seccionActiva === 'hospitales' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-4 animate-fadeIn">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col flex-1">
            
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-5 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                  <Hospital className="w-5 h-5 text-blue-600" /> Censo Maestro de Personas Hospitalizadas
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Escribe nombres, cédulas u hospitales para ubicar ingresos validados por equipos de contingencia.
                </p>
              </div>
              
              <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-2 flex-1 max-w-2xl justify-end">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Buscar por nombre, cédula..."
                    value={busquedaPaciente}
                    onChange={(e) => setBusquedaPaciente(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-800 shadow-inner"
                  />
                </div>
                <div className="relative">
                  <Filter className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <select
                    value={filtroHospital}
                    onChange={(e) => setFiltroHospital(e.target.value)}
                    className="w-full sm:w-auto text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-700 cursor-pointer shadow-inner appearance-none"
                  >
                    <option value="">Todos los Hospitales</option>
                    {hospitalesDisponibles.map((hosp, i) => (
                      <option key={i} value={hosp}>{hosp}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-wider">
              Registros coincidentes: {pacientesFiltrados.length}
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl max-h-[60vh] custom-scrollbar">
              {pacientesFiltrados.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs bg-slate-50/50 flex flex-col items-center">
                  <Users className="w-8 h-8 mb-3 opacity-30" />
                  No se encontraron reportes con los términos provistos.
                </div>
              ) : (
                <>
                  {/* Vista Escritorio */}
                  <table className="hidden md:table w-full text-left border-collapse text-xs relative">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-black tracking-wider border-b border-slate-200 sticky top-0 z-10">
                        <th className="p-3 w-12 text-center">N°</th>
                        <th className="p-3">Apellidos y Nombres</th>
                        <th className="p-3">Cédula / ID</th>
                        <th className="p-3">Hospital de Destino</th>
                        <th className="p-3">Observaciones</th>
                        <th className="p-3 w-20 text-center">Edad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {pacientesFiltrados.map((p, index) => (
                        <tr key={p.id || index} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-3 font-mono text-slate-400 text-center">{index + 1}</td>
                          <td className="p-3 font-black text-slate-900 uppercase">{p.nombre}</td>
                          <td className="p-3 font-mono text-slate-600">{p.cedula}</td>
                          <td className="p-3">
                            <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-bold text-[10px]">
                              {p.hospital}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 max-w-xs truncate" title={p.observaciones}>
                            {p.observaciones}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-600">{p.edad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Vista Tarjetas para Celulares */}
                  <div className="md:hidden grid grid-cols-1 gap-2 p-2 bg-slate-50/50">
                    {pacientesFiltrados.map((p, index) => (
                      <div key={p.id || index} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <span className="text-[10px] text-slate-400 font-black tracking-wider">INGRESO #{index + 1}</span>
                          <span className="text-[10px] font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">{p.edad} AÑOS</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase leading-tight">{p.nombre}</h4>
                          <p className="text-[10px] text-slate-500 mt-0.5">Cédula: <span className="font-mono font-bold text-slate-800">{p.cedula}</span></p>
                        </div>
                        <div className="text-[10px] text-blue-700 font-bold flex items-center gap-1.5 bg-blue-50/50 p-1.5 rounded">
                          <Hospital className="w-3.5 h-3.5" /> {p.hospital}
                        </div>
                        <p className="text-[10px] bg-slate-50 p-2.5 rounded border border-slate-100 text-slate-600 italic">
                          {p.observaciones}
                        </p>
                      </div>
                    ))}
                  </div> 
                </>
              )}
            </div>
          </div>
        </main>
      )}

      {/* MODAL GLOBAL PARA FORMULARIOS */}
      {formActivo && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 max-w-md w-full max-h-[90vh] overflow-y-auto relative animate-scaleUp custom-scrollbar">
            <button 
              onClick={() => setFormActivo(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h2 className={`text-xs font-black tracking-wider mb-4 uppercase flex items-center gap-2 ${formActivo === 'rescate' ? 'text-red-600' : 'text-blue-600'}`}>
              {formActivo === 'rescate' ? <><AlertTriangle className="w-4 h-4" /> Nueva Alerta de Emergencia</> : <><Package className="w-4 h-4" /> Registrar Punto Logístico</>}
            </h2>
            
            {coordenadaSeleccionada ? (
              <div className="bg-green-50 border border-green-200 text-green-800 text-[10px] py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold mb-4">
                <CheckCircle className="w-3.5 h-3.5" /> Coordenadas vinculadas: {coordenadaSeleccionada.lat.toFixed(4)}, {coordenadaSeleccionada.lng.toFixed(4)}
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-[10px] py-2 px-3 rounded-lg flex items-center gap-2 font-semibold mb-4 leading-tight">
                <Lightbulb className="w-6 h-6 flex-shrink-0 text-blue-500" /> 
                Consejo: Si cierras, puedes marcar un punto exacto directamente en el mapa antes de rellenar el formulario.
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