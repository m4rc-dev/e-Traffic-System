// Add this helper function to sanitize and format datetime
String formatDateTime(const String& dateTimeStr) {
  String cleaned = dateTimeStr;
  
  // Remove any invisible characters or extra spaces
  cleaned.trim();
  
  // If the string is empty or too short, return a default
  if (cleaned.length() < 8) {
    return "Invalid Date";
  }
  
  // Return the cleaned datetime string
  return cleaned;
}


void handleSubmit(const String &payload) {
  String p[12];
  if (splitFields(payload, p, 12) < 12) {
    nextionCmd("t12.txt=\"Missing fields\"");
    return;
  }

  // Sanitize and format the datetime
  String rawDateTime = p[11];
  String formattedDateTime = formatDateTime(rawDateTime);

  // Fill globals
  g_name = p[0];
  g_plate = p[4];
  g_phone = p[2];
  g_type = p[7];
  g_location = p[9];
  g_datetime = formattedDateTime;  // Use formatted datetime
  g_amount = p[10];

  // ... rest of existing code ...
}