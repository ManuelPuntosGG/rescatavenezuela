import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function FormularioAcopio({ coordenadas, onAgregarExitoso }) {
  const estadoInicial = {
    nombre_centro: '',
    contacto_centro: '',
    horario: '',
    ubicacion_referencia: '',
    insumos_solicitados: ''
  };

  const [formData, setFormData] = useState(estadoInicial);
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
      
      // Resetear el formulario al estado inicial limpio
      setFormData(estadoInicial);
      onAgregarExitoso();
    } catch (err) {
      alert("Error al registrar centro: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-xl">
      <div className="border-b border-slate-100 pb-2">
        <h3 className="text-sm font-black tracking-wide text-emerald-600 flex items-center gap-1.5">
          📦 REGISTRAR CENTRO DE ACOPIO
        </h3>
        <p className="text-[10px] text-slate-400">Establezca un punto oficial de recolección y distribución de suministros</p>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre de la Institución u Organización <span className="text-emerald-600">*</span></label>
        <input 
          required 
          type="text" 
          value={formData.nombre_centro}
          className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none" 
          placeholder="Ej: Cruz Roja Seccional o Escuela Andrés Bello" 
          onChange={e => setFormData({...formData, nombre_centro: e.target.value})} 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Horario de Atención</label>
          <input 
            type="text" 
            value={formData.horario}
            className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none" 
            placeholder="Ej: 8:00 AM - 6:00 PM" 
            onChange={e => setFormData({...formData, horario: e.target.value})} 
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Teléfono de Contacto</label>
          <input 
            type="text" 
            value={formData.contacto_centro}
            className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none font-medium" 
            placeholder="Ej: 0241-1234567" 
            onChange={e => setFormData({...formData, contacto_centro: e.target.value})} 
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">Insumos Críticos Requeridos <span className="text-emerald-600">*</span></label>
        <textarea 
          required 
          value={formData.insumos_solicitados}
          className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg h-20 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none resize-none leading-relaxed" 
          placeholder="Ej: Agua mineral, suero oral, gasas, analgésicos, alimentos no perecederos..." 
          onChange={e => setFormData({...formData, insumos_solicitados: e.target.value})} 
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-600 mb-1">Dirección Exacta o Referencia Fija <span className="text-emerald-600">*</span></label>
        <input 
          required 
          type="text" 
          value={formData.ubicacion_referencia}
          className="w-full border border-slate-200 bg-slate-50/50 p-2 text-xs rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none" 
          placeholder="Ej: Frente a la plaza Bolívar, al lado de la estación de servicio" 
          onChange={e => setFormData({...formData, ubicacion_referencia: e.target.value})} 
        />
      </div>

      <button 
        type="submit" 
        disabled={cargando} 
        className={`w-full text-white py-2.5 px-4 rounded-lg text-xs font-black tracking-wider transition-all shadow-md ${
          !coordenadas 
            ? "bg-slate-400 cursor-not-allowed opacity-60" 
            : "bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99]"
        }`}
      >
        {cargando ? "REGISTRANDO PUNTO..." : "PUBLICAR PUNTO DE ACOPIO"}
      </button>
    </form>
  );
}