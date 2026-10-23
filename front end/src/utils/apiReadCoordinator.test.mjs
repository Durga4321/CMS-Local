import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiReadCoordinator } from './apiReadCoordinator.mjs';
const base = 'https://cms.test';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };

test('concurrent identical reads share transport but have separately readable bodies', async () => {
  let count = 0; const gate = deferred();
  const read = createApiReadCoordinator(() => { count++; return gate.promise; }, base);
  const a = read('/api/Patient', {headers:{Authorization:'Bearer A'}});
  const b = read('/api/Patient', {headers:{authorization:'Bearer A'}});
  await Promise.resolve(); assert.equal(count,1);
  gate.resolve(new Response('{"id":1}'));
  assert.deepEqual(await (await a).json(), {id:1});
  assert.deepEqual(await (await b).json(), {id:1});
  await read('/api/Patient', {headers:{Authorization:'Bearer A'}});
  assert.equal(count,2); // Refresh after completion still goes to the server.
});
test('different authorization, query filters and credentials remain independent', async () => {
  let count=0;
  const read=createApiReadCoordinator(async () => {count++; return new Response('ok');},base);
  await Promise.all([
    read('/api/Patient?branchId=1',{headers:{Authorization:'A'}}),
    read('/api/Patient?branchId=1',{headers:{Authorization:'B'}}),
    read('/api/Patient?branchId=2',{headers:{Authorization:'A'}}),
    read('/api/Patient?branchId=1',{headers:{Authorization:'A'},credentials:'omit'}),
  ]); assert.equal(count,4);
});
test('reads after mutation never share a read started before it', async () => {
  const gate=deferred(); let reads=0; let writes=0;
  const read=createApiReadCoordinator((url,init) => {
    if(init.method==='PATCH'){writes++;return Promise.resolve(new Response('saved'));}
    reads++; return reads===1 ? gate.promise : Promise.resolve(new Response('Paid'));
  },base);
  const old=read('/api/Billing/17'); await Promise.resolve();
  await read('/api/Billing/17/payment',{method:'PATCH',body:'{}'});
  assert.equal(await (await read('/api/Billing/17')).text(),'Paid');
  gate.resolve(new Response('Pending')); await old;
  assert.equal(reads,2); assert.equal(writes,1);
});
test('failures propagate and retries start another request',async()=>{
  let count=0;
  const read=createApiReadCoordinator(async()=>{count++;throw new Error('offline');},base);
  const result=await Promise.allSettled([read('/api/Lab/orders'),read('/api/Lab/orders')]);
  assert.equal(count,1); assert.ok(result.every(x=>x.status==='rejected'));
  await assert.rejects(read('/api/Lab/orders'),/offline/); assert.equal(count,2);
});
test('cancellable reads, explicit reloads and non API resources are independent',async()=>{
  let count=0; const read=createApiReadCoordinator(async()=>{count++;return new Response('ok');},base);
  const controller=new AbortController();
  await Promise.all([
    read('/api/Patient',{signal:controller.signal}),read('/api/Patient',{signal:controller.signal}),
    read('/api/Patient',{cache:'reload'}),read('/api/Patient',{cache:'reload'}),
    read('/logo.png'),read('/logo.png'),
  ]);assert.equal(count,6);
});
test('HTTP failures are delivered unchanged to every consumer',async()=>{
  let count=0; const read=createApiReadCoordinator(async()=>{count++;return new Response('Forbidden',{status:403});},base);
  const responses=await Promise.all([read('/api/Billing'),read('/api/Billing')]);
  assert.equal(count,1); for(const r of responses){assert.equal(r.status,403);assert.equal(await r.text(),'Forbidden');}
});

test('a read started during a save is not reused after the save finishes',async()=>{
  const write=deferred(); const during=deferred(); let reads=0;
  const read=createApiReadCoordinator((url,init)=>{
    if(init.method==='POST')return write.promise;
    reads++; return reads===1 ? during.promise : Promise.resolve(new Response('fresh'));
  },base);
  const save=read('/api/Billing/pharmacy',{method:'POST',body:'{}'});
  const old=read('/api/Billing/pharmacy'); await Promise.resolve();
  write.resolve(new Response('saved')); await save;
  assert.equal(await (await read('/api/Billing/pharmacy')).text(),'fresh');
  during.resolve(new Response('old')); await old; assert.equal(reads,2);
});
test('writes are never deduplicated and preserve their payloads',async()=>{
  const payloads=[];
  const read=createApiReadCoordinator(async(url,init)=>{payloads.push(init.body);return new Response('ok');},base);
  await Promise.all([read('/api/Lab/orders/1/complete',{method:'PATCH',body:'first'}),read('/api/Lab/orders/1/complete',{method:'PATCH',body:'second'})]);
  assert.deepEqual(payloads,['first','second']);
});
