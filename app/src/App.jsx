import React, { /*useState*/ } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from "./pages/Login";
import Optimizer from "./pages/Optimizer";
import PrivateRoute from "./auth/PrivateRoute";
import { AuthProvider } from "./auth/AuthContext";

function App() {
  //const [token, setToken] = useState(() => localStorage.getItem('token'));
  return (
    <Router>
      <Routes>
        {/*<Route path="/login" element={<Login setToken={setToken} />} />
        {/* Ruta protegida: si no hay token, redirige a login }
        <Route path="/map" element={token ? <Optimizer token={token} /> : <Navigate to="/login" />} />*/}
        <Route path="/map" element={<Optimizer /> }/>
        <Route path="/" element={<Navigate to="/map" />} />
      </Routes>
    </Router>
  );
}

export default App;
