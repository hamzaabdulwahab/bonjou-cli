# Bonjou

Bonjou is a terminal-based chat app for local networks. You can send messages and files to other computers on the same WiFi or LAN without needing internet.

## What It Does

- Chat with people on the same network
- Send files and folders
- Works on Mac, Linux, and Windows
- No server needed - everything stays on your local network
- Simple commands starting with `@`
- Auto-discovers users across different labs/subnets

## Quick Start

### Install

**Mac (Homebrew):**
```bash
brew tap hamzaabdulwahab/bonjou https://github.com/hamzaabdulwahab/homebrew-bonjou
brew install bonjou
```

**Windows (Scoop):**
```powershell
scoop bucket add bonjou https://github.com/hamzaabdulwahab/scoop-bonjou
scoop install bonjou
```

**Linux (.deb):**
```bash
wget https://github.com/hamzaabdulwahab/bonjou-cli/releases/download/v1.0.0/bonjou_1.0.0_amd64.deb
sudo dpkg -i bonjou_1.0.0_amd64.deb
```

Or download from [Releases](https://github.com/hamzaabdulwahab/bonjou-cli/releases).

### Run

```bash
bonjou
```

You will see:
```
🌐 Welcome to Bonjou v1.0.0
👤 User: hamza | IP: 192.168.1.5
📡 LAN: Connected
Type @help for commands.
```

### Basic Commands

```
@users                          # see who is on the network
@send alex Hello!               # send message to alex
@file alex ~/report.pdf         # send a file
@folder alex ./my-folder        # send a folder
@broadcast Meeting in 5 mins    # message everyone
@scan                           # find users in other labs
@help                           # see all commands
@exit                           # quit
```

## Cross-Lab Discovery

Bonjou automatically scans nearby subnets when it starts. Users in different labs (like 192.168.1.x and 192.168.6.x) should appear in `@users` within a few seconds.

**Not seeing someone?**
- Run `@scan` to search all subnets (~2 minutes)
- Or use `@connect <ip>` if you know their IP (instant)

## Build From Source

Need Go 1.21 or newer.

```bash
git clone https://github.com/hamzaabdulwahab/bonjou-cli.git
cd bonjou-cli
go run ./cmd/bonjou
```

To build binaries:
```bash
./scripts/build.sh
```

## How It Works

- Bonjou finds other users using UDP on port 46320
- Messages and files go through TCP on port 46321
- Files you receive go to `~/.bonjou/received/`
- Settings saved in `~/.bonjou/config.json`

## Troubleshooting

**Can not see other users in same lab?**
- Make sure you are on the same network
- Check if firewall is blocking ports 46320 and 46321

**Can not see users in different lab?**
- Wait a few seconds for auto-scan to complete
- Run `@scan` to search all subnets
- Use `@connect <their-ip>` if you know their IP

**File transfer failed?**
- Wait for user to show up in @users first
- Check version with `bonjou --version`

## More Info

- [Commands](HELP.md)
- [Install Guide](docs/install-guide.md)
- [Demo](docs/demo-simulation.md)

## License

MIT
