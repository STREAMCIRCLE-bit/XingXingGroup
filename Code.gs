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

function detailRows_(type,id,time,branch,f) {
  const branches = {"วงเวียนใหญ่":["Mala","Shabu"],"พระราม 3":["Mala","Shabu"],"พุทธมณฑลสาย 2":["Mala","Shabu"],"บางบอน 5":["Mala","Shabu"],"บรมสิรินธร":["Mala","Shabu"],"มหานคร":["Express","Go (ไม่มี Delivery)"],"ติวานนท์ 28":["Express","Delivery Only"],"บางนา":["Express","Go"],"ทาวน์อินทาวน์":["Express","Go"],"สีลม":["Express","Go*"],"สระบุรี":["Express","Go"],"ลาดพร้าว 12":["Express","Delivery Only"],"นวมินทร์":["Express","ตักชั่ง"],"วิภาวดี":["Express","Delivery Only"],"บรรทัดทอง":["Express","Go"],"ลาดพร้าว 71":["Express","ตักชั่ง"],"เกษตร":["Express","ตักชั่ง"],"ราชพฤกษ์":["Express","Go"],"The Nine พระราม 9":["Express","Delivery Only*"],"บางแค":["Express","ตักชั่ง"],"เพชรเกษม":["Express","Delivery Only"],"บางใหญ่":["Express","Delivery Only"],"ลาดกระบัง":["Express","Go"],"สนามเป้า":["Express","ตักชั่ง"],"สาธุ 19":["Express","ตักชั่ง"],"ติวานนท์ T10":["Express","ตักชั่ง"],"คลอง 3":["Express","ตักชั่ง"],"ปู่เจ้า":["Express","ตักชั่ง"],"กิ่งแก้ว":["Express","ตักชั่ง"],"รัตนธิเบศร์":["Express","ตักชั่ง"],"อ้อมใหญ่":["Express","ตักชั่ง"],"สามเสน":["Express","Go"],"อุดมสุข 45":["Express","ตักชั่ง"],"วชิรธรรม":["Express","ตักชั่ง"],"ตำหรุ บางพลี":["Express","ตักชั่ง"],"บางพลัด / Lotus จรัญ":["Express","ตักชั่ง"],"วัดลาดปลาดุก":["Express","ตักชั่ง"],"หนามแดง":["Express","ตักชั่ง"],"จรัญ":["Express","ตักชั่ง"],"ห้วยขวาง":["Express","ตักชั่ง"],"เยาวราช":["Express","ตักชั่ง"],"วิภา":["Express","ตักชั่ง"]};
  const prefix = [id,time,branches[branch]?.[0] || '',branch,branches[branch]?.[1] || ''];
  const row = values => prefix.concat(values.map(v=>v ?? ''));
  const date=f['วันที่'], due=f['กำหนดติดตาม'], person=f['ชื่อพนักงาน'];
  if(type==='ปัญหาสาขา') {
    const priority=['','ต่ำ','ปานกลาง','สูง','ด่วนมาก'][f['ความเร่งด่วน']] || f['ความเร่งด่วน'];
    return {tab:type,rows:[row([date,f['หัวข้อ'],f['ประเภท'],priority,f['รายละเอียด'],f['ผลกระทบ'],f['ผู้รับผิดชอบ'],due])]};
  }
  if(type==='ความผิดพนักงาน') {
    const severity=['','เล็กน้อย','ปานกลาง','ร้ายแรง'][f['ระดับ']] || f['ระดับ'];
    return {tab:type,rows:[row([date,person,f['ตำแหน่ง'],f['ประเภท'],severity,f['รายละเอียด'],f['ผู้รับผิดชอบ'],due,f['การลงโทษ']])]};
  }
  let people;
  if(f['รายชื่อพนักงาน']){
    people=f['รายชื่อพนักงาน'].split(/\r?\n/).filter(line=>line.trim()).map(line=>{
      const parts=line.split(/[\t,]/).map(value=>value.trim());
      if(!parts[0] || parts.length>4) throw Error('กรุณาระบุพนักงานบรรทัดละคน ไม่เกินสี่ช่อง');
      const [name,nick,position,phone]=parts;
      return row([name,nick,position,phone,'','','ทำงานอยู่','']);
    });
  }else{
    people=[row([person,f['ชื่อเล่น'],f['ตำแหน่ง'],f['เบอร์โทร'],f['รหัสพนักงาน'],f['วันเริ่มงาน'],f['สถานะ'] || 'ทำงานอยู่',f['หมายเหตุ']])];
  }
  return {tab:'ทะเบียนพนักงาน',rows:people};
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
    const time=new Date();
    const detailData=detailRows_(data.type,id,time,data.branch,fields);
    const detailSheet=sheet.getParent().getSheetByName(detailData.tab);
    const receiptCells=detailSheet.getRange(1,1,detailSheet.getLastRow(),1).getValues();
    let detailRow=receiptCells.length+1;
    while(detailRow>1 && !receiptCells[detailRow-2][0]) detailRow--;
    const detailRange=detailSheet.getRange(detailRow,1,detailData.rows.length,detailData.rows[0].length);
    const row=last+1, inserted=[];
    try {
      sheet.appendRow([id,time,safe(data.branch),safe(fields['วันที่']||''),safe(data.type+(fields['ประเภท']?' · '+fields['ประเภท']:'')),safe(detail),'รับเรื่อง',safe(fields['ผู้รับผิดชอบ']||''),'','','','','','','',data.key]);
      detailRange.setValues(detailData.rows.map(values=>values.map(v=>typeof v==='string'?safe(v):v)));
      if(data.type!=='เพิ่มพนักงาน') {
        detailSheet.getRange(detailRow,detailData.rows[0].length+1).setValue(photos.length);
      }
      photos.forEach((blob,i)=>{
        const image=sheet.insertImage(blob,11+i,row);
        inserted.push(image);
        image.setAltTextTitle(id+' รูป '+(i+1)).setWidth(110).setHeight(85);
      });
      if(photos.length) sheet.setRowHeight(row,92);
      SpreadsheetApp.flush();
      props.setProperty('lastReceipt',String(next));
    } catch(e) {
      if(detailSheet.getRange(detailRow,1).getValue()===id) detailSheet.getRange(detailRow,1,detailData.rows.length,detailData.rows[0].length+1).clearContent();
      inserted.forEach(image=>image.remove());
      if(sheet.getRange(row,1).getValue()===id) sheet.getRange(row,1,1,16).clearContent();
      throw e;
    }
    return id;
  } finally {lock.releaseLock()}
}
