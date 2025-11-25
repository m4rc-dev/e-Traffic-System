/* E-Traffic Final Firmware (Updated)

   - Nextion UART2: RX=16, TX=17

   - SIM900A UART1: RX=27, TX=26

   - Full: Login, Submit, Page3 Preview, SMS send

*/



#include <WiFi.h>

#include <WiFiClientSecure.h>

#include <HTTPClient.h>

#include <ArduinoJson.h>



//

// CONFIG

//

const char* ssid = "lavajoy";

const char* wifiPassword = "tsamtsam";

const char* serverUrl = "https://e-traffic-backend-production.up.railway.app";

bool allowInsecure = true;



HardwareSerial nextion(2);  // UART2

HardwareSerial sim900(1);   // UART1



const int SIM900_RX = 27;   // SIM900 TX → ESP32 RX

const int SIM900_TX = 26;   // SIM900 RX → ESP32 TX



WiFiClientSecure secureClient;



String jwtToken = "";

String loggedInUser = "";

bool isLoggedIn = false;



String rxBuffer = "";



// Page3 / SMS Preview

String g_name, g_plate, g_type, g_amount, g_location, g_datetime, g_phone;



//

// NEXTION Helper

//

void nextionCmd(const String &cmd) {

  nextion.print(cmd);

  nextion.write(0xFF); nextion.write(0xFF); nextion.write(0xFF);

}



//

// Split Helper

//

uint8_t splitFields(const String &body, String *out, uint8_t maxFields) {

  uint8_t idx = 0;

  int start = 0;

  for (int i = 0; i < body.length() && idx < maxFields - 1; ++i) {

    if (body[i] == '|') {

      out[idx++] = body.substring(start, i);

      out[idx].trim();

      start = i + 1;

    }

  }

  out[idx++] = body.substring(start);

  for (int i = 0; i < idx; i++) out[i].trim();

  return idx;

}



//

// WIFI

//

void connectWiFi() {

  Serial.printf("\nConnecting to WiFi '%s'...\n", ssid);



  WiFi.disconnect(true);

  delay(200);

  WiFi.mode(WIFI_STA);

  WiFi.begin(ssid, wifiPassword);



  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {

    Serial.print(".");

    delay(500);

  }



  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("\nWiFi Connected: " + WiFi.localIP().toString());

  } else {

    Serial.println("\nWiFi FAILED.");

  }

}



//

// SIM900 TOOLS

//

String simRead(unsigned long timeout = 2000) {

  String r = "";

  unsigned long start = millis();

  while (millis() - start < timeout) {

    while (sim900.available()) r += (char)sim900.read();

    if (r.length()) break;

  }

  return r;

}



bool sim900_ready() {

  sim900.println("AT");

  String r = simRead(1000);

  Serial.println("[SIM900] AT -> " + r);

  if (!r.startsWith("OK") && r.indexOf("OK") == -1) return false;



  sim900.println("AT+CSQ");

  Serial.println("[SIM900] CSQ -> " + simRead(1000));



  sim900.println("AT+CREG?");

  Serial.println("[SIM900] CREG -> " + simRead(1000));



  return true;

}



//

// SEND SMS

//

void sendSMS(const String &number, const String &message) {

  Serial.println("\n=========== SMS SENDING START ===========");



  sim900.println("AT+CMGF=1");

  Serial.println("[SIM900] CMGF -> " + simRead(800));



  // Set number

  sim900.print("AT+CMGS=\"");

  sim900.print(number);

  sim900.println("\"");



  delay(700);

  Serial.println("[SIM900] CMGS prompt -> " + simRead(800));



  // Message

  sim900.print(message);

  delay(300);



  // CTRL+Z

  sim900.write(26);

  Serial.println("[SMS] Waiting for result...");



  String resp = simRead(6000);

  Serial.println("[SIM900] Final -> " + resp);



  if (resp.indexOf("OK") != -1 || resp.indexOf("+CMGS:") != -1) {

    Serial.println("SMS SENT SUCCESSFULLY!");

  } else {

    Serial.println("SMS FAILED — NO CONFIRMATION");

  }



  Serial.println("=========== SMS SENDING END ===========\n");

}



//

// LOGIN

//

void handleLogin(const String &payload) {

  String parts[2];

  splitFields(payload, parts, 2);



  String email = parts[0];

  String pass = parts[1];



  Serial.println("[LOGIN] " + email);



  StaticJsonDocument<256> doc;

  doc["email"] = email;

  doc["password"] = pass;

  String body;

  serializeJson(doc, body);



  HTTPClient http;

  String endpoint = String(serverUrl) + "/api/auth/login";

  bool ok = endpoint.startsWith("https://") ?

    http.begin(secureClient, endpoint) :

    http.begin(endpoint);



  if (!ok) {

    nextionCmd("t2.txt=\"Server error\"");

    return;

  }



  http.addHeader("Content-Type", "application/json");

  int status = http.POST(body);

  String resp = http.getString();

  http.end();



  Serial.printf("[LOGIN] %d\n", status);

  Serial.println(resp);



  if (status == 200) {

    StaticJsonDocument<512> r;

    if (!deserializeJson(r, resp)) {

      jwtToken = r["token"].as<String>();

      loggedInUser = r["user"]["full_name"].as<String>();

      isLoggedIn = true;



      nextionCmd("page1.t0.txt=\"" + loggedInUser + "\"");

      nextionCmd("t2.txt=\"Login OK\"");

      delay(200);

      nextionCmd("page page1");

      return;

    }

  }



  nextionCmd("t2.txt=\"Invalid login\"");

}



