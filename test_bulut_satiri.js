/* "Yalnızca bulutta" satırı ne zaman çiziliyor?   node test_bulut_satiri.js
 *
 * Kırılan hâl: render() her ana ekran çiziminde renderHomeCloud() çağırıyor.
 * Sayfa açılışında bu, pullAllReports() daha BİTMEDEN çalışıyordu: bulut
 * listesi geliyor, kayıtlar yerelde henüz yok, satır "Yalnızca bulutta"
 * diye çıkıyor, indirme bitince kayboluyordu.
 *
 * Kaynak dosyadan okunur; üretilen kod ölçülür.
 */
const fs = require('fs');
const HTML = fs.readFileSync(__dirname + '/vda63.html', 'utf8');
const JS = HTML.slice(HTML.indexOf('<script>') + 8, HTML.lastIndexOf('</script>'));

let hata = 0;
const ol = (ad, k, ek) => {
    if (k) console.log('  OK  ' + ad);
    else { console.log('HATA ' + ad + (ek ? ' -> ' + ek : '')); hata++; }
};

const govde = (imza) => {
    const b = JS.indexOf(imza);
    if (b < 0) return '';
    return JS.slice(b, JS.indexOf('\n}', JS.indexOf('\n', b)) + 2);
};

console.log('BULUT SATIRI — YARIŞ DURUMU');
console.log('='.repeat(56));

const rhc = govde('async function renderHomeCloud()');
ol('renderHomeCloud bulundu', !!rhc);
ol('indirme bitmeden çizmiyor (_pullBitti guard)',
   /_pullBitti\s*\)?\s*return/.test(rhc) || /if\(!_pullBitti\)\s*return/.test(rhc),
   rhc.slice(0, 160));
ol('guard, cloudList çağrısından ÖNCE',
   rhc.indexOf('_pullBitti') < rhc.indexOf('cloudList'),
   '_pullBitti@' + rhc.indexOf('_pullBitti') + ' cloudList@' + rhc.indexOf('cloudList'));

const pull = govde('async function pullAllReports()');
ol('pullAllReports bitince bayrak set ediliyor',
   /_pullBitti\s*=\s*true/.test(pull));
ol('bayrak return’den ÖNCE',
   pull.indexOf('_pullBitti=true') < pull.lastIndexOf('return n;'),
   'bayrak@' + pull.indexOf('_pullBitti=true'));
ol('hata dalında da set ediliyor (catch sonrası)',
   pull.indexOf('_pullBitti=true') > pull.indexOf('catch(e)'));

const ps = govde('async function pullShared()');
ol('veri gelmese de bir kez çiziliyor',
   /else\s+renderHomeCloud\(\)/.test(ps), ps.slice(-200));

ol('bayrak başlangıçta kapalı', /let _pullBitti\s*=\s*false/.test(JS));

console.log('');
console.log('SİLİNEN KAYIT GERİ GELMİYOR (tombstone)');
console.log('-'.repeat(56));
/* Kırılan hâl: silinen rapor id'leri tombstone'da tutuluyor ama ona
 * YALNIZ pullAllReports bakıyordu. autoPushReports silinen kaydı buluta
 * GERİ YÜKLÜYOR, renderHomeCloud da onu "Yalnızca bulutta" gösteriyordu:
 * kayıt bir geliyor bir kayboluyordu. */
ol('tombstone modül düzeyinde paylaşılıyor', /let _silinmis\s*=\s*\{\}/.test(JS));
ol('pullAllReports tombstone’u yazıyor',
   /_silinmis\s*=\s*del\s*;/.test(govde('async function pullAllReports()')));

const push = govde('async function autoPushReports()');
ol('autoPushReports silinmiş kaydı buluta geri yüklemiyor',
   /_silinmis\[i\.id\]/.test(push), push.slice(0, 120));
ol('autoPushReports kontrolü upsert’ten ÖNCE',
   push.indexOf('_silinmis[i.id]') < push.indexOf('upsert'),
   'guard@' + push.indexOf('_silinmis[i.id]') + ' upsert@' + push.indexOf('upsert'));
ol('silinmiş kayıt bu tarayıcıdan da temizleniyor',
   /_silinmis\[i\.id\][\s\S]{0,200}removeItem/.test(push));

const rhc2 = govde('async function renderHomeCloud()');
ol('ana ekran silinmiş kaydı "Yalnızca bulutta" göstermiyor',
   /!_silinmis\[c\.id\]/.test(rhc2), rhc2.slice(-200));

const sil = govde('function deleteReport(id)');
ol('silme anında tombstone’a giriyor (senkronu beklemeden)',
   /_silinmis\[id\]\s*=/.test(sil));
ol('tombstone kaydı delete çağrısından ÖNCE',
   sil.indexOf('_silinmis[id]') < sil.indexOf(".delete()"),
   sil.slice(0, 150));

console.log('='.repeat(56));
console.log(hata ? hata + ' HATA' : 'TÜM KONTROLLER GEÇTİ');
process.exit(hata ? 1 : 0);
