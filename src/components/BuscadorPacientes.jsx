import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const BuscadorPacientes = () => {
  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);

  // 1. Cargar el CSV al montar el componente
  useEffect(() => {
    fetch('/data/Registro_Maestro_Pacientes_Sismo_2026.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setDatos(results.data);
            setResultados(results.data);
          }
        });
      });
  }, []);

  // 2. Lógica de búsqueda
  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setBusqueda(term);

    const filtrados = datos.filter(paciente => 
      paciente['Apellidos y Nombres']?.toLowerCase().includes(term) ||
      paciente['Cédula / ID']?.includes(term) ||
      paciente['Hospital']?.toLowerCase().includes(term)
    );
    setResultados(filtrados);
  };

  return (
    <div className="contenedor-buscador"> {/* Aplica aquí tu CSS */}
      <input 
        type="text" 
        placeholder="Buscar por nombre, cédula u hospital..." 
        value={busqueda}
        onChange={handleSearch}
        className="input-estilo-propio"
      />

      <table className="tabla-estilo-propio">
        <thead>
          <tr>
            <th>Hospital</th>
            <th>Nombre</th>
            <th>Cédula</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((paciente, index) => (
            <tr key={index}>
              <td>{paciente.Hospital}</td>
              <td>{paciente['Apellidos y Nombres']}</td>
              <td>{paciente['Cédula / ID']}</td>
              <td>{paciente.Observaciones}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BuscadorPacientes;