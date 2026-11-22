# Extra intermediate certificates

`intermediates.pem` holds intermediate CA certificates that a portal fails to send. Node.js does not fetch missing intermediates itself (browsers and macOS curl do), so without them it rejects the connection. Scripts that contact the portals load this file through `NODE_EXTRA_CA_CERTS`; certificate verification stays fully on.

| Certificate            | Needed by                  | Issued by                                     | Valid until | SHA-256 fingerprint                                                                               |
| ---------------------- | -------------------------- | --------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| Alpiro RSA DV SSL CA 2 | www.pvl.cz (Povodí Vltavy) | Sectigo Public Server Authentication Root R46 | 2035-03-26  | `CD:FB:B4:78:82:81:8B:69:4A:AD:81:8C:D8:04:0D:D1:10:50:19:7F:51:DD:BF:3C:2E:B0:98:12:E4:A2:5D:F5` |

Found on 2026-11-22: www.pvl.cz sends "AlpiroSSL RSA DV CA" instead of the "Alpiro RSA DV SSL CA 2" that signed its certificate. The correct intermediate was downloaded from the issuer URL in the site's certificate (`http://crt.sectigo.com/AlpiroRSADVSSLCA2.crt`) and checked with `openssl verify` against Node's built-in root store.

If Povodí Vltavy fixes its server, the entry is harmless. If it changes certificate authority, the probe reports a TLS error for `pvl` and a new intermediate has to be added here the same way.
