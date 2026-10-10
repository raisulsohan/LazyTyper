// Release check: after the installed panel has been opened, its host engine must be loaded in
// After Effects. Reports where the extension lives and builds one rig through it with the
// arguments in %TEMP%\LazyTyper\ae-test\fixture.json. Writes %TEMP%\LazyTyper\installed.json.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper";
  var out = { done: true };
  try {
    out.hostLoaded = typeof LT_call === "function";
    if (out.hostLoaded) {
      out.version = LT.version;
      var f = new File(dir + "/ae-test/fixture.json");
      f.encoding = "UTF-8";
      f.open("r");
      var fx = eval("(" + f.read() + ")");
      f.close();
      var comp = app.project.activeItem;
      for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = comp.layer(i).name === "Headline";
      var a = fx.args;
      a.type = "dynamic";
      a.cursor = true;
      out.create = LT_call("createRig", LT.stringify(a));
      comp.time = 1.2;
      out.info = LT_call("selectionInfo", "{\"detail\":true}");
    }
  } catch (e) {
    out.error = String(e) + " line " + e.line;
  }
  var w = new File(dir + "/installed.json");
  w.encoding = "UTF-8";
  w.open("w");
  w.write(typeof LT !== "undefined" ? LT.stringify(out) : "{\"done\":true,\"hostLoaded\":false}");
  w.close();
})();
