import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import imageCompression from 'browser-image-compression';
export default function FormularioRescate({ coordenadas, onAgregarExitoso }) {
  const [formData, setFormData] = useState({
    nombre_reportante: '',
    contacto_reportante: '',
    ubicacion_referencia: '',
    detalles_emergencia: '',
    sospecha_supervivientes: true
  });
  const [foto, setFoto] = useState(null);
  const [cargando, setCargando] = useState(false);
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Compresión del lado del cliente para optimizar redes móviles inestables
    const opciones = { maxSizeMB: 0.3, maxWidthOrHeight: 1024, useWebWorker: true };
    try {
      setCargando(true);
      const fileComprimido = await imageCompression(file, opciones);
      setFoto(fileComprimido);
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
        const fileName = `${Math.random()}.${fileExt}`;
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
      onAgregarExitoso();
    } catch (err) {
      alert("Error al procesar el reporte: " + err.message);
    } finally {
      setCargando(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} class="space-y-3 bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-bold text-red-600 border-b pb-1">🚨 Reportar Sospecha de 
Sobrevivientes</h3>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-gray-600">Tu Nombre (Opcional)</label>
          <input type="text" class="w-full border p-1 text-sm rounded" placeholder="Ej: Juan" 
            onChange={e => setFormData({...formData, nombre_reportante: e.target.value})} />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600">Teléfono/Contacto 
(Obligatorio)</label>
          <input required type="text" class="w-full border p-1 text-sm rounded" placeholder="Ej:
          04141234567" 
            onChange={e => setFormData({...formData, contacto_reportante: e.target.value})} />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-600">Dirección / Puntos de 
Referencia</label>
        <input required type="text" class="w-full border p-1 text-sm rounded" placeholder="Ej: 
Detrás del CC Metrópolis, edificio azul colapsado" 
          onChange={e => setFormData({...formData, ubicacion_referencia: e.target.value})} />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-600">Detalles de la Situación 
Estructural</label>
        <textarea required class="w-full border p-1 text-sm rounded h-16" placeholder="Ej: Se 
escuchan golpes bajo los escombros del segundo piso..." 
          onChange={e => setFormData({...formData, detalles_emergencia: e.target.value})} />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-600">Fotografía del Sitio (Bajo peso 
automático)</label>
        <input type="file" accept="image/*" class="w-full text-xs text-gray-500 file:mr-2 
file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-red-50 
file:text-red-700 hover:file:bg-red-100" 
          onChange={handleFileChange} />
      </div>
      <div class="flex items-center space-x-2 py-1">
        <input type="checkbox" id="sobrevivientes" checked={formData.sospecha_supervivientes} 
          onChange={e => setFormData({...formData, sospecha_supervivientes: 
e.target.checked})} />
        <label htmlFor="sobrevivientes" class="text-xs text-gray-700 font-bold">¿Hay sospechas 
de personas con vida bajo los escombros?</label>
      </div>
      <button type="submit" disabled={cargando} class="w-full bg-red-600 text-white p-2 rounded 
text-sm font-bold hover:bg-red-700 transition-colors">
        {cargando ? "Procesando..." : "ENVIAR ALERTA URGENTE"}
      </button>
    </form>
  );
}