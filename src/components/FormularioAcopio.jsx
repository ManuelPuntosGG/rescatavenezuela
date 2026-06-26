import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
export default function FormularioAcopio({ coordenadas, onAgregarExitoso }) {
  const [formData, setFormData] = useState({
    nombre_centro: '',
    contacto_centro: '',
    horario: '',
    ubicacion_referencia: '',
    insumos_solicitados: ''
  });
  const [cargando, setCargando] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!coordenadas) return alert("Por favor, marca el punto de acopio en el mapa primero.");
    setCargando(true);
    try {
      const { error } = await supabase.from('centros_acopio').insert([{
        ...formData,
        latitud: coordenadas.lat,
        longitud: coordenadas.lng
      }]);
      if (error) throw error;
      alert("Centro de acopio registrado satisfactoriamente.");
      onAgregarExitoso();
    } catch (err) {
      alert("Error al registrar centro: " + err.message);
    } finally {
      setCargando(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} class="space-y-3 bg-white p-4 rounded-lg shadow">
      <h3 class="text-lg font-bold text-emerald-600 border-b pb-1">📦 Registrar Centro de 
Acopio</h3>
      <div>
        <label class="block text-xs font-semibold text-gray-600">Nombre de la Institución u 
Organización</label>
        <input required type="text" class="w-full border p-1 text-sm rounded" placeholder="Ej: 
Cruz Roja Seccional o Escuela Andrés Bello" 
          onChange={e => setFormData({...formData, nombre_centro: e.target.value})} />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-xs font-semibold text-gray-600">Horario de Atención</label>
          <input type="text" class="w-full border p-1 text-sm rounded" placeholder="Ej: 8:00 AM - 6:00 PM" 
        onChange={e => setFormData({...formData, horario: e.target.value})} />
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600">Teléfono de Contacto</label>
          <input type="text" class="w-full border p-1 text-sm rounded" placeholder="Ej: 
0241-1234567" 
            onChange={e => setFormData({...formData, contacto_centro: e.target.value})} />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-600">Insumos Críticos Solicitados</
label>
        <textarea required class="w-full border p-1 text-sm rounded h-16" placeholder="Ej: Agua 
mineral, suero, gasas, alimentos no perecederos" 
          onChange={e => setFormData({...formData, insumos_solicitados: e.target.value})} />
      </div>
      <div>
        <label class="block text-xs font-semibold text-gray-600">Dirección Exacta o Referencia 
Fija</label>
        <input required type="text" class="w-full border p-1 text-sm rounded" placeholder="Ej: 
Al lado de la estación de servicio Bolívar" 
          onChange={e => setFormData({...formData, ubicacion_referencia: e.target.value})} />
      </div>
      <button type="submit" disabled={cargando} class="w-full bg-emerald-600 text-white p-2 
rounded text-sm font-bold hover:bg-emerald-700 transition-colors">
        {cargando ? "Registrando..." : "PUBLICAR PUNTO DE ACOPIO"}
      </button>
    </form>
  );
}