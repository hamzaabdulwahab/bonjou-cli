# Bonjou Demo

This shows how to use Bonjou between two computers. You can also test on one computer using two terminal windows.

## Setup

1. Install Bonjou on both computers
2. Make sure both are on the same WiFi/network
3. Open firewall ports 46320 (UDP) and 46321 (TCP)

## Example Session

### Computer 1 (Alex)

Start Bonjou:
```bash
bonjou
```

Check your info:
```
@whoami
```
Output:
```
Username: alex
IP: 192.168.1.10
Port: 46321
```

### Computer 2 (Jamie)

Start Bonjou:
```bash
bonjou
```

See who is on the network:
```
@users
```
Output:
```
alex (192.168.1.10)
```

Send a message:
```
@send alex Hey Alex!
```

Alex will see the message appear.

## Send a File

On Jamie's computer:
```
@file alex ~/Documents/notes.pdf
```

You will see progress:
```
Sending notes.pdf... 45%... 100% done
```

Alex receives it in:
```
~/.bonjou/received/files/notes.pdf
```

## Send a Folder

On Alex's computer:
```
@folder jamie ./project-files
```

Bonjou zips the folder, sends it, and unzips on the other side.

Jamie receives it in:
```
~/.bonjou/received/folders/project-files/
```

## Message Everyone

```
@broadcast Break time in 5 minutes!
```

Everyone on the network sees this message.

## Check History

```
@history
```

Shows all past messages and transfers.

## Exit

```
@exit
```

Closes Bonjou.
