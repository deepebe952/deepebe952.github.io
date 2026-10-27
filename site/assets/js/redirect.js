/* Compatibility entry points preserve query parameters and deep links. */
(() => {
  "use strict";
  const target = document.currentScript.dataset.target;
  location.replace(target + location.search + location.hash);
})();
