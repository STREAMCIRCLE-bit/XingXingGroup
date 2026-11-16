function doGet() {
  return HtmlService.createHtmlOutputFromFile('index').addMetaTag('viewport','width=device-width, initial-scale=1').setTitle('บันทึกความผิดพนักงานรายสาขา');
}

function doPost(event) {
  let result;
  try {
    const raw=event.postData.contents;
    if(raw.length>6500000) throw Error('ไฟล์แนบใหญ่เกินกำหนด');
    const data=JSON.parse(raw);
    result={id:submitRecord(data),key:data.key};
  } catch(error) {
    result={error:'ส่งเรื่องไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง'};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function submitRecord(data) {
  const required = {
    'ปัญหาสาขา':['หัวข้อ','ประเภท','วันที่'],
    'ความผิดพนักงาน':['ชื่อพนักงาน','ประเภท','วันที่','รายละเอียด','ผู้รับผิดชอบ'],
    'เพิ่มพนักงาน':[data.fields?.['รายชื่อพนักงาน'] ? 'รายชื่อพนักงาน' : 'ชื่อพนักงาน']
  };
  const invalid = msg => {throw Error(msg)};
  if (!Object.hasOwnProperty.call(required,data.type) || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.key) || typeof data.branch!=='string' || !data.branch.trim() || data.branch.length>100) invalid('กรุณาตรวจสอบประเภทและสาขา');
  const fields=data.fields;
  if (!fields || Object.keys(fields).length>16 || Object.entries(fields).some(([k,v])=>k.length>40 || typeof v!=='string' || v.length>6000)) invalid('ข้อมูลยาวเกินกำหนด');
  for (const label of required[data.type]) if (!fields[label]?.trim()) invalid('กรุณากรอก '+label);
  if (fields['วันที่'] && !/^\d{4}-\d{2}-\d{2}$/.test(fields['วันที่'])) invalid('วันที่ไม่ถูกต้อง');
  if (!Array.isArray(data.images) || data.images.length>5) invalid('แนบรูปได้ไม่เกิน 5 รูป');
  const photos=data.images.map((image,i)=>{
    if (typeof image!=='string' || image.length>1200000 || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(image)) invalid('รูปภาพไม่ถูกต้อง');
    return Utilities.newBlob(Utilities.base64Decode(image.split(',')[1]),'image/jpeg','photo-'+(i+1)+'.jpg');
  });
  const safe=v=>/^[=+@'-]/.test(v)?"'"+v:v;
  const detail=Object.entries(fields).filter(([k,v])=>v).map(([k,v])=>k+' · '+v).join('\n');
  if(detail.length>35000) invalid('ข้อมูลยาวเกินกำหนด');
  const sheet=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getSheetById(0);
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const last=sheet.getLastRow();
    const props=PropertiesService.getScriptProperties();
    let previous=Number(props.getProperty('lastReceipt') || 0);
    if (!Number.isSafeInteger(previous) || previous<0) throw Error('เลขลำดับในระบบไม่ถูกต้อง');
    if(last>1) {
      const keys=sheet.getRange(2,16,last-1,1).getValues();
      const ids=sheet.getRange(2,1,last-1,1).getValues();
      for(let i=0;i<ids.length;i++) {
        const value=String(ids[i][0]);
        if(keys[i][0]===data.key || value==='XX-'+data.key) return value;
        const match=/^XX-(\d+)$/.exec(value);
        if(match) previous=Math.max(previous,Number(match[1]));
      }
    }
    const next=previous+1;
    const id='XX-'+String(next).padStart(6,'0');
    const row=last+1, inserted=[];
    try {
      sheet.appendRow([id,new Date(),safe(data.branch),safe(fields['วันที่']||''),safe(data.type+(fields['ประเภท']?' · '+fields['ประเภท']:'')),safe(detail),'รับเรื่อง',safe(fields['ผู้รับผิดชอบ']||''),'','','','','','','',data.key]);
      photos.forEach((blob,i)=>{
        const image=sheet.insertImage(blob,11+i,row);
        inserted.push(image);
        image.setAltTextTitle(id+' รูป '+(i+1)).setWidth(110).setHeight(85);
      });
      if(photos.length) sheet.setRowHeight(row,92);
      SpreadsheetApp.flush();
      props.setProperty('lastReceipt',String(next));
    } catch(e) {
      inserted.forEach(image=>image.remove());
      if(sheet.getRange(row,1).getValue()===id) sheet.getRange(row,1,1,16).clearContent();
      throw e;
    }
    return id;
  } finally {lock.releaseLock()}
}
