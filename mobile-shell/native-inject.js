(function(){
  try {
    var styleId = "avenzo-android-mobile-style";
    var style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = atob("__CSS__");
    document.documentElement.classList.add("avenzo-android-app");

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

    function isVisible(el) {
      if (!el) return false;
      var computed = window.getComputedStyle(el);
      return computed.display !== "none" &&
        computed.visibility !== "hidden" &&
        el.getClientRects().length > 0;
    }

    function syncMobileState() {
      applyBranding();
      var activeChat = document.querySelector(".dm-chat:not(.dm-mobile-hidden)");
      document.documentElement.classList.toggle(
        "avenzo-dm-chat-active",
        Boolean(activeChat && isVisible(activeChat))
      );
    }

    window.__avenzoHandleBack = function() {
      try {
        var modal = document.querySelector(".modal");
        if (modal && isVisible(modal)) {
          var close = modal.querySelector(
            '.modal-header button[aria-label="Close"], .icon-button[aria-label="Close"], button[aria-label*="Close"]'
          );
          if (close) {
            close.click();
            return "handled";
          }
        }

        var chatBack = document.querySelector(
          ".dm-chat:not(.dm-mobile-hidden) .dm-back"
        );
        if (chatBack && isVisible(chatBack)) {
          chatBack.click();
          return "handled";
        }

        var nav = document.querySelector(".mobile-nav");
        if (nav && isVisible(nav)) {
          var active = nav.querySelector("button.active");
          var home = nav.querySelector("button");
          if (active && home && active !== home) {
            home.click();
            return "handled";
          }
        }

        var path = window.location.pathname;
        if (path.indexOf("/settings/") === 0) {
          window.location.href = "/settings";
          return "handled";
        }
        if (path === "/settings") {
          window.location.href = "/home?screen=profile";
          return "handled";
        }
        if (
          path === "/messages" ||
          path === "/reels" ||
          path.indexOf("/u/") === 0
        ) {
          window.location.href = "/home";
          return "handled";
        }
        if (path !== "/home" && path !== "/") {
          window.location.href = "/home";
          return "handled";
        }
      } catch (e) {}
      return "exit";
    };

    syncMobileState();

    if (!window.__avenzoNativeBrandObserver) {
      window.__avenzoNativeBrandObserver = new MutationObserver(syncMobileState);
      window.__avenzoNativeBrandObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"]
      });
    }
  } catch (e) {}
})();