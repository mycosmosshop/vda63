/* Bulut raporları yerele iniyor mu?   node test_bulut_indirme.js
 *
 * Kırılan hâl: pullAllReports() her raporu safeSet ile yazıyordu;
 * localStorage kotası dolunca safeSet SESSİZCE false dönüyor, rapor
 * inmemiş sayılıyor ve ana ekranda "Yalnızca bulutta" olarak kalıyordu.
 * Kullanıcı hiçbir uyarı görmüyor, senkron çalışıyor sanıyordu.
 *
 * Kaynak dosyadan okunur; yardımcı değil ÜRETİLEN kod ölçülür.
 */
const fs = require('fs');
const HTML = fs.readFileSync(__dirname + '/vda63.html', 'utf8');
const JS = HTML.slice(HTML.indexOf('<script>') + 8, HTML.lastIndexOf('</script>'));

let hata = 0;
const ol = (ad, k, ek) => {
    if (k) console.log('  ✓ ' + ad + (ek ? '  ' + ek : ''));
    else { console.log('  ✗ ' + ad + (ek ? ' — ' + ek : '')); hata++; }
};

/* pullAllReports gövdesini kaynaktan çıkar ve sahte ortamda çalıştır */
const bas = JS.indexOf('async function pullAllReports()');
const govde = JS.slice(bas, JS.indexOf('\n}', JS.indexOf('return n;', bas)) + 2);

/* kota: kaç bayt sığacağını sınırlayan sahte localStorage */
function ortam(kotaBayt, raporlar) {
    const depo = {};
    let doluluk = 0;
    const toastlar = [];
    const ls = {
        getItem: (k) => (k in depo ? depo[k] : null),
        setItem: (k, v) => {
            const eski = depo[k] ? depo[k].length : 0;
            if (doluluk - eski + v.length > kotaBayt) {
                const e = new Error('QuotaExceededError');
                e.name = 'QuotaExceededError';
                throw e;
            }
            doluluk += v.length - eski;
            depo[k] = String(v);
        },
        removeItem: (k) => { if (depo[k]) { doluluk -= depo[k].length; delete depo[k]; } },
        get length() { return Object.keys(depo).length; },
        key: (i) => Object.keys(depo)[i],
    };
    const g = {
        localStorage: ls,
        LS_LIST: 'vda63_list',
        _cloudIds: new Set(),
        console: { warn() {}, log() {} },
        toast: (m, t) => toastlar.push(String(m)),
        migrate: (x) => x,
        leanReport: (x) => x,
        safeSet: (k, v) => { try { ls.setItem(k, v); return true; } catch (e) { return false; } },
        // compactStorage: gerçek kodun yaptığı gibi ağır alanı siler
        compactStorage: () => {
            Object.keys(depo).forEach((k) => {
                if (!k.startsWith('vda63_r_')) return;
                try {
                    const o = JSON.parse(depo[k]);
                    if (o && o.elements) {
                        o.elements.forEach((el) => (el.subs || []).forEach(
                            (s) => (s.qs || []).forEach((q) => { delete q.r; })));
                        ls.setItem(k, JSON.stringify(o));
                    }
                } catch (e) {}
            });
        },
        sb: {
            from: () => ({
                select: () => ({
                    eq: () => Promise.resolve({ data: [] }),
                    order: () => Promise.resolve({ data: raporlar, error: null }),
                }),
            }),
        },
        JSON, Object, Set, Promise, String, Error, Date, Array,
    };
    const fn = new Function('__k', 'with(__k){' + govde + '\nreturn pullAllReports;}')(
        new Proxy(g, { has: () => true, get: (o, p) => (p in o ? o[p] : undefined),
                       set: (o, p, v) => { o[p] = v; return true; } }));
    return { fn, depo, toastlar, doluluk: () => doluluk };
}

/* Ağır rapor: kotayı gerçekten zorlasın */
const rapor = (id, kb) => ({
    id, name: 'YENİ İTİMAT ' + id, type: 'surec',
    updated_at: '2026-09-11T08:00:00Z',
    // updatedAt raporun KENDI icinde de durur; indirme "yerel surum daha
    // yeni mi" karsilastirmasini ondan yapiyor.
    data: { updatedAt: '2026-09-11T08:00:00Z',
            elements: [{ subs: [{ qs: [{ r: 'x'.repeat(kb * 1024) }] }] }] },
});

(async function () {
    console.log('BULUT → YEREL İNDİRME');
    console.log('='.repeat(58));

    /* 1) Bol kota: hepsi inmeli */
    {
        const o = ortam(5 * 1024 * 1024, [rapor('a', 5), rapor('b', 5), rapor('c', 5)]);
        const n = await o.fn();
        ol('kota yeterliyken tüm raporlar iniyor (%d/3)'.replace('%d', n), n === 3);
        const liste = JSON.parse(o.depo['vda63_list'] || '{}');
        ol('liste güncelleniyor (ana ekranda görünür)',
            Object.keys(liste).length === 3, Object.keys(liste).length + ' kayıt');
    }

    /* 2) Dar kota: compactStorage ile yer açılıp yine inmeli */
    {
        // İki rapor sığar, üçüncüsü ancak sıkıştırmadan sonra
        const o = ortam(26 * 1024, [rapor('a', 10), rapor('b', 10), rapor('c', 10)]);
        const n = await o.fn();
        ol('kota darken sıkıştırma devreye giriyor (%d/3)'.replace('%d', n),
            n === 3, 'compactStorage çağrılmıyorsa 2 kalır');
    }

    /* 3) Hiç sığmıyorsa: SESSİZ kalmamalı */
    {
        const o = ortam(1024, [rapor('a', 40), rapor('b', 40)]);
        const n = await o.fn();
        ol('sığmayan rapor sessizce yutulmuyor (uyarı çıkıyor)',
            o.toastlar.some((m) => /sığmadı/i.test(m)), o.toastlar[0] || '(uyarı yok)');
        ol('sığmayanlar listeye YAZILMIYOR (yanlış "indi" görüntüsü olmasın)',
            Object.keys(JSON.parse(o.depo['vda63_list'] || '{}')).length === 0
            && n === 0, n + ' rapor sayıldı');
    }

    /* 4) Yerelde güncel kopya varsa tekrar indirilmemeli */
    {
        const o = ortam(5 * 1024 * 1024, [rapor('a', 5)]);
        await o.fn();
        const ilk = o.doluluk();
        const n2 = await o.fn();
        ol('güncel rapor ikinci kez indirilmiyor', n2 === 0, n2 + ' rapor');
        ol('depo şişmiyor', o.doluluk() === ilk);
    }

    console.log('='.repeat(58));
    console.log(hata ? hata + ' HATA' : 'TÜM KONTROLLER GEÇTİ');
    process.exit(hata ? 1 : 0);
})();
