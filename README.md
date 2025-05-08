
# TaskTrackers

A full-stack task management application built with **React.js** (frontend) and **Flask** (backend), with deployment via **Apache** and **Let's Encrypt SSL**. This project supports OAuth (Google), MySQL database connectivity, and WebSocket communication for real-time features.

---

## 🔧 Project Structure

```
todoList-front-back/
│
├── flask_project/         # Flask backend
│   ├── env/               # Python virtual environment
│   ├── flask_todo.wsgi    # WSGI entry point
│   └── ...
│
├── frontend/              # React frontend
│   ├── public/
│   ├── src/
│   ├── .env               # React environment variables
│   └── ...
```

---

## 🚀 Deployment Domains

| Service     | URL                         |
|-------------|-----------------------------|
| Frontend    | https://tasktrackers.fun    |
| Backend API | https://api.tasktrackers.fun|

---

## 🔗 Tech Stack

- **Frontend:** React.js, PM2
- **Backend:** Flask, MySQL, SQLAlchemy, Flask-OAuth, WebSocket
- **Server:** Apache2, mod_wsgi
- **Security:** HTTPS via Let's Encrypt (Certbot)
- **Environment:** Ubuntu

---

## ⚙️ Frontend Setup (React)

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Create `.env` file:
   ```env
   REACT_APP_API_URL=https://api.tasktrackers.fun
   # For local development:
   # REACT_APP_API_URL=http://localhost:5000
   ```

3. Install dependencies and build:
   ```bash
   npm install
   npm install -g pm2
   npm run build
   ```

4. Start the React app:
   ```bash
   pm2 start "npm run start"
   ```

---

## 🐍 Backend Setup (Flask)

1. Navigate to the backend directory:
   ```bash
   cd flask_project
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv env
   source env/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file:
   ```env
   DATABASE_URL="mysql+pymysql://admin:Arkane1.@flask-project-db.cjo6cswwg3bx.us-east-2.rds.amazonaws.com:3306/flask_project"
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   GOOGLE_REDIRECT_URI="https://api.tasktrackers.fun/google-callback"
   SITE_URL="http://localhost:3000"
   ```

---

## 🛠 Apache Configuration (Deployment)

Apache serves both frontend and backend:

- **Backend API** is hosted on: `https://api.tasktrackers.fun`
- **Frontend React app** is reverse proxied from: `https://tasktrackers.fun`

Enable SSL with Certbot:
```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache
```

Apache virtual hosts are defined in:
```
/etc/apache2/sites-available/
├── api.tasktrackers.conf
├── api.tasktrackers-le-ssl.conf
├── tasktrackers.conf
└── tasktrackers-le-ssl.conf
```

---

## 🔐 SSL Certificates

SSL certificates are automatically generated and stored under:
```
/etc/letsencrypt/live/tasktrackers.fun/
```

---

## 🧪 Development Tips

- Use `pm2 logs` to view frontend logs
- Apache logs are stored in:
  ```
  /var/log/apache2/tasktrackers_error.log
  /var/log/apache2/tasktrackers_access.log
  ```
- Restart Apache after config updates:
  ```bash
  sudo systemctl restart apache2
  ```

---

## 📬 Contact

**Maintainer:** Guled  
📧 Email: guled652@gmail.com

---

## 📝 License

This project is licensed under the MIT License.

---

## 🛢️ AWS RDS Setup (MySQL)

### 📌 1. Create an RDS MySQL Instance

1. Sign in to the AWS Management Console.
2. Go to **RDS** > **Create database**.
3. Choose **Standard Create** and select:
   - Engine type: **MySQL**
   - Version: **8.x** or compatible with `pymysql`
4. Set DB instance identifier, master username (`admin`) and password.
5. Under **Connectivity**:
   - Enable **Public access** if needed (be cautious for production).
   - Choose/create a **VPC security group** to allow inbound MySQL traffic (port 3306).

### 🔑 2. Configure Security Group

1. Navigate to **EC2 > Security Groups**.
2. Edit the security group used by your RDS instance.
3. Add an **Inbound rule**:
   - Type: MySQL/Aurora
   - Port: 3306
   - Source: Your server IP or `0.0.0.0/0` for testing

### 🔗 3. Connect RDS to Flask

Use the RDS endpoint in your `.env` as shown:

```env
DATABASE_URL="mysql+pymysql://admin:yourpassword@your-db-endpoint.rds.amazonaws.com:3306/flask_project"
```

**Example (from this project):**
```env
DATABASE_URL="mysql+pymysql://admin:Arkane1.@flask-project-db.cjo6cswwg3bx.us-east-2.rds.amazonaws.com:3306/flask_project"
```

Make sure:
- The database `flask_project` exists (you can create it via any MySQL client or `Flask-Migrate`)
- MySQL user (`admin`) has necessary privileges

### 🧪 Test RDS Connection

You can test the connection using `mysql` CLI or a GUI tool like DBeaver, MySQL Workbench:

```bash
mysql -h flask-project-db.cjo6cswwg3bx.us-east-2.rds.amazonaws.com -u admin -p
```

---
