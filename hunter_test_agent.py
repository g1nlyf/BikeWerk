import paramiko
import sys
import os
import re
import json
import math
from bs4 import BeautifulSoup
from datetime import datetime

# Configuration
HOST = '45.9.41.232'
USER = 'root'
PASS_FILE = 'deploy_password.txt'
TARGET_URL = 'https://www.kleinanzeigen.de/s-anzeige/canyon-spectral-5/3302127274-217-4855'
MARBURG_ZIP = '35037'
MARBURG_COORDS = (50.8022, 8.7667) # Lat, Lon approx

# Setup Logging
def log(step, status, message):
    print(f"[{step}][{status}] {message}")

def read_password():
    try:
        with open(PASS_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        log("SETUP", "ERROR", f"Password file {PASS_FILE} not found.")
        sys.exit(1)

def ssh_connect(host, user, password):
    log("STEP 1", "INFO", f"Connecting to {user}@{host}...")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(host, username=user, password=password, timeout=10)
        log("STEP 1", "SUCCESS", "SSH Connection established.")
        return client
    except Exception as e:
        log("STEP 1", "ERROR", f"SSH Connection failed: {str(e)}")
        sys.exit(1)

def fetch_html_remote(client, url):
    log("STEP 2", "INFO", f"Fetching URL via remote: {url}")
    # Use curl with headers to mimic browser
    cmd = f"curl -s -L -A 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' '{url}'"
    stdin, stdout, stderr = client.exec_command(cmd)
    
    html = stdout.read().decode('utf-8')
    error = stderr.read().decode('utf-8')
    
    if html and len(html) > 1000:
        log("STEP 2", "SUCCESS", f"Fetched {len(html)} bytes.")
        return html
    else:
        log("STEP 2", "ERROR", f"Fetch failed. Stderr: {error[:200]}...")
        return None

def parse_price(text):
    clean = re.sub(r'[^0-9.,]', '', text).strip()
    if not clean: return 0
    # Handle German format 1.200,00 -> 1200.00
    if ',' in clean and '.' in clean:
         # Assume . is thousand sep, , is decimal
         clean = clean.replace('.', '').replace(',', '.')
    elif ',' in clean:
         clean = clean.replace(',', '.')
    elif '.' in clean:
         # If only dot, check if it's thousand sep (e.g. 1.200) or decimal (12.50)
         # If 3 digits after dot, usually thousand sep
         if re.match(r'.*\.\d{3}$', clean):
             clean = clean.replace('.', '')
    
    try:
        return float(clean)
    except:
        return 0

def calculate_distance(zip_code):
    # Mock coordinates for demo
    # In real app this would query a DB
    mock_db = {
        '35789': (50.4167, 8.3833), # Weilmünster
        '35037': MARBURG_COORDS
    }
    
    if zip_code in mock_db:
        lat1, lon1 = mock_db[zip_code]
        lat2, lon2 = MARBURG_COORDS
        
        # Haversine formula
        R = 6371 # km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2) * math.sin(dlat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dlon/2) * math.sin(dlon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        d = R * c
        
        return round(d, 1)
    return None

def analyze_hunter_logic(html):
    log("STEP 3", "INFO", "Starting Raw Parsing & Logic Trace...")
    soup = BeautifulSoup(html, 'html.parser')
    report = {}
    
    # 1. Title
    title_el = soup.select_one('.boxedarticle--title') or soup.select_one('h1')
    title = title_el.get_text(strip=True) if title_el else "N/A"
    log("STEP 3", "DEBUG", f"Found Title: '{title}'")
    report['title'] = title

    # 2. Price & Type
    price_el = soup.select_one('.boxedarticle--price') or soup.select_one('.price-element')
    price_text = price_el.get_text(strip=True) if price_el else ""
    price_val = parse_price(price_text)
    is_vb = 'VB' in price_text or 'Verhandlungsbasis' in price_text
    log("STEP 3", "DEBUG", f"Found Price String: '{price_text}' -> Value: {price_val}, Type: {'VB' if is_vb else 'Fixed'}")
    report['price'] = price_val
    report['price_type'] = 'VB' if is_vb else 'FIXED'

    # 3. Description & Specs
    desc_el = soup.select_one('#viewad-description-text')
    desc_text = desc_el.get_text(strip=True) if desc_el else ""
    log("STEP 3", "DEBUG", f"Extracted Description ({len(desc_text)} chars).")
    report['description_preview'] = desc_text[:100] + "..."

    # Specs Regex Logic
    # Year
    year_match = re.search(r'(?:Neukauf|Rechnung|Baujahr|Year)\s*[:\s]*(\d{2}[./]\d{2}|\d{4})', desc_text, re.IGNORECASE)
    if year_match:
        val = year_match.group(1)
        # Normalize "06/24" -> 2024
        if '/' in val and len(val) <= 5:
            parts = val.split('/')
            if len(parts[1]) == 2: val = '20' + parts[1]
        log("STEP 3", "DEBUG", f"Found Year Keyword: '{year_match.group(0)}' -> Mapped: {val}")
        report['year'] = val
    else:
        log("STEP 3", "DEBUG", "No Year keyword found.")
        report['year'] = None

    # Size
    size_match = re.search(r'(?:Rahmengröße|Größe|Size)\s*[:\s-]*([LMS]|XL|XXL|\d{2}\s*cm|\d{2}\s*Zoll)', desc_text, re.IGNORECASE) or \
                 re.search(r'\b(L|XL|M|S)\b', title) # Fallback to title
    
    if size_match:
        val = size_match.group(1)
        log("STEP 3", "DEBUG", f"Found Size Keyword: '{size_match.group(0)}' -> Mapped: {val}")
        report['size'] = val
    else:
        log("STEP 3", "DEBUG", "No Size keyword found.")
        report['size'] = None

    # 4. Shipping / Local Lot
    # Check "Nur Abholung" in price area or details
    shipping_text = ""
    shipping_els = soup.select('.boxedarticle--details, #viewad-price, .ad-shipping-details')
    for el in shipping_els:
        shipping_text += " " + el.get_text()
    
    is_local_lot = False
    
    # Primary check: Specific elements
    if re.search(r'Nur\s*Abholung', shipping_text, re.IGNORECASE):
        log("STEP 4", "DEBUG", f"Found 'Nur Abholung' trigger in details/price block.")
        is_local_lot = True
    elif re.search(r'Nur\s*Abholung', desc_text, re.IGNORECASE):
        log("STEP 4", "DEBUG", f"Found 'Nur Abholung' trigger in description.")
        is_local_lot = True
    # Fallback: Check full body text if not found yet (Robustness)
    elif re.search(r'Nur\s*Abholung', soup.get_text(), re.IGNORECASE):
        log("STEP 4", "DEBUG", f"Found 'Nur Abholung' trigger in global page text (Fallback).")
        is_local_lot = True
    
    if is_local_lot:
        log("STEP 4", "ACTION", "Setting LOCAL_LOT status. Activating Free Booking Protocol.")
        report['shipping'] = 'PICKUP_ONLY'
        report['badges'] = ['LOCAL_LOT']
    else:
        log("STEP 4", "DEBUG", "No 'Nur Abholung' found. Assuming Shipping Available.")
        report['shipping'] = 'AVAILABLE'

    # 5. Geodata
    # Extract Zip
    location_el = soup.select_one('.boxedarticle--location') or soup.select_one('.ad-location')
    location_text = location_el.get_text(strip=True) if location_el else ""
    zip_match = re.search(r'\b(\d{5})\b', location_text)
    
    if not zip_match:
         # Fallback: Look for "PLZ" or just 5 digits in likely areas
         log("STEP 5", "DEBUG", "ZIP not found in location element. Scanning full text for 'PLZ XXXXX' or 'XXXXX City'...")
         full_text = soup.get_text()
         # Look for 5 digits followed by City name (simplified)
         # Or just the first 5 digit number that looks like a zip (3xxxx, 4xxxx etc)
         # Try to find near "Hessen" or "Weilmünster"
         context_match = re.search(r'\b(\d{5})\s+[A-ZÄÖÜ][a-zäöü]+', full_text)
         if context_match:
             zip_match = context_match
             log("STEP 5", "DEBUG", f"Found potential ZIP in text: {zip_match.group(0)}")

    if zip_match:
        zip_code = zip_match.group(1)
        log("STEP 5", "DEBUG", f"Found ZIP: {zip_code} in '{location_text}'")
        report['zip'] = zip_code
        
        # Distance Logic
        dist = calculate_distance(zip_code)
        if dist is not None:
            log("STEP 5", "INFO", f"Coordinates {zip_code}: Looked up. Distance to Marburg ({MARBURG_ZIP}): {dist} km.")
            if dist < 100:
                log("STEP 5", "SUCCESS", "Status: In Range (Green Zone).")
                report['logistics_zone'] = 'GREEN'
            else:
                log("STEP 5", "WARNING", "Status: Out of Range (Yellow Zone).")
                report['logistics_zone'] = 'YELLOW'
        else:
             log("STEP 5", "WARNING", f"ZIP {zip_code} not in mock DB. Cannot calc distance.")
    else:
        log("STEP 5", "ERROR", "ZIP code not found.")

    # 6. Seller Trust
    seller_el = soup.select_one('#viewad-contact')
    if seller_el:
        since_match = re.search(r'Aktiv\s*seit\s*(\d{2}\.\d{2}\.\d{4})', seller_el.get_text())
        since = since_match.group(1) if since_match else "Unknown"
        
        rating_el = seller_el.select_one('.userbadge')
        rating = rating_el.get_text(strip=True) if rating_el else "Unknown"
        
        log("STEP 6", "DEBUG", f"Seller: Active since {since}, Rating: {rating}")
        
        # Trust Score Calc
        score = 0
        if since != "Unknown":
            year = int(since.split('.')[2])
            age = 2026 - year
            score += age * 2 # 2 points per year
        
        if "Zufrieden" in rating or "TOP" in rating:
            score += 5
            
        log("STEP 6", "INFO", f"Trust Score Calculated: {score}/10")
        report['seller_trust_score'] = score
        report['seller_since'] = since

    return report

def main():
    print("=== STARTING HUNTER DIAGNOSTIC PROBE ===")
    pwd = read_password()
    client = ssh_connect(HOST, USER, pwd)
    
    html = fetch_html_remote(client, TARGET_URL)
    if not html:
        print("CRITICAL: Failed to get HTML.")
        client.close()
        return

    final_data = analyze_hunter_logic(html)
    
    print("\n=== FINAL JSON OUTPUT ===")
    print(json.dumps(final_data, indent=2, ensure_ascii=False))
    
    client.close()
    print("\n=== PROBE COMPLETE ===")

if __name__ == '__main__':
    main()
