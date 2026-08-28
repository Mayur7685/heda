#!/usr/bin/env python3
"""
Heda Protocol — Dedicated Local Moondream 2 VLM Server
Loads Moondream 2 onto Apple Silicon / CUDA GPU and serves REST endpoints on port 2020.
"""

import os
import json
import base64
import urllib.request
from io import BytesIO
from http.server import HTTPServer, BaseHTTPRequestHandler
from PIL import Image

print("==============================================================")
print("Loading local Moondream 2 VLM onto Apple Silicon / CUDA GPU...")
print("==============================================================")

try:
    import moondream as md
    model = md.vl(local=True, model="moondream2")
    print("✔ Moondream 2 model loaded successfully!")
except Exception as e:
    print(f"✘ Error loading Moondream model: {e}")
    print("Make sure 'moondream' is installed in your Python environment.")
    raise e

class MoondreamRequestHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle CORS pre-flight requests."""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Moondream-Auth')
        self.end_headers()

    def do_POST(self):
        """Handle Moondream API requests."""
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Invalid JSON payload: {e}"}).encode('utf-8'))
            return

        image_url = body.get("image_url")
        if not image_url:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Missing image_url field"}).encode('utf-8'))
            return

        try:
            if "," in image_url:
                header, encoded = image_url.split(",", 1)
                image_data = base64.b64decode(encoded)
                image = Image.open(BytesIO(image_data))
            elif image_url.startswith("http://") or image_url.startswith("https://"):
                req = urllib.request.Request(image_url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    image = Image.open(BytesIO(response.read()))
            else:
                image_data = base64.b64decode(image_url)
                image = Image.open(BytesIO(image_data))
        except Exception as e:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Failed to load/decode image: {e}"}).encode('utf-8'))
            return

        path = self.path.rstrip('/')
        response_data = {}
        status_code = 200

        if path == "/v1/detect":
            object_name = body.get("object", "object")
            print(f"[VLM DETECT] Finding object: '{object_name}'")
            try:
                res = model.detect(image, object_name)
                response_data = {
                    "objects": [
                        {
                            "x_min": o["x_min"],
                            "y_min": o["y_min"],
                            "x_max": o["x_max"],
                            "y_max": o["y_max"]
                        } for o in res.get("objects", [])
                    ]
                }
            except Exception as e:
                status_code = 500
                response_data = {"error": f"Model inference error: {e}"}

        elif path == "/v1/query":
            question = body.get("question", "")
            print(f"[VLM QUERY] Question: {question[:50]}...")
            try:
                res = model.query(image, question)
                response_data = {"answer": res.get("answer", "")}
            except Exception as e:
                status_code = 500
                response_data = {"error": f"Model inference error: {e}"}

        else:
            status_code = 404
            response_data = {"error": f"Endpoint '{path}' not found."}

        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode('utf-8'))

def run(port=2020):
    server_address = ('', port)
    httpd = HTTPServer(server_address, MoondreamRequestHandler)
    print(f"\n[LOCAL MOONDREAM SERVER] Started offline at http://localhost:{port}/v1")
    print("Press CTRL+C to terminate.")
    print("==============================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    print("\nStopping local server...")
    httpd.server_close()

if __name__ == '__main__':
    run()
