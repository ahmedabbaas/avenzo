(function(){
  try {
    var ROOT = document.documentElement;
    var HOME_SCROLL_KEY = "avenzo:android:home-scroll";
    var lastHomeActive = false;
    var restoreTimer = 0;

    function isVisible(el) {
      if (!el) return false;
      var computed = window.getComputedStyle(el);
      return computed.display !== "none" &&
        computed.visibility !== "hidden" &&
        el.getClientRects().length > 0;
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, function(ch){
        return ({
          "&":"&amp;",
          "<":"&lt;",
          ">":"&gt;",
          '"':"&quot;",
          "'":"&#039;"
        })[ch];
      });
    }

    var styleId = "avenzo-android-mobile-style";
    var style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = atob("__CSS__");
    ROOT.classList.add("avenzo-android-app");

    var logo = "data:image/webp;base64,__LOGO__";

    function brandImage(size) {
      var img = document.createElement("img");
      img.src = logo;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.className = "avenzo-native-logo";
      img.style.width = size + "px";
      img.style.height = size + "px";
      img.style.objectFit = "cover";
      img.style.borderRadius = Math.max(9, Math.round(size * 0.3)) + "px";
      img.style.flex = "0 0 auto";
      return img;
    }

    function applyBranding() {
      document.querySelectorAll(".brand,.public-brand,.messages-brand").forEach(function(el){
        if (el.querySelector(".avenzo-brand-logo,.avenzo-native-logo")) return;
        var mark = el.querySelector(":scope > i");
        if (!mark) {
          var span = el.querySelector(":scope > span");
          if (span && span.textContent.trim() === "A") mark = span;
        }
        var img = brandImage(el.classList.contains("brand") ? 34 : 31);
        if (mark) mark.replaceWith(img);
        else el.prepend(img);
      });

      document.querySelectorAll(".brand-mark").forEach(function(mark){
        if (mark.parentElement && mark.parentElement.querySelector(".avenzo-native-logo")) return;
        mark.replaceWith(brandImage(52));
      });
    }

    function findLeftNavButton(label) {
      var buttons = Array.prototype.slice.call(
        document.querySelectorAll(".left-nav button")
      );
      return buttons.find(function(button){
        return button.textContent.trim().toLowerCase().indexOf(label.toLowerCase()) === 0;
      }) || null;
    }

    function closeDrawer() {
      ROOT.classList.remove("avenzo-native-drawer-open");
      var drawer = document.querySelector(".avenzo-native-drawer");
      if (drawer) drawer.setAttribute("aria-hidden", "true");
    }

    function openDrawer() {
      ROOT.classList.add("avenzo-native-drawer-open");
      var drawer = document.querySelector(".avenzo-native-drawer");
      if (drawer) drawer.setAttribute("aria-hidden", "false");
    }

    function triggerDestination(label, href) {
      closeDrawer();
      if (href) {
        window.location.href = href;
        return;
      }
      var target = findLeftNavButton(label);
      if (target) target.click();
    }

    function ensureDrawer() {
      var top = document.querySelector(".top");
      if (!top || document.querySelector(".avenzo-native-menu-button")) return;

      var menu = document.createElement("button");
      menu.type = "button";
      menu.className = "avenzo-native-menu-button";
      menu.setAttribute("aria-label", "Open navigation menu");
      menu.innerHTML =
        '<span></span><span></span><span></span>';
      menu.addEventListener("click", function(){
        if (ROOT.classList.contains("avenzo-native-drawer-open")) closeDrawer();
        else openDrawer();
      });
      top.appendChild(menu);

      var drawer = document.createElement("div");
      drawer.className = "avenzo-native-drawer";
      drawer.setAttribute("aria-hidden", "true");
      drawer.innerHTML =
        '<button class="avenzo-native-drawer-backdrop" aria-label="Close menu"></button>' +
        '<aside class="avenzo-native-drawer-panel" role="dialog" aria-label="AVENZO menu">' +
          '<div class="avenzo-native-drawer-head">' +
            '<div class="avenzo-native-drawer-brand"></div>' +
            '<div><b>AVENZO</b><small>Menu</small></div>' +
            '<button class="avenzo-native-drawer-close" aria-label="Close menu">×</button>' +
          '</div>' +
          '<nav>' +
            '<button data-avenzo-action="messages">Messages</button>' +
            '<button data-avenzo-action="activity">Activity</button>' +
            '<button data-avenzo-action="saved">Saved</button>' +
            '<button data-avenzo-action="settings">Settings</button>' +
          '</nav>' +
        '</aside>';

      document.body.appendChild(drawer);
      var brandHolder = drawer.querySelector(".avenzo-native-drawer-brand");
      if (brandHolder) brandHolder.appendChild(brandImage(44));

      drawer.querySelector(".avenzo-native-drawer-backdrop")
        .addEventListener("click", closeDrawer);
      drawer.querySelector(".avenzo-native-drawer-close")
        .addEventListener("click", closeDrawer);

      drawer.querySelector('[data-avenzo-action="messages"]')
        .addEventListener("click", function(){ triggerDestination("", "/messages"); });
      drawer.querySelector('[data-avenzo-action="activity"]')
        .addEventListener("click", function(){ triggerDestination("Activity"); });
      drawer.querySelector('[data-avenzo-action="saved"]')
        .addEventListener("click", function(){ triggerDestination("Saved"); });
      drawer.querySelector('[data-avenzo-action="settings"]')
        .addEventListener("click", function(){ triggerDestination("", "/settings"); });
    }

    function normalizeBottomNav() {
      var nav = document.querySelector(".mobile-nav");
      if (!nav) return;

      var buttons = Array.prototype.slice.call(nav.querySelectorAll(":scope > button"));
      buttons.forEach(function(button){
        var small = button.querySelector("small");
        if (!small) return;

        var label = small.textContent.trim().toLowerCase();
        var wanted = "avenzo-mobile-secondary";
        var wantedLabel = small.textContent;

        if (label === "home") {
          wanted = "avenzo-primary-home";
          wantedLabel = "Home";
        } else if (label === "explore" || label === "search") {
          wanted = "avenzo-primary-search";
          wantedLabel = "Search";
        } else if (label === "create") {
          wanted = "avenzo-primary-create";
          wantedLabel = "Create";
        } else if (label === "reels") {
          wanted = "avenzo-primary-reels";
          wantedLabel = "Reels";
        } else if (label === "profile") {
          wanted = "avenzo-primary-profile";
          wantedLabel = "Profile";
        }

        var managed = [
          "avenzo-primary-home",
          "avenzo-primary-search",
          "avenzo-primary-create",
          "avenzo-primary-reels",
          "avenzo-primary-profile",
          "avenzo-mobile-secondary"
        ];

        var alreadyCorrect =
          button.classList.contains(wanted) &&
          managed.every(function(name){
            return name === wanted || !button.classList.contains(name);
          });

        if (!alreadyCorrect) {
          managed.forEach(function(name){
            if (name !== wanted) button.classList.remove(name);
          });
          button.classList.add(wanted);
        }

        if (small.textContent !== wantedLabel) {
          small.textContent = wantedLabel;
        }
      });
    }

    function homeButton() {
      return document.querySelector(".mobile-nav .avenzo-primary-home");
    }

    function isHomeScreenActive() {
      var button = homeButton();
      return Boolean(
        window.location.pathname === "/home" &&
        button &&
        button.classList.contains("active")
      );
    }

    function saveHomeScroll() {
      if (!isHomeScreenActive()) return;
      try {
        sessionStorage.setItem(HOME_SCROLL_KEY, String(Math.max(0, window.scrollY || 0)));
      } catch (e) {}
    }

    function restoreHomeScroll() {
      clearTimeout(restoreTimer);
      restoreTimer = window.setTimeout(function(){
        try {
          var stored = Number(sessionStorage.getItem(HOME_SCROLL_KEY) || "0");
          if (stored > 0 && isHomeScreenActive()) {
            window.scrollTo({ top: stored, left: 0, behavior: "auto" });
          }
        } catch (e) {}
      }, 120);
    }

    function syncHomeState() {
      var nowHome = isHomeScreenActive();
      if (nowHome && !lastHomeActive) restoreHomeScroll();
      if (!nowHome && lastHomeActive) saveHomeScroll();
      lastHomeActive = nowHome;
    }

    function syncMobileState() {
      applyBranding();
      ensureDrawer();
      normalizeBottomNav();
      syncHomeState();

      var activeChat = document.querySelector(".dm-chat:not(.dm-mobile-hidden)");
      ROOT.classList.toggle(
        "avenzo-dm-chat-active",
        Boolean(activeChat && isVisible(activeChat))
      );
    }

    function closeVisibleModal() {
      var modals = Array.prototype.slice.call(
        document.querySelectorAll('.modal[role="dialog"], .modal, .story-viewer-shell')
      ).filter(isVisible);

      if (!modals.length) return false;
      var modal = modals[modals.length - 1];
      var close = modal.querySelector(
        'button[aria-label="Close"], button[aria-label="Close story"], ' +
        'button[aria-label*="close" i], .modal-header .icon-button'
      );
      if (close && !close.disabled) {
        close.click();
        return true;
      }

      if (modal.classList.contains("story-viewer-shell")) {
        modal.click();
        return true;
      }
      return false;
    }

    window.__avenzoHandleBack = function() {
      try {
        if (ROOT.classList.contains("avenzo-native-drawer-open")) {
          closeDrawer();
          return "handled";
        }

        if (closeVisibleModal()) {
          return "handled";
        }

        var chatBack = document.querySelector(
          ".dm-chat:not(.dm-mobile-hidden) .dm-back"
        );
        if (chatBack && isVisible(chatBack)) {
          chatBack.click();
          return "handled";
        }

        if (window.location.pathname.indexOf("/settings") === 0) {
          window.location.href = "/home";
          return "handled";
        }

        if (
          window.location.pathname === "/messages" ||
          window.location.pathname === "/reels" ||
          window.location.pathname.indexOf("/u/") === 0 ||
          window.location.pathname.indexOf("/admin/") === 0
        ) {
          window.location.href = "/home";
          return "handled";
        }

        if (window.location.pathname === "/home") {
          var home = homeButton();
          if (home && !home.classList.contains("active")) {
            home.click();
            return "handled";
          }
          return "root";
        }

        if (window.history.length > 1) return "history";
        return "root";
      } catch (e) {
        return "root";
      }
    };

    window.addEventListener("scroll", saveHomeScroll, { passive: true });
    window.addEventListener("pagehide", saveHomeScroll);
    document.addEventListener("visibilitychange", function(){
      if (document.hidden) saveHomeScroll();
      else restoreHomeScroll();
    });

    var syncQueued = false;

    function scheduleSync() {
      if (syncQueued) return;
      syncQueued = true;
      window.requestAnimationFrame(function(){
        syncQueued = false;
        syncMobileState();
      });
    }

    syncMobileState();

    if (!window.__avenzoNativeBrandObserver) {
      window.__avenzoNativeBrandObserver = new MutationObserver(function(mutations){
        var needsSync = mutations.some(function(mutation){
          return mutation.type === "childList" &&
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);
        });
        if (needsSync) scheduleSync();
      });

      window.__avenzoNativeBrandObserver.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });

      document.addEventListener("click", function(){
        window.setTimeout(scheduleSync, 0);
        window.setTimeout(scheduleSync, 120);
      }, true);

      window.addEventListener("popstate", scheduleSync);
      window.addEventListener("pageshow", scheduleSync);
    }
  } catch (e) {}
})();