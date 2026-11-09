# Disegna le icone dell'app (vetrina con tenda a righe e moneta d'oro) in icons/.
Add-Type -AssemblyName System.Drawing
$dir = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
function Col($r, $g, $b) { [System.Drawing.Color]::FromArgb($r, $g, $b) }
function Pen($c) { New-Object System.Drawing.SolidBrush $c }
foreach ($size in 512, 192, 180) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.ScaleTransform($size / 512.0, $size / 512.0)
  $g.Clear((Col 26 18 8))
  $g.FillRectangle((Pen (Col 58 41 20)), 96, 200, 320, 220)
  for ($k = 0; $k -lt 8; $k++) {
    if ($k % 2) { $c = Col 255 244 226 } else { $c = Col 230 90 60 }
    $x = 80 + $k * 44
    $g.FillRectangle((Pen $c), $x, 130, 44, 70)
    $g.FillPie((Pen $c), $x, 178, 44, 44, 0, 180)
  }
  $g.FillRectangle((Pen (Col 255 210 120)), 130, 250, 140, 110)
  $g.FillRectangle((Pen (Col 120 70 30)), 300, 250, 80, 170)
  $g.FillEllipse((Pen (Col 255 194 75)), 300, 300, 170, 170)
  $bordo = New-Object System.Drawing.Pen -ArgumentList (Col 200 130 20), 10
  $g.DrawEllipse($bordo, 300, 300, 170, 170)
  $font = New-Object System.Drawing.Font -ArgumentList 'Segoe UI', 110, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = 'Center'
  $sf.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF -ArgumentList 300, 305, 170, 170
  $g.DrawString([string][char]0x20AC, $font, (Pen (Col 58 36 0)), $rect, $sf)
  $bmp.Save((Join-Path $dir "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}
Get-ChildItem $dir | ForEach-Object { "$($_.Name) $($_.Length)" }
