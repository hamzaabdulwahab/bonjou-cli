# How to Install Bonjou

Pick your operating system and follow the steps.

## Mac

### Option 1: Homebrew (easiest)

```bash
brew tap hamzaabdulwahab/bonjou https://github.com/hamzaabdulwahab/homebrew-bonjou
brew install bonjou
```

Run it:
```bash
bonjou
```

Update later:
```bash
brew update && brew upgrade bonjou
```

### Option 2: Download manually

1. Download from releases:
```bash
curl -L -o bonjou-macos.tar.gz https://github.com/hamzaabdulwahab/bonjou-terminal/releases/download/v1.0.0/bonjou-macos.tar.gz
```

2. Extract and install:
```bash
tar -xzf bonjou-macos.tar.gz
sudo mv bonjou-macos /usr/local/bin/bonjou
sudo chmod +x /usr/local/bin/bonjou
```

3. Run:
```bash
bonjou
```

### Option 3: Build from source

```bash
git clone https://github.com/hamzaabdulwahab/bonjou-terminal.git
cd bonjou-terminal
go build -o bonjou ./cmd/bonjou
sudo mv bonjou /usr/local/bin/
```

---

## Linux

### Option 1: Debian/Ubuntu package

```bash
wget https://github.com/hamzaabdulwahab/bonjou-terminal/releases/download/v1.0.0/bonjou_1.0.0_amd64.deb
sudo dpkg -i bonjou_1.0.0_amd64.deb
```

If you get dependency errors:
```bash
sudo apt -f install
```

Run:
```bash
bonjou
```

### Option 2: Download manually

```bash
curl -L -o bonjou-linux.tar.gz https://github.com/hamzaabdulwahab/bonjou-terminal/releases/download/v1.0.0/bonjou-linux.tar.gz
tar -xzf bonjou-linux.tar.gz
sudo mv bonjou-linux /usr/local/bin/bonjou
sudo chmod +x /usr/local/bin/bonjou
```

### Option 3: Build from source

```bash
git clone https://github.com/hamzaabdulwahab/bonjou-terminal.git
cd bonjou-terminal
go build -o bonjou ./cmd/bonjou
sudo mv bonjou /usr/local/bin/
```

---

## Windows

### Option 1: Scoop (easiest)

Open PowerShell:
```powershell
scoop bucket add bonjou https://github.com/hamzaabdulwahab/scoop-bonjou
scoop install bonjou
```

Run:
```powershell
bonjou
```

Update later:
```powershell
scoop update bonjou
```

If download fails, clear cache first:
```powershell
scoop cache rm bonjou
scoop install bonjou
```

### Option 2: Download manually

1. Download from releases:
```powershell
Invoke-WebRequest -Uri https://github.com/hamzaabdulwahab/bonjou-terminal/releases/download/v1.0.0/bonjou-windows.zip -OutFile bonjou-windows.zip
```

2. Extract:
```powershell
Expand-Archive bonjou-windows.zip -DestinationPath C:\Tools\Bonjou
```

3. Add to PATH:
   - Open System Properties > Environment Variables
   - Add `C:\Tools\Bonjou` to your Path

4. Open new terminal and run:
```powershell
bonjou
```

### Option 3: Build from source

```powershell
git clone https://github.com/hamzaabdulwahab/bonjou-terminal.git
cd bonjou-terminal
go build -o bonjou.exe .\cmd\bonjou
```

Move bonjou.exe to a folder in your PATH.

---

## Check if it worked

```bash
bonjou --version
```

Should show: `Bonjou v1.0.0`

---

## Offline Install (USB/AirDrop)

If you dont have internet on the target machine:

1. Download the right file on another computer:
   - Mac: `bonjou-macos.tar.gz`
   - Linux: `bonjou-linux.tar.gz`
   - Windows: `bonjou-windows.zip`

2. Copy to USB or use AirDrop

3. Follow the manual install steps above

---

## Firewall

Bonjou needs these ports open:
- UDP 46320 (finding other users)
- TCP 46321 (sending messages and files)

If you cant see other users, check your firewall settings.
