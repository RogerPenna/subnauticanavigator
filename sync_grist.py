import requests
import json

# Desktop Grist
DESKTOP_API_KEY = "3f239483efa9f797806c76b9e5f82af0ce8ee3dc"
DESKTOP_BASE_URL = "http://localhost:47478/api"
DESKTOP_DOC_ID = "17Zr1nRakG1EdNd6SsdqLX"

# Online Grist (from .env)
ONLINE_API_KEY = "0b2321953e9d41418da1891c78d4c516c681e23f"
ONLINE_BASE_URL = "https://docs.getgrist.com/api"
ONLINE_DOC_ID = "jt9ASdwtgHaBFbxyfhdmwf"

def get_structure(base_url, api_key, doc_id):
    headers = {"Authorization": f"Bearer {api_key}"}
    tables_url = f"{base_url}/docs/{doc_id}/tables"
    resp = requests.get(tables_url, headers=headers)
    if resp.status_code != 200:
        print(f"Error fetching tables from {base_url}: {resp.text}")
        return None
    
    tables = resp.json().get('tables', [])
    structure = {}
    
    for table in tables:
        table_id = table['id']
        # Skip summary tables
        if table_id.startswith('grist_') or '_summary_' in table_id:
            continue
            
        cols_url = f"{base_url}/docs/{doc_id}/tables/{table_id}/columns"
        cols_resp = requests.get(cols_url, headers=headers)
        if cols_resp.status_code == 200:
            cols = cols_resp.json().get('columns', [])
            # In Grist API, column type is inside 'fields'
            structure[table_id] = {col['id']: col['fields']['type'] for col in cols if not col['id'].startswith('manual')}
            
    return structure

def sync():
    print("Fetching Desktop structure...")
    desktop_struct = get_structure(DESKTOP_BASE_URL, DESKTOP_API_KEY, DESKTOP_DOC_ID)
    if not desktop_struct: return

    print("Fetching Online structure...")
    online_struct = get_structure(ONLINE_BASE_URL, ONLINE_API_KEY, ONLINE_DOC_ID)
    if not online_struct: return

    headers_online = {
        "Authorization": f"Bearer {ONLINE_API_KEY}",
        "Content-Type": "application/json"
    }

    for table_id, desktop_cols in desktop_struct.items():
        if table_id not in online_struct:
            print(f"Creating missing table: {table_id}")
            columns_payload = [{"id": cid, "fields": {"type": ctype, "label": cid}} for cid, ctype in desktop_cols.items()]
            create_table_url = f"{ONLINE_BASE_URL}/docs/{ONLINE_DOC_ID}/tables"
            payload = {"tables": [{"id": table_id, "columns": columns_payload}]}
            resp = requests.post(create_table_url, headers=headers_online, json=payload)
            if resp.status_code == 200:
                print(f"Successfully created table {table_id}")
            else:
                print(f"Failed to create table {table_id}: {resp.text}")
        else:
            # Table exists, check for missing columns
            online_cols = online_struct[table_id]
            missing_cols = []
            for cid, ctype in desktop_cols.items():
                if cid not in online_cols:
                    missing_cols.append({"id": cid, "fields": {"type": ctype, "label": cid}})
            
            if missing_cols:
                print(f"Adding {len(missing_cols)} missing columns to {table_id}")
                add_col_url = f"{ONLINE_BASE_URL}/docs/{ONLINE_DOC_ID}/tables/{table_id}/columns"
                payload = {"columns": missing_cols}
                resp = requests.post(add_col_url, headers=headers_online, json=payload)
                if resp.status_code == 200:
                    print(f"Successfully added columns to {table_id}")
                else:
                    print(f"Failed to add columns to {table_id}: {resp.text}")
            else:
                print(f"Table {table_id} is already in sync.")

if __name__ == "__main__":
    sync()
