import { API_ENDPOINTS, apiUrl } from "../config/api";
import { getStoredHospitalId } from "./branchApi.jsx";
export const CMS_MODULES=["Dashboard","Branches","Doctors","Receptionists","Nurses","Lab Technicians","Lab Files","Patients","Appointments","Schedule Settings","Roles & Permissions","User Management","Reports","Settings"].map((key)=>({key,label:key==="Branches"?"Branches / Clinics":key,monthlyPrice:{Dashboard:0,Branches:400,Doctors:700,Receptionists:450,Nurses:450,"Lab Technicians":500,"Lab Files":350,Patients:650,Appointments:600,"Schedule Settings":300,"Roles & Permissions":300,"User Management":450,Reports:800,Settings:250}[key]||0}));
export const LAB_MODULE_KEYS=["Lab Technicians","Lab Files"];
export const NON_LAB_MODULE_KEYS=CMS_MODULES.map((m)=>m.key).filter((key)=>!LAB_MODULE_KEYS.includes(key));
export const SUBSCRIPTION_PLANS=[];
export const SUBSCRIPTIONS_STORAGE_KEY="cms_admin_subscriptions";
export const SUBSCRIPTION_TX_STORAGE_KEY="cms_subscription_transactions";
export const SUBSCRIPTION_PLANS_STORAGE_KEY="cms_subscription_plans";
export const LANDING_SUBSCRIPTION_REQUESTS_KEY="cms_landing_subscription_requests";
const todayIso=()=>new Date().toISOString().slice(0,10);
const getAuthToken = () => {
  const isSuperAdmin = typeof window !== "undefined" && window.location?.pathname?.startsWith("/superadmin");
  const keys = isSuperAdmin ? ["superAdminToken", "adminToken", "token"] : ["adminToken", "token", "superAdminToken"];
  for (const storage of [sessionStorage, localStorage]) {
    for (const key of keys) {
      const token = storage.getItem(key);
      if (token) return token;
    }
  }
  return "";
};
const requestJson=async(path,options={})=>{const{body,headers,skipAuth=false,...rest}=options;const token=skipAuth?"":getAuthToken();const response=await fetch(apiUrl(path),{cache:"no-store",...rest,headers:{"Content-Type":"application/json","ngrok-skip-browser-warning":"true",...(token?{Authorization:"Bearer "+token}:{}),...headers},body:body!==undefined?JSON.stringify(body):undefined});const text=await response.text();let payload=null;if(text){try{payload=JSON.parse(text)}catch{payload=text}}if(!response.ok){const detail=payload?.message||payload?.title||payload?.error;const error=new Error(detail|| (response.status===403?"Access denied for /api/"+path+" (403). Sign in with the required account role.":"Request to /api/"+path+" failed with status "+response.status));error.status=response.status;error.endpoint=path;error.payload=payload;throw error;}return payload};
const parseList=(value)=>Array.isArray(value)?value:Array.isArray(value?.data)?value.data:Array.isArray(value?.items)?value.items:Array.isArray(value?.results)?value.results:Array.isArray(value?.records)?value.records:Array.isArray(value?.subscriptions)?value.subscriptions:Array.isArray(value?.subscriptionRequests)?value.subscriptionRequests:Array.isArray(value?.requests)?value.requests:Array.isArray(value?.plans)?value.plans:Array.isArray(value?.methods)?value.methods:Array.isArray(value?.paymentMethods)?value.paymentMethods:Array.isArray(value?.renewals)?value.renewals:Array.isArray(value?.renewalPurchases)?value.renewalPurchases:Array.isArray(value?.pendingPayments)?value.pendingPayments:Array.isArray(value?.pendingPurchases)?value.pendingPurchases:Array.isArray(value?.payments)?value.payments:Array.isArray(value?.purchases)?value.purchases:Array.isArray(value?.history)?value.history:[];
export const addMonths=(dateValue,months)=>{const date=new Date((dateValue||todayIso())+"T00:00:00");date.setMonth(date.getMonth()+Number(months||1));return date.toISOString().slice(0,10)};
export const readStoredJson=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key)||"null");return value==null?fallback:value}catch{return fallback}};
export const writeStoredJson=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
export const getModulePrice=(moduleKey)=>CMS_MODULES.find((m)=>m.key===moduleKey)?.monthlyPrice||0;
export const isLabModule=(moduleKey="")=>LAB_MODULE_KEYS.some((key)=>String(key).toLowerCase()===String(moduleKey||"").toLowerCase());
export const sanitizeModulesForLabAccess=(modules=[],includesLab=true)=>{const set=new Set((Array.isArray(modules)?modules:[]).filter(Boolean));const source=set.size?Array.from(set):CMS_MODULES.map((m)=>m.key);return source.filter((key)=>includesLab||!isLabModule(key))};
export const BILLING_CYCLES = [{ months: 1, label: "Monthly" }, { months: 3, label: "3 Months" }, { months: 6, label: "6 Months" }, { months: 12, label: "Yearly" }];
export const SUBSCRIPTION_PLAN_TYPES = ["Basic", "Super", "Premium"];
export const getBillingCycle = (months) => BILLING_CYCLES.find((cycle) => cycle.months === Number(months))?.label || "-";
const unwrap = (value) => value?.data ?? value;
const asBoolean = (value) => value === true || value === 1 || String(value).toLowerCase() === "true";
const dateOnly = (value) => value ? String(value).slice(0, 10) : "";
const optionalNumber = (value) => value == null || value === "" ? null : Number(value);

