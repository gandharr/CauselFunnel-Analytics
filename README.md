# ⚡ CausalFunnel Analytics

An ultra-lightweight, high-performance real-time behavior analytics platform. **CausalFunnel** tracks real-time user micro-interactions, processes dynamic page heatmaps on a canvas-overlay layer, constructs modular conversion funnels, and powers instant video-like session replays.

🔗 **Live Production URL:** [https://causelfunnel-analytics.onrender.com/](https://causelfunnel-analytics.onrender.com/)  
🔗 **GitHub Pages Serverless Static Demo:** [https://gandharr.github.io/CauselFunnel-Analytics](https://gandharr.github.io/CauselFunnel-Analytics)

---

## 🛠️ Tech Stack

### Frontend Core
- **React 19 & TypeScript**: Component-driven architecture using robust state hooks.
- **Vite**: Rapid, lightweight frontend compilation.
- **Tailwind CSS v4**: Ultra-fast utility styling for fluid fluid layouts.
- **Motion (from `motion/react`)**: High-fidelity UI animations, transitions, and staggered list entries.
- **Lucide React**: Clean and recognizable iconography.

### Backend & Real-time Layer
- **Express (Node.js)**: Efficient API server for real-time tracking collection and telemetry queries.
- **WebSocket (`ws`)**: Direct, bi-directional telemetry streaming.
- **MongoDB Node Driver (`mongodb` v7.3)**: High-performance cloud document storage.
- **Esbuild**: Bundles server-side code into an optimized CommonJS bundle for container ingress environments.

---

## 🚀 Setup & Local Installation Steps (VS Code)

To configure, run, and test the repository locally in **VS Code**, follow these steps:

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher recommended)
- **Git**
- **VS Code**

### 2. Clone the Repository
Open your VS Code terminal and clone your repo:
```bash
git clone https://github.com/gandharr/CauselFunnel-Analytics.git
cd CauselFunnel-Analytics
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Your Environment Secrets
Create a `.env` file in the root folder. You can copy from `.env.example`:
```bash
cp .env.example .env
```

Open `.env` in VS Code and supply your MongoDB Cloud Atlas Connection URI:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/causelfunnel?retryWrites=true&w=majority
```
> **Note**: If `MONGODB_URI` is omitted or left blank, the application automatically triggers its **self-healing fallback layers** (local `data/events.json` on Node servers, or `localStorage` on serverless GitHub Pages).

### 5. Launch the Local Development Server
Boot the server using the unified backend-Vite server script:
```bash
npm run dev
```
The application will boot up at **`http://localhost:3000`**.  
The Express server handles standard API routes and proxies asset-delivery through the Vite development middleware.

### 6. Build and Test Production Build Locally
To check if the compiled production assets bundle and run smoothly:
```bash
# Compile client assets & bundle TypeScript Express server using esbuild
npm run build

# Launch the compiled production server
npm start
```

---

## ☁️ Deployment Guidelines

### A. Deploying to Render (Live Full-Stack Mode)
The live application at `https://causelfunnel-analytics.onrender.com/` is deployed as a Web Service on Render:
1. Link your GitHub repository to a new **Render Web Service**.
2. Configure these Environment Variables in your Render dashboard:
   - `NODE_ENV` = `production`
   - `MONGODB_URI` = `your_mongodb_atlas_connection_string`
3. Set the **Build Command**: `npm run build`
4. Set the **Start Command**: `npm run start`

### B. Deploying to GitHub Pages (Serverless Demo Mode)
Since GitHub Pages is static and cannot host Node/Express or secure environment variables, CausalFunnel uses an intelligent **Virtual Client-Side Database** fallback. When a `*.github.io` environment is detected, all API tracking routes seamlessly re-route to browser `localStorage` and pre-seed interactive simulated samples.
To deploy to GitHub Pages:
```bash
npm run deploy
```

---

## ⚖️ Assumptions & Architectural Trade-offs

1. **Dual-Driver Database Hybrid Architecture**:
   - *Trade-off*: Writing a database manager supporting both server-side MongoDB and local `events.json` (or `localStorage`) increases initial code complexity.
   - *Benefit*: Bypasses traditional barrier-to-entry issues. Users can evaluate, fork, and play with the analytics dashboard instantly without setting up a database, while enterprise setups can secure connection strings for deep cloud analytics.

2. **Unified Port Single-Instance Strategy (Port 3000)**:
   - *Assumption*: We assume cloud environments (like Render and Cloud Run) operate best with a single container entry point.
   - *Design*: Rather than running separate ports for Vite and Express (which requires CORS configuration), Express acts as a master proxy that serves both API endpoints and injects the active Vite compiler directly as middleware.

3. **Inactivity Session Gating**:
   - *Trade-off*: Client-side session monitoring assumes user activity (keystrokes, mouse moves, clicks) can be monitored continuously.
   - *Design*: To prevent idle windows from polluting telemetry, a client-side sliding window of 30 minutes resets on human interactive gestures. If inactive for more than 30 minutes, tracking pauses automatically.

4. **Self-Healing Permutations**:
   - *Assumption*: Users often paste incomplete connection URIs.
   - *Design*: The database linker implements self-healing parameter parsing. If a `MONGODB_URI` is supplied without an explicit database target or specific flags, the server automatically appends safe default configurations rather than crashing on start.
