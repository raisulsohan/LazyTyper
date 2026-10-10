// Runs one named step (from %TEMP%\LazyTyper\step.txt) so a runner can look for After Effects
// error dialogs after each one. Writes step.json.
(function () {
  var dir = Folder.temp.fsName + "/LazyTyper";
  function readText(path) { var f = new File(path); f.encoding = "UTF-8"; f.open("r"); var s = f.read(); f.close(); return s; }
  var step = readText(dir + "/step.txt").replace(/\s+$/, "");
  var fx = eval("(" + readText(dir + "/ae-test/fixture.json") + ")");
  $.evalFile(new File(fx.root + "/host/host.jsx"));
  var out = "";
  function args(extra) {
    var a = {};
    for (var k in fx.args) if (fx.args.hasOwnProperty(k)) a[k] = fx.args[k];
    for (var e in extra) if (extra.hasOwnProperty(e)) a[e] = extra[e];
    return LT.stringify(a);
  }
  function sel(comp, name) {
    for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = comp.layer(i).name === name;
  }
  try {
    var comp = app.project ? app.project.activeItem : null;
    if (step === "noop") {
      out = "ok";
    } else if (step === "closeNew") {
      try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e1) {}
      app.newProject();
      out = "ok";
    } else if (step === "addComp") {
      comp = app.project.items.addComp("Step test", 1920, 1080, 1, 10, 30);
      out = "ok";
    } else if (step === "addText") {
      comp = null;
      for (var ci = 1; ci <= app.project.numItems; ci++) if (app.project.item(ci) instanceof CompItem && app.project.item(ci).name === "Step test") comp = app.project.item(ci);
      comp.layers.addText("Hello, this is a step test.").name = "A";
      out = "ok";
    } else if (step === "viewer") {
      for (var vi = 1; vi <= app.project.numItems; vi++) if (app.project.item(vi) instanceof CompItem && app.project.item(vi).name === "Step test") app.project.item(vi).openInViewer();
      out = "ok";
    } else if (step === "sameProject") {
      comp = app.project.items.addComp("Step test", 1920, 1080, 1, 10, 30);
      comp.openInViewer();
      comp.layers.addText("Hello, this is a step test.").name = "A";
      comp.layers.addText("Second layer\rwith two lines").name = "B";
      out = "ok";
    } else if (step === "new2") {
      try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e2) {}
      app.newProject();
      comp = app.project.items.addComp("Step test", 1920, 1080, 1, 10, 30);
      comp.openInViewer();
      var a2 = comp.layers.addText("Hello, this is a step test.");
      a2.name = "A";
      var b2 = comp.layers.addText("Second layer\rwith two lines");
      b2.name = "B";
      out = "ok";
    } else if (step === "new") {
      try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e0) {}
      app.newProject();
      comp = app.project.items.addComp("Step test", 1920, 1080, 1, 10, 30);
      var a = comp.layers.addText("Hello, this is a step test.");
      a.name = "A";
      var b = comp.layers.addText("Second layer\rwith two lines");
      b.name = "B";
      comp.openInViewer();
      out = "ok";
    } else if (step === "dynamic") {
      sel(comp, "A");
      out = LT_call("createRig", args({ type: "dynamic", cursor: true }));
    } else if (step === "stable") {
      sel(comp, "B");
      out = LT_call("createRig", args({ type: "stable", cursor: true }));
    } else if (step === "time") {
      comp.time = 2;
      out = "ok";
    } else if (step === "frame") {
      comp.saveFrameToPng(1.5, new File(dir + "/step-frame.png"));
      out = "ok";
    } else if (step === "bake") {
      sel(comp, "A");
      out = LT_call("bake", args({}));
    } else if (step === "unbake") {
      sel(comp, "A");
      out = LT_call("unbake", args({}));
    } else if (step === "refreshStable") {
      sel(comp, "B");
      out = LT_call("refreshRig", args({}));
    } else if (step === "refreshDynamic") {
      sel(comp, "A");
      out = LT_call("refreshRig", args({}));
    } else if (step === "remove") {
      sel(comp, "A");
      out = LT_call("removeRig", args({}));
    }
  } catch (err) {
    out = "error: " + err + " line " + err.line;
  }
  var f = new File(dir + "/step.json");
  f.open("w");
  f.write("{\"done\":true,\"step\":" + LT.stringify(step) + ",\"out\":" + LT.stringify(String(out).substr(0, 300)) + "}");
  f.close();
})();
