from flask import Flask, request, jsonify, redirect
from flask_sqlalchemy import SQLAlchemy
from flask_restful import Api, Resource
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_bcrypt import Bcrypt
from flask_cors import CORS,cross_origin
from flask_socketio import SocketIO, emit, join_room, leave_room
import requests
import os
import string
import random
from datetime import datetime
from sqlalchemy.sql import func
from gevent import monkey

# Initialize Flask App
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Allow cross-origin requests from your React app
# CORS(
#     app,
#     supports_credentials=True,
#     resources={
#         r"/create-room": {"origins": ["http://localhost:3000"]},
#         r"/join-room":   {"origins": ["http://localhost:3000"]},
#         r"/*":           {"origins": ["http://localhost:3000"]}
#     }
# )

CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Ensure Flask sets the CORS headers for preflight
app.config['CORS_HEADERS'] = 'Content-Type'
api = Api(app)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="http://localhost:3000")

# Configure MySQL Database on AWS RDS
app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+pymysql://admin:Arkane1.@flask-project-db.cjo6cswwg3bx.us-east-2.rds.amazonaws.com:3306/flask_project"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["JWT_SECRET_KEY"] = "supersecretkey"  # Change this in production

app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL',
    app.config['SQLALCHEMY_DATABASE_URI']
)

# Google OAuth Configuration
app.config["GOOGLE_CLIENT_ID"] = "367806865319-i8f7c705aibohpipt9djeg6utopt5k3e.apps.googleusercontent.com"
app.config["GOOGLE_CLIENT_SECRET"] = "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"
app.config["GOOGLE_REDIRECT_URI"] = "http://127.0.0.1:5000/google-callback"

# Initialize Extensions
db = SQLAlchemy(app)
from flask_migrate import Migrate
migrate = Migrate(app, db)

jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# Define User Model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=True)  # Optional for OAuth users

# Define Room Model
class Room(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(6), unique=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

# Define Task Model
class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default="Not Started")  # "In Progress", "Completed"
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

# Helper to generate unique 6-character codes
def generate_room_code(length=6):
    chars = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(random.choices(chars, k=length))
        if not Room.query.filter_by(code=code).first():
            return code

# SocketIO Events
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")
    # Don't try to authenticate here - we'll handle auth in a separate event
    emit('connected', {'message': 'Connected to server'})

@socketio.on('authenticate')
def handle_authentication(data):
    print(f"Authentication data received: {data}")
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        if user_id:
            join_room(f'user_{user_id}')
            emit('authenticated', {'success': True, 'user_id': user_id})
        else:
            emit('authenticated', {'success': False, 'error': 'Invalid token'})
    except Exception as e:
        emit('authenticated', {'success': False, 'error': str(e)})



@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

@socketio.on('join_room')
@jwt_required()
def handle_join_room(data):
    user_id = get_jwt_identity()
    room_code = data.get('room_code')
    if room_code:
        join_room(room_code)
        emit('room_message', {
            'message': f'User {user_id} joined room {room_code}'
        }, room=room_code)

@socketio.on('leave_room')
def handle_leave_room(data):
    room_code = data.get('room_code')
    if room_code:
        leave_room(room_code)
        emit('room_message', {'message': f'Left room {room_code}'}, room=room_code)

def notify_task_update(user_id, task_data, action='update'):
    """Helper function to notify clients about task changes"""
    room = f'user_{user_id}'
    socketio.emit('task_update', {
        'action': action,
        'task': task_data,
        'timestamp': datetime.utcnow().isoformat()
    }, room=room)

def notify_room_update(room_code, message):
    """Helper function to notify room members about changes"""
    socketio.emit('room_update', {
        'message': message,
        'timestamp': datetime.utcnow().isoformat()
    }, room=room_code)

# Home Route
@app.route("/")
def home():
    return "Flask API is running!"

# Register User (Email & Password)
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if not data.get("email") or not data.get("password"):
        return jsonify({"message": "Email and password are required"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"message": "User already exists"}), 400

    hashed_password = bcrypt.generate_password_hash(data["password"]).decode("utf-8")
    new_user = User(name=data.get("name"), email=data["email"], password=hashed_password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"message": "User registered successfully"}), 201

# Login User (Email & Password)
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    user = User.query.filter_by(email=data.get("email")).first()

    if not user:
        return jsonify({"message": "User not found"}), 404

    if not user.password:
        return jsonify({"message": "This account was created using Google. Please log in with Google."}), 400

    if bcrypt.check_password_hash(user.password, data.get("password")):
        token = create_access_token(identity=str(user.id))
        print(f"User {user.id} logged in with token: {token}")
        return jsonify({"message": "Login successful", "token": token}), 200
    else:
        return jsonify({"message": "Invalid password"}), 401

