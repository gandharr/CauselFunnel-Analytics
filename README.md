# User Analytics Dashboard

## 🛠️ Setup Steps

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Launch Server inside Development Environment**:
   ```bash
   npm run dev
   ```

3. **Compile Production Builds**:
   ```bash
   npm run build
   ```

4. **Start Production Builds**:
   ```bash
   npm start
   ```

## 🚀 Tech Stack

- **Frontend**: React 18 with Vite, HTML Canvas overlay for thermal click heatmaps, Tailwind CSS for minimalist responsive styling, and Lucide React icons.
- **Backend**: Node.js & Express API endpoints paired with standard WebSocket (`ws`) layer for dynamic zero-latency telemetry broadcasting.
- **Database**: Native MongoDB connector with a safe, zero-config file fallback (`events.json`) to persist documents automatically if no cloud MongoDB Atlas server is linked.
- **Vanilla Tracking Script**: Compact closure-insulated tracker serving from `/tracker.js` converting absolute clicks to proportional webpage percentages.

## 🧠 Assumptions or Trade-offs

### 1. Device-Independent Percentages
* **Problem**: absolute coordinate numbers (e.g. `x: 500, y: 700`) completely break heatmaps if tracked on mobile screens but visualized on high-res desktop views.
* **Solution**: Storing clicks as viewport relative floating-point factors (`xPct`, `yPct`). 100% geometric scale accuracy is guaranteed at any resolution or orientation.

### 2. Zero-Config Database Fallback
* **Problem**: Forcing developers to sign up/set up MongoDB before testing a locally cloned app hampers quick evaluation.
* **Solution**: Created a self-healing multi-driver adapter. The application dynamically links to cloud MongoDB if `MONGODB_URI` exists; otherwise, it boots seamlessly into a local JSON document database fallback.

### 3. Client-Side sliding Inactivity Gate
* **Problem**: Inactive windows or idle pages pollute standard durations, making summaries useless.
* **Solution**: Implemented a client-side sliding window of 30 minutes in the tracking closure, resetting on interactive key pressures or mouse triggers. After 30 minutes, it automatically ends the session.

## 🌐 GitHub Pages Deployment (Serverless Static Demo)

Since GitHub Pages is a static hosting platform, it cannot run a live Node/Express server or a cloud MongoDB database. To solve this, **CausalFunnel** is equipped with a **self-healing Virtual Client-Side Database fallback**.

When deployed on GitHub Pages, the application will automatically:
1. Detect the static hosting environment (`*.github.io`).
2. Intercept `/api/` requests and route them to a virtual engine backed by browser `localStorage`.
3. Pre-seed beautiful interactive sample sessions (Alpha, Beta, Gamma buyers) on first load.
4. Enable full live event tracking within the **Website Sandbox**—plotting coordinates and live-streaming user journeys in real-time inside your browser!

### 🚀 How to Deploy to GitHub Pages in 3 Simple Steps:

1. **Install the deployment helper package**:
   ```bash
   npm install gh-pages --save-dev
   ```

2. **Add deployment scripts to your `package.json`**:
   Open `package.json` and add these two lines inside the `"scripts"` object:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```

3. **Publish to GitHub Pages**:
   Commit and push your files to your GitHub repository, then run:
   ```bash
   npm run deploy
   ```
   *Vite will automatically build your app with relative asset paths, and publish the `dist/` folder to your `gh-pages` branch. Your fully interactive analytics dashboard is now live!*

