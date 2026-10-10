# Closes After Effects' message boxes (errors and warnings: #32770 windows with no title), the
# same as pressing OK, so a test run can go on. Uses WM_CLOSE, which needs no keyboard focus.
# Never touches the "Executing Script ..." progress window: it is a #32770 window too, but has a
# title, and closing it cancels the running script. Prints how many it closed.
#   powershell -NoProfile -File tools\ae-dismiss.ps1
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public class LTDismiss {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  public static List<IntPtr> Dialogs(uint want) {
    var r = new List<IntPtr>();
    EnumWindows((h, p) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      var c = new StringBuilder(64); GetClassName(h, c, 64);
      var t = new StringBuilder(256); GetWindowText(h, t, 256);
      if (pid == want && IsWindowVisible(h) && c.ToString() == "#32770" && t.Length == 0) r.Add(h);
      return true;
    }, IntPtr.Zero);
    return r;
  }
}
"@
$ae = Get-Process AfterFX -ErrorAction SilentlyContinue
if (-not $ae) { "0"; exit 0 }
$n = 0
foreach ($h in [LTDismiss]::Dialogs([uint32]$ae[0].Id)) {
  [LTDismiss]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
  $n++
}
Start-Sleep -Milliseconds 500
"$n"
