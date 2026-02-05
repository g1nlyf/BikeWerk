import paramiko
import sys
import time

# Configuration
HOST = '45.9.41.232'
USER = 'root'
PASS_FILE = 'deploy_password.txt'

def read_password():
    try:
        with open(PASS_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"Error: {PASS_FILE} not found.")
        sys.exit(1)

def run_remote_command(client, command, verbose=True):
    if verbose:
        print(f"REMOTE EXEC: {command}")
    stdin, stdout, stderr = client.exec_command(command)
    
    # Stream output
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    
    if verbose:
        if out: print(out)
        if err: print(f"STDERR: {err}")
    
    return exit_status

def main():
    print("=== REMOTE SYSTEM CLEANUP ===")
    pwd = read_password()
    
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(HOST, username=USER, password=pwd)
        print("✅ SSH Connected")
        
        # 1. Clean DB using sqlite3
        # Assuming sqlite3 is installed. If not, we might need a node script.
        # Let's try to find where the DB is. Assuming standard deploy path /root/eubike/backend/database/eubike.db
        db_path = "/root/eubike/backend/database/eubike.db"
        
        print("🧹 Cleaning Remote Database...")
        # Check if file exists
        check_cmd = f"[ -f {db_path} ] && echo 'exists'"
        stdin, stdout, stderr = client.exec_command(check_cmd)
        if 'exists' in stdout.read().decode('utf-8'):
            sql_cmds = "DELETE FROM bikes; DELETE FROM market_history; DELETE FROM search_stats;"
            # Try to run via sqlite3 command line
            cmd = f"sqlite3 {db_path} \"{sql_cmds}\""
            status = run_remote_command(client, cmd)
            if status != 0:
                print("⚠️ sqlite3 command failed. Trying Node.js fallback...")
                # Fallback: create a temporary node script on remote
            # We run it from telegram-bot directory where sqlite3 is likely installed
            node_cmd = """cd /root/eubike/telegram-bot && node -e "const sqlite3 = require('sqlite3'); const db = new sqlite3.Database('../backend/database/eubike.db'); db.serialize(() => { db.run('DELETE FROM bikes'); db.run('DELETE FROM market_history'); db.run('DELETE FROM search_stats', (err) => { if(err) console.error(err); else console.log('DB Cleaned'); }); });" """
            
            print(f"   Trying Node.js fallback from telegram-bot dir...")
            status_node = run_remote_command(client, node_cmd)
            
            if status_node != 0:
                 print("⚠️ Node fallback failed too. Trying backend dir...")
                 node_cmd_back = """cd /root/eubike/backend && node -e "const sqlite3 = require('sqlite3'); const db = new sqlite3.Database('./database/eubike.db'); db.serialize(() => { db.run('DELETE FROM bikes'); db.run('DELETE FROM market_history'); db.run('DELETE FROM search_stats', (err) => { if(err) console.error(err); else console.log('DB Cleaned'); }); });" """
                 run_remote_command(client, node_cmd_back)

        else:
            print("⚠️ DB file not found remotely. Skipping DB clean.")

        # 2. Clean Images
        img_path = "/root/eubike/backend/public/images/bikes"
        print(f"🧹 Cleaning Remote Images in {img_path}...")
        # rm -rf * inside the dir
        cmd = f"rm -rf {img_path}/*"
        run_remote_command(client, cmd)
        
        print("✅ Remote Cleanup Complete.")
        client.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
