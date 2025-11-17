param(
  [int]$Port = 5173
)

Add-Type -AssemblyName System.Net
Add-Type -AssemblyName System.IO

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Static server running at $prefix" -ForegroundColor Green

try {
  while ($true) {
    try {
      $context = $listener.GetContext()
      $req = $context.Request
      $res = $context.Response

      $path = $req.Url.AbsolutePath.TrimStart('/')
      if ([string]::IsNullOrEmpty($path)) { $path = 'index.html' }
      if ($path -eq 'favicon.ico') { $path = 'index.html' }
      if ($path -eq 'api/ping') {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
        $res.ContentType = 'application/json'
        $res.ContentLength64 = $bytes.Length
        if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
        $res.Close()
        continue
      }
      if ($path.StartsWith('api/data/')) {
        $key = $path.Substring(9)
        $dataDir = Join-Path (Get-Location) 'data'
        if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir -Force | Out-Null }
        $filePath = Join-Path $dataDir ($key + '.json')
        if ($req.HttpMethod -eq 'GET') {
          if (Test-Path $filePath) { $text = [System.IO.File]::ReadAllText($filePath) } else { $text = 'null' }
          $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
          $res.ContentType = 'application/json'
          $res.ContentLength64 = $bytes.Length
          if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
          $res.Close()
          continue
        } elseif ($req.HttpMethod -eq 'POST') {
          $reader = New-Object System.IO.StreamReader($req.InputStream, [System.Text.Encoding]::UTF8)
          $body = $reader.ReadToEnd()
          $reader.Dispose()
          [System.IO.File]::WriteAllText($filePath, $body)
          $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
          $res.ContentType = 'application/json'
          $res.ContentLength64 = $bytes.Length
          if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
          $res.Close()
          continue
        } else {
          $res.StatusCode = 405
          $msg = [System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed')
          if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($msg, 0, $msg.Length) }
          $res.Close()
          continue
        }
      }
      $fullPath = Join-Path (Get-Location) $path

      if (Test-Path $fullPath) {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        $res.ContentLength64 = $bytes.Length
        $ext = [System.IO.Path]::GetExtension($fullPath)
        switch ($ext) {
          '.html' { $res.ContentType = 'text/html' }
          '.css' { $res.ContentType = 'text/css' }
          '.js' { $res.ContentType = 'application/javascript' }
          '.json' { $res.ContentType = 'application/json' }
          default { $res.ContentType = 'application/octet-stream' }
        }
        if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not Found")
        if ($req.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($msg, 0, $msg.Length) }
      }
      $res.Close()
    } catch {
      try { if ($res -and $res.OutputStream) { $res.Close() } } catch {}
      continue
    }
  }
} finally {
  try { $listener.Stop() } catch {}
}
