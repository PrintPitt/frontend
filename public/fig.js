/* fig.js — pasang figur isometrik Hans (fig/*.html) di dalam iframe tanpa tombol bawaannya,
   lalu kendalikan dari halaman: FIG.mount(el, 'mesin-fotokopi', {palette:'monad'}).then(api => api.act('Copy!'))
   Nama figur: 'mesin-fotokopi' | 'laminator-a4' | 'printer-inkjet'
   Palet figur: mustard | tomato | mint | cobalt | blush | monad
   Aksi mesin-fotokopi: Angkat tutup · Taruh dokumen · Copy! · Ambil hasil · Isi kertas · Pintu depan · Tarik kertas macet
   Aksi laminator-a4: Nyalakan · Masukkan pouch · ABS (mundur) · Ambil hasil
   Aksi printer-inkjet: Nyalakan · Colok flashdisk · Print! · Buka cover · Ganti tinta · Isi kertas · Ambil hasil */
(function () {
  var CSS =
    'html,body{background:transparent!important;margin:0!important;overflow:hidden!important;height:100%!important}' +
    'body>header,.controls,.mcap,#readout,.idea,.made-with,footer,.actions,#btns,.lgd,#stats,.stats,.vset,.zchip,#toast,.toast{display:none!important}' +
    '.stage{position:fixed!important;inset:0!important;margin:0!important;padding:0!important;width:100%!important;height:100%!important;display:flex!important;align-items:center!important;justify-content:center!important}' +
    '.zwrap{width:100%!important;height:100%!important;margin:0!important;display:flex!important;align-items:center!important;justify-content:center!important}' +
    '#fig{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important}';

  function mount(el, name, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var f = document.createElement('iframe');
      f.src = 'fig/' + name + '.html';
      f.title = name;
      /* interactive:true → pengguna bisa menyeret untuk memutar, ketuk dua kali untuk kembali ke depan,
         dan menekan bagian mesin (tutup, laci, tombol) langsung — persis seperti HTML aslinya.
         touch-action:pan-y di dalam figur menjaga scroll vertikal halaman tetap jalan di HP. */
      var inter = !!opts.interactive;
      if (!inter) { f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; }
      else { f.title = (opts.title || name) + ' — seret untuk memutar, ketuk dua kali untuk kembali'; }
      f.style.cssText = 'border:0;width:100%;height:100%;display:block;background:transparent;pointer-events:' + (inter ? 'auto' : 'none');
      f.addEventListener('load', function () {
        var w = f.contentWindow, d = f.contentDocument;
        var s = d.createElement('style'); s.textContent = CSS; d.head.appendChild(s);
        function btn(label) {
          var bs = d.querySelectorAll('button');
          for (var i = 0; i < bs.length; i++) if (bs[i].textContent.trim().indexOf(label) === 0) return bs[i];
          return null;
        }
        var api = {
          frame: f, win: w, doc: d,
          act: function (label) { var b = btn(label); if (b) b.click(); return !!b; },
          palette: function (p) { var b = d.querySelector('.sw[title="' + p + '"]'); if (b) b.click(); return !!b; },
          spin: function (on) { var b = d.getElementById(on ? 'vspin' : 'vreset'); if (b) b.click(); },
          reset: function () { var b = d.getElementById('vreset'); if (b) b.click(); },
          /* ganti sudut pandang dengan easing bawaan figur (yaw, pitch dalam derajat; ms durasi) */
          camTo: function (yaw, pitch, ms) { try { var u = w.ui || (w.mountFigure && w.__ui); if (u && u.camTo) u.camTo(yaw, pitch, ms); } catch (e) {} },
          actions: function () { return Array.prototype.map.call(d.querySelectorAll('button.act'), function (b) { return b.textContent.trim(); }); }
        };
        setTimeout(function () {
          try { w.dispatchEvent(new w.Event('resize')); } catch (e) {}
          if (opts.palette) api.palette(opts.palette);
          if (opts.spin) api.spin(true);
          resolve(api);
        }, 60);
      });
      el.appendChild(f);
    });
  }
  window.FIG = { mount: mount };
})();
