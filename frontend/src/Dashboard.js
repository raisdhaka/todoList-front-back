import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import axios from "axios";
import { Container, Card, Button, Form, Row, Col, Alert, Badge } from "react-bootstrap";
import { FiPlus, FiEdit2, FiTrash2, FiShare2, FiLogIn } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import "./Dashboard.css";

const API_URL = process.env.REACT_APP_API_URL;

const columnsFromBackend = {
  todo: { name: "To Do", items: [] },
  inprogress: { name: "In Progress", items: [] },
  done: { name: "Done", items: [] }
};

const Dashboard = () => {
  const [columns, setColumns] = useState(columnsFromBackend);
  const [tasks, setTasks] = useState("");
  const [newTask, setNewTask] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [newRoomCode, setNewRoomCode] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const navigate = useNavigate();
  const EXPIRY_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

  const user_id = localStorage.getItem("user_id");

  useEffect(() => {
    const storedRoom = localStorage.getItem("roomCode");
    if (storedRoom) {
      try {
        const { code, timestamp } = JSON.parse(storedRoom);
        if (Date.now() - timestamp < EXPIRY_DURATION) {
          setRoomCode(code);
          fetchTasks(code);
          if (socket) {
            socket.emit("join_room", { room_code: code });
          }
        } else {
          localStorage.removeItem("roomCode");
        }
      } catch (err) {
        console.error("Error parsing roomCode from localStorage:", err);
        localStorage.removeItem("roomCode");
      }
    }
  }, [socket]);
  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      handleUnauthorized();
      return;
    }

    const newSocket = io(API_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });


    newSocket.on("connect", () => {
      console.log("Connected to WebSocket server");
      newSocket.emit("authenticate", { token });
    });

    newSocket.on("authentication_response", (data) => {
      if (data.status !== 'authenticated') {
        console.error("Authentication failed:", data);
        handleUnauthorized();
      }
    });

    newSocket.on("task_update", (data) => {
      fetchTasks();
    });

    newSocket.on("room_update", (data) => {
      setJoinMessage(data.message);
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    newSocket.on("connect_error", (err) => {
      console.error("Connection error:", err);
      if (err.message.includes("401")) {
        handleUnauthorized();
      }
    });

    setSocket(newSocket);


    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("task_update", (data) => {
        console.log("Task update received via WebSocket:", data); // Debug WebSocket data
        fetchTasks(); // Refresh tasks
      });
    }

    return () => {
      if (socket) {
        socket.off("task_update");
      }
    };
  }, [socket]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");
    const user_idFromUrl = urlParams.get("user_id");

    if (tokenFromUrl) {
      localStorage.setItem("token", tokenFromUrl);
      localStorage.setItem("user_id", user_idFromUrl);
      window.history.replaceState({}, document.title, "/dashboard");
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleUnauthorized = () => {
    setError("Session expired. Redirecting to login...");

    localStorage.removeItem("token");
    localStorage.removeItem("roomCode");
    localStorage.removeItem("user_id");
    setTimeout(() => {
      navigate("/login");
    }, 3000); // 3-second delay
  };

  const handleLogout = () => {
    setError("Loging out. Redirecting to login...");

    localStorage.removeItem("token");
    localStorage.removeItem("roomCode");
    setTimeout(() => {
      navigate("/login");
    }, 3000); // 3-second delay
  };

  const checkAuthError = (error) => {
    const message = error?.response?.data?.msg;

    if (error.response?.status === 401 || message === "Token has expired") {
      handleUnauthorized();
      return true;
    }

    if (error instanceof Response && error.status === 401) {
      handleUnauthorized();
      return true;
    }

    return false;
  };

  const fetchTasks = async (roomCodeParam = roomCode) => {
    console.log("Fetching tasks..."); // Debug log
    console.log("Room code:", roomCodeParam); // Debug log
    try {
      if (!roomCodeParam) {
        roomCodeParam = 0;
      }

      const token = localStorage.getItem("token");
      if (!token) return handleUnauthorized();

      const res = await axios.get(`${API_URL}/tasks?room_code=${roomCodeParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log("Fetched tasks:", res.data); // Debug response

      if (res.data.error == true) {
        setMessage("No tasks found");
        return;

      }

      const tasks = res.data;
      setColumns({
        todo: { ...columns.todo, items: tasks.filter(t => t.status === "todo") },
        inprogress: { ...columns.inprogress, items: tasks.filter(t => t.status === "inprogress") },
        done: { ...columns.done, items: tasks.filter(t => t.status === "done") }
      });
    } catch (error) {
      if (error.response?.status === 401) {
        handleUnauthorized();
      } else {
        console.error("Failed to fetch tasks:", error);
        setError("Failed to load tasks");
      }
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();

    if (!newTask.trim()) return;

    try {
      const token = localStorage.getItem("token");

      const res = await axios.post(
        `${API_URL}/tasks`,
        {
          title: newTask,
          description: "",
          status: "todo",
          room_code: roomCode ? roomCode : 0
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      console.log("Task creation response:", res.data); // Debug response
      setNewTask(""); // Clear input field
      fetchTasks(); // Refresh tasks
    } catch (error) {
      if (error.response?.status === 401) {
        handleUnauthorized();
      } else {
        console.error("Failed to add task:", error);
        setError("Failed to add task");
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      handleUnauthorized();
      return;
    }

    try {
      await axios.delete(
        `${API_URL}/tasks/${taskId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setColumns(columnsFromBackend);
      fetchTasks();
      setMessage("Task deleted successfully");
    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to delete task:", error);
        setError("Failed to delete task.");
      }
    }
  };

  const handleEditTask = async (task) => {
    const newTitle = prompt("Edit task title:", task.title);
    if (newTitle && newTitle !== task.title) {
      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      try {
        await axios.put(
          `${API_URL}/tasks/${task.id}`,
          { title: newTitle, status: task.status },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        fetchTasks();
        setMessage("Task updated successfully");
      } catch (error) {
        if (!checkAuthError(error)) {
          console.error("Failed to edit task:", error);
          setError("Failed to edit task.");
        }
      }
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId) {
      const sourceColumn = columns[source.droppableId];
      const destColumn = columns[destination.droppableId];
      const sourceItems = [...sourceColumn.items];
      const destItems = [...destColumn.items];
      const [movedItem] = sourceItems.splice(source.index, 1);
      movedItem.status = destination.droppableId;
      destItems.splice(destination.index, 0, movedItem);

      setColumns({
        ...columns,
        [source.droppableId]: { ...sourceColumn, items: sourceItems },
        [destination.droppableId]: { ...destColumn, items: destItems }
      });

      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      axios.put(
        `${API_URL}/tasks/${movedItem.id}`,
        { status: movedItem.status },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(error => {
        if (!checkAuthError(error)) {
          console.error("Failed to update task status:", error);
          setError("Failed to update task status.");
        }
      });
    }
  };

  const handleCreateRoom = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      setJoinMessage("");
      const res = await fetch(`${API_URL}/create-room`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("Failed to create room");

      const data = await res.json();
      setNewRoomCode(data.code); // Update the state with the new room code

      if (socket && socket.connected) {
        socket.emit("join_room", {
          room_code: data.code,
          token: token // Send token with room join
        });
      } else {
        console.error("Socket not connected");
        setJoinMessage("Reconnecting to server...");
      }
    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to create room", error);
        setJoinMessage(error.message || "Error creating room");
      }
    }
  };

  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      socket.emit("leave_room", { room_code: roomCode });
    }
    localStorage.removeItem("roomCode");
    setColumns(columnsFromBackend);
    setJoinMessage("You have left the room.");
    setNewRoomCode("");

    setJoinInput("");
    setRoomCode("");
    console.log("roomcode ...", roomCode);
    fetchTasks(0);
  };

  const handleJoinRoom = async () => {
    if (!joinInput.trim()) {
      setJoinMessage("Please enter a room code");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        handleUnauthorized();
        return;
      }

      setJoinMessage("");
      const res = await fetch(`${API_URL}/join-room`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code: joinInput.trim().toUpperCase() })
      });
      console.log("Join room response:", res); // Debug response
      if (res.status === 401) {
        // const error = await res.json();
        handleUnauthorized();
      }
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to join room");
      }

      const data = await res.json();
      setRoomCode(data.code);
      localStorage.setItem("roomCode", JSON.stringify({
        code: data.code,
        timestamp: Date.now()
      }));

      setColumns(columnsFromBackend);

      fetchTasks(data.code);

      if (socket) {
        socket.emit("join_room", { room_code: data.code });
      }

    } catch (error) {
      if (!checkAuthError(error)) {
        console.error("Failed to join room", error);
        setJoinMessage(error.message || "Error joining room");
      }
    }
  };


  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(""); // Clear the message after 2 seconds
      }, 2000);

      return () => clearTimeout(timer); // Cleanup the timer if the component unmounts or message changes
    }
  }, [message]);


  return (
    <Container fluid className="dashboard-container py-4">
      <Row className="mb-4">
        <div className="d-flex justify-content-between">
          <h2 className="fw-bold">Task Board</h2>
          {error && <Alert variant="danger" onClose={() => setError("")} dismissible>{error}</Alert>}
          {message && <Alert variant="info" onClose={() => setMessage("")} dismissible>{message}</Alert>}
          <Button variant="outline-danger" size="sm" onClick={handleLogout} className="float-end">
            <FiLogIn className="me-1" />
            Logout
          </Button>
        </div>
      </Row>

      {/* Room Section */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Card.Title className="mb-3">Collaboration Room</Card.Title>

          <Row className="g-3 mb-3">
            <Col md={12}>
              {roomCode && (
                <Card className="mt-3">
                  <Card.Body className="text-center">
                    <Card.Title>Joined Room</Card.Title>
                    <Badge bg="success" className="fs-6">{roomCode}</Badge>
                    <div className="mt-2">
                      <Button variant="outline-danger" size="sm" onClick={handleLeaveRoom}>
                        Leave Room
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </Col>
            <Col md={6}>
              <Button
                variant="primary"
                onClick={handleCreateRoom}
                className="w-50"
                disabled={isLoading}
              >
                <FiShare2 className="me-2" /> Create Room
              </Button>
              {newRoomCode && (
                <div className="mt-2">
                  <p className="mb-1">Share this code with others:</p>
                  <Badge bg="success" className="fs-6">{newRoomCode}</Badge>
                </div>
              )}

            </Col>

            <Col md={6}>

              <Card className="mb-4 shadow-sm">
                <Card.Body>
                  <div className="d-flex">
                    <Form.Control
                      type="text"
                      placeholder="Enter Room Code"
                      value={joinInput}
                      onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                      className="me-2"
                      disabled={isLoading}
                    />
                    <Button
                      variant="primary"
                      onClick={handleJoinRoom}
                      disabled={isLoading}
                    >
                      <FiLogIn className="me-1" /> Join
                    </Button>


                  </div>


                </Card.Body>
              </Card>
              {joinMessage && (
                <Alert variant={joinMessage.includes("Joined") ? "success" : "warning"} className="mt-2 mb-0">
                  {joinMessage}
                </Alert>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Task Input */}
      <Card className="mb-4 shadow-sm">
        <Card.Body>
          <Form onSubmit={handleAddTask} className="d-flex">
            <Form.Control
              type="text"
              placeholder="Enter a new task"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              className="me-2"
              disabled={isLoading}
            />
            <Button
              variant="primary"
              className="col-sm-2"
              type="submit"
              disabled={isLoading}
            >
              <FiPlus className="me-1" /> Add Task
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Row className="g-3">
          {Object.entries(columns).map(([columnId, column]) => (
            <Col key={columnId} md={4}>
              <Card className={`h-100 border-0 shadow-sm column column-${columnId}`}>
                <Card.Header className="bg-transparent border-0">
                  <h5 className="fw-bold mb-0">{column.name}</h5>
                </Card.Header>
                <Card.Body className="p-3">
                  <Droppable droppableId={columnId}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="droppable-col"
                      >
                        {column.items.map((item, index) => (
                          <Draggable
                            key={item.id.toString()}
                            draggableId={item.id.toString()}
                            index={index}
                          >
                            {(provided) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="mb-2 task-card shadow-sm"
                              >
                                <Card.Body className="p-3 d-flex justify-content-between align-items-center">
                                  <span>{item.title}</span>
                                  {item.user_id == user_id && (
                                    <div className="card-buttons">
                                      <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => handleEditTask(item)}
                                        className="text-primary p-0"
                                        disabled={isLoading}
                                      >
                                        <FiEdit2 />
                                      </Button>
                                      <Button
                                        variant="link"
                                        size="sm"
                                        onClick={() => handleDeleteTask(item.id)}
                                        className="text-danger p-0 ms-2"
                                        disabled={isLoading}
                                      >
                                        <FiTrash2 />
                                      </Button>
                                    </div>
                                  )}
                                </Card.Body>
                              </Card>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </DragDropContext>
    </Container>
  );
};

export default Dashboard;