@echo off
echo Starting Frontend...

cd frontend

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Start Next.js dev server
echo Starting Next.js development server...
npm run dev