# Lists After Effects' visible top-level windows with their titles and, for dialogs, their text.
# A test run uses it to notice error dialogs that a script cannot see.
#   powershell -NoProfile -File tools\ae-dialogs.ps1
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public class LTWin {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  public static List<string> List(uint want) {
    var r = new List<string>();
    EnumWindows((h, p) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == want && IsWindowVisible(h)) {
        var t = new StringBuilder(512); GetWindowText(h, t, 512);
        var c = new StringBuilder(128); GetClassName(h, c, 128);
        var kids = new List<string>();
        EnumChildWindows(h, (k, q) => { var s = new StringBuilder(512); GetWindowText(k, s, 512); if (s.Length > 0) kids.Add(s.ToString()); return true; }, IntPtr.Zero);
        r.Add(h + " [" + c + "] '" + t + "' " + string.Join(" | ", kids));
      }
      return true;
    }, IntPtr.Zero);
    return r;
  }
}
"@
$ae = Get-Process AfterFX -ErrorAction SilentlyContinue
if (-not $ae) { "After Effects is not running"; exit 0 }
[LTWin]::List([uint32]$ae[0].Id)
