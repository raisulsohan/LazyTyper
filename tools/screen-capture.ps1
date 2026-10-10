# Saves a picture of the primary screen (to read an After Effects dialog during a test run).
#   powershell -NoProfile -File tools\screen-capture.ps1 <out.png>
param([string]$Out)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save($Out)
$g.Dispose()
$bmp.Dispose()
