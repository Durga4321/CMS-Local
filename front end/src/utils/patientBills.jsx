export const billValue = (row, ...keys) => keys.map(key => key.split('.').reduce((value, part) => value?.[part], row)).find(value => value !== undefined && value !== null && value !== '') ?? '';
export const patientBillType = bill => {
 const raw=String(billValue(bill,'invoiceType','InvoiceType','billingType','BillingType','serviceType','ServiceType','type') || bill.__billType || '').toLowerCase();
 if(raw.includes('pharm') || raw.includes('medicine')) return 'pharmacy';
 if(raw.includes('lab') || raw.includes('diagnos') || raw.includes('test')) return 'lab';
 return 'op';
};
export const parsePatientBills = payload => {
 if(Array.isArray(payload)) return payload;
 if(!payload || typeof payload !== 'object') return null;
 for(const key of ['bills','billings','billing','invoices','items','records','results','data','result']) {
  if(payload[key] !== undefined) { const rows=parsePatientBills(payload[key]); if(rows) return rows; }
 }
 return null;
};
export const patientBillMatches = (bill, patient, history = []) => {
 const patientId = billValue(bill, 'patientId','PatientId','patient.id','patient.Id','patient.patientId');
 if(patientId !== '') return String(patientId) === String(patient.id);
 const code = billValue(bill,'patientCode','PatientCode');
 if(code !== '') return Boolean(patient.patientCode) && String(code) === String(patient.patientCode);
 const appointmentId = billValue(bill,'appointmentId','AppointmentId','appointment.id');
 return appointmentId !== '' && history.some(visit => String(visit.appointmentId) === String(appointmentId));
};
export const loadPatientBills = async ({ patient, history = [], request }) => {
 const sources = [['Billing',''],['Billing/op','OP'],['Billing/lab','Lab'],['Billing/pharmacy','Pharmacy']];
 const results = await Promise.allSettled(sources.map(async ([path, type]) => {
  const rows=[];
  for(let page=1;;page++) {
   const query=new URLSearchParams({patientId:String(patient.id),page:String(page),pageNumber:String(page),pageSize:'10000',includeAll:'true'});
   const payload=await request(path+'?'+query);
   const batch=parsePatientBills(payload);
   if(!batch) throw Error('Unexpected billing response');
   rows.push(...batch.map(bill => ({...bill, __billType:type})));
   const totalPages=Number(payload.totalPages || payload.pagination?.totalPages || payload.data?.totalPages || payload.meta?.totalPages || 1);
   if(page >= totalPages || !batch.length) break;
  }
  return rows;
 }));
 const lookup=new Map();
 for(const result of results) if(result.status === 'fulfilled') for(const bill of result.value) {
  if(!patientBillMatches(bill,patient,history)) continue;
  const identity=billValue(bill,'billingId','BillingId','billId','BillId','id','Id');
  const invoice=billValue(bill,'invoiceNo','InvoiceNo','invoiceNumber','InvoiceNumber','billNumber','BillNumber');
  const key=patientBillType(bill)+':' + (identity !== '' ? 'id:'+identity : invoice !== '' ? 'invoice:'+invoice : JSON.stringify(bill));
  if(!lookup.has(key)) lookup.set(key,bill);
  else lookup.set(key,{...lookup.get(key),...bill});
 }
 return { bills:[...lookup.values()].sort((a,b) => String(billValue(b,'createdAt','CreatedAt','billDate','invoiceDate')).localeCompare(String(billValue(a,'createdAt','CreatedAt','billDate','invoiceDate')))), incomplete: results.some(result => result.status === 'rejected') };
};
