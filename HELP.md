# Bonjou Commands

All commands start with `@`. Type them in the Bonjou terminal.

## Basic Commands

| Command | What it does |
|---------|-------------|
| `@help` | Show this help |
| `@whoami` | Show your username and IP |
| `@users` | List people on the network |
| `@status` | Show app info and paths |
| `@history` | Show past messages |
| `@clear` | Clear the screen |
| `@exit` | Quit Bonjou |

## Sending Messages

**To one person:**
```
@send alex Hey, how are you?
```

**To multiple people:**
```
@multi alex,bob Meeting at 3pm
```

**To everyone:**
```
@broadcast Lunch break!
```

You can use their username or IP address.

## Sending Files

**Send a file:**
```
@file alex ~/Documents/report.pdf
```

**Send a folder:**
```
@folder alex ./my-project
```

**Send to multiple people:**
```
@multi alex,bob ~/photo.jpg
```

Files are received in:
- `~/.bonjou/received/files/`
- `~/.bonjou/received/folders/`

## Discovery Limits

Bonjou announces itself automatically. On the same subnet, users appear quickly via UDP broadcast.

Bonjou discovery is same-subnet only (UDP broadcast generally does not cross routers/VLANs). If someone is not showing up, ensure both devices are on the same Wi‑Fi/LAN segment and that firewall rules allow UDP/TCP on the app ports.

## Settings

**Change your username:**
```
@setname john
```

**Change where files are saved:**
```
@setpath ~/Downloads/bonjou
```

## Tips

- Same lab: users appear automatically in `@users`
- Different lab/subnet: not supported (move both devices to the same subnet)
- Use quotes for paths with spaces: `@file alex "~/My Documents/file.pdf"`
- Use `~` for home directory
- Run `bonjou --version` to check version
