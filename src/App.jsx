import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import MapaEmergencia from './components/MapaEmergencia';
import FormularioRescate from './components/FormularioRescate';
import FormularioAcopio from './components/FormularioAcopio';

export default function App() {
  const [rescates, setRescates] = useState([]);
  const [acopios, setAcopios] = useState([]);
  const [coordenadaSeleccionada, setCoordenadaSeleccionada] = useState(null);
  const [pestanaActiva, setPestanaActiva] = useState('rescate'); // 'rescate' o 'acopio'

  const cargarDatos = async () => {
    const { data: res } = await supabase.from('reportes_rescate').select('*').order('creado_en', { ascending: false });
    const { data: aco } = await supabase.from('centros_acopio').select('*').order('creado_en', { ascending: false });
    if (res) setRescates(res);
    if (aco) setAcopios(aco);
  };

  useEffect(() => {
    cargarDatos();

    // Suscripción en tiempo real (Canales de Supabase) para actualizaciones automáticas instantáneas
    const canalRescates = supabase.channel('cambios-rescates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reportes_rescate' }, cargarDatos)
      .subscribe();

    const canalAcopios = supabase.channel('cambios-acopios')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'centros_acopio' }, cargarDatos)
      .subscribe();

    return () => {
      supabase.removeChannel(canalRescates);
      supabase.removeChannel(canalAcopios);
    };
  }, []);

  const geolocalizarUsuario = () => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta geolocalización.");
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoordenadaSeleccionada({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      alert("Ubicación GPS obtenida con éxito.");
    }, () => {
      alert("No se pudo acceder a tu GPS. Por favor marca el mapa manualmente.");
    }, { enableHighAccuracy: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Navbar Superior de Emergencia */}
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
            📍 Usar mi GPS Actual
          </button>
        </div>
      </header>

      {/* Contenido Principal con layout de dos bloques */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Panel Izquierdo: Formularios */}
        <div className="lg:col-span-1 space-y-4">
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
              ⚠️ Haz clic en cualquier punto del mapa o usa tu GPS para habilitar el formulario.
            </div>
          )}

          {pestanaActiva === 'rescate' ? (
            <FormularioRescate coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); cargarDatos(); }} />
          ) : (
            <FormularioAcopio coordenadas={coordenadaSeleccionada} onAgregarExitoso={() => { setCoordenadaSeleccionada(null); cargarDatos(); }} />
          )}
        </div>

        {/* Panel Derecho: Mapa en pantalla completa */}
        <div className="lg:col-span-2 bg-white p-2 rounded-lg shadow border relative h-[600px] lg:h-auto flex flex-col">
          <div className="absolute top-4 right-4 z-[999] bg-white/95 backdrop-blur-sm p-3 rounded shadow-md border text-xs space-y-1 font-bold">
            <div className="flex items-center"><span class="w-3 h-3 bg-red-500 rounded-full mr-2"></span> Rescate (Posibles Sobrevivientes)</div>
            <div className="flex items-center"><span class="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span> Centros de Acopio Activos</div>
            <div className="flex items-center"><span class="w-3 h-3 bg-blue-500 rounded-full mr-2"></span> Tu Selección Actual</div>
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
      </main>
    </div>
  );
}