export const normalizeSubscriptionPlan = (plan = {}) => {
  const id = plan.id ?? plan.subscriptionPlanId ?? plan.planId ?? plan.SubscriptionPlanId ?? plan.Id ?? "";
  const durationMonths = Number(plan.durationMonths ?? plan.DurationMonths ?? plan.months ?? 1);
  const name = plan.name ?? plan.Name ?? "";
  const labAccess = plan.includesLab ?? plan.IncludesLab ?? plan.labIncluded ?? plan.hasLab;
  const pharmacyAccess = plan.includesPharmacy ?? plan.IncludesPharmacy ?? plan.pharmacyIncluded ?? plan.hasPharmacy;
  const cmsAccess = plan.includesCms ?? plan.IncludesCms ?? plan.cmsIncluded ?? plan.hasCms;
  const namedLabAccess = /\bwithout\s+lab\b/i.test(name)
    ? false
    : /\bwith\s+lab\b/i.test(name)
      ? true
      : null;
  const namedPharmacyAccess = /\bwithout\s+pharmacy\b/i.test(name)
    ? false
    : /\bwith\s+pharmacy\b/i.test(name)
      ? true
      : null;
  const includesLab = labAccess == null
    ? namedLabAccess ?? false
    : asBoolean(labAccess);
  const includesPharmacy = pharmacyAccess == null
    ? namedPharmacyAccess ?? false
    : asBoolean(pharmacyAccess);
  const price = Number(plan.price ?? plan.Price ?? plan.amount ?? plan.basePrice ?? 0);
  const explicitType = plan.planType ?? plan.PlanType ?? plan.tier ?? plan.Tier;
  const planType = SUBSCRIPTION_PLAN_TYPES.find((type) => type.toLowerCase() === String(explicitType || name).trim().split(/[\s-]/)[0]?.toLowerCase()) || "Basic";
  const planTypeKnown = SUBSCRIPTION_PLAN_TYPES.some((type) => type.toLowerCase() === String(explicitType || name).trim().split(/[\s-]/)[0]?.toLowerCase());
  return {
    id, subscriptionPlanId: id, name, planType, planTypeKnown,
    durationMonths, includesCms: cmsAccess == null ? true : asBoolean(cmsAccess),
    includesLab, includesPharmacy, price, basePrice: price,
    isActive: asBoolean(plan.isActive ?? plan.IsActive ?? true),
    billingCycle: plan.billingCycle ?? plan.BillingCycle ?? getBillingCycle(durationMonths),
    modules: sanitizeModulesForLabAccess(CMS_MODULES.map((module) => module.key), includesLab),
    raw: plan,
  };
};
export const readPurchasedEntitlements = (record = {}, plan = {}) => {
  const flags = {};
  for (const key of ["includesCms", "includesLab", "includesPharmacy"]) {
    const pascal = key[0].toUpperCase() + key.slice(1);
    const value = record[key] ?? record[pascal] ?? plan[key] ?? plan[pascal];
    flags[key] = value == null ? null : asBoolean(value);
  }
  return flags;
};
export const formatPurchasedModules = (record) =>
  [["CMS", record.includesCms], ["Lab", record.includesLab], ["Pharmacy", record.includesPharmacy]]
    .map(([label, enabled]) => label + ": " + (enabled == null ? "Unknown" : enabled ? "Yes" : "No")).join(" / ");
