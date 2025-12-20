# Bonjou

Bonjou is a terminal-based chat app for local networks. You can send messages and files to other computers on the same WiFi or LAN without needing internet.

## What It Does

- Chat with people on the same network
- Send files and folders
- Works on Mac, Linux, and Windows
- No server needed - everything stays on your local network
- Simple commands starting with `@`

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
wget https://github.com/hamzaabdulwahab/bonjou-terminal/releases/download/v1.0.0/bonjou_1.0.0_amd64.deb
sudo dpkg -i bonjou_1.0.0_amd64.deb
```

Or download from [Releases](https://github.com/hamzaabdulwahab/bonjou-terminal/releases).

### Run

```bash
bonjou
```

You will see something like:
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
@help                           # see all commands
@exit                           # quit
```

## Build From Source

Need Go 1.21 or newer.

```bash
git clone https://github.com/hamzaabdulwahab/bonjou-terminal.git
cd bonjou-terminal
go run ./cmd/bonjou
```

To build binaries for all platforms:
```bash
./scripts/build.sh
```

## How It Works

- Bonjou finds other users using UDP broadcasts on port 46320
- Messages and files go through TCP on port 46321
- Files you receive go to `~/.bonjou/received/`
- Your settings are saved in `~/.bonjou/config.json`

## Project Structure

```
cmd/bonjou/     - main app entry point
internal/
  commands/     - handles @ commands
  config/       - saves/loads settings
  network/      - discovery and file transfer
  ui/           - terminal interface
  history/      - chat logs
```

## Troubleshooting

**Can not see other users?**
- Make sure you are on the same network
- Check if firewall is blocking ports 46320 and 46321

**File transfer failed?**
- Wait for user to show up in @users first
- Check if both have the same version with bonjou --version

## More Info

- [Install Guide](docs/install-guide.md) - detailed install steps
- [Command Reference](HELP.md) - all commands explained
- [Demo](docs/demo-simulation.md) - example session

## License

MIT
