function doGet() {
  return HtmlService.createHtmlOutput(`
<!doctype html><html lang="th"><meta charset="utf-8"><title>แจ้งเหตุการณ์สาขา</title>
<style>*{box-sizing:border-box}body{margin:0;background:#fbf6ee;color:#29241f;font:17px/1.6 system-ui,sans-serif}main{max-width:560px;margin:32px auto;padding:24px}header{color:#9a3428;font-weight:700}h1{font-size:32px;margin:8px 0}label{display:block;margin:20px 0 0;font-weight:600}input,select,textarea,button{font:inherit;width:100%;padding:12px;border:1px solid #aa9f94;border-radius:8px;background:white;color:inherit}textarea{resize:vertical}button{background:#933725;color:white;border:0;font-weight:bold;margin-top:20px}button:disabled{opacity:.6}output{display:block;margin-top:12px}</style>
<main><header>XingXing Group</header><h1>แจ้งเหตุการณ์สาขา</h1><form id="report"><label>สาขา<input name="branch" required maxlength="100"></label><label>วันที่เกิดเหตุ<input name="day" type="date" required></label><label>ประเภทเหตุการณ์<select name="kind" required><option value="">เลือกประเภท</option><option>บริการลูกค้า</option><option>อาหารและครัว</option><option>ออเดอร์และการชำระเงิน</option><option>อุปกรณ์และสถานที่</option><option>การปฏิบัติงาน</option><option>อื่น ๆ</option></select></label><label>รายละเอียดเหตุการณ์<textarea name="detail" rows="4" required maxlength="2500"></textarea></label><button>ส่งเรื่องให้ทีมกลาง</button></form><output id="result" role="status"></output></main>
<script>const form=document.querySelector('form'),out=document.querySelector('output'),button=form.querySelector('button');let key=crypto.randomUUID();form.onsubmit=function(event){event.preventDefault();button.disabled=true;out.textContent='กำลังส่งเรื่อง…';const data=Object.fromEntries(new FormData(form));data.key=key;google.script.run.withSuccessHandler(function(id){out.textContent='ทีมกลางได้รับเรื่องแล้ว เลขที่ '+id;form.reset();key=crypto.randomUUID();button.disabled=false}).withFailureHandler(function(){out.textContent='ยังยืนยันการรับเรื่องไม่ได้ กรุณาตรวจข้อมูลแล้วส่งอีกครั้ง';button.disabled=false}).submitIncident(data)};</script></html>`).addMetaTag('viewport','width=device-width, initial-scale=1').setTitle('แจ้งเหตุการณ์สาขา · XingXing');
}

function submitIncident(data) {
  const key = String(data.key || '');
  const branch = String(data.branch || '').trim();
  const detail = String(data.detail || '').trim();
  const day = String(data.day || '');
  const kinds = ['บริการลูกค้า','อาหารและครัว','ออเดอร์และการชำระเงิน','อุปกรณ์และสถานที่','การปฏิบัติงาน','อื่น ๆ'];
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key) || !branch || branch.length > 100 || !detail || detail.length > 2500 || !kinds.includes(data.kind) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error('ข้อมูลไม่ครบ');
  if (new Date(day).toISOString().slice(0,10) !== day) throw Error('วันที่ไม่ถูกต้อง');
  const id = 'XX-' + key;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getSheetById(0);
    const last = sheet.getLastRow();
    if (last > 1 && sheet.getRange(2,1,last-1,1).createTextFinder(id).matchEntireCell(true).findNext()) return id;
    const safe = value => (/^[=+@'-]/.test(value) ? "'" + value : value);
    sheet.appendRow([id,new Date(),safe(branch),day,data.kind,safe(detail),'รับเรื่อง']);
    SpreadsheetApp.flush();
    return id;
  } finally { lock.releaseLock(); }
}