export const normalizeClinicSubscription = (subscription = {}, plans = []) => {
  const planId = subscription.subscriptionPlanId ?? subscription.SubscriptionPlanId ?? subscription.planId;
  const catalogPlan = (Array.isArray(plans) ? plans : []).find((item) => String(item.id) === String(planId));
  const embeddedPlan = subscription.plan || subscription.subscriptionPlan || subscription.SubscriptionPlan;
  const plan = normalizeSubscriptionPlan({ ...(catalogPlan?.raw || {}), ...(embeddedPlan || {}) });
  const durationMonths = optionalNumber(subscription.durationMonths ?? subscription.DurationMonths ?? subscription.months ?? (embeddedPlan || catalogPlan ? plan.durationMonths : null));
  const labValue = subscription.includesLab ?? subscription.IncludesLab ?? (embeddedPlan || catalogPlan ? plan.includesLab : null);
  const includesLab = labValue == null ? null : asBoolean(labValue);
  const startDate = dateOnly(subscription.startDate ?? subscription.StartDate ?? subscription.createdAt);
  const amount = optionalNumber(subscription.amount ?? subscription.Amount ?? subscription.price ?? subscription.Price ?? (embeddedPlan || catalogPlan ? plan.price : null));
  return {
    id: subscription.id ?? subscription.clinicSubscriptionId ?? subscription.ClinicSubscriptionId ?? subscription.hospitalId ?? subscription.HospitalId,
    hospitalId: subscription.hospitalId ?? subscription.HospitalId ?? subscription.clinicId ?? subscription.ClinicId ?? "",
    adminId: subscription.adminId ?? subscription.AdminId ?? "",
    adminEmail: subscription.adminEmail ?? subscription.AdminEmail ?? subscription.email ?? "",
    adminName: subscription.adminName ?? subscription.AdminName ?? subscription.admin?.name ?? subscription.name ?? "",
    clinicName: subscription.clinicName ?? subscription.ClinicName ?? subscription.hospitalName ?? subscription.HospitalName ?? "",
    planId: planId ?? plan.id,
    subscriptionPlanId: planId ?? plan.id,
    planName: subscription.planName ?? subscription.PlanName ?? (embeddedPlan || catalogPlan ? plan.name : ""),
    status: subscription.status ?? subscription.Status ?? "",
    billingCycle: subscription.billingCycle ?? subscription.BillingCycle ?? getBillingCycle(durationMonths),
    startDate,
    renewalDate: dateOnly(subscription.expiryDate ?? subscription.ExpiryDate ?? subscription.endDate ?? subscription.EndDate ?? subscription.renewalDate ?? subscription.RenewalDate ?? subscription.subscriptionEndDate ?? subscription.SubscriptionEndDate),
    months: durationMonths, durationMonths,
    ...readPurchasedEntitlements(subscription, embeddedPlan || catalogPlan?.raw || {}),
    includesLab,
    subscriptionType: includesLab == null ? "-" : includesLab ? "With Lab" : "Without Lab",
    modules: includesLab == null ? [] : sanitizeModulesForLabAccess(CMS_MODULES.map((item) => item.key), includesLab),
    amount,
    paidAmount: optionalNumber(subscription.paidAmount ?? subscription.PaidAmount ?? subscription.amountPaid ?? subscription.AmountPaid),
    paymentStatus: subscription.paymentStatus ?? subscription.PaymentStatus ?? "",
    paymentReference: subscription.paymentReference ?? subscription.PaymentReference ?? subscription.transactionId ?? subscription.TransactionId ?? "",
    lastPaymentDate: dateOnly(subscription.lastPaymentDate ?? subscription.LastPaymentDate ?? subscription.paymentDate),
    raw: subscription,
  };
};
export const readSubscriptionPlans=()=>readStoredJson(SUBSCRIPTION_PLANS_STORAGE_KEY,[]).map(normalizeSubscriptionPlan);
export const saveSubscriptionPlans=(items)=>writeStoredJson(SUBSCRIPTION_PLANS_STORAGE_KEY,items.map(normalizeSubscriptionPlan));
export const readLandingSubscriptionRequests=()=>readStoredJson(LANDING_SUBSCRIPTION_REQUESTS_KEY,[]);
export const saveLandingSubscriptionRequest=(request)=>{const current=readLandingSubscriptionRequests();const record={id:"landing-"+Date.now(),source:"Landing page",createdAt:new Date().toISOString(),status:"Pending",paymentStatus:request.paymentConfirmed?"Confirmation submitted":"Pending confirmation",paymentMethod:request.paymentMethod||"",paymentReference:"",paidAmount:0,adminName:request.customer?.name||"",adminEmail:request.customer?.email||"",phone:request.customer?.phone||"",address:request.customer?.address||"",subscriptionPlanId:request.plan?.id||"",planId:request.plan?.id||"",planName:request.plan?.name||"",planType:request.plan?.planType||"",includesLab:Boolean(request.plan?.includesLab),durationMonths:request.plan?.durationMonths||1,billingCycle:getBillingCycle(request.plan?.durationMonths),amount:Number(request.plan?.price||0),lastPaymentDate:request.paymentConfirmed?todayIso():""};writeStoredJson(LANDING_SUBSCRIPTION_REQUESTS_KEY,[record,...current.filter((item)=>String(item.adminEmail).toLowerCase()!==String(record.adminEmail).toLowerCase())]);return record};
export const readSubscriptions=()=>[];
export const saveSubscriptions=(items)=>writeStoredJson(SUBSCRIPTIONS_STORAGE_KEY,items.map(normalizeClinicSubscription));
export const readSubscriptionTransactions=()=>[];
export const saveSubscriptionTransactions=(items)=>writeStoredJson(SUBSCRIPTION_TX_STORAGE_KEY,items);
export const calculateSubscriptionAmount = (planId, moduleKeys = [], months = 1, plans = []) => {
  const plan = plans.find((item) => String(item.id) === String(planId) || String(item.subscriptionPlanId) === String(planId));
  return plan ? Number(plan.price ?? plan.basePrice ?? 0) : 0;
};
export const fetchSubscriptionPlans=async()=>{let response;try{response=await requestJson(API_ENDPOINTS.subscriptions.publicPlans,{skipAuth:true})}catch(publicError){response=await requestJson(API_ENDPOINTS.subscriptions.publicPlans)}const plans=parseList(response).map(normalizeSubscriptionPlan);saveSubscriptionPlans(plans);return plans};
export const fetchSubscriptionPaymentMethods=async()=>{
  const response=unwrap(await requestJson(API_ENDPOINTS.subscriptions.paymentMethods,{skipAuth:true}));
  const methods=parseList(response).map((method)=>({
    code:String(method.code??method.Code??method.id??method.Id??"").trim(),
    name:String(method.name??method.Name??method.label??method.Label??method.code??method.Code??"").trim(),
    enabled:asBoolean(method.enabled??method.Enabled??true),
    liveProcessingAvailable:asBoolean(method.liveProcessingAvailable??method.LiveProcessingAvailable??false),
  })).filter((method)=>method.code&&method.enabled);
  return {
    gatewayConfigured:asBoolean(response?.gatewayConfigured??response?.GatewayConfigured??false),
    methods,
  };
};
export const fetchAdminSubscriptionPlans=async()=>{
  const response=unwrap(await requestJson(API_ENDPOINTS.subscriptions.adminPlans));
  return parseList(response).map(normalizeSubscriptionPlan);
};
export const createAdminSubscriptionPlan=async(plan)=>{
  const durationMonths=Number(plan.durationMonths||plan.months);
  const price=Number(plan.price);
  if(!BILLING_CYCLES.some((cycle)=>cycle.months===durationMonths)||!Number.isFinite(price)||price<0){
    throw new Error("Enter a valid cycle and price.");
  }
  const payload={
    name:String(plan.name||"").trim(),
    planType:SUBSCRIPTION_PLAN_TYPES.includes(plan.planType)?plan.planType:"Basic",
    durationMonths,
    includesCms:true,
    includesLab:asBoolean(plan.includesLab),
    includesPharmacy:asBoolean(plan.includesPharmacy),
    price,
    isActive:plan.isActive!==false,
  };
  if(!payload.name)throw new Error("Enter a plan name.");
  const result=unwrap(await requestJson(API_ENDPOINTS.subscriptions.adminPlans,{method:"POST",body:payload}));
  return result&&typeof result==="object"?normalizeSubscriptionPlan(result):normalizeSubscriptionPlan(payload);
};
export const updateAdminSubscriptionPlanPrice=async(id,{price,isActive}={})=>{
  if(id==null||String(id).trim()==="")throw new Error("A subscription plan ID is required.");
  const numericPrice=Number(price);
  if(!Number.isFinite(numericPrice)||numericPrice<0)throw new Error("Enter a valid plan price.");
  const path=API_ENDPOINTS.subscriptions.adminPlanPrice.replace("{id}",encodeURIComponent(id));
  const body={price:numericPrice};
  if(typeof isActive==="boolean")body.isActive=isActive;
  const result=unwrap(await requestJson(path,{method:"PUT",body}));
  return result&&typeof result==="object"?normalizeSubscriptionPlan(result):{id:String(id),price:numericPrice};
};
export const updateAdminSubscriptionPlan=async(id,plan)=>{
  if(id==null||String(id).trim()==="")throw new Error("A subscription plan ID is required.");
  const durationMonths=Number(plan.durationMonths||plan.months);
  const price=Number(plan.price);
  if(!BILLING_CYCLES.some((cycle)=>cycle.months===durationMonths)||!Number.isFinite(price)||price<0){
    throw new Error("Enter a valid cycle and price.");
  }
  const payload={
    name:String(plan.name||"").trim(),
    planType:SUBSCRIPTION_PLAN_TYPES.includes(plan.planType)?plan.planType:"Basic",
    durationMonths,
    includesCms:true,
    includesLab:asBoolean(plan.includesLab),
    includesPharmacy:asBoolean(plan.includesPharmacy),
    price,
    isActive:plan.isActive!==false,
  };
  if(!payload.name)throw new Error("Enter a plan name.");
  const path=API_ENDPOINTS.subscriptions.adminPlanById.replace("{id}",encodeURIComponent(id));
  const result=unwrap(await requestJson(path,{method:"PUT",body:payload}));
  return result&&typeof result==="object"?normalizeSubscriptionPlan(result):normalizeSubscriptionPlan({...payload,id});
};
export const createSubscriptionCheckout=async({name,email,mobileNumber,subscriptionPlanId,paymentMethod})=>{
  const payload={
    name:String(name||"").trim(),
    email:String(email||"").trim(),
    mobileNumber:String(mobileNumber||"").trim(),
    subscriptionPlanId:Number(subscriptionPlanId),
    paymentMethod:String(paymentMethod||"").trim(),
  };
  if(!payload.name||!payload.email||!payload.mobileNumber||!Number.isInteger(payload.subscriptionPlanId)||payload.subscriptionPlanId<1||!payload.paymentMethod){
    throw new Error("Enter valid customer details, select a plan, and choose a payment method.");
  }
  return unwrap(await requestJson(API_ENDPOINTS.subscriptions.checkout,{method:"POST",body:payload,skipAuth:true}));
};
export const getSubscriptionPurchaseId=(purchase)=>{
  const value=purchase?.purchaseId??purchase?.PurchaseId??purchase?.purchaseID??purchase?.PurchaseID??purchase?.subscriptionPurchaseId??purchase?.SubscriptionPurchaseId??purchase?.purchase?.purchaseId??purchase?.purchase?.id??purchase?.Purchase?.PurchaseId??purchase?.Purchase?.Id??purchase?.id??purchase?.Id??purchase?.data?.purchaseId??purchase?.data?.PurchaseId??purchase?.data?.subscriptionPurchaseId??purchase?.data?.id??purchase?.data?.Id;
  return value==null||String(value).trim()===""?"":String(value);
};
export const getDemoCheckoutToken=(purchase)=>{
  const value=purchase?.demoToken??purchase?.DemoToken??purchase?.signedCheckoutToken??purchase?.SignedCheckoutToken??purchase?.signedToken??purchase?.SignedToken??purchase?.checkoutToken??purchase?.CheckoutToken??purchase?.simulationToken??purchase?.SimulationToken??purchase?.paymentSimulationToken??purchase?.PaymentSimulationToken??purchase?.purchase?.demoToken??purchase?.purchase?.DemoToken??purchase?.purchase?.signedCheckoutToken??purchase?.purchase?.SignedCheckoutToken??purchase?.data?.demoToken??purchase?.data?.DemoToken??purchase?.data?.signedCheckoutToken??purchase?.data?.SignedCheckoutToken??purchase?.data?.signedToken??purchase?.data?.SignedToken??purchase?.data?.purchase?.demoToken;
  return value==null||String(value).trim()===""?"":String(value).trim();
};
export const initiateSubscriptionPayment=async(purchaseId,paymentMethod,{authenticated=false}={})=>{
  if(!Number.isInteger(Number(purchaseId))||Number(purchaseId)<1)throw new Error("The checkout response did not include a valid purchase ID.");
  const method=String(paymentMethod||"").trim();
  if(!method)throw new Error("Select a payment method.");
  return unwrap(await requestJson(API_ENDPOINTS.subscriptions.initiatePayment,{method:"POST",body:{purchaseId:Number(purchaseId),paymentMethod:method},skipAuth:!authenticated}));
};
export const confirmDemoSubscriptionPayment=async(purchaseId,paymentMethod,simulateResult,demoToken)=>{
  if(!Number.isInteger(Number(purchaseId))||Number(purchaseId)<1)throw new Error("The checkout response did not include a valid purchase ID.");
  const method=String(paymentMethod||"").trim();
  const result=String(simulateResult||"").trim();
  const token=String(demoToken||"").trim();
  if(!method)throw new Error("Select a payment method.");
  if(!["Success","Failed"].includes(result))throw new Error("Select Success or Failed for the demo payment result.");
  if(!token)throw new Error("The checkout did not return a signed demo payment token. No payment confirmation was sent.");
  return unwrap(await requestJson(API_ENDPOINTS.subscriptions.confirmDemoPayment,{
    method:"POST",
    body:{purchaseId:Number(purchaseId),paymentMethod:method,simulateResult:result,demoToken:token},
    skipAuth:true,
  }));
};
export const fetchPendingSubscriptionPayments=async()=>{
  const response=unwrap(await requestJson(API_ENDPOINTS.subscriptions.pendingPayments));
  const rows=Array.isArray(response?.pendingPayments)?response.pendingPayments:Array.isArray(response?.pendingPurchases)?response.pendingPurchases:parseList(response);
  return rows.map((row)=>({
    ...row,
    id:getSubscriptionPurchaseId(row),
    customerName:row.name??row.Name??row.customerName??row.CustomerName??"",
    email:row.email??row.Email??row.customerEmail??row.CustomerEmail??"",
    planName:row.planName??row.PlanName??row.subscriptionPlan?.name??row.SubscriptionPlan?.Name??row.plan?.name??row.Plan?.Name??"",
    amount:optionalNumber(row.amount??row.Amount??row.price??row.Price),
    paymentMethod:row.paymentMethod??row.PaymentMethod??"",
    paymentStatus:row.paymentStatus??row.PaymentStatus??row.payment?.status??row.Payment?.Status??row.status??row.Status??"",
    paymentAttempts:row.paymentAttempts??row.PaymentAttempts??row.attempts??row.Attempts??row.attemptCount??row.AttemptCount??[],
    ...readPurchasedEntitlements(row,row.purchasedPlan??row.subscriptionPlan??row.plan??{}),
  }));
};
export const fetchAdminDemoPurchases=async()=>{
  const response=unwrap(await requestJson(API_ENDPOINTS.subscriptions.adminDemoPurchases));
  const rows=Array.isArray(response?.demoPurchases)?response.demoPurchases:parseList(response);
  return rows.map((row)=>({
    ...row,
    id:getSubscriptionPurchaseId(row),
    customerName:row.name??row.Name??row.customerName??row.CustomerName??"",
    email:row.email??row.Email??row.customerEmail??row.CustomerEmail??"",
    planName:row.planName??row.PlanName??row.subscriptionPlan?.name??row.SubscriptionPlan?.Name??row.plan?.name??row.Plan?.Name??"",
    amount:optionalNumber(row.amount??row.Amount??row.price??row.Price),
    paymentMethod:row.paymentMethod??row.PaymentMethod??"",
    paymentStatus:row.paymentStatus??row.PaymentStatus??row.payment?.status??row.Payment?.Status??row.status??row.Status??"",
    purchaseType:row.purchaseType??row.PurchaseType??"",
    adminCreationStatus:row.adminCreationStatus??row.AdminCreationStatus??"",
    eligibleForAdminCreation:row.eligibleForAdminCreation??row.EligibleForAdminCreation??null,
    createdAt:row.createdAt??row.CreatedAt??"",
    ...readPurchasedEntitlements(row,row.purchasedPlan??row.subscriptionPlan??row.plan??{}),
  }));
};
export const fetchSubscriptionPaymentStatus=async(purchaseId)=>{
  if(!Number.isInteger(Number(purchaseId))||Number(purchaseId)<1)throw new Error("A valid purchase ID is required to check payment status.");
  const path=API_ENDPOINTS.subscriptions.paymentStatus.replace("{purchaseId}",encodeURIComponent(String(purchaseId)));
  return unwrap(await requestJson(path));
};
export const createRenewalCheckout=async({subscriptionPlanId,paymentMethod})=>{
  const planId=Number(subscriptionPlanId);
  const method=String(paymentMethod||"").trim();
  if(!Number.isInteger(planId)||planId<1||!method)throw new Error("Select a plan and payment method for renewal.");
  return unwrap(await requestJson(API_ENDPOINTS.subscriptions.renewalCheckout,{method:"POST",body:{subscriptionPlanId:planId,paymentMethod:method}}));
};
export const fetchRenewalHistory=async()=>{
  const response=unwrap(await requestJson(API_ENDPOINTS.subscriptions.renewalHistory));
  return parseList(response);
};
export const activateSubscriptionRenewal=async(purchaseId)=>{
  if(purchaseId==null||String(purchaseId).trim()==="")throw new Error("A renewal purchase ID is required.");
  const path=API_ENDPOINTS.subscriptions.activateRenewal.replace("{purchaseId}",encodeURIComponent(purchaseId));
  return unwrap(await requestJson(path,{method:"POST"}));
};
export const fetchSubscriptionRequests=async()=>{
  const response=unwrap(await requestJson(API_ENDPOINTS.subscriptions.requests));
  return parseList(response).map((request)=>({
    id:request.subscriptionRequestId??request.SubscriptionRequestId??request.id??request.Id??request.requestId??"",
    customerName:request.name??request.Name??request.customerName??request.CustomerName??request.adminName??request.AdminName??request.fullName??"",
    email:request.email??request.Email??request.customerEmail??request.CustomerEmail??request.adminEmail??request.AdminEmail??"",
    clinicName:request.clinicName??request.ClinicName??request.hospitalName??request.HospitalName??request.clinic?.name??request.Clinic?.Name??"",
    planName:request.planName??request.PlanName??request.plan?.name??request.Plan?.Name??"",
    amount:optionalNumber(request.amount??request.Amount??request.price??request.Price),
    paymentStatus:request.paymentStatus??request.PaymentStatus??request.payment?.status??request.Payment?.Status??"",
    status:request.status??request.Status??"",
    ...readPurchasedEntitlements(request, request.purchasedPlan ?? request.subscriptionPlan ?? request.plan ?? {}),
    durationMonths:optionalNumber(request.durationMonths??request.DurationMonths),
    raw:request,
  }));
};
export const fetchPendingAdminCreations = async () => {
  const response = unwrap(await requestJson(API_ENDPOINTS.superAdmin.pendingAdminCreations));
  const rows = Array.isArray(response?.pendingAdminCreations) ? response.pendingAdminCreations : parseList(response);
  return rows.map((row) => ({ ...row, id: getSubscriptionPurchaseId(row),
    eligibleForAdminCreation: row.eligibleForAdminCreation ?? row.EligibleForAdminCreation ?? true,
    ...readPurchasedEntitlements(row, row.purchasedPlan ?? row.subscriptionPlan ?? row.plan ?? {}) }));
};
export const fetchPendingAdminCreation = async (id) => {
  const path = subscriptionRequestActionPath(API_ENDPOINTS.superAdmin.pendingAdminCreation, id);
  return unwrap(await requestJson(path));
};
export const createAdminFromPurchase = async (id) => {
  const path = subscriptionRequestActionPath(API_ENDPOINTS.superAdmin.createAdminFromPurchase, id);
  return unwrap(await requestJson(path, { method: "POST" }));
};
export const fetchSubscriptionRequest=async(id)=>{
  if(id==null||String(id).trim()==="")throw new Error("A subscription request ID is required.");
  const path=API_ENDPOINTS.subscriptions.requestById.replace("{id}",encodeURIComponent(id));
  return unwrap(await requestJson(path));
};
const subscriptionRequestActionPath=(template,id)=>{
  if(id==null||String(id).trim()==="")throw new Error("A subscription request ID is required.");
  return template.replace("{id}",encodeURIComponent(id));
};
export const saveSubscriptionPlan = async (plan, id) => {
  const durationMonths = Number(plan.durationMonths || plan.months);
  const price = Number(plan.price);
  if (!BILLING_CYCLES.some((cycle) => cycle.months === durationMonths) || !Number.isFinite(price) || price < 0) throw new Error("Enter a valid cycle and price.");
  const planType = SUBSCRIPTION_PLAN_TYPES.includes(plan.planType) ? plan.planType : "Basic";
  const name = String(plan.name || "").trim();
  if (!name) throw new Error("Enter a plan name.");
  const payload = { name, planType, durationMonths, billingCycle: getBillingCycle(durationMonths), includesCms: true, includesLab: asBoolean(plan.includesLab), includesPharmacy: asBoolean(plan.includesPharmacy), price, isActive: plan.isActive !== false };
  const path = id ? API_ENDPOINTS.subscriptions.planById.replace("{id}", encodeURIComponent(id)) : API_ENDPOINTS.subscriptions.plans;
  const result = unwrap(await requestJson(path, { method: id ? "PUT" : "POST", body: payload }));
  const saved = result && typeof result === "object" ? normalizeSubscriptionPlan(result) : normalizeSubscriptionPlan({ ...payload, id });
  if (saved?.id) saveSubscriptionPlans([saved, ...readSubscriptionPlans().filter((item) => String(item.id) !== String(saved.id))]);
  return saved;
};
export const fetchAllSubscriptions = async () => {
  const [response, plans] = await Promise.all([requestJson(API_ENDPOINTS.subscriptions.all), fetchSubscriptionPlans()]);
  return [...parseList(response).map((item) => normalizeClinicSubscription(item, plans)), ...readLandingSubscriptionRequests()];
};
export const fetchAdminSubscriptions = async () => {
  const [response, plans] = await Promise.all([
    requestJson(API_ENDPOINTS.subscriptions.all),
    fetchAdminSubscriptionPlans(),
  ]);
  return parseList(response).map((item) => normalizeClinicSubscription(item, plans));
};
export const fetchMySubscription = async () => {
  let response;
  try { response = unwrap(await requestJson(API_ENDPOINTS.subscriptions.my)); } catch (error) {
    const email = sessionStorage.getItem("adminEmail") || localStorage.getItem("adminEmail") || sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail") || "";
    const pending = readLandingSubscriptionRequests().find((item) => String(item.adminEmail).toLowerCase() === String(email).toLowerCase());
    if (pending) return pending;
    throw error;
  }
  if (!response || typeof response !== "object" || Array.isArray(response) || !Object.keys(response).length) return null;
  const subscription = normalizeClinicSubscription(response);
  const hasDetails = subscription.durationMonths != null && subscription.includesLab != null && subscription.amount != null && subscription.planName;
  if (hasDetails || response.plan || response.subscriptionPlan || response.SubscriptionPlan) return subscription;
  // Older APIs may return only a plan ID. Catalogue access must not block clinic details.
  try { return normalizeClinicSubscription(response, await fetchSubscriptionPlans()); }
  catch (error) {
    if (error.status === 403) return subscription;
    throw error;
  }
};
export const fetchClinicSubscription = async (hospitalId = getStoredHospitalId()) => {
  if (!hospitalId) throw new Error("Clinic ID is missing. Set up or sign in to the clinic before loading its subscription.");
  const path = API_ENDPOINTS.subscriptions.clinicByHospitalId.replace("{hospitalId}", encodeURIComponent(hospitalId));
  let response = unwrap(await requestJson(path));
  response = response?.clinicSubscription ?? response?.ClinicSubscription ?? response?.subscription ?? response?.Subscription ?? response;
  if (!response || typeof response !== "object" || Array.isArray(response) || !Object.keys(response).length) return null;
  const subscription = normalizeClinicSubscription(response);
  const hasDetails = subscription.durationMonths != null && subscription.includesLab != null && subscription.amount != null && subscription.planName;
  if (hasDetails || response.plan || response.subscriptionPlan || response.SubscriptionPlan) return subscription;
  // Older APIs may return only a plan ID. Catalogue access must not block clinic details.
  try { return normalizeClinicSubscription(response, await fetchSubscriptionPlans()); }
  catch (error) {
    if (error.status === 403) return subscription;
    throw error;
  }
};

