import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const source = join(here, 'system-print.cs')
const output = join(here, 'system-print.exe')
if (process.platform !== 'win32') throw new Error('Windows build required')
if (existsSync(output) && statSync(output).mtimeMs >= Math.max(statSync(source).mtimeMs, statSync(fileURLToPath(import.meta.url)).mtimeMs)) process.exit(0)
const windows = process.env.WINDIR || 'C:\\Windows'
const compiler = join(windows, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe')
function newest(base, name, pattern) {
  if (!existsSync(base)) return null
  const versions = readdirSync(base).filter(v => pattern.test(v) && existsSync(join(base, v, name))).sort((a,b) => a.localeCompare(b, undefined, { numeric:true }))
  return versions.length ? join(base, versions.at(-1), name) : null
}
const metadata = newest('C:/Program Files (x86)/Windows Kits/10/UnionMetadata', 'Windows.winmd', /^\d/)
const references = [metadata, ...['System.Runtime.WindowsRuntime', 'System.Runtime', 'System.Runtime.InteropServices.WindowsRuntime'].map(name => newest(join(windows, 'Microsoft.NET/assembly/GAC_MSIL', name), name + '.dll', /^v\d/)), 'System.Drawing.dll', 'System.Windows.Forms.dll', 'System.Web.Extensions.dll']
if (references.some(r => !r)) throw new Error('Windows SDK metadata or .NET Framework references missing')
execFileSync(compiler, ['/nologo','/optimize+','/target:winexe',...references.map(r => '/r:' + r), '/out:' + output, source], { stdio:'inherit', windowsHide:true })
console.log('Windows system print helper built')
