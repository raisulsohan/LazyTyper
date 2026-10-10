// Manual captures: After Effects takes scripts. Writes %TEMP%\LazyTyper\manual-ready.json.
(function () {
  var f = new File(Folder.temp.fsName + "/LazyTyper/manual-ready.json");
  f.open("w");
  f.write("{\"done\":true,\"version\":\"" + app.version + "\"}");
  f.close();
})();
