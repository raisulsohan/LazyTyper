# Scrolls an After Effects panel by posting mouse-wheel messages to its window (no keyboard focus,
# the real mouse pointer never moves). x, y are relative to After Effects' main window.
#
#   powershell -NoProfile -File tools\manual\ae-wheel.ps1 <hwnd> <x> <y> <notches>   (negative: down)
param([long]$Hwnd, [int]$X, [int]$Y, [int]$Notches)
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class LTWheel {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
"@
[LTWheel]::SetProcessDPIAware() | Out-Null
$h = [IntPtr]$Hwnd
$main = [LTWheel]::GetAncestor($h, 2)
$r = New-Object LTWheel+RECT
[LTWheel]::GetWindowRect($main, [ref]$r) | Out-Null
$sx = $r.L + $X; $sy = $r.T + $Y
$step = if ($Notches -lt 0) { -120 } else { 120 }
for ($i = 0; $i -lt [Math]::Abs($Notches); $i++) {
  $w = [IntPtr](([long]($step -band 0xFFFF)) -shl 16)
  $l = [IntPtr](([long]($sy -band 0xFFFF) -shl 16) -bor ($sx -band 0xFFFF))
  [LTWheel]::PostMessage($h, 0x020A, $w, $l) | Out-Null
  Start-Sleep -Milliseconds 60
}
"ok"
