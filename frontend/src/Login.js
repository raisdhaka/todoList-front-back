import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Container, Card, Form, Button, Row, Col, Alert } from "react-bootstrap";
import { FcGoogle } from "react-icons/fc";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL;

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/login`, { email, password });
      alert("Login Successful");
      localStorage.setItem("token", response.data.token);
      navigate("/dashboard");
    } catch (error) {
      setError(error.response?.data?.message || "Invalid email or password");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/google-login?redirect_uri=http://localhost:3000/google-callback`;
  };

  return (
    <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: "100vh" }}>
      <Card style={{ width: "400px", padding: "20px" }}>
        <Card.Body>
          <Card.Title className="text-center mb-4">Login</Card.Title>
          
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
              <Form.Label>Email address</Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100 mb-3">
              Login
            </Button>
          </Form>

          <div className="text-center mb-3">
            <p className="text-muted">Or</p>
          </div>

          <Button 
            variant="outline-primary" 
            onClick={handleGoogleLogin} 
            className="w-100 mb-3 d-flex align-items-center justify-content-center"
          >
            <FcGoogle size={20} className="me-2" />
            Continue with Google
          </Button>

          <Row className="mt-3">
            <Col className="text-center">
              Don't have an account? <a href="/signup">Sign up here</a>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login;