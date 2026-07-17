/**
 * Dev launcher: on this machine Avast SSL scanning re-signs all HTTPS traffic,
 * so Node must explicitly trust its root CA (local-tls-ca.pem, git-ignored,
 * exported from the Windows cert store) or every outbound API call fails with
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE. NODE_EXTRA_CA_CERTS must be set before the
 * Node process starts, hence this wrapper instead of an npm-script env var
 * (not portable on Windows).
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const caFile = path.join(here, 'local-tls-ca.pem')
const env = { ...process.env }
if (existsSync(caFile))
  env.NODE_EXTRA_CA_CERTS = caFile

const vite = path.join(here, 'node_modules', 'vite', 'bin', 'vite.js')
spawn(process.execPath, [vite, '--host'], { stdio: 'inherit', env })
