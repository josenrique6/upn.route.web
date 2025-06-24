import React, { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'flatpickr/dist/flatpickr.min.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { useNavigate } from 'react-router-dom';

// Componente de Login
export default function Login({setToken}) {
  const [username, setUsername] = useState('jose.heredia@dinet.com.pe');
  const [password, setPassword] = useState('jose.heredia@dinet.com.pe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Preparar el body como form-urlencoded
      const body = new URLSearchParams();
      body.append('grant_type', 'password');
      body.append('username', username);
      body.append('password', password);
      body.append('scope', '');
      body.append('client_id', 'string');
      body.append('client_secret', 'string');

      const response = await fetch('http://localhost:8000/api/v1/login/access-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          accept: 'application/json'
        },
        body: body.toString(),
      });
      if (!response.ok) {
        throw new Error('Error en el login');
      }
      const data = await response.json();
      // Luego, cuando inicies sesión:
      setToken(data.access_token);
      localStorage.setItem('token', data.access_token);
      navigate('/map'); // Redirige a la interfaz del mapa
    } catch (err) {
      console.error(err);
      setError('Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-2">
      <div className='row justify-content-center'>
        <div className='col-4'>
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">Usuario</label>
              <input
                type="email"
                className="form-control"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Contraseña</label>
              <input
                type="password"
                className="form-control"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Cargando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

