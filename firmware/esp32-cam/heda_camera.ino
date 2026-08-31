#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include "camera_pins.h"

// ── WiFi & 0G Heda Ingest Configuration ───────────────────────────────────────
const char *STA_SSID   = "YOUR_WIFI_NAME";
const char *STA_PASS   = "YOUR_WIFI_PASSWORD";

// Unified 0G Heda Relayer on Render (or local IP during dev, e.g. http://192.168.1.X:3001)
const char *INGEST_URL = "https://heda-relayer.onrender.com/api/v1/ingest";
const char *OTA_BASE   = "https://heda-relayer.onrender.com/api/v1/devices/";

// Physical button pin (Optional: connect button between GPIO 1 and GND)
#define SHUTTER_PIN 1

String deviceId = "";
unsigned long lastUploadTime = 0;
const unsigned long UPLOAD_INTERVAL_MS = 30000; // 30 seconds

void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_SVGA; // 800x600 resolution
  config.jpeg_quality = 12;             // 10-63 (lower = higher quality)
  config.fb_count     = 2;

  // Initialize PSRAM frame buffers
  if (psramFound()) {
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_VGA;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[0G Camera] Init failed: 0x%x\n", err);
    return;
  }
  Serial.println("[0G Camera] OV2640 Initialized Successfully.");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(SHUTTER_PIN, INPUT_PULLUP);

  initCamera();

  // Connect to Local Wi-Fi
  Serial.printf("[WiFi] Connecting to %s...\n", STA_SSID);
  WiFi.begin(STA_SSID, STA_PASS);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP Address: " + WiFi.localIP().toString());
    deviceId = "ESP32-" + WiFi.macAddress();
    Serial.printf("========================================\n");
    Serial.printf(" 0G HEDA HARDWARE CAMERA INITIALIZED\n");
    Serial.printf(" Device ID: %s\n", deviceId.c_str());
    Serial.printf(" Pair this Device ID in Heda WebApp\n");
    Serial.printf("========================================\n");
  } else {
    Serial.println("\n[WiFi] Failed to connect. Check credentials.");
  }
}

void captureAndUpload() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[0G Ingest] WiFi disconnected, skipping capture.");
    return;
  }

  Serial.println("[0G Ingest] Capturing frame...");
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[0G Ingest] Frame capture failed!");
    return;
  }

  HTTPClient http;
  http.begin(INGEST_URL);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Device-Id", deviceId);

  Serial.printf("[0G Ingest] Sending %d bytes to %s\n", fb->len, INGEST_URL);
  int httpResponseCode = http.POST(fb->buf, fb->len);

  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.printf("[0G Storage Pinning SUCCESS] %s\n", response.c_str());
  } else {
    Serial.printf("[0G Ingest Error] HTTP %d: %s\n", httpResponseCode, http.getString().c_str());
  }

  http.end();
  esp_camera_fb_return(fb);
}

void checkOTAModelUpdate() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String otaUrl = String(OTA_BASE) + deviceId + "/ota";
  http.begin(otaUrl);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    if (payload.indexOf("\"assigned\":true") >= 0) {
      Serial.printf("[OTA Weights Sync] Active Model Update Detected: %s\n", payload.c_str());
    }
  }
  http.end();
}

void loop() {
  // Check physical shutter button or interval timer
  bool buttonPressed = (digitalRead(SHUTTER_PIN) == LOW);
  unsigned long now = millis();

  if (buttonPressed || (now - lastUploadTime >= UPLOAD_INTERVAL_MS)) {
    lastUploadTime = now;
    captureAndUpload();
    checkOTAModelUpdate();
  }

  delay(100);
}
