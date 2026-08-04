package network

import (
	"crypto/ecdh"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// LocalPublicKeyFromSecret returns the X25519 public key (hex-encoded)
// derived from the local long-term secret. Exported so the UI/commands layer
// can render it for fingerprint display without owning the crypto details.
func LocalPublicKeyFromSecret(secret string) (string, error) {
	return localPublicKeyFromSecret(secret)
}

func localPublicKeyFromSecret(secret string) (string, error) {
	priv, err := privateKeyFromSecret(secret)
	if err != nil {
		return "", err
	}
	return hex.EncodeToString(priv.PublicKey().Bytes()), nil
}

func privateKeyFromSecret(secret string) (*ecdh.PrivateKey, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return nil, fmt.Errorf("your Bonjou configuration is incomplete — try deleting ~/.bonjou/config.json and restarting")
	}
	seed := sha256.Sum256([]byte(secret))
	private := seed
	private[0] &= 248
	private[31] &= 127
	private[31] |= 64
	return ecdh.X25519().NewPrivateKey(private[:])
}