export const assignSubscriptionToClinic = async ({ hospitalId, subscriptionPlanId, startDate, paidAmount, paymentReference, paymentDate }) => {
  const payload = { hospitalId: Number(hospitalId) || hospitalId, subscriptionPlanId: Number(subscriptionPlanId) || subscriptionPlanId, ...(startDate ? { startDate } : {}), ...(paidAmount != null ? { paidAmount: Number(paidAmount) } : {}), ...(paymentReference ? { paymentReference } : {}), ...(paymentDate ? { paymentDate } : {}) };
  return unwrap(await requestJson(API_ENDPOINTS.subscriptions.assign, { method: "POST", body: payload }));
};
export const buildDefaultSubscription=()=>null;
export const upsertSubscription=(subscription)=>{const current=readSubscriptions();const key=String(subscription.hospitalId||subscription.adminEmail||subscription.adminId||"").toLowerCase();const next=current.filter((item)=>String(item.hospitalId||item.adminEmail||item.adminId||"").toLowerCase()!==key);const saved=normalizeClinicSubscription(subscription);saveSubscriptions([saved,...next]);saveSubscriptionTransactions([{id:"txn-"+Date.now(),type:subscription.transactionType||"Subscription",adminEmail:saved.adminEmail,adminName:saved.adminName,clinicName:saved.clinicName,planName:saved.planName,modules:saved.modules,amount:saved.amount,date:todayIso(),status:saved.status},...readSubscriptionTransactions()]);return saved};

export const getSubscriptionForAdmin=()=>null;
export const seedSubscriptionsForAdmins=()=>[];
