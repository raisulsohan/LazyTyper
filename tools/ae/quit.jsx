// Closes the open project without saving and quits After Effects (test runs only).
(function () {
    try { app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES); } catch (e) {}
    app.quit();
})();
