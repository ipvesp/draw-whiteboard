# Draw Whiteboard

A real-time collaborative whiteboard with shared rooms, drawing tools, text, shapes, cursors, and PNG/SVG export. The interface is in Turkish.

## Run locally

```bash
git clone https://github.com/ipvesp/draw-whiteboard.git
cd draw-whiteboard
npm install
npm run dev
```

The client runs at `http://localhost:5173` and the WebSocket server at `ws://localhost:3001` by default. See `client/.env.example` to override the WebSocket URL. Use `npm run build` for a production build.

## Docker

```bash
docker compose up --build
```

Rooms support an optional password and viewer mode. Passwords are shared separately from invitation links.
