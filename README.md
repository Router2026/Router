# 🧭 Router - Israel's Smart Travel Platform

Router is an innovative "One-Stop-Shop" platform for the Israeli traveler, combining advanced trip planning capabilities, field navigation, and a location-based social network. The application solves the problem of scattered information by making data on nature trails, attractions, culinary options, and logistics accessible in one place, using Artificial Intelligence (AI) to build personalized itineraries.

## ✨ Key Features

* **🗺️ Smart Discovery Map:** An interactive map divided into regions, with information layers (springs, trails, culinary) and real-time insights on crowds and weather.
* **🤖 AI-Powered Trip Planner:** Building a full, customized itinerary (by region, participant composition, and style) integrated with a smart algorithm that optimally arranges the stops.
* **ℹ️ Comprehensive Site Information:** Detailed information cards including difficulty level, stroller accessibility, shade index, and dog-friendly status.
* **🏆 Community & Gamification:** An incentive model encouraging users to report from the field, write reviews, and upload photos in exchange for points (XP) and leveling up.
* **🎥 Content Creators Social Network:** Uploading video clips, sharing routes, and following other travelers.

## 🛠️ Technologies

**Frontend:**
* React + TypeScript + Vite
* React Router DOM (Navigation)
* Leaflet + React-Leaflet (Maps)
* Material-UI (MUI) & Lucide React (Design & Icons)

**Backend & AI:**
* Node.js (Request and user management)
* Python Microservice (LLM model communication and route processing)
* Firebase Auth / Auth0 (User authentication)

**Database:**
* PostgreSQL + PostGIS (For smart spatial geographic queries)

---

## 🚀 Installation and Setup

To run the project on your local machine, follow these steps:

### 1. Frontend Setup
Ensure Node.js (version 18 or higher) is installed.

```bash
# Navigate to the frontend directory
cd code/frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will run locally (usually at `http://localhost:5173`).

### 2. Database Setup (PostgreSQL)
Ensure PostgreSQL is installed along with the PostGIS extension.
Run the script file / import the backup into your database (see the section below regarding DB import/export).

## 💾 Database Extraction & Backup
Since the project uses PostgreSQL (with PostGIS), the best and safest way to backup or extract all the data, tables, and structure of the database is by using the `pg_dump` utility.

### Export Database (Backup)
To export the database to a file (to transfer to a friend or upload to another server), open your Command Line (Terminal / PowerShell) and run:

```powershell
# Navigate to your PostgreSQL bin installation folder (change '14' to your installed version if needed)
cd "C:\Program Files\PostgreSQL\14\bin"

# Extract the DB to a custom format file (compressed and recommended)
.\pg_dump -U postgres -h localhost -p 5432 -F c router_db > "C:\Users\halif\Desktop\router-db.dump"
```
### Restore Database (Import)
To restore the `.dump` file you created into a new, empty database, use `pg_restore`:

```powershell
# First, create an empty database in pgAdmin or via CLI
# Then run the restore command:
.\pg_restore -U postgres -h localhost -p 5432 -O -d router_db "C:\Path\To\router-db.dump"
```