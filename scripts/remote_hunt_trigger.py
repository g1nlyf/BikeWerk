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

def main():
    print("=== REMOTE HUNTER TRIGGER (10 BIKES) ===")
    pwd = read_password()
    
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(HOST, username=USER, password=pwd)
        print("✅ SSH Connected")
        
        print("🚀 Executing Manual Hunt on Remote...")
        # We use unbuffered output to see logs in real-time if possible, 
        # but paramiko exec_command blocks until channel closes usually for full output.
        # We can read from stdout in loop.
        
        cmd = "cd /root/eubike/backend && node scripts/manual_hunt_verbose.js"
        stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
        
        for line in stdout:
            print(line.strip())
            
        exit_status = stdout.channel.recv_exit_status()
        if exit_status == 0:
            print("✅ Remote Hunt Complete Success.")
        else:
            print(f"❌ Remote Hunt Failed with status {exit_status}")
            
        client.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
