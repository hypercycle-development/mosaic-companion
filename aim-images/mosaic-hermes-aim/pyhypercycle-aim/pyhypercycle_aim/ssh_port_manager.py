import os
import subprocess
import tempfile
import base64
from pyhypercycle_aim.exceptions import SSHPortManagerError

SSH_USER_HOME = "/home/access"
SSH_USER = "access"
SSH_AUTH_KEYS = f"{SSH_USER_HOME}/.ssh/authorized_keys"
SSHD_CONFIG = "/etc/ssh/sshd_config"
INIT_MARKER_FILE = "/var/run/sshportmanager_initialized"

class SSHPortManager:
    @classmethod
    def allow_access(cls, ports=None, shell=False, username="access"):
        if not username.isalnum():
            raise SSHPortManagerError("Username must be alpha-numeric.")       
 
        cls.ensure_user(username)
        cls.ensure_ssh_dir(username)

        # Create keypair
        key = subprocess.check_output(["ssh-keygen", "-t", "rsa", "-b", "2048", "-N", "", "-f", "/tmp/tempkey"]).decode()
        private_key = open("/tmp/tempkey", "r").read()
        public_key = open("/tmp/tempkey.pub", "r").read()
        os.remove("/tmp/tempkey")
        os.remove("/tmp/tempkey.pub")

        options = []

        if not shell:
            options.append("no-pty,no-agent-forwarding,no-X11-forwarding")

        if ports:
            for port in ports:
                port = int(port)
                options.append(f"permitopen=\"localhost:{port}\"")

        option_str = ""
        if options:
            option_str = ",".join(options) + " "

        # Append to authorized_keys
        with open(SSH_AUTH_KEYS, "a") as f:
            f.write(f"{option_str}{public_key}")

        return private_key

    @classmethod
    def remove_key(cls, pubkey):
        """Remove a public key from authorized_keys."""
        if not os.path.exists(SSH_AUTH_KEYS):
            return
        with open(SSH_AUTH_KEYS, "r") as f:
            lines = f.readlines()
        with open(SSH_AUTH_KEYS, "w") as f:
            for line in lines:
                if pubkey.strip() not in line.strip():
                    f.write(line)

    @classmethod
    def ensure_user(cls, username):
        """Ensure the SSH user exists."""
        if not username.isalnum():
            raise SSHPortManagerError("Username must be alpha-numeric.")       
        try:
            subprocess.run(["id", username], check=True, stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            subprocess.run(["useradd", "-m", "-s", "/bin/bash", username], check=True)

    @classmethod
    def ensure_ssh_dir(cls, username):
        """Ensure the .ssh directory and authorized_keys exist."""
        if not username.isalnum():
            raise SSHPortManager("Username must be alpha-numeric.")
        ssh_dir = f"/home/{username}/.ssh"
        authorized_keys = f"{ssh_dir}/authorized_keys"

        os.makedirs(ssh_dir, mode=0o700, exist_ok=True)
        open(authorized_keys, "a").close()  # Touch file
        os.chmod(authorized_keys, 0o600)
        os.chown(ssh_dir, os.getuid(), os.getgid())
        os.chown(authorized_keys, os.getuid(), os.getgid())

    @classmethod
    def list_users(cls, users=None):
        """List users with their public keys."""
        users = {}
        home_base = "/home"

        for username in os.listdir(home_base):
            if users is not None and username not in users:
                continue
            ssh_dir = os.path.join(home_base, username, ".ssh")
            auth_keys = os.path.join(ssh_dir, "authorized_keys")

            if os.path.exists(auth_keys):
                with open(auth_keys, "r") as f:
                    keys = [line.strip() for line in f if line.strip()]
                    if keys:
                        users[username] = keys
        return users


    @classmethod
    def init(cls, ssh_port=4001):
        if not os.path.exists(cls.INIT_MARKER_FILE):
            print("SSHPortManager already initialized, skipping.")
            return 
        ssh_port=int(ssh_port)

        """Prepare SSHD settings."""
        cls.ensure_user(SSH_USER)
        cls.ensure_ssh_dir(SSH_USER)

        # Install openssh-server if missing
        subprocess.run("apt-get update && apt-get install -y openssh-server",
                       shell=True, check=True)

        # Ensure sshd_config allows needed features
        with open(SSHD_CONFIG, "a") as f:
            f.write(f"\nPort {ssh_port}\n")        
            f.write("\nPermitRootLogin no\n")
            f.write("PasswordAuthentication no\n")
            f.write("AllowTcpForwarding yes\n")
            f.write("PermitTTY yes\n")
            f.write("Subsystem sftp /usr/lib/openssh/sftp-server\n")
        
        os.makedirs("/var/run/sshd", exist_ok=True)
        subprocess.run("systemctl restart sshd", shell=True, check=True)

        # Write the marker file
        with open(cls.INIT_MARKER_FILE, "w") as f:
            f.write("initialized")


