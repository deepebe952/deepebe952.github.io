/* Compatibility entry: the task directory now lives on the homepage. */
(() => {
  "use strict";
  const home = new URL("index.html#results", location.href);
  home.search = location.search;
  location.replace(home.href);
})();
