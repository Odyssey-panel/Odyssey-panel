#!/usr/bin/env python3
"""Run a command inside the live Railway deployment via SSH (paramiko)."""
import sys
import paramiko

KEY = "/home/z/.ssh/id_ed25519"

def run(cmd, instance=None):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        "ssh.railway.com",
        port=22,
        username=instance or None,
        key_filename=KEY,
        look_for_keys=True,
        allow_agent=False,
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
    )
    stdin, stdout, stderr = client.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    client.close()
    if out:
        print(out, end="")
    if err:
        print("STDERR:", err, end="")
    sys.exit(code)

if __name__ == "__main__":
    cmd = sys.argv[1]
    inst = sys.argv[2] if len(sys.argv) > 2 else None
    run(cmd, inst)
