// Apply the saved theme before first paint (avoids a light/dark flash)
try {
  var t = localStorage.getItem('ci-theme');
  if (t) document.documentElement.dataset.theme = t;
} catch (e) {}
