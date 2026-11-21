#!/usr/bin/env python3
"""
Abyssal Knight — Production Web Server
FastAPI asynchronous server with automatic fallback to Python's built-in ThreadingHTTPServer.

Usage:
    python3 server.py
    # or with uvicorn directly:
    uvicorn server:app --host 0.0.0.0 --port 8000
"""

import os
import sys
import json
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Game Metadata
GAME_INFO = {
    "title": "Abyssal Knight",
    "version": "1.0.0",
    "genre": "2D Action Platformer / Metroidvania",
    "engine": "HTML5 Canvas + Web Audio API",
    "controls": {
        "move": "Arrow Keys (or A / D)",
        "jump": "Arrow Up / Space / W",
        "attack": "X (or J / Left Click)",
        "dash": "Ctrl (or Shift / K)",
        "heal": "Q (Focus Soul)",
        "pogo": "Down + Attack (Air)",
        "spells": "Keys 1, 2, 3",
        "switch_weapon": "R (or Keys 7, 8, 9, 0)",
        "interact": "F (Rest at Bonfire)",
        "help": "H",
        "rebind": "Escape"
    },
    "features": [
        "Dynamic 2D Lighting and Particle Systems",
        "3 Unique Unlockable Ancient Spells (Pyre Blast, Frost Nova, Abyssal Singularity)",
        "Hollow Knight style Directional Combat & Downward Pogo Bouncing",
        "Multi-phase Void Lord Boss Encounter",
        "Checkpoints & Bonfire Rest Mechanism",
        "33 CC0 / MIT Procedural Sound Effects"
    ]
}

def create_fastapi_app():
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.middleware.gzip import GZipMiddleware
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse, JSONResponse

    app = FastAPI(
        title="Abyssal Knight Web Server",
        version="1.0.0",
        description="Production ASGI server for the 2D action-platformer Abyssal Knight"
    )

    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health_check():
        return {"status": "ok", "app": "Abyssal Knight", "version": "1.0.0"}

    @app.get("/api/info")
    async def get_info():
        return JSONResponse(content=GAME_INFO)

    @app.get("/")
    async def index_root():
        index_path = BASE_DIR / "index.html"
        if not index_path.exists():
            raise HTTPException(status_code=404, detail="index.html not found")
        return FileResponse(index_path, media_type="text/html")

    # Mount static assets
    app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")

    return app


def run_builtin_server(host="0.0.0.0", port=8000):
    from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
    import mimetypes

    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("audio/wav", ".wav")
    mimetypes.add_type("image/png", ".png")

    class GameRequestHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(BASE_DIR), **kwargs)

        def do_GET(self):
            if self.path == "/health":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"ok","app":"Abyssal Knight","version":"1.0.0"}')
                return
            elif self.path == "/api/info":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(GAME_INFO).encode("utf-8"))
                return
            super().do_GET()

    print(f"[Abyssal Knight] Built-in HTTP server listening on http://{host}:{port}")
    httpd = ThreadingHTTPServer((host, port), GameRequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[Abyssal Knight] Server stopped.")
        httpd.server_close()


# Module-level app for ASGI runners (uvicorn server:app)
try:
    app = create_fastapi_app()
    _HAS_FASTAPI = True
except ImportError:
    app = None
    _HAS_FASTAPI = False


def main():
    default_host = os.environ.get("HOST", "0.0.0.0")
    default_port = int(os.environ.get("PORT", 8000))
    parser = argparse.ArgumentParser(description="Abyssal Knight Game Server")
    parser.add_argument("--host", default=default_host, help=f"Host address to bind (default: {default_host})")
    parser.add_argument("--port", type=int, default=default_port, help=f"Port to listen on (default: {default_port})")
    args = parser.parse_args()

    if _HAS_FASTAPI:
        import uvicorn
        print(f"[Abyssal Knight] Starting FastAPI ASGI server on http://{args.host}:{args.port}")
        uvicorn.run("server:app", host=args.host, port=args.port, reload=False, log_level="info")
    else:
        print("[Abyssal Knight] FastAPI / Uvicorn not installed. Running high-performance built-in server.")
        print("To run with FastAPI ASGI, run: pip install -r requirements.txt")
        run_builtin_server(host=args.host, port=args.port)


if __name__ == "__main__":
    main()

