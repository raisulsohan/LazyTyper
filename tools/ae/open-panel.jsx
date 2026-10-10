// Opens the LazyTyper panel in a running After Effects (Window > Extensions > LazyTyper).
(function () {
    var id = app.findMenuCommandId("LazyTyper");
    if (id) app.executeCommand(id);
})();
