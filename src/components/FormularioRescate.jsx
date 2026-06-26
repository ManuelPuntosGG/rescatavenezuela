import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';

export default function FormularioRescate({ coordenadas, onAgregarExitoso }) {
  const estadoInicial = {
    nombre_reportante: '',
    contacto_reportante: '',
    ubicacion_referencia: '',
    detalles_emergencia: '',
    sospecha_supervivientes: true
  };

  const [formData, setFormData] = useState(estadoInicial);
  const [foto, setFoto] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(null); // <-- Nueva previsualización visual
  const [cargando, setCargando] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const opciones = { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: true };
    try {
      setCargando(true);
      const fileComprimido = await imageCompression(file, opciones);
      setFoto(fileComprimido);
      
      // Crear URL local para mostrar la previsualización en miniatura
      setVistaPrevia(URL.createObjectURL(fileComprimido));
    } catch (error) {
      console.error("Error comprimiendo imagen:", error);
    } finally {
      setCargando(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coordenadas) return alert("Por favor, marca un punto de rescate en el mapa primero.");
    
    setCargando(true);
    let fotoUrl = null;

    try {
      if (foto) {
        const fileExt = foto.name ? foto.name.split('.').pop() : 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `rescates/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('imagenes_emergencia')
          .upload(filePath, foto);
          
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('imagenes_emergencia').getPublicUrl(filePath);
        fotoUrl = data.publicUrl;
      }

      const { error } = await supabase.from('reportes_rescate').insert([{
        ...formData,
        latitud: coordenadas.lat,
        longitud: coordenadas.lng,
        foto_url: fotoUrl
      }]);

      if (error) throw error;

      alert("Reporte de rescate publicado exitosamente con coordenadas precisas.");
      
      // Limpieza total del componente tras el éxito
      setFormData(estadoInicial);
      setFoto(null);
      setVistaPrevia(null);
      onAgregarExitoso();
    } catch (err) {
      alert("Error al procesar el reporte: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-xl">
      <div className="border-b border-slate-100 pb-2">
        <h3 className="text-sm font-black tracking-wide text-red-600 flex items-center gap-1.5">
          🚨 DETALLES DE SOLICITUD DE RESCATE
        </h3>
        <p className="text-[10px] text-slate-400">Proporcione información verídica para los equipos de respuesta</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Tu Nombre (Opcional)</label>
          <input 
            type="text" 
            value={formData.nombre_reportante}
            className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none" 
            placeholder="Ej: Juan" 
            onChange={e => setFormData({...formData, nombre_reportante: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Teléfono / Contacto <span className="text-red-500">*</span></label>
          <input 
            required 
            type="text" 
            value={formData.contacto_reportante}
            className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none font-medium" 
            placeholder="Ej: 04141234567" 
            onChange={e => setFormData({...formData, contacto_reportante: e.target.value})} 
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">Dirección Estructural / Puntos de Referencia <span className="text-red-500">*</span></label>
        <input 
          required 
          type="text" 
          value={formData.ubicacion_referencia}
          className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none" 
          placeholder="Ej: Detrás del CC Metrópolis, edificio azul colapsado" 
          onChange={e => setFormData({...formData, ubicacion_referencia: e.target.value})} 
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">Detalles de la Emergencia y Entorno <span className="text-red-500">*</span></label>
        <textarea 
          required 
          value={formData.detalles_emergencia}
          className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg h-20 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all outline-none resize-none leading-relaxed" 
          placeholder="Ej: Se escuchan ruidos bajo las placas de concreto en la planta baja. Estructura inestable..." 
          onChange={e => setFormData({...formData, detalles_emergencia: e.target.value})} 
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">Fotografía del Sitio (Optimización de red activa)</label>
        <div className="flex items-center gap-3 mt-1">
          <input 
            type="file" 
            accept="image/*" 
            className="flex-1 text-[11px] text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 file:cursor-pointer file:transition-all" 
            onChange={handleFileChange} 
          />
          {vistaPrevia && (
            <div className="relative w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shadow-sm shrink-0">
              <img src={vistaPrevia} alt="Previa" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Banner de alerta dinámico basado en la casilla crítica */}
      <div className={`p-3 rounded-lg border transition-all ${
        formData.sospecha_supervivientes 
          ? 'bg-red-50 border-red-200 text-red-900 shadow-sm' 
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}>
        <label htmlFor="sobrevivientes" className="flex items-start gap-2.5 cursor-pointer select-none">
          <input 
            type="checkbox" 
            id="sobrevivientes" 
            checked={formData.sospecha_supervivientes} 
            className="rounded border-slate-300 text-red-600 focus:ring-red-500 mt-0.5 w-4 h-4 cursor-pointer"
            onChange={e => setFormData({...formData, sospecha_supervivientes: e.target.checked})} 
          />
          <div className="text-[11px]">
            <span className="font-bold block">¿Hay sospechas de personas con vida bajo los escombros?</span>
            <span className={`${formData.sospecha_supervivientes ? 'text-red-600 font-medium' : 'text-slate-400'} text-[10px]`}>
              {formData.sospecha_supervivientes ? '⚠️ Esto priorizará el marcador en el mapa de atención rápida.' : 'Marque esta casilla solo si hay indicios de sobrevivientes.'}
            </span>
          </div>
        </label>
      </div>

      <button 
        type="submit" 
        disabled={cargando} 
        className={`w-full text-white py-2.5 px-4 rounded-lg text-xs font-black tracking-wider transition-all shadow-md ${
          !coordenadas 
            ? "bg-slate-400 cursor-not-allowed opacity-60" 
            : "bg-red-600 hover:bg-red-700 active:scale-[0.99]"
        }`}
      >
        {cargando ? "PROCESANDO REPORTE..." : "ENVIAR ALERTA URGENTE"}
      </button>
    </form>
  );
}