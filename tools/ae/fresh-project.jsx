// Test runs only: gives After Effects a new, empty project. Writes %TEMP%\LazyTyper\fresh.json.
//
// The open project is never lost: when it has items, a copy is saved to
// %TEMP%\LazyTyper\backups first (the five newest copies are kept), then it closes unsaved.
//
// This script must do nothing else. Closing a project and building in the new one within the
// same script makes After Effects show "internal verification failure, sorry! {no current
// context}" once the script ends; a separate script for the building avoids it.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper";
  var out = { done: true };
  try {
    var proj = app.project;
    if (proj && proj.numItems > 0) {
      var bdir = new Folder(dir + "/backups");
      if (!bdir.exists) bdir.create();
      var d = new Date();
      var stamp = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + "_" + d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds();
      var name = proj.file ? proj.file.name.replace(/\.aep$/i, "") : "Untitled";
      var copy = new File(bdir.fsName + "/" + name + "_" + stamp + ".aep");
      proj.save(copy);
      out.backup = copy.fsName;
      var olds = bdir.getFiles("*.aep");
      olds.sort(function (a, b) { return a.modified.getTime() - b.modified.getTime(); });
      for (var i = 0; i < olds.length - 5; i++) olds[i].remove();
    }
    if (proj) proj.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    app.newProject();
    out.ok = true;
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var f = new File(dir + "/fresh.json");
  f.encoding = "UTF-8";
  f.open("w");
  f.write("{\"done\":true,\"ok\":" + (out.ok ? "true" : "false") +
    (out.backup ? ",\"backup\":\"" + out.backup.replace(/\\/g, "/") + "\"" : "") +
    (out.error ? ",\"error\":\"" + out.error.replace(/"/g, "'") + "\"" : "") + "}");
  f.close();
})();
