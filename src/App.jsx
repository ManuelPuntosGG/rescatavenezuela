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
  const [formActivo, setFormActivo] = useState(null); 
  const [gpsUsuario, setGpsUsuario] = useState(null);
  const [soloCriticos, setSoloCriticos] = useState(false); 

  // Control de expansión de tarjetas independientes para no abrumar la vista
  const [rescateExpandido, setRescateExpandido] = useState(null);
  const [acopioExpandido, setAcopioExpandido] = useState(null);

  // Control de la sección activa (Listo para 'mapa' u 'hospitales' en el futuro)
  const [seccionActiva, setSeccionActiva] = useState('mapa'); 

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

  const rescatesFiltrados = soloCriticos 
    ? rescates.filter(item => item.sospecha_supervivientes) 
    : rescates;

  // Conteos para el resumen rápido (Card de KPIs)
  const totalCriticos = rescates.filter(item => item.sospecha_supervivientes).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900">
      
      {/* Header Principal */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 shadow-md border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
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

          {/* Botones de Acción de Registro y GPS */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button 
              onClick={() => setFormActivo('rescate')}
              className="text-xs font-black bg-red-600 hover:bg-red-700 text-white py-2 px-3.5 rounded-lg shadow transition-all flex items-center gap-1.5"
            >
              🚨 Reportar Rescate
            </button>
            <button 
              onClick={() => setFormActivo('acopio')}
              className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3.5 rounded-lg shadow transition-all flex items-center gap-1.5"
            >
              📦 Registrar Acopio
            </button>
            <button 
              onClick={geolocalizarUsuario} 
              className={`text-xs font-bold py-2 px-3.5 rounded-lg shadow transition-all flex items-center gap-1.5 border ${
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

      {/* SUB-NAVBAR: Menú Limpio de Secciones (Preparado para Hospitales) */}
      <div className="bg-white border-b border-slate-200 sticky top-[73px] z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex gap-1 h-full">
            <button 
              onClick={() => setSeccionActiva('mapa')}
              className={`px-4 h-full text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                seccionActiva === 'mapa' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🗺️ Mapa de Emergencia
            </button>
            <button 
              onClick={() => setSeccionActiva('hospitales')}
              className={`px-4 h-full text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
                seccionActiva === 'hospitales' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              🏥 Reportes de Hospitales 
              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-sans font-normal">Próximamente</span>
            </button>
          </div>
        </div>
      </div>

      {/* PANEL DE RESUMEN RÁPIDO (Métricas limpias para evitar caos visual) */}
      <section className="bg-slate-100/80 border-b border-slate-200/60 py-3 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-red-50 text-red-600 font-bold text-lg">🚨</div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Rescates Activos</p>
              <p className="text-lg font-black text-slate-800 mt-1">{rescates.length}</p>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600 font-bold text-lg">⚠️</div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Casos Críticos</p>
              <p className="text-lg font-black text-orange-600 mt-1">{totalCriticos}</p>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-lg">📦</div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Centros de Acopio</p>
              <p className="text-lg font-black text-slate-800 mt-1">{acopios.length}</p>
            </div>
          </div>
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 font-bold text-lg">👥</div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 leading-none">Búsqueda Personas</p>
              <p className="text-xs font-bold text-slate-400 mt-1">Conectando...</p>
            </div>
          </div>
        </div>
      </section>

      {/* VISTAS CONDICIONALES */}
      {seccionActiva === 'mapa' ? (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Columna de Mapa (2/3) */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex-1">
                <BuscadorDireccion onDireccionEncontrada={(coords) => setCoordenadaSeleccionada(coords)} />
              </div>
              {coordenadaSeleccionada && (
                <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] py-2 px-3.5 rounded-lg font-medium shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                  Fijado: {coordenadaSeleccionada.lat.toFixed(4)}, {coordenadaSeleccionada.lng.toFixed(4)}
                </div>
              )}
            </div>

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

          {/* Columna de Listados Dinámicos e Intuitivos (1/3) */}
          <div className="lg:col-span-1 space-y-4 flex flex-col h-[600px] lg:h-auto overflow-hidden">
            
            {/* Lista de Rescates */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
              <div className="border-b border-slate-100 pb-2 mb-2 flex items-center justify-between">
                <h3 className="text-xs font-black tracking-wider text-slate-400 flex items-center gap-1.5">
                  🚨 SOLICITUDES DE RESCATE
                </h3>
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
                  <div className="text-center py-8 text-slate-400 text-xs">Sin registros que mostrar.</div>
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
                            <span className="bg-slate-200/80 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap">
                              📍 a {item.distancia.toFixed(1)} km
                            </span>
                          )}
                        </div>

                        {/* Contenido Expandible controlado */}
                        {estaExpandido && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-slate-600 space-y-2 animate-fade-in">
                            <p className="text-[11px] leading-relaxed"><strong className="text-slate-700">Detalles:</strong> {item.detalles_emergencia}</p>
                            <div className="flex flex-col gap-0.5 text-[10px]">
                              <span className="font-semibold text-slate-700">📞 Contacto: {item.contacto_reportante}</span>
                              {item.sospecha_supervivientes && (
                                <span className="text-red-600 font-bold">⚠️ Confirmación: Sospecha fuerte de supervivientes bajo escombros.</span>
                              )}
                            </div>
                            <div className="flex justify-end pt-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2.5 rounded flex items-center text-[10px]"
                                onClick={(e) => e.stopPropagation()} // Evita cerrar la tarjeta al pulsar el link
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

            {/* Lista de Centros de Acopio */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
              <h3 className="text-xs font-black tracking-wider text-slate-400 border-b border-slate-100 pb-2 mb-2">
                📦 CENTROS DE ACOPIO LOGÍSTICOS
              </h3>
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
                            <span className="bg-slate-200/80 text-slate-700 font-mono font-bold px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap">
                              📍 a {item.distancia.toFixed(1)} km
                            </span>
                          )}
                        </div>
                        
                        {!estaExpandido && (
                          <p className="text-slate-500 text-[10px] truncate mt-0.5">🔍 Clic para ver insumos solicitados y horarios</p>
                        )}

                        {/* Contenido Expandible */}
                        {estaExpandido && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-slate-600 space-y-2 animate-fade-in">
                            <p className="text-[11px] leading-relaxed">
                              <strong className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[10px] font-bold mr-1">Solicita:</strong> 
                              {item.insumos_solicitados}
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500 font-medium">
                              <span>🕒 Horario: {item.horario || 'No especificado'}</span>
                              <span>📞 Telf: {item.contacto_centro || 'S/C'}</span>
                            </div>
                            <div className="flex justify-end pt-1">
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${item.latitud},${item.longitud}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-1 px-2.5 rounded flex items-center text-[10px]"
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
      ) : (
        /* PANEL DE HOSPITALES (Espacio limpio para la siguiente implementación) */
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-xl mx-auto mt-10">
            <span className="text-4xl block mb-3">🏥</span>
            <h3 className="text-lg font-black text-slate-800">Módulo de Cotejo Hospitalario</h3>
            <p className="text-slate-500 text-xs mt-2 leading-relaxed">
              Aquí se integrarán las listas de pacientes ingresados, traslados y estatus de las salas de urgencias de los principales centros médicos del país para cruzarlos con los reportes de personas desaparecidas en tiempo real.
            </p>
            <div className="mt-6 p-3 bg-indigo-50 text-indigo-700 rounded-xl text-[11px] font-semibold inline-block">
              🚀 Próxima actualización en desarrollo
            </div>
          </div>
        </main>
      )}

      {/* MODAL EMERGENTE DE FORMULARIOS */}
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
                ⚠️ No has seleccionado un punto en el mapa. Cierra este cuadro si deseas marcarlo antes de rellenar los datos.
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