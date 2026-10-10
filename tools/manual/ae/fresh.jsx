// Manual captures: a new, empty project, like tools/ae/fresh-project.jsx, in a script run of its own.
// A project the manual made itself (never saved, its comps' comment "LazyTyper manual scene") closes
// without a copy, so the manual's scratch never pushes a copy of real work out of the five that
// %TEMP%\LazyTyper\backups keeps. Any other project with items is copied there first.
// Writes %TEMP%\LazyTyper\fresh.json.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper";
  var out = { done: true };
  try {
    var proj = app.project;
    var ours = false;
    if (proj && !proj.file) {
      for (var n = 1; n <= proj.numItems; n++) {
        if (proj.item(n) instanceof CompItem && proj.item(n).comment === "LazyTyper manual scene") ours = true;
      }
    }
    if (proj && proj.numItems > 0 && !ours) {
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
