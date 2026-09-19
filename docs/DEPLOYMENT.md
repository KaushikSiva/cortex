# Running and deployment

CORTEX is a standalone repository. Install the Node lockfile with `npm ci` and Python dependencies from `robot/requirements.txt` and `voice/requirements.txt` into `.venv`. Copy `.env.example` to `.env.local`, then use `npm run local`.

Services bind to loopback:
- Next.js/control WebSocket: http://localhost:3000
- MuJoCo robot HTTP API: http://127.0.0.1:8002
- Pipecat voice WebSocket/health: http://127.0.0.1:8003

For production locally, build with `npm run build`, start both Python services, and run `npm start`. Use the custom server; `next start` alone does not provide the control WebSocket.

Keys stay in `.env.local`; restart both Node and Pipecat after editing them. Browser microphone input requires localhost or HTTPS. A remote deployment also needs authenticated operator access and a secure transport to the robot; loopback defaults are intentional.

EdgeOne may host the frontend and constrained execution route. Configure `EDGEONE_EXECUTION_URL` and its bearer token only after deploying that route. A standard stateless EdgeOne function cannot host the long-running MuJoCo process or Pipecat audio pipeline. No remote deployment is represented as complete.