//

// SUBMIT

//

bool sendViolation(StaticJsonDocument<768> &doc) {

  HTTPClient http;

  String endpoint = String(serverUrl) + "/api/violations";



  bool ok = endpoint.startsWith("https://") ?

    http.begin(secureClient, endpoint) :

    http.begin(endpoint);



  if (!ok) {

    nextionCmd("t12.txt=\"Server error\"");

    return false;

  }



  http.addHeader("Content-Type", "application/json");

  http.addHeader("Authorization", "Bearer " + jwtToken);



  String body;

  serializeJson(doc, body);



  Serial.println("[VIOLATION] Sending...");

  Serial.println(body);



  int status = http.POST(body);

  String resp = http.getString();

  http.end();



  Serial.printf("[VIOLATION] %d\n", status);

  Serial.println(resp);



  if (status == 201 || status == 200) return true;

  return false;

}



void handleSubmit(const String &payload) {

  String p[12];

  if (splitFields(payload, p, 12) < 12) {

    nextionCmd("t12.txt=\"Missing fields\"");

    return;

  }



  // Fill globals

  g_name = p[0];

  g_plate = p[4];

  g_phone = p[2];

  g_type = p[7];

  g_location = p[9];

  g_datetime = p[11];

  g_amount = p[10];



  StaticJsonDocument<768> doc;

  doc["violator_name"] = p[0];

  doc["violator_license"] = p[1];

  doc["violator_phone"] = p[2];

  doc["violator_address"] = p[3];

  doc["vehicle_plate"] = p[4];

  doc["vehicle_model"] = p[5];

  doc["vehicle_color"] = p[6];

  doc["violation_type"] = p[7];

  doc["violation_description"] = p[8];

  doc["location"] = p[9];

  doc["fine_amount"] = p[10].toFloat();

  doc["datetime"] = p[11];



  Serial.println("[SUBMIT] Sending to server...");

  if (sendViolation(doc)) {

    Serial.println("[SUBMIT] Success!");



    nextionCmd("page3.t0.txt=\"" + g_name + "\"");

    nextionCmd("page3.t1.txt=\"" + g_plate + "\"");

    nextionCmd("page3.t2.txt=\"" + g_type + "\"");

    nextionCmd("page3.t3.txt=\"" + g_amount + "\"");

    nextionCmd("page3.t4.txt=\"" + g_location + "\"");

    nextionCmd("page3.t5.txt=\"" + g_datetime + "\"");



    nextionCmd("page page3");

  } else {

    nextionCmd("t12.txt=\"Submit failed\"");

  }

}



//

// NEXTION COMMANDS

//

void processNextionPayload(const String &cmd) {

  if (cmd.startsWith("LOGIN|"))

    handleLogin(cmd.substring(6));



  else if (cmd.startsWith("SUBMIT|"))

    handleSubmit(cmd.substring(7));



    else if (cmd == "SENDSMS") {

    Serial.println("[NEXTION] SENDSMS triggered!");



    String sms =

      "Good Day, Ma'am/Sir! " + g_name +

      "\n\ne-Traffic Notice: "

      "\nViolation: " + g_type +

      "\nFine: PHP " + g_amount +

      "\nLocation: " + g_location +

      "\nDate: " + g_datetime;



    sendSMS(g_phone, sms);



    // Clear page2

    for (int i = 0; i <= 11; i++)

      nextionCmd("page2.t" + String(i) + ".txt=\"\"");



    nextionCmd("page page1");

  }

}



//

// SETUP

//

void setup() {

  Serial.begin(115200);

  delay(200);



  nextion.begin(9600, SERIAL_8N1, 16, 17);

  sim900.begin(115200, SERIAL_8N1, SIM900_RX, SIM900_TX);



  if (allowInsecure) secureClient.setInsecure();



  connectWiFi();

  Serial.println("\nREADY.\n");

}



//

// LOOP

//

void loop() {

  while (nextion.available()) {

    char c = nextion.read();

    rxBuffer += c;

  }



  int idx;

  while ((idx = rxBuffer.indexOf("<END>")) != -1) {

    String cmd = rxBuffer.substring(0, idx);

    rxBuffer.remove(0, idx + 5);

    cmd.trim();

    Serial.println("[RECEIVED] " + cmd);

    processNextionPayload(cmd);

  }



  if (sim900.available()) {

    String s = sim900.readStringUntil('\n');

    s.trim();

    if (s.length()) Serial.println("[SIM900] " + s);

  }

}