# Google OAuth Login
@app.route("/google-login")
def google_login():
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/auth"
        "?response_type=code"
        f"&client_id={app.config['GOOGLE_CLIENT_ID']}"
        f"&redirect_uri={app.config['GOOGLE_REDIRECT_URI']}"
        "&scope=https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
        "&access_type=offline"
        "&prompt=consent"
    )
    return redirect(google_auth_url)

# Google OAuth Callback
@app.route("/google-callback")
def google_callback():
    code = request.args.get("code")
    if not code:
        return jsonify({"error": "Authorization code not found"}), 400

    token_data = {
        "code": code,
        "client_id": app.config["GOOGLE_CLIENT_ID"],
        "client_secret": app.config["GOOGLE_CLIENT_SECRET"],
        "redirect_uri": app.config["GOOGLE_REDIRECT_URI"],
        "grant_type": "authorization_code",
    }

    token_response = requests.post("https://oauth2.googleapis.com/token", data=token_data)
    token_json = token_response.json()
    if "access_token" not in token_json:
        return jsonify({"error": "Failed to obtain access token"}), 400

    access_token = token_json["access_token"]
    user_info_response = requests.get(
        "https://www.googleapis.com/oauth2/v1/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    user_info = user_info_response.json()

    user = User.query.filter_by(email=user_info["email"]).first()
    if not user:
        user = User(name=user_info.get("name"), email=user_info.get("email"), password=None)
        db.session.add(user)
        db.session.commit()

    token = create_access_token(identity=str(user.id))
    return redirect(f"http://localhost:3000/dashboard?token={token}")

# Create Room Endpoint
@app.route("/create-room", methods=["POST"])
@cross_origin(origin="http://localhost:3000", supports_credentials=True)
@jwt_required()
def create_room():
    user_id = get_jwt_identity()
    code = generate_room_code()
    room = Room(code=code)
    db.session.add(room)
    db.session.commit()
    
    socketio.emit('room_created', {'code': code}, room=f'user_{user_id}')
    return jsonify({"code": code}), 201

# Join Room Endpoint
@app.route("/join-room", methods=["POST"])
@jwt_required()
def join_room_endpoint():
    data = request.get_json() or {}
    code = data.get("code", "").upper().strip()
    if not code or len(code) != 6:
        return jsonify({"error": "Invalid code format."}), 400
    
    room = Room.query.filter_by(code=code).first()
    if not room:
        return jsonify({"error": "Room not found."}), 404
    
    user_id = get_jwt_identity()
    notify_room_update(code, f"User {user_id} joined the room")
    
    return jsonify({"code": code, "message": "Joined room successfully."}), 200

# Task API
class TaskAPI(Resource):
    @jwt_required()
    def get(self):
        current_user = get_jwt_identity()
        user = User.query.get(current_user)
        if not user:
            return jsonify({"message": "User not found"}), 404
        tasks = Task.query.filter_by(user_id=user.id).all()
        return jsonify([{ "id": t.id, "title": t.title, "status": t.status } for t in tasks])

    @jwt_required()
    def post(self):
        data = request.get_json()
        if not isinstance(data.get("title"), str) or not data["title"].strip():
            return jsonify({"error": "Title must be a non-empty string"}), 400

        current_user = get_jwt_identity()
        user = User.query.get(current_user)
        if not user:
            return {"message": "User not found"}, 404

        new_task = Task(
            title=data["title"],
            description=data.get("description", ""),
            status=data.get("status", "todo").lower(),
            user_id=user.id
        )
        db.session.add(new_task)
        db.session.commit()
        
        task_data = {
            "id": new_task.id,
            "title": new_task.title,
            "status": new_task.status
        }
        notify_task_update(current_user, task_data, 'create')
        
        return {"message": "Task created", "task": task_data}, 201

# Task Update/Delete API
class SingleTaskAPI(Resource):
    @jwt_required()
    def put(self, task_id):
        current_user = get_jwt_identity()
        task = Task.query.get(task_id)
        if not task:
            return {"message": "Task not found"}, 404
        
        data = request.get_json()
        if 'title' in data:
            task.title = data['title']
        if 'status' in data:
            task.status = data['status']
        
        db.session.commit()
        
        task_data = {
            "id": task.id,
            "title": task.title,
            "status": task.status
        }
        notify_task_update(current_user, task_data, 'update')
        
        return {"message": "Task updated successfully", "task": task_data}

    @jwt_required()
    def delete(self, task_id):
        current_user = get_jwt_identity()
        task = Task.query.get(task_id)
        if not task:
            return {"message": "Task not found"}, 404
        
        task_data = {
            "id": task.id,
            "title": task.title,
            "status": task.status
        }
        
        db.session.delete(task)
        db.session.commit()
        
        notify_task_update(current_user, task_data, 'delete')
        return {"message": "Task deleted successfully"}

# Register API Routes
api.add_resource(TaskAPI, "/tasks")
api.add_resource(SingleTaskAPI, "/tasks/<int:task_id>")

if __name__ == "__main__":
    
    monkey.patch_all()
    socketio.run(app, debug=True, host='0.0.0.0')