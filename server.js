import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testProcess;
const PORT = process.env.PORT || 3980;

const startServer = () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
        if (err) {
          console.error('Error reading index.html', err);
          res.writeHead(500);
          res.end('Error loading the page');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        }
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  });

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

    testProcess = spawn('node', [path.join(__dirname, './index.js')], {
      stdio: 'inherit'
    });

    testProcess.on('close', (code) => {
      console.log(`Bot Server process exited with code ${code}`);
    });

    setInterval(() => {
      console.log('Restarting server and bot process...');
      testProcess.kill('SIGINT');
      server.close(() => {
        server.listen(PORT, () => {
          console.log(`Server restarted on port ${PORT}`);
          testProcess = spawn('node', [path.join(__dirname, './index.js')], {
            stdio: 'inherit'
          });

          testProcess.on('close', (code) => {
            console.log(`Bot Server process exited with code ${code}`);
          });
        });
      });
    }, 1800000);
  });
};

startServer();
