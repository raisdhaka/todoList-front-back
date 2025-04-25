import React, { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import Login from "./Login";
import Signup from "./Signup"; // Import Signup component
import Dashboard from "./Dashboard";

const GoogleCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get("token");

    if (token) {
      localStorage.setItem("token", token); // Store the token
      navigate("/dashboard"); // Redirect to dashboard
    } else {
      alert("Google Login Failed!");
      navigate("/login"); // Redirect back to login if no token
    }
  }, [navigate, location]);

  return <h2>Logging in...</h2>;
};

function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/google-callback" element={<GoogleCallback />} /> {/* New Route for Google OAuth */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
