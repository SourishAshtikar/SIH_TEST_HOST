require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./db');
const { ensureDatabaseInitialized } = require('./db/autoMigrate');

const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3000;
let mlProcess = null;

function startMLService() {
  const tester = net.createServer()
    .once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log('ℹ️ Python ML FastAPI service is already running on port 8000.');
      } else {
        console.error('⚠️ ML port check error:', err.message);
      }
    })
    .once('listening', () => {
      tester.close(() => {
        console.log('🤖 Auto-starting Python ML FastAPI microservice on port 8000...');
        
        let pythonPath = 'python';
        const venvPaths = [
          path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe'),
          path.join(__dirname, '..', '..', '.venv', 'bin', 'python'),
          path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe'),
          path.join(__dirname, '..', '.venv', 'bin', 'python')
        ];

        for (const p of venvPaths) {
          if (fs.existsSync(p)) {
            pythonPath = p.includes(' ') ? `"${p}"` : p;
            console.log(`ℹ️ Using Python virtual environment: ${p}`);
            break;
          }
        }

        mlProcess = spawn(pythonPath, ['-m', 'uvicorn', 'Model.api_intergate:app', '--host', '127.0.0.1', '--port', '8000'], {
          shell: true
        });
        
        mlProcess.stdout.on('data', (data) => {
          console.log(`[ML-stdout] ${data.toString().trim()}`);
        });

        mlProcess.stderr.on('data', (data) => {
          console.error(`[ML-stderr] ${data.toString().trim()}`);
        });

        mlProcess.on('error', (err) => {
          console.error('⚠️ Could not start Python ML microservice automatically:', err.message);
        });
      });
    })
    .listen(8000, '127.0.0.1');
}

const startServer = async () => {
  try {
    await testConnection();
    await ensureDatabaseInitialized();
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      startMLService();
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use by another process.`);
        console.error(`💡 Solution: Stop the existing process running on port ${PORT} or kill it using: taskkill /F /PID <PID>`);
      } else {
        console.error('❌ Server startup error:', error.message);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Server startup aborted due to database connection error:', error.message);
    process.exit(1);
  }
};

const { exec } = require('child_process');

function killMLProcess() {
  if (mlProcess) {
    console.log('Stopping Python ML microservice...');
    try {
      if (process.platform === 'win32') {
        // Kill the process tree (including shell and child python processes)
        exec(`taskkill /F /T /PID ${mlProcess.pid}`, () => {});
      } else {
        mlProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('Error killing Python ML microservice:', e.message);
    }
  }
}

// Guarantee cleanup on all exit paths
process.on('SIGINT', () => {
  killMLProcess();
  process.exit(0);
});

process.on('SIGTERM', () => {
  killMLProcess();
  process.exit(0);
});

process.on('exit', () => {
  killMLProcess();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception in server:', err);
  killMLProcess();
  process.exit(1);
});

startServer();
