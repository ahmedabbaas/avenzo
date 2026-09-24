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

    function closeNativeDmSheet() {
      var existing = document.querySelector(".avenzo-native-dm-action-overlay");
      if (existing) existing.remove();
    }

    function openNativeDmSheet(row) {
      if (!row || document.querySelector(".dm-message-action-modal")) return;
      var source = row.querySelector(".dm-message-actions");
      if (!source) return;

      closeNativeDmSheet();

      var overlay = document.createElement("div");
      overlay.className = "modal avenzo-native-dm-action-overlay";

      var sheet = document.createElement("div");
      sheet.className = "avenzo-native-dm-sheet";
      sheet.innerHTML =
        '<div style="width:38px;height:4px;margin:1px auto 11px;border-radius:999px;background:#4c5056"></div>' +
        '<div class="avenzo-native-dm-reactions"></div>' +
        '<div class="avenzo-native-dm-actions"></div>' +
        '<button type="button" class="avenzo-native-dm-cancel" aria-label="Close message actions">Cancel</button>';

      var reactionBox = sheet.querySelector(".avenzo-native-dm-reactions");
      ["❤️","😂","👍","😮","😢","😡"].forEach(function(emoji){
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = emoji;
        button.addEventListener("click", function(){
          var reactSource = Array.prototype.slice.call(
            source.querySelectorAll(":scope > button")
          ).find(function(item){
            return item.textContent.trim() === "React";
          });

          if (!reactSource) {
            closeNativeDmSheet();
            return;
          }

          reactSource.click();
          window.setTimeout(function(){
            var pickerButtons = row.querySelectorAll(".dm-reaction-picker button");
            var match = Array.prototype.slice.call(pickerButtons).find(function(item){
              return item.textContent.trim() === emoji;
            });
            if (match) match.click();
            closeNativeDmSheet();
          }, 40);
        });
        reactionBox.appendChild(button);
      });

      var actionBox = sheet.querySelector(".avenzo-native-dm-actions");
      Array.prototype.slice.call(source.querySelectorAll(":scope > button"))
        .filter(function(button){
          return button.textContent.trim() !== "React";
        })
        .forEach(function(sourceButton){
          var button = document.createElement("button");
          button.type = "button";
          button.textContent = sourceButton.textContent.trim();
          if (/delete|report/i.test(button.textContent)) {
            button.style.color = "#ff6767";
          }
          button.addEventListener("click", function(){
            closeNativeDmSheet();
            sourceButton.click();
          });
          actionBox.appendChild(button);
        });

      overlay.addEventListener("click", closeNativeDmSheet);
      sheet.addEventListener("click", function(event){ event.stopPropagation(); });
      sheet.querySelector(".avenzo-native-dm-cancel")
        .addEventListener("click", closeNativeDmSheet);

      overlay.appendChild(sheet);
      document.body.appendChild(overlay);
    }

    function enhanceLegacyDmActions() {
      if (document.querySelector(".dm-message-menu-trigger")) return;

      document.querySelectorAll(".dm-message-row").forEach(function(row){
        if (row.dataset.avenzoDmEnhanced === "1") return;
        if (!row.querySelector(".dm-message-actions")) return;

        row.dataset.avenzoDmEnhanced = "1";
        var timer = null;
        var startX = 0;
        var startY = 0;

        function clearHold() {
          if (timer) {
            window.clearTimeout(timer);
            timer = null;
          }
        }

        row.addEventListener("contextmenu", function(event){
          event.preventDefault();
          openNativeDmSheet(row);
        });

        row.addEventListener("pointerdown", function(event){
          startX = event.clientX;
          startY = event.clientY;
          clearHold();
          timer = window.setTimeout(function(){
            timer = null;
            openNativeDmSheet(row);
            if (navigator.vibrate) navigator.vibrate(18);
          }, 420);
        }, { passive:true });

        row.addEventListener("pointermove", function(event){
          if (
            Math.abs(event.clientX - startX) > 10 ||
            Math.abs(event.clientY - startY) > 10
          ) {
            clearHold();
          }
        }, { passive:true });

        row.addEventListener("pointerup", clearHold, { passive:true });
        row.addEventListener("pointercancel", clearHold, { passive:true });
      });
    }

    function enhanceLegacyDmChrome() {
      var chat = document.querySelector(".dm-chat");
      if (!chat) return;

      var head = chat.querySelector(".dm-chat-head");
      if (head && !head.querySelector(".dm-head-search-button")) {
        var more = head.querySelector(".dm-more-button");
        if (more) {
          var search = document.createElement("button");
          search.type = "button";
          search.className = "icon-button dm-head-search-button avenzo-native-dm-search";
          search.setAttribute("aria-label", "Search messages");
          search.innerHTML =
            '<svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="10.5" cy="10.5" r="6.5"></circle>' +
              '<path d="m15.5 15.5 5 5"></path>' +
            '</svg>';
          search.addEventListener("click", function(){
            var tools = chat.querySelector(".dm-chat-tools");
            if (tools) tools.classList.toggle("open");
          });
          head.insertBefore(search, more);
        }
      }

      var compose = chat.querySelector(".dm-compose-row");
      if (compose && !compose.querySelector(".dm-camera-button")) {
        var buttons = Array.prototype.slice.call(
          compose.querySelectorAll(":scope > button")
        );
        var normalButtons = buttons.filter(function(button){
          return !button.classList.contains("dm-send-button") &&
            !button.classList.contains("send-button");
        });

        if (normalButtons[0]) {
          normalButtons[0].classList.add("dm-camera-button");
        }
        if (normalButtons[1]) {
          normalButtons[1].classList.add("dm-emoji-button");
        }
        compose.classList.add("avenzo-legacy-composer");
      }

      var headerAvatar = head ? head.querySelector(":scope > img") : null;
      if (headerAvatar) {
        chat.querySelectorAll(".dm-message-row.them").forEach(function(row){
          if (row.querySelector(".dm-message-avatar")) return;
          var avatarWrap = document.createElement("span");
          avatarWrap.className = "dm-message-avatar avenzo-native-message-avatar";
          avatarWrap.setAttribute("aria-hidden", "true");
          avatarWrap.appendChild(headerAvatar.cloneNode(true));
          row.insertBefore(avatarWrap, row.firstChild);
        });
      }
    }

    function decodeJwtSubject(token) {
      try {
        var payload = token.split(".")[1];
        if (!payload) return "";
        payload = payload.replace(/-/g, "+").replace(/_/g, "/");
        while (payload.length % 4) payload += "=";
        var decoded = JSON.parse(atob(payload));
        return decoded && decoded.sub ? String(decoded.sub) : "";
      } catch (e) {
        return "";
      }
    }

    function registerNativeNotificationSession(token) {
      if (!token || !window.AvenzoNative?.registerSession) return;
      var userId = decodeJwtSubject(token);
      if (!userId) return;

      try {
        window.AvenzoNative.registerSession(token, userId);
      } catch (e) {}
    }

    function extractBearer(headers) {
      try {
        if (!headers) return "";
        if (headers instanceof Headers) {
          var value = headers.get("authorization") || headers.get("Authorization");
          return value && value.indexOf("Bearer ") === 0 ? value.slice(7) : "";
        }
        if (Array.isArray(headers)) {
          var row = headers.find(function(item){
            return item && String(item[0]).toLowerCase() === "authorization";
          });
          var pairValue = row && row[1] ? String(row[1]) : "";
          return pairValue.indexOf("Bearer ") === 0 ? pairValue.slice(7) : "";
        }
        var key = Object.keys(headers).find(function(name){
          return name.toLowerCase() === "authorization";
        });
        var objectValue = key ? String(headers[key]) : "";
        return objectValue.indexOf("Bearer ") === 0 ? objectValue.slice(7) : "";
      } catch (e) {
        return "";
      }
    }

    function installNativeNotificationSessionCapture() {
      if (!window.AvenzoNative?.registerSession) return;
      if (window.__avenzoNativeFetchWrapped) return;
      window.__avenzoNativeFetchWrapped = true;

      var originalFetch = window.fetch.bind(window);
      window.fetch = function(input, init) {
        try {
          var url = typeof input === "string"
            ? input
            : input && input.url
              ? input.url
              : "";
          if (url.indexOf("ltlxynrssgpqgzbdpliv.supabase.co") !== -1) {
            var token = extractBearer(init && init.headers);
            if (!token && input && input.headers) {
              token = extractBearer(input.headers);
            }
            if (token) registerNativeNotificationSession(token);
          }
        } catch (e) {}

        return originalFetch(input, init);
      };
    }

    function syncMobileState() {
      applyBranding();
      ensureDrawer();
      normalizeBottomNav();
      enhanceLegacyDmChrome();
      enhanceLegacyDmActions();
      installNativeNotificationSessionCapture();
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