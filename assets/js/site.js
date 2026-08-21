/**
 * Openline — page behaviour.
 *
 * Three small pieces: the theme toggle (the token block in tokens.css does
 * the actual work), the mobile nav, and the IMEI field, which validates
 * locally with a Luhn check so nothing is sent anywhere on keystroke.
 */
(function () {
  'use strict';

  /* ---- theme ------------------------------------------------------- */

  var root = document.documentElement;

  function systemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function storedTheme() {
    try {
      return localStorage.getItem('openline-theme');
    } catch (err) {
      return null;
    }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.setAttribute(
        'aria-label',
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      );
    });
  }

  applyTheme(storedTheme() || systemTheme());

  document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem('openline-theme', next);
      } catch (err) {
        /* private mode — the choice just does not persist */
      }
    });
  });

  /* ---- mobile nav -------------------------------------------------- */

  var navButton = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('site-nav');

  function setNav(open) {
    if (!nav || !navButton) return;
    nav.hidden = !open;
    navButton.setAttribute('aria-expanded', String(open));
  }

  function isCompact() {
    return window.matchMedia('(max-width: 940px)').matches;
  }

  if (navButton && nav) {
    setNav(!isCompact());
    navButton.addEventListener('click', function () {
      setNav(nav.hidden);
    });
    window.addEventListener('resize', function () {
      setNav(!isCompact());
    });
    nav.addEventListener('click', function (event) {
      if (event.target.tagName === 'A' && isCompact()) setNav(false);
    });
  }

  /* ---- IMEI field -------------------------------------------------- */

  var imei = document.querySelector('[data-imei-input]');
  var note = document.querySelector('[data-imei-note]');
  var form = document.querySelector('[data-imei-form]');

  /** Standard Luhn check — an IMEI is 15 digits with a Luhn check digit. */
  function luhnValid(digits) {
    var sum = 0;
    var double = false;
    for (var i = digits.length - 1; i >= 0; i -= 1) {
      var value = digits.charCodeAt(i) - 48;
      if (double) {
        value *= 2;
        if (value > 9) value -= 9;
      }
      sum += value;
      double = !double;
    }
    return sum % 10 === 0;
  }

  var ICON_INFO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';
  var ICON_OK =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6.5L9.5 17 4 11.6"/></svg>';
  var ICON_NO =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

  function setNote(state, text, icon) {
    if (!note) return;
    note.dataset.state = state;
    note.innerHTML = icon + '<span>' + text + '</span>';
  }

  function groupDigits(digits) {
    return digits
      .replace(/(.{2})(.{0,6})(.{0,6})(.{0,1})/, function (_, a, b, c, d) {
        return [a, b, c, d].filter(Boolean).join(' ');
      })
      .trim();
  }

  if (imei) {
    imei.addEventListener('input', function () {
      var caretAtEnd = imei.selectionStart === imei.value.length;
      var digits = imei.value.replace(/\D/g, '').slice(0, 15);
      imei.value = groupDigits(digits);
      if (caretAtEnd) imei.setSelectionRange(imei.value.length, imei.value.length);

      if (digits.length === 0) {
        setNote('idle', 'Dial *#06# on the device to display its IMEI.', ICON_INFO);
      } else if (digits.length < 15) {
        setNote('idle', digits.length + ' of 15 digits.', ICON_INFO);
      } else if (luhnValid(digits)) {
        setNote('valid', 'Checksum looks right — ready to look up.', ICON_OK);
      } else {
        setNote('invalid', 'Checksum does not match. Re-read the last digit.', ICON_NO);
      }
    });
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var digits = imei ? imei.value.replace(/\D/g, '') : '';
      if (digits.length !== 15 || !luhnValid(digits)) {
        setNote('invalid', 'Enter a full 15-digit IMEI before continuing.', ICON_NO);
        if (imei) imei.focus();
        return;
      }
      setNote(
        'valid',
        'Validated locally. Connect a lookup provider to return a report.',
        ICON_OK
      );
    });
  }

  /* ---- current year ------------------------------------------------ */

  document.querySelectorAll('[data-year]').forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });
})();
