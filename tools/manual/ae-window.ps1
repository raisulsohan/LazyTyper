# A picture of After Effects' main window only, never of the desktop: PrintWindow asks the window
# to draw itself into a bitmap, so other windows in front of it (a browser, a chat) cannot show up.
# Also lists the window's visible child windows (the panels), with their rectangles relative to the
# picture, so tools/manual/session.mjs can crop one panel out.
#
#   powershell -NoProfile -File tools\manual\ae-window.ps1 <out.png> <children.json>
#
# Prints "ok <width>x<height>" or an error. After Effects must not be minimised.
param([string]$Out, [string]$Json)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public class LTShot {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public static IntPtr FindMain(uint want) {
    IntPtr best = IntPtr.Zero; long area = 0;
    EnumWindows((h, p) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid != want || !IsWindowVisible(h)) return true;
      var t = new StringBuilder(512); GetWindowText(h, t, 512);
      if (!t.ToString().StartsWith("Adobe After Effects")) return true;
      RECT r; GetWindowRect(h, out r);
      long a = (long)(r.R - r.L) * (r.B - r.T);
      if (a > area) { area = a; best = h; }
      return true;
    }, IntPtr.Zero);
    return best;
  }
  public static List<string> Children(IntPtr main) {
    var list = new List<string>();
    RECT m; GetWindowRect(main, out m);
    EnumChildWindows(main, (h, p) => {
      if (!IsWindowVisible(h)) return true;
      RECT r; GetWindowRect(h, out r);
      if (r.R - r.L < 40 || r.B - r.T < 40) return true;
      var t = new StringBuilder(256); GetWindowText(h, t, 256);
      var c = new StringBuilder(128); GetClassName(h, c, 128);
      list.Add("{\"hwnd\":" + h.ToInt64() + ",\"cls\":\"" + c.ToString().Replace("\\", "/").Replace("\"", "'") +
        "\",\"title\":\"" + t.ToString().Replace("\\", "/").Replace("\"", "'") + "\",\"x\":" + (r.L - m.L) + ",\"y\":" + (r.T - m.T) +
        ",\"w\":" + (r.R - r.L) + ",\"h\":" + (r.B - r.T) + "}");
      return true;
    }, IntPtr.Zero);
    return list;
  }
}
"@
[LTShot]::SetProcessDPIAware() | Out-Null
$ae = Get-Process AfterFX -ErrorAction SilentlyContinue
if (-not $ae) { "error: After Effects is not running"; exit 1 }
$h = [LTShot]::FindMain([uint32]$ae[0].Id)
if ($h -eq [IntPtr]::Zero) { "error: no After Effects main window"; exit 1 }
if ([LTShot]::IsIconic($h)) { "error: After Effects is minimised"; exit 1 }
$r = New-Object LTShot+RECT
[LTShot]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.R - $r.L; $ht = $r.B - $r.T
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
# 2 = PW_RENDERFULLCONTENT: also what the GPU draws (the viewer, the panels' own surfaces).
$ok = [LTShot]::PrintWindow($h, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()
if (-not $ok) { $bmp.Dispose(); "error: PrintWindow failed"; exit 1 }
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
if ($Json) {
  $kids = [LTShot]::Children($h)
  Set-Content -Path $Json -Value ("[" + ($kids -join ",`n") + "]") -Encoding UTF8
}
"ok ${w}x${ht}